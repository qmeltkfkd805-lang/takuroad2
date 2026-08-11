import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..', '..')
const candidateDir = resolve(here, 'work-candidate-review')
const outputDir = resolve(here, 'work-enrichment-output')

nextEnv.loadEnvConfig(projectRoot)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase server environment variables are missing')
const supabase = createClient(url, key, { auth: { persistSession: false } })

const arraySame = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
const linkSame = (actual, expected) => {
  const clean = (links) => (links ?? []).map(({ label, url }) => ({ label, url })).sort((a, b) => `${a.label}${a.url}`.localeCompare(`${b.label}${b.url}`))
  return JSON.stringify(clean(actual)) === JSON.stringify(clean(expected))
}

async function main() {
  const batchFiles = (await readdir(candidateDir)).filter((name) => /^batch-\d{3}\.json$/.test(name)).sort()
  const candidates = []
  for (const file of batchFiles) candidates.push(...JSON.parse(await readFile(resolve(candidateDir, file), 'utf8')))
  const backupFiles = (await readdir(outputDir)).filter((name) => /^pre-candidate-insert-.*\.json$/.test(name)).sort()
  if (!backupFiles.length) throw new Error('No pre-insert backup found')
  const baselinePath = resolve(outputDir, backupFiles.at(-1))
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'))

  const { data: current, error } = await supabase.from('tags').select('*')
  if (error) throw error
  const currentById = new Map(current.map((row) => [row.id, row]))
  const currentBySlug = new Map(current.map((row) => [row.slug, row]))
  const existingChanged = baseline.filter((row) => JSON.stringify(row) !== JSON.stringify(currentById.get(row.id))).map((row) => row.slug)
  const missing = []
  const failed = []
  for (const candidate of candidates) {
    const row = currentBySlug.get(candidate.slug)
    if (!row) { missing.push(candidate.slug); continue }
    const expectedLinks = candidate.officialUrl ? [{ label: '공식 사이트', url: candidate.officialUrl }] : []
    if (row.name !== candidate.name || row.english_name !== (candidate.englishName || null) ||
      row.ip_type !== candidate.ipType.join(',') || row.description !== candidate.description ||
      !arraySame(row.aliases, candidate.aliases) || !arraySame(row.genres, candidate.genres) ||
      row.official_url !== (candidate.officialUrl || null) || !linkSame(row.links, expectedLinks)) {
      failed.push(candidate.slug)
    }
  }

  console.log(JSON.stringify({ total: current.length, baseline: baseline.length, candidates: candidates.length, existingChanged, missing, failed, baselinePath }, null, 2))
  if (current.length !== 439 || baseline.length !== 339 || candidates.length !== 100 || existingChanged.length || missing.length || failed.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
