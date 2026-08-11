import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..', '..')
const candidateDir = resolve(here, 'work-candidate-review-6')
const outputDir = resolve(here, 'work-enrichment-output')
nextEnv.loadEnvConfig(projectRoot)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  return value
}
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

const batchFiles = (await readdir(candidateDir)).filter((name) => /^batch-\d{3}\.json$/.test(name)).sort()
const candidates = []
for (const file of batchFiles) candidates.push(...JSON.parse(await readFile(resolve(candidateDir, file), 'utf8')))
const backupFiles = (await readdir(outputDir)).filter((name) => /^pre-candidate-6-insert-.*\.json$/.test(name)).sort()
const backupFile = backupFiles.at(-1)
if (!backupFile) throw new Error('Candidate 6 backup not found')
const before = JSON.parse(await readFile(resolve(outputDir, backupFile), 'utf8'))
const { data: after, error } = await supabase.from('tags').select('*').order('name')
if (error) throw error

const candidateSlugs = new Set(candidates.map((row) => row.slug))
const afterById = new Map(after.map((row) => [row.id, row]))
const afterBySlug = new Map(after.map((row) => [row.slug, row]))
const existingChanged = before.filter((row) => !same(row, afterById.get(row.id))).map((row) => row.slug)
const failed = candidates.filter((candidate) => {
  const actual = afterBySlug.get(candidate.slug)
  const expected = {
    name: candidate.name.trim(), slug: candidate.slug.trim(), english_name: candidate.englishName?.trim() || null,
    aliases: candidate.aliases ?? [], ip_type: candidate.ipType.join(','), description: candidate.description.trim(),
    genres: candidate.genres ?? [], keywords: [], official_url: candidate.officialUrl || null,
    links: candidate.officialUrl ? [{ label: '공식 사이트', url: candidate.officialUrl }] : [], created_by: null,
  }
  return !actual || Object.entries(expected).some(([key, value]) => !same(value, actual[key]))
}).map((row) => row.slug)

const result = {
  before: before.length,
  after: after.length,
  insertedFound: [...candidateSlugs].filter((slug) => afterBySlug.has(slug)).length,
  existingChanged,
  insertedFailed: failed,
  backupFile,
}
console.log(JSON.stringify(result, null, 2))
if (before.length !== 839 || after.length !== 939 || result.insertedFound !== 100 || existingChanged.length || failed.length) process.exitCode = 1
