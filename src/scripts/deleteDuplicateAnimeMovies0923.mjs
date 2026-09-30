import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
nextEnv.loadEnvConfig(resolve(here, '..', '..'))
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const apply = process.argv.includes('--apply')
const slugs = [
  'revue-starlight-movie',
  'sekaiichi-hatsukoi-proposal-movie',
  'sekaiichi-hatsukoi-yokozawa-movie',
  'hakuoki-kyoto-ranbu-movie',
  'hakuoki-shikon-sokyu-movie',
  'fate-stay-night-ubw-2010-movie',
  'sasaki-miyano-graduation-movie',
  'sailor-moon-cosmos-movie',
  'sailor-moon-eternal-movie',
  'seven-deadly-sins-cursed-by-light-movie',
]

async function fetchAll() {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('tags').select('*').order('name').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

const before = await fetchAll()
const targets = before.filter((row) => slugs.includes(row.slug))
if (targets.length !== slugs.length) throw new Error(`Safety stop: found ${targets.length}/${slugs.length} targets`)
if (targets.some((row) => row.ip_type !== '영화')) throw new Error('Safety stop: a target is no longer movie-only')

const outputDir = resolve(here, 'work-enrichment-output')
await mkdir(outputDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = resolve(outputDir, `pre-duplicate-anime-movie-delete-${stamp}.json`)
const reportPath = resolve(outputDir, `duplicate-anime-movie-delete-${stamp}.json`)
await writeFile(backupPath, JSON.stringify(before, null, 2), 'utf8')

if (!apply) {
  await writeFile(reportPath, JSON.stringify({ mode: 'dry-run', before: before.length, targets }, null, 2), 'utf8')
  console.log(JSON.stringify({ mode: 'dry-run', before: before.length, deletes: targets.length, afterExpected: before.length - targets.length, names: targets.map((row) => row.name), backupPath, reportPath }, null, 2))
  process.exit(0)
}

const { data: deleted, error } = await supabase.from('tags').delete().in('slug', slugs).select('id,name,slug')
if (error) throw error
if (deleted.length !== slugs.length) throw new Error(`Delete returned ${deleted.length}, expected ${slugs.length}`)
const after = await fetchAll()
const remainingSlugs = new Set(after.map((row) => row.slug))
const failed = slugs.filter((slug) => remainingSlugs.has(slug))
if (after.length !== before.length - slugs.length || failed.length) throw new Error(`Post-check failed: before=${before.length}, after=${after.length}, failed=${failed.join(',')}`)
await writeFile(reportPath, JSON.stringify({ mode: 'apply', before: before.length, after: after.length, deleted, failed, backupPath }, null, 2), 'utf8')
console.log(JSON.stringify({ mode: 'apply', before: before.length, deleted: deleted.length, after: after.length, failed: 0, names: deleted.map((row) => row.name), backupPath, reportPath }, null, 2))
