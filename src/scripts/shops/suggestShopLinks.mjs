// 샵 부속 연결 후보 뽑기 (읽기 전용) — plan 의 link_events·works 를 채울 때 쓴다
//   node scripts/shops/suggestShopLinks.mjs <shop_id> [--works "하이큐,원신,..."]
// 1) 이 샵에서 열리는(열렸던) 이벤트: 도로명주소 같고 place_detail/place_name 에 샵 이름이 든 것 → link_events 후보
//    같은 건물의 다른 공간 이벤트는 참고용으로만 따로 보여준다(연결 금지)
// 2) 작품 후보: 위 이벤트 + 이미 연결된 이벤트의 작품(tag) 을 횟수와 함께
// 3) --works 로 준 이름을 tags(name·english_name·aliases) 에서 찾아 tag_id 를 보여준다(없으면 "없음" — tags 새로 만들지 않음)
// 4) 현재 등록된 취급 작품·취급 상품
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const norm = (s) => (s ?? '').toString().toLowerCase().replace(/\s+/g, '').replace(/[()\[\]·・.,'"-]/g, '')
const roadKey = (a) => {
  const m = (a ?? '').replace(/특별시|광역시|특별자치시|특별자치도/g, '').match(/([가-힣0-9]+(?:로|길)(?:\s?[0-9]+(?:번)?길)?)\s?([0-9]+(?:-[0-9]+)?)/)
  return m ? norm(m[1] + m[2]) : null
}
const nameCore = (s) => norm(s).replace(/점$/, '')

const shopId = process.argv[2]
if (!shopId) throw new Error('shop_id required')
const wi = process.argv.indexOf('--works')
const workNames = wi > 0 ? process.argv[wi + 1].split(',').map((s) => s.trim()).filter(Boolean) : []

const s = await db.from('shops').select('id, name, addr, slug').eq('id', shopId).single()
if (s.error) throw s.error
const shop = s.data
const rk = roadKey(shop.addr)

const ev = await db.from('events').select('id, title, type, place_name, place_addr, place_detail, shop_id, tag_id, start_date, end_date, tags(name)')
  .ilike('place_addr', `%${(shop.addr ?? '').split(' ').slice(-2).join(' ')}%`)
if (ev.error) throw ev.error
const sameRoad = ev.data.filter((e) => rk && roadKey(e.place_addr) === rk)
const atShop = sameRoad.filter((e) => norm(`${e.place_detail ?? ''} ${e.place_name ?? ''}`).includes(nameCore(shop.name)))
const linkable = atShop.filter((e) => !e.shop_id)
const linkedHere = await db.from('events').select('id, title, tag_id, tags(name)').eq('shop_id', shopId)
if (linkedHere.error) throw linkedHere.error
const building = sameRoad.filter((e) => !atShop.includes(e) && !e.shop_id)

const workCount = new Map()
for (const e of [...atShop, ...linkedHere.data]) {
  if (!e.tag_id || !e.tags) continue
  const k = e.tag_id
  const w = workCount.get(k) ?? { tag_id: k, name: e.tags.name, events: new Set() }
  w.events.add(e.id)
  workCount.set(k, w)
}

const lookup = []
for (const n of workNames) {
  const q = n.replace(/[%,()]/g, '')
  const r = await db.from('tags').select('id, name, english_name, aliases').or(`name.ilike.%${q}%,english_name.ilike.%${q}%`).limit(5)
  let hits = r.data ?? []
  if (!hits.length) {
    const a = await db.from('tags').select('id, name, english_name, aliases').contains('aliases', [n]).limit(5)
    hits = a.data ?? []
  }
  lookup.push({ query: n, hits: hits.map((h) => ({ tag_id: h.id, name: h.name })) })
}

const curTags = await db.from('shop_tags').select('is_primary, tags(id, name)').eq('shop_id', shopId)
const curGoods = await db.from('shop_goods_categories').select('goods_types(slug, name)').eq('shop_id', shopId)

console.log(JSON.stringify({
  shop: { id: shop.id, name: shop.name, addr: shop.addr, url: `https://www.takuroad.kr/shop/${shop.slug}` },
  link_events: linkable.map((e) => ({ event_id: e.id, title: e.title, place_detail: e.place_detail, period: `${e.start_date}~${e.end_date}` })),
  already_linked: linkedHere.data.length,
  at_shop_but_linked_elsewhere: atShop.filter((e) => e.shop_id && e.shop_id !== shopId).map((e) => ({ event_id: e.id, title: e.title, shop_id: e.shop_id })),
  same_building_other_space_DO_NOT_LINK: building.map((e) => `${e.title} | ${e.place_detail ?? e.place_name}`),
  works_from_events: [...workCount.values()].map((w) => ({ tag_id: w.tag_id, name: w.name, events: w.events.size })).sort((a, b) => b.events - a.events),
  works_lookup: lookup,
  current: {
    works: (curTags.data ?? []).map((t) => (t.is_primary ? '*' : '') + t.tags?.name),
    goods_types: (curGoods.data ?? []).map((g) => g.goods_types?.slug),
  },
}, null, 1))
