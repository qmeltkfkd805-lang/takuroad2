import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..', '..')
const outputDir = resolve(here, 'work-enrichment-output')
const apply = process.argv.includes('--apply')
nextEnv.loadEnvConfig(projectRoot)

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

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
const target = before.find((row) => row.slug === 'banana-fish')
if (!target) throw new Error('Safety stop: banana-fish was not found')
if (target.name !== 'BANANA FISH' || target.ip_type !== '애니') throw new Error(`Safety stop: unexpected target state name=${target.name} ip_type=${target.ip_type}`)

await mkdir(outputDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = resolve(outputDir, `pre-banana-fish-type-update-${stamp}.json`)
await writeFile(backupPath, JSON.stringify(before, null, 2), 'utf8')

if (!apply) {
  console.log(JSON.stringify({ mode: 'dry-run', count: before.length, slug: target.slug, beforeType: target.ip_type, afterType: '애니,만화', backupPath }, null, 2))
  process.exit(0)
}

const { data, error } = await supabase.from('tags').update({ ip_type: '애니,만화' }).eq('id', target.id).select('*').single()
if (error) throw error
if (data.ip_type !== '애니,만화') throw new Error(`Post-check failed: ip_type=${data.ip_type}`)

const after = await fetchAll()
const changed = before.filter((row) => JSON.stringify(row) !== JSON.stringify(after.find((item) => item.id === row.id))).map((row) => row.slug)
if (after.length !== before.length || changed.length !== 1 || changed[0] !== 'banana-fish') throw new Error(`Safety stop after update: count=${after.length}, changed=${changed.join(',')}`)
console.log(JSON.stringify({ mode: 'apply', count: after.length, slug: data.slug, ipType: data.ip_type, changed, backupPath }, null, 2))
