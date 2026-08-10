import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..', '..')
const reviewDir = resolve(here, 'work-description-review')
const outputDir = resolve(here, 'work-enrichment-output')
const baselinePath = resolve(outputDir, 'backup-2026-08-10T04-32-02-261Z.json')
const apply = process.argv.includes('--apply')

nextEnv.loadEnvConfig(projectRoot)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase server environment variables are missing')
const supabase = createClient(url, key, { auth: { persistSession: false } })

const empty = (value) => value == null || value === '' || (Array.isArray(value) && value.length === 0)
const sameArray = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? [])

async function loadReviews() {
  const files = (await readdir(reviewDir)).filter((name) => /^batch-\d+\.json$/.test(name)).sort()
  const rows = []
  for (const file of files) rows.push(...JSON.parse(await readFile(resolve(reviewDir, file), 'utf8')))
  return { files, rows }
}

async function main() {
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'))
  const { files, rows } = await loadReviews()
  const reviewedSlugs = rows.map((row) => row.slug)
  const uniqueSlugs = new Set(reviewedSlugs)
  const targets = baseline.filter((row) => empty(row.description))
  const protectedRows = baseline.filter((row) => !empty(row.description))

  if (baseline.length !== 339) throw new Error(`Safety stop: baseline has ${baseline.length}, expected 339`)
  if (rows.length !== 302 || uniqueSlugs.size !== 302) throw new Error('Safety stop: reviews must contain 302 unique works')
  const missing = targets.filter((row) => !uniqueSlugs.has(row.slug)).map((row) => row.slug)
  const extra = rows.filter((row) => !targets.some((target) => target.slug === row.slug)).map((row) => row.slug)
  const protectedOverlap = protectedRows.filter((row) => uniqueSlugs.has(row.slug)).map((row) => row.slug)
  if (missing.length || extra.length || protectedOverlap.length) {
    throw new Error(`Safety stop: missing=${missing.length}, extra=${extra.length}, protectedOverlap=${protectedOverlap.length}`)
  }

  const { data: before, error: readError } = await supabase.from('tags').select('*').order('name')
  if (readError) throw readError
  if (before.length !== 339) throw new Error(`Safety stop: DB has ${before.length}, expected 339`)
  const currentBySlug = new Map(before.map((row) => [row.slug, row]))
  const absent = reviewedSlugs.filter((slug) => !currentBySlug.has(slug))
  if (absent.length) throw new Error(`Safety stop: DB missing reviewed slugs: ${absent.join(', ')}`)

  await mkdir(outputDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = resolve(outputDir, `pre-reviewed-apply-${stamp}.json`)
  const reportPath = resolve(outputDir, `reviewed-apply-${stamp}.json`)
  await writeFile(backupPath, JSON.stringify(before, null, 2), 'utf8')

  const changes = rows.map((review) => {
    const current = currentBySlug.get(review.slug)
    const patch = {
      description: review.description,
      genres: review.genres,
      ip_type: review.ipType.join(','),
    }
    // 불확실하여 비운 URL은 기존 값을 지우지 않는다.
    if (review.officialUrl) patch.official_url = review.officialUrl
    return { id: current.id, slug: review.slug, patch }
  })

  if (apply) {
    for (const item of changes) {
      const { error } = await supabase.from('tags').update(item.patch).eq('id', item.id)
      if (error) throw new Error(`${item.slug}: ${error.message}`)
    }
  }

  const result = { mode: apply ? 'apply' : 'dry-run', files: files.length, reviewed: rows.length, protected: protectedRows.length, backupPath, changes }
  await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf8')

  if (apply) {
    const { data: after, error: afterError } = await supabase.from('tags').select('*')
    if (afterError) throw afterError
    const afterBySlug = new Map(after.map((row) => [row.slug, row]))
    const failed = changes.filter(({ slug, patch }) => {
      const row = afterBySlug.get(slug)
      return row.description !== patch.description || !sameArray(row.genres, patch.genres) || row.ip_type !== patch.ip_type ||
        ('official_url' in patch && row.official_url !== patch.official_url)
    }).map((item) => item.slug)
    const protectedChanged = protectedRows.filter((original) => {
      const row = afterBySlug.get(original.slug)
      return JSON.stringify(row) !== JSON.stringify(before.find((item) => item.slug === original.slug))
    }).map((row) => row.slug)
    if (failed.length || protectedChanged.length) {
      throw new Error(`Post-check failed: reviewed=${failed.length}, protectedChanged=${protectedChanged.length}`)
    }
    console.log(JSON.stringify({ mode: 'apply', updated: changes.length, protected: protectedRows.length, failed: 0, protectedChanged: 0, backupPath, reportPath }, null, 2))
    return
  }

  console.log(JSON.stringify({ mode: 'dry-run', updates: changes.length, protected: protectedRows.length, backupPath, reportPath }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
