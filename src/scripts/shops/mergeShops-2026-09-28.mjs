// 2026-09-28 사용자 지시: 같은 건물 + 같은 이름(브랜드) 샵은 한 행으로 합친다. 설명에 층·호점별 안내를 줄마다 적는다.
// - 대표 행(keep) 필드를 갱신하고, 합칠 행(merge)의 취급 작품(shop_tags)·상품 분류(shop_goods_categories)·상품 옵션을 대표 행에 복사(중복 제외)
// - 그 밖의 참조(events·shop_images·saved_shops·reviews·route_* 등)는 대표 행으로 옮긴다(현재 건수 0 이면 건너뜀)
// - 합친 행은 status 'deleted'(소프트) — 행·과거 연결은 지우지 않는다. 변경 전 전체 행을 backups/ 에, 변경은 shop_change_logs 에.
//   node scripts/shops/mergeShops-2026-09-28.mjs [--dry]
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFile, writeFile } from 'fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry')
const EDITOR = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const BLD = '국제전자센터 상가는 매월 첫째·셋째 일요일 휴무이니 방문 전 확인해 주세요.'

const GROUPS = [
  {
    keep: 'fb2ed90d-e09e-4810-bd87-a941252e17db', expect: '2026-09-28T05:50:52.591621+00:00',
    merge: [['f6a9f356-69eb-45f2-b794-f91d4192a042', '2026-09-28T05:27:22.923005+00:00'], ['7a5bf144-eed4-416a-9d6c-64540a555054', '2026-09-28T05:27:21.328741+00:00']],
    fields: {
      name: '쿄우마샵 국제전자센터점',
      floor_info: '국제전자센터 2층 136호(본점) · 9층(1·2호점)',
      cats: ['가챠', '굿즈샵', '쿠지', '피규어샵'],
      description: [
        '서브컬처 피규어·가챠·굿즈 전문점 쿄우마샵의 국제전자센터 매장으로, 같은 건물에 세 곳이 있습니다.',
        '· 2층 136호 본점: 피규어·가챠·굿즈, 제일복권·공식 MD',
        '· 9층 1호점: 가챠·카드가챠',
        '· 9층 2호점: 가챠·카드가챠·제일복권',
        `영업시간은 공식 안내가 없어 비워 두었습니다. ${BLD}`,
      ].join('\n'),
    },
  },
  {
    keep: '2f1321e8-39a4-4f29-8f50-6ee8a82c6e66', expect: '2026-09-28T05:51:41.822676+00:00',
    merge: [['cb797d3d-4529-49d6-a889-36faf49d5654', '2026-09-28T05:51:00.805095+00:00']],
    fields: {
      name: '이스타에그 국전점',
      floor_info: '국제전자센터 7층(본점) · 9층(2호점)',
      sns_links: ['https://x.com/E_staregg_store', 'https://x.com/E_stareggstore2'],
      description: [
        '게임·애니메이션 서브컬처 상품을 판매하는 이스타에그의 국제전자센터 매장으로, 같은 건물에 두 곳이 있습니다.',
        '· 7층 본점: 매일 11:00~19:30, 매월 첫째·셋째 일요일 휴무',
        '· 9층 2호점: 매주 화요일 정기휴무',
        '(각 매장 공식 X 안내 — 영업시간 표는 본점 기준)',
      ].join('\n'),
    },
  },
  {
    keep: '6774a8a7-1970-44d2-9060-f040ca0b81af', expect: '2026-09-28T05:51:02.362136+00:00',
    merge: [['0a6505fe-0c2e-4a07-9f41-d483fc37c267', '2026-09-28T05:25:12.235056+00:00']],
    fields: {
      floor_info: '국제전자센터 5층 · 3층(가챠점) · 8층(프리미엄 쿠지샵)',
      cats: ['굿즈샵', '쿠지', '가챠', '피규어샵'],
      description: [
        '피규어·쿠지·가챠·굿즈를 파는 애니랩스(ANILABS)의 국제전자센터 매장으로, 같은 건물에 세 곳이 있습니다.',
        '· 5층: 피규어·쿠지(자체 쿠지 포함)·굿즈',
        '· 3층 가챠점: 가챠(캡슐토이)',
        '· 8층 프리미엄 쿠지샵: 쿠지(2026년 6월 오픈)',
        '평일 13:00~20:00, 주말 11:00~20:00 영업하며 매월 첫째·셋째 일요일은 휴무입니다(공식 인스타그램 안내).',
      ].join('\n'),
    },
  },
]
// 대표 행으로 옮길 참조 테이블 (shop_tags·shop_goods_categories·shop_products 는 복사로 따로 처리, shop_change_logs 는 이력이라 그대로)
const MOVE = ['events', 'shop_images', 'saved_shops', 'reviews', 'check_ins', 'route_progress', 'route_session_visits', 'route_shops', 'shop_events',
  'shop_verify_requests', 'shop_amenity_links', 'shop_highlights', 'shop_info_confirmations', 'shop_suggestions', 'event_submissions', 'pilgrimage_list_shops', 'shop_ai_summaries']

const log = (shop_id, field_name, old_value, new_value, target_table = 'shops', target_id = null) =>
  db.from('shop_change_logs').insert({ shop_id, target_table, target_id, field_name, old_value, new_value, change_source: 'admin', changed_by: EDITOR, reason: 'admin_update' })

const backup = []
const report = []
for (const g of GROUPS) {
  const ids = [g.keep, ...g.merge.map((m) => m[0])]
  const rows = await db.from('shops').select('*').in('id', ids)
  if (rows.error) throw rows.error
  const keep = rows.data.find((r) => r.id === g.keep)
  const expects = Object.fromEntries([[g.keep, g.expect], ...g.merge])
  const changed = rows.data.filter((r) => r.updated_at !== expects[r.id])
  if (changed.length) { report.push({ keep: keep.name, status: 'SKIP_CHANGED_SINCE_READ', rows: changed.map((r) => r.name) }); continue }
  backup.push(...rows.data)
  const r = { keep: keep.name, new_name: g.fields.name ?? keep.name, merged: [], tags: 0, goods: 0, products: 0, moved: {} }

  // 1) 작품·상품 분류·옵션 복사 (대표 행에 없는 것만)
  const [kt, kg, kp] = await Promise.all([
    db.from('shop_tags').select('tag_id').eq('shop_id', g.keep),
    db.from('shop_goods_categories').select('goods_type_id').eq('shop_id', g.keep),
    db.from('shop_products').select('tag_id, goods_type_id, variant_slug').eq('shop_id', g.keep),
  ])
  const haveT = new Set(kt.data.map((x) => x.tag_id)), haveG = new Set(kg.data.map((x) => x.goods_type_id))
  const haveP = new Set(kp.data.map((x) => `${x.tag_id}|${x.goods_type_id}|${x.variant_slug}`))
  for (const [mid] of g.merge) {
    const m = rows.data.find((x) => x.id === mid)
    r.merged.push(m.name)
    const st = await db.from('shop_tags').select('*').eq('shop_id', mid)
    for (const t of st.data) {
      if (haveT.has(t.tag_id)) continue
      haveT.add(t.tag_id); r.tags++
      if (!dry) { const { shop_id, id, created_at, ...rest } = t; const i = await db.from('shop_tags').insert({ ...rest, shop_id: g.keep }); if (i.error) throw i.error }
    }
    const sg = await db.from('shop_goods_categories').select('*').eq('shop_id', mid)
    for (const x of sg.data) {
      if (haveG.has(x.goods_type_id)) continue
      haveG.add(x.goods_type_id); r.goods++
      if (!dry) { const { shop_id, id, created_at, ...rest } = x; const i = await db.from('shop_goods_categories').insert({ ...rest, shop_id: g.keep }); if (i.error) throw i.error }
    }
    const sp = await db.from('shop_products').select('*').eq('shop_id', mid)
    for (const x of sp.data) {
      const k = `${x.tag_id}|${x.goods_type_id}|${x.variant_slug}`
      if (haveP.has(k)) continue
      haveP.add(k); r.products++
      if (!dry) { const { shop_id, id, created_at, updated_at, ...rest } = x; const i = await db.from('shop_products').insert({ ...rest, shop_id: g.keep }); if (i.error) throw i.error }
    }
    // 2) 그 밖의 참조 이동
    for (const t of MOVE) {
      const c = await db.from(t).select('shop_id', { count: 'exact', head: true }).eq('shop_id', mid)
      if (c.error || !c.count) continue
      r.moved[`${t}`] = (r.moved[t] ?? 0) + c.count
      if (!dry) { const u = await db.from(t).update({ shop_id: g.keep }).eq('shop_id', mid); if (u.error) throw new Error(`${t}: ${u.error.message}`) }
    }
  }

  if (dry) { report.push({ ...r, status: 'DRY' }); continue }
  // 3) 대표 행 갱신
  // 작품·분류 복사가 shops.updated_at 을 올리므로, 복사 뒤 다시 읽는다(복사 중 다른 필드가 바뀌었으면 중단)
  const fresh = (await db.from('shops').select('*').eq('id', g.keep).single()).data
  const drift = Object.keys(g.fields).filter((k) => JSON.stringify(fresh[k]) !== JSON.stringify(keep[k]))
  if (drift.length) { report.push({ ...r, status: 'KEEP_CHANGED_DURING_COPY', drift }); continue }
  const patch = {}
  for (const [k, v] of Object.entries(g.fields)) if (JSON.stringify(fresh[k]) !== JSON.stringify(v)) patch[k] = v
  const u = await db.from('shops').update(patch).eq('id', g.keep).eq('updated_at', fresh.updated_at).select('id')
  if (u.error) throw u.error
  if (!u.data.length) { report.push({ ...r, status: 'RACE_ON_KEEP' }); continue }
  for (const [k, v] of Object.entries(patch)) await log(g.keep, k, fresh[k] ?? null, v)
  // 4) 합친 행 소프트 삭제
  for (const [mid] of g.merge) {
    const m = rows.data.find((x) => x.id === mid)
    if (m.status === 'deleted') continue
    const d = await db.from('shops').update({ status: 'deleted' }).eq('id', mid).select('id')
    if (d.error) throw d.error
    await log(mid, 'status', m.status, 'deleted')
    await log(mid, 'merged_into', null, g.keep)
  }
  report.push({ ...r, status: 'MERGED' })
}
if (!dry && backup.length) {
  const file = `scripts/shops/backups/shops-before-merge-${Date.now()}.json`
  await writeFile(file, JSON.stringify(backup, null, 1))
  console.log('backup', file)
  // ledger: 합친 행 표시
  const lp = 'scripts/shops/ledger.json'
  const ledger = JSON.parse(await readFile(lp, 'utf8'))
  for (const g of GROUPS) for (const [mid] of g.merge) {
    ledger.shops[mid] = { ...(ledger.shops[mid] ?? {}), merged_into: g.keep, notes: `2026-09-28 같은 건물·같은 이름으로 ${g.keep} 에 합침(status deleted)` }
  }
  await writeFile(lp, JSON.stringify(ledger, null, 1))
}
console.log(JSON.stringify(report, null, 1))
