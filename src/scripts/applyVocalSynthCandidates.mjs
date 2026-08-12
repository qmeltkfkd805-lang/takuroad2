import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')
const outputDir = resolve(here, 'work-enrichment-output')
const apply = process.argv.includes('--apply')
nextEnv.loadEnvConfig(root)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const candidates = JSON.parse(await readFile(resolve(here, 'vocal-synth-candidates.json'), 'utf8'))
const norm = (v) => String(v ?? '').toLowerCase().replace(/\s+/g, '').trim()
const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b))

async function fetchAll() {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('tags').select('*').order('name').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

if (candidates.length !== 39) throw new Error(`Expected 39 candidates, got ${candidates.length}`)
if (candidates.some(c => c.description.length > 80)) throw new Error('Description exceeds 80 characters')
const before = await fetchAll()
if (before.length !== 1240) throw new Error(`Safety stop: expected 1240 existing rows, got ${before.length}`)
const values = new Map()
for (const row of before) for (const value of [row.name, row.english_name, ...(row.aliases ?? [])]) if (norm(value)) values.set(norm(value), row.name)
const slugs = new Set(before.map(r => r.slug))
const conflicts = []
for (const c of candidates) {
  if (slugs.has(c.slug)) conflicts.push(`${c.name}: slug ${c.slug}`)
  for (const value of [c.name, c.englishName, ...(c.aliases ?? [])]) if (values.has(norm(value))) conflicts.push(`${c.name}: ${value} -> ${values.get(norm(value))}`)
}
if (conflicts.length) throw new Error(`Live conflicts:\n${[...new Set(conflicts)].join('\n')}`)
const rows = candidates.map(c => ({
  name: c.name, slug: c.slug, english_name: c.englishName || null, aliases: c.aliases,
  ip_type: c.ipType.join(','), description: c.description, genres: c.genres, keywords: [],
  official_url: c.officialUrl || null,
  links: c.officialUrl ? [{ label: '공식 사이트', url: c.officialUrl }] : [], created_by: null,
}))
await mkdir(outputDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = resolve(outputDir, `pre-vocal-synth-insert-${stamp}.json`)
const reportPath = resolve(outputDir, `vocal-synth-insert-${stamp}.json`)
await writeFile(backupPath, JSON.stringify(before, null, 2), 'utf8')
if (!apply) {
  await writeFile(reportPath, JSON.stringify({ mode: 'dry-run', before: before.length, rows }, null, 2), 'utf8')
  console.log(JSON.stringify({ mode: 'dry-run', before: before.length, inserts: rows.length, afterExpected: 1279, conflicts: 0, backupPath, reportPath }, null, 2))
  process.exit(0)
}
const { data: inserted, error } = await supabase.from('tags').insert(rows).select('*')
if (error) throw error
const after = await fetchAll()
const afterById = new Map(after.map(r => [r.id, r]))
const existingChanged = before.filter(r => !same(r, afterById.get(r.id))).map(r => r.slug)
const insertedBySlug = new Map(inserted.map(r => [r.slug, r]))
const failed = rows.filter(expected => {
  const actual = insertedBySlug.get(expected.slug)
  return !actual || actual.name !== expected.name || actual.english_name !== expected.english_name || actual.ip_type !== expected.ip_type ||
    actual.description !== expected.description || !same(actual.aliases ?? [], expected.aliases) || !same(actual.genres ?? [], expected.genres) ||
    actual.official_url !== expected.official_url || !same(actual.links ?? [], expected.links)
}).map(r => r.slug)
if (inserted.length !== 39 || after.length !== 1279 || existingChanged.length || failed.length) throw new Error(`Post-check failed: inserted=${inserted.length}, after=${after.length}, existingChanged=${existingChanged.length}, failed=${failed.length}`)
await writeFile(reportPath, JSON.stringify({ mode: 'apply', before: before.length, inserted: inserted.length, after: after.length, existingChanged, failed, backupPath, insertedRows: inserted }, null, 2), 'utf8')
console.log(JSON.stringify({ mode: 'apply', before: before.length, inserted: inserted.length, after: after.length, existingChanged: 0, failed: 0, backupPath, reportPath }, null, 2))
