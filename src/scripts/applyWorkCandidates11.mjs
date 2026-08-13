import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..', '..')
const candidateDir = resolve(here, 'work-candidate-review-11')
const outputDir = resolve(here, 'work-enrichment-output')
const apply = process.argv.includes('--apply')

nextEnv.loadEnvConfig(projectRoot)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase server environment variables are missing')
const supabase = createClient(url, key, { auth: { persistSession: false } })

const norm = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, '').trim()
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  return value
}
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

async function fetchAllTags() {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('tags').select('*').order('name').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

async function loadCandidates() {
  const files = (await readdir(candidateDir)).filter((name) => /^batch-\d{3}\.json$/.test(name)).sort()
  const candidates = []
  for (const file of files) candidates.push(...JSON.parse(await readFile(resolve(candidateDir, file), 'utf8')))
  return { files, candidates }
}

function toInsertRow(candidate) {
  return {
    name: candidate.name.trim(),
    slug: candidate.slug.trim(),
    english_name: candidate.englishName?.trim() || null,
    aliases: candidate.aliases ?? [],
    ip_type: candidate.ipType.join(','),
    description: candidate.description.trim(),
    genres: candidate.genres ?? [],
    keywords: [],
    official_url: candidate.officialUrl || null,
    links: candidate.officialUrl ? [{ label: '공식 사이트', url: candidate.officialUrl }] : [],
    created_by: null,
  }
}

async function main() {
  const { files, candidates } = await loadCandidates()
  if (files.length !== 10 || candidates.length !== 100) throw new Error(`Safety stop: expected 10 files/100 candidates, got ${files.length}/${candidates.length}`)
  if (new Set(candidates.map((row) => row.slug)).size !== 100) throw new Error('Safety stop: duplicate candidate slugs')
  if (new Set(candidates.map((row) => row.name)).size !== 100) throw new Error('Safety stop: duplicate candidate names')

  const before = await fetchAllTags()
  if (before.length !== 1380) throw new Error(`Safety stop: DB has ${before.length} rows, expected 1380`)

  const slugSet = new Set(before.map((row) => row.slug))
  const existingNames = new Map()
  for (const row of before) for (const value of [row.name, row.english_name, ...(row.aliases ?? [])]) {
    const key = norm(value)
    if (key) existingNames.set(key, row.name)
  }
  const conflicts = []
  for (const candidate of candidates) {
    if (slugSet.has(candidate.slug)) conflicts.push(`${candidate.name}: slug=${candidate.slug}`)
    for (const value of [candidate.name, candidate.englishName, ...(candidate.aliases ?? [])]) {
      const hit = existingNames.get(norm(value))
      if (hit) conflicts.push(`${candidate.name}: ${value} -> ${hit}`)
    }
  }
  if (conflicts.length) throw new Error(`Safety stop: live DB conflicts\n${[...new Set(conflicts)].join('\n')}`)

  const rows = candidates.map(toInsertRow)
  await mkdir(outputDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = resolve(outputDir, `pre-candidate-11-insert-${stamp}.json`)
  const reportPath = resolve(outputDir, `candidate-11-insert-${stamp}.json`)
  await writeFile(backupPath, JSON.stringify(before, null, 2), 'utf8')

  if (!apply) {
    await writeFile(reportPath, JSON.stringify({ mode: 'dry-run', before: before.length, rows }, null, 2), 'utf8')
    console.log(JSON.stringify({ mode: 'dry-run', before: before.length, inserts: rows.length, afterExpected: 1480, conflicts: 0, backupPath, reportPath }, null, 2))
    return
  }

  const { data: inserted, error: insertError } = await supabase.from('tags').insert(rows).select('*')
  if (insertError) throw insertError
  if (inserted.length !== 100) throw new Error(`Insert returned ${inserted.length}, expected 100`)

  const after = await fetchAllTags()
  const afterById = new Map(after.map((row) => [row.id, row]))
  const existingChanged = before.filter((row) => !same(row, afterById.get(row.id))).map((row) => row.slug)
  const insertedBySlug = new Map(inserted.map((row) => [row.slug, row]))
  const failed = rows.filter((expected) => {
    const actual = insertedBySlug.get(expected.slug)
    return !actual || actual.name !== expected.name || actual.english_name !== expected.english_name || actual.ip_type !== expected.ip_type ||
      actual.description !== expected.description || !same(actual.aliases ?? [], expected.aliases) || !same(actual.genres ?? [], expected.genres) ||
      actual.official_url !== expected.official_url || !same(actual.links ?? [], expected.links)
  }).map((row) => row.slug)
  if (after.length !== 1480 || existingChanged.length || failed.length) throw new Error(`Post-check failed: after=${after.length}, existingChanged=${existingChanged.length}, insertedFailed=${failed.length}`)

  await writeFile(reportPath, JSON.stringify({ mode: 'apply', before: before.length, inserted: inserted.length, after: after.length, existingChanged, failed, backupPath, insertedRows: inserted }, null, 2), 'utf8')
  console.log(JSON.stringify({ mode: 'apply', before: before.length, inserted: inserted.length, after: after.length, existingChanged: 0, failed: 0, backupPath, reportPath }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
