// 2026-09-28 사용자 요청: 새 카테고리 "피규어샵"(lib/constants/categories.ts, commit 3d6171f) — 피규어를 파는 샵에 모두 추가
// 기준: 취급 상품 분류(shop_goods_categories)에 피규어(figure·figure-new·nendoroid)가 등록된 active 샵.
//   설명에 "피규어"만 있는 샵(쿠지 경품·운영사 이름 등)은 넣지 않는다.
// 피규어 전문점(공식 소개가 피규어 전문)은 피규어샵을 대표(첫 값)로, 나머지는 끝에 추가한다.
// 정보 확인일(info_last_confirmed_at)·ledger last_checked_at 은 건드리지 않는다(카테고리만 변경). 변경 전 행은 backups/ 에, 변경은 shop_change_logs 에.
//   node scripts/shops/addFigureCategory-2026-09-28.mjs [--dry]
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFile } from 'fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry')
const CAT = '피규어샵'
const EDITOR = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d' // applyShopPlan.mjs 와 같은 편집자
const FIRST = new Set([
  '1bdef20f-f701-41d0-bab8-ccfc66c03d85', // 피규어프레소 서초점 — "정품 피규어 전문"
])
const FIRST_NAMES = new Set(['피규어프레소 서초점', '피규어프레소 신도림점', '논노21', '토이스카이'])

const gt = await db.from('goods_types').select('id, slug').in('slug', ['figure', 'figure-new', 'nendoroid'])
if (gt.error) throw gt.error
const sgc = await db.from('shop_goods_categories').select('shop_id').in('goods_type_id', gt.data.map((g) => g.id))
if (sgc.error) throw sgc.error
const ids = [...new Set(sgc.data.map((r) => r.shop_id))]
const rows = await db.from('shops').select('*').in('id', ids).eq('status', 'active')
if (rows.error) throw rows.error

const before = []
const res = { updated: [], already: [], race: [] }
for (const row of rows.data) {
  const cats = row.cats ?? []
  if (cats.includes(CAT)) { res.already.push(row.name); continue }
  const first = FIRST.has(row.id) || FIRST_NAMES.has(row.name)
  const next = first ? [CAT, ...cats] : [...cats, CAT]
  if (dry) { console.log('DRY', row.name, JSON.stringify(cats), '→', JSON.stringify(next)); continue }
  before.push(row)
  const u = await db.from('shops').update({ cats: next }).eq('id', row.id).eq('updated_at', row.updated_at).select('id')
  if (u.error) throw u.error
  if (!u.data.length) { res.race.push(row.name); continue }
  const log = await db.from('shop_change_logs').insert({
    shop_id: row.id, target_table: 'shops', field_name: 'cats', old_value: cats, new_value: next,
    change_source: 'admin', changed_by: EDITOR, reason: 'admin_update',
  })
  if (log.error) throw log.error
  res.updated.push(`${row.name} ${JSON.stringify(next)}`)
}
if (!dry && before.length) {
  const file = `scripts/shops/backups/shops-before-figurecat-${Date.now()}.json`
  await writeFile(file, JSON.stringify(before, null, 1))
  console.log('backup', file)
}
console.log(JSON.stringify({ total: rows.data.length, updated: res.updated.length, already: res.already.length, race: res.race }, null, 1))
if (!dry) console.log(res.updated.join('\n'))
