// 취급 작품(tags) 새로 만들기 — 선택 목록에 없는 작품만 (샵 작업용)
//   node scripts/shops/createWorks.mjs scripts/shops/works/<file>.json [--dry]
//
// 입력: [{ name, slug, english_name?, aliases?[], ip_type: "영화,애니", ip_type_slug: "anime",
//          parent_slug?, genres?[], description?, official_url? }]
// - 이름·영문명·별칭(정규화)이나 slug 가 기존 작품과 겹치면 만들지 않고 기존 id 를 알려준다(중복 방지)
// - description 은 공식 정보로 확인되는 한 줄만. 모르면 비워 둔다(추측 금지)
// - 결과: scripts/shops/runs/works-<name>-<시각>.json (만든 id·slug), 되돌릴 때 이 목록으로 삭제
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { basename } from 'node:path'

config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const file = process.argv[2]
const dry = process.argv.includes('--dry')
if (!file) throw new Error('works json path required')
const input = JSON.parse(await readFile(file, 'utf8'))
const norm = (s) => (s ?? '').toString().toLowerCase().replace(/[\s!！?？:：·・.,'"()\[\]~\-–—☆★「」『』×]/g, '')

const tags = []
for (let f = 0; ; f += 1000) {
  const r = await db.from('tags').select('id, name, slug, english_name, aliases').order('id').range(f, f + 999)
  if (r.error) throw r.error
  tags.push(...r.data); if (r.data.length < 1000) break
}
const bySlug = new Map(tags.map((t) => [t.slug, t]))
const byKey = new Map()
for (const t of tags) for (const k of [t.name, t.english_name, ...(t.aliases ?? [])]) if (norm(k)) byKey.set(norm(k), t)
const ipTypes = new Map(((await db.from('ip_types').select('id, slug')).data ?? []).map((t) => [t.slug, t.id]))

const out = []
for (const w of input) {
  const hit = [w.name, w.english_name, ...(w.aliases ?? [])].map((k) => byKey.get(norm(k))).find(Boolean) ?? bySlug.get(w.slug)
  if (hit) { out.push({ name: w.name, status: 'EXISTS', id: hit.id, existing: hit.name, slug: hit.slug }); continue }
  const parent = w.parent_slug ? bySlug.get(w.parent_slug) : null
  if (w.parent_slug && !parent) { out.push({ name: w.name, status: 'SKIP_NO_PARENT', parent_slug: w.parent_slug }); continue }
  if (w.ip_type_slug && !ipTypes.has(w.ip_type_slug)) { out.push({ name: w.name, status: 'SKIP_BAD_IP_TYPE' }); continue }
  const row = {
    name: w.name, slug: w.slug, english_name: w.english_name ?? null, aliases: w.aliases?.length ? w.aliases : null,
    ip_type: w.ip_type ?? null, ip_type_id: w.ip_type_slug ? ipTypes.get(w.ip_type_slug) : null,
    genres: w.genres?.length ? w.genres : null, description: w.description ?? null,
    official_url: w.official_url ?? null, links: [], keywords: null, created_by: null,
    parent_tag_id: parent?.id ?? null,
  }
  if (dry) { out.push({ name: w.name, status: 'DRY_CREATE', slug: w.slug, parent: parent?.name ?? null }); continue }
  const r = await db.from('tags').insert(row).select('id, slug').single()
  if (r.error) { out.push({ name: w.name, status: 'ERROR', error: r.error.message }); continue }
  out.push({ name: w.name, status: 'CREATED', id: r.data.id, slug: r.data.slug })
  bySlug.set(r.data.slug, { ...row, id: r.data.id }); byKey.set(norm(w.name), { ...row, id: r.data.id })
}
await mkdir('scripts/shops/runs', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
await writeFile(`scripts/shops/runs/works-${basename(file, '.json')}-${dry ? 'dry-' : ''}${stamp}.json`, JSON.stringify(out, null, 1))
console.log(JSON.stringify(out.map((o) => `${o.status} ${o.name}${o.existing ? ' → ' + o.existing : ''}${o.error ? ' ' + o.error : ''}`), null, 1))
