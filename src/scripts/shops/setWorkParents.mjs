// 작품 상위 관계(tags.parent_tag_id — 사이트의 "상위 작품(프랜차이즈)") 연결
//   node scripts/shops/setWorkParents.mjs scripts/shops/works/<file>.json [--dry]
//
// 입력: [{ "child": "<slug>", "parent": "<slug>", "kind": "series|character_brand|maker", "evidence": "공식 소속 근거", "url": "...", "overwrite": false }]
//       관계 해제: { "child": "<slug>", "parent": null, "unset": true, "reason": "..." } (현재 상위가 있을 때만)
// - 공식 소속이 확인된 것만. 이름이 비슷하거나 같은 샵에서 판다는 이유로 추측하지 않는다(미확인은 pending 에)
// - 막는 것: 자기 자신을 상위로, 순환(상위 쪽 체인에 자식이 있음), 없는 작품,
//            이미 다른 상위가 있는데 overwrite 없이 바꾸기, 같은 관계 중복(이미 같으면 건너뜀)
// - 변경 전 해당 작품들의 parent_tag_id 를 scripts/shops/backups/ 에 저장, 결과는 runs/ 에
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { basename } from 'node:path'

config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const file = process.argv[2]
const dry = process.argv.includes('--dry')
if (!file) throw new Error('json path required')
const input = JSON.parse(await readFile(file, 'utf8'))

const slugs = [...new Set(input.flatMap((x) => [x.child, x.parent]).filter(Boolean))]
const r = await db.from('tags').select('id, name, slug, parent_tag_id').in('slug', slugs)
if (r.error) throw r.error
const bySlug = new Map(r.data.map((t) => [t.slug, t]))

async function chainHas(startId, targetId) {
  // startId 에서 상위로 올라가며 targetId 가 나오면 순환
  let id = startId
  for (let i = 0; i < 20 && id; i++) {
    if (id === targetId) return true
    const p = await db.from('tags').select('parent_tag_id').eq('id', id).single()
    if (p.error) throw p.error
    id = p.data.parent_tag_id
  }
  return false
}

const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
if (!dry) {
  await mkdir('scripts/shops/backups', { recursive: true })
  await writeFile(`scripts/shops/backups/tag-parents-before-${basename(file, '.json')}-${stamp}.json`,
    JSON.stringify(r.data.map((t) => ({ id: t.id, slug: t.slug, parent_tag_id: t.parent_tag_id })), null, 1))
}
const out = []
for (const x of input) {
  if (x.unset) {
    const c = bySlug.get(x.child)
    if (!c) { out.push({ ...x, status: 'SKIP_NOT_FOUND' }); continue }
    if (!c.parent_tag_id) { out.push({ ...x, status: 'ALREADY_NONE' }); continue }
    if (dry) { out.push({ child: c.name, parent: '(해제)', status: 'DRY_UNSET' }); continue }
    const u = await db.from('tags').update({ parent_tag_id: null }).eq('id', c.id).eq('parent_tag_id', c.parent_tag_id).select('id')
    if (u.error) { out.push({ ...x, status: 'ERROR', error: u.error.message }); continue }
    out.push({ child: c.name, parent: '(해제)', status: 'UNSET', before: c.parent_tag_id, reason: x.reason })
    c.parent_tag_id = null
    continue
  }
  const c = bySlug.get(x.child), p = bySlug.get(x.parent)
  if (!c || !p) { out.push({ ...x, status: 'SKIP_NOT_FOUND' }); continue }
  if (c.id === p.id) { out.push({ ...x, status: 'SKIP_SELF' }); continue }
  if (c.parent_tag_id === p.id) { out.push({ ...x, status: 'ALREADY' }); continue }
  if (c.parent_tag_id && !x.overwrite) { out.push({ ...x, status: 'SKIP_HAS_OTHER_PARENT', current: c.parent_tag_id }); continue }
  if (await chainHas(p.id, c.id)) { out.push({ ...x, status: 'SKIP_CYCLE' }); continue }
  if (dry) { out.push({ child: c.name, parent: p.name, status: 'DRY_SET' }); continue }
  const u = await db.from('tags').update({ parent_tag_id: p.id }).eq('id', c.id).select('id')
  if (u.error) { out.push({ ...x, status: 'ERROR', error: u.error.message }); continue }
  out.push({ child: c.name, parent: p.name, status: 'SET', kind: x.kind ?? null, before: c.parent_tag_id, evidence: x.evidence, url: x.url })
  c.parent_tag_id = p.id
}
await mkdir('scripts/shops/runs', { recursive: true })
await writeFile(`scripts/shops/runs/parents-${basename(file, '.json')}-${dry ? 'dry-' : ''}${stamp}.json`, JSON.stringify(out, null, 1))
console.log(JSON.stringify(out.map((o) => `${o.status} ${o.child} → ${o.parent}`), null, 1))
