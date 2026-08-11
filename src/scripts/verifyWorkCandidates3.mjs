import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..', '..')
const candidateDir = resolve(here, 'work-candidate-review-3')
const outputDir = resolve(here, 'work-enrichment-output')
nextEnv.loadEnvConfig(projectRoot)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase server environment variables are missing')
const supabase = createClient(url, key, { auth: { persistSession: false } })
const same = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
const cleanLinks = (links) => (links ?? []).map(({ label, url }) => ({ label, url }))

async function main() {
  const batchFiles = (await readdir(candidateDir)).filter((name) => /^batch-\d{3}\.json$/.test(name)).sort()
  const candidates = []
  for (const file of batchFiles) candidates.push(...JSON.parse(await readFile(resolve(candidateDir, file), 'utf8')))
  const backupFiles = (await readdir(outputDir)).filter((name) => /^pre-candidate-3-insert-.*\.json$/.test(name)).sort()
  if (!backupFiles.length) throw new Error('No third-set pre-insert backup found')
  const baselinePath = resolve(outputDir, backupFiles.at(-1))
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'))
  const { data: current, error } = await supabase.from('tags').select('*')
  if (error) throw error
  const currentById = new Map(current.map((row) => [row.id, row]))
  const currentBySlug = new Map(current.map((row) => [row.slug, row]))
  const existingChanged = baseline.filter((row) => JSON.stringify(row) !== JSON.stringify(currentById.get(row.id))).map((row) => row.slug)
  const missing = []
  const mismatches = []
  for (const candidate of candidates) {
    const row = currentBySlug.get(candidate.slug)
    if (!row) { missing.push(candidate.slug); continue }
    const expected = {
      name: candidate.name, english_name: candidate.englishName || null, aliases: candidate.aliases ?? [],
      ip_type: candidate.ipType.join(','), description: candidate.description, genres: candidate.genres ?? [],
      official_url: candidate.officialUrl || null,
      links: candidate.officialUrl ? [{ label: '공식 사이트', url: candidate.officialUrl }] : [],
    }
    const fields = []
    if (row.name !== expected.name) fields.push('name')
    if (row.english_name !== expected.english_name) fields.push('english_name')
    if (!same(row.aliases, expected.aliases)) fields.push('aliases')
    if (row.ip_type !== expected.ip_type) fields.push('ip_type')
    if (row.description !== expected.description) fields.push('description')
    if (!same(row.genres, expected.genres)) fields.push('genres')
    if (row.official_url !== expected.official_url) fields.push('official_url')
    if (!same(cleanLinks(row.links), expected.links)) fields.push('links')
    if (fields.length) mismatches.push({ slug: candidate.slug, fields })
  }
  console.log(JSON.stringify({ total: current.length, baseline: baseline.length, candidates: candidates.length, existingChanged, missing, mismatchCount: mismatches.length, mismatchFields: [...new Set(mismatches.flatMap((item) => item.fields))], samples: mismatches.slice(0, 5), baselinePath }, null, 2))
  if (current.length !== 639 || baseline.length !== 539 || candidates.length !== 100 || existingChanged.length || missing.length || mismatches.length) process.exitCode = 1
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
