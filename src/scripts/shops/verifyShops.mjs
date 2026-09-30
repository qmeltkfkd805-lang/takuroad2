// 샵 반영 검증 + 이벤트 연결 인계 후보 추출 (읽기 전용)
//   node scripts/shops/verifyShops.mjs <id> [<id> ...]
// 1) service role 재조회  2) anon 키 익명 조회  3) 공개 상세 HTTP 응답
// 4) shop_id 가 비어 있는 이벤트 중 주소·장소명이 이 샵과 겹치는 것 → 인계 후보(수정하지 않음)
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '../.env.local', quiet: true })
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const SITE = 'https://www.takuroad.kr'
const norm = (s) => (s ?? '').toString().toLowerCase().replace(/\s+/g, '')
const roadKey = (a) => {
  const m = (a ?? '').replace(/특별시|광역시/g, '').match(/([가-힣0-9]+(?:로|길)(?:\s?[0-9]+(?:번)?길)?)\s?([0-9]+(?:-[0-9]+)?)/)
  return m ? norm(m[1] + m[2]) : null
}

const ids = process.argv.slice(2)
const out = []
for (const id of ids) {
  const s = await svc.from('shops').select('id, slug, name, addr, floor_info, status, lat, lng, hours, updated_at').eq('id', id).single()
  const a = await anon.from('shops').select('id, slug, name, addr, status').eq('id', id).maybeSingle()
  let http = null
  if (s.data?.slug) {
    const r = await fetch(`${SITE}/shop/${encodeURIComponent(s.data.slug)}`, { redirect: 'follow' })
    const html = await r.text()
    http = { status: r.status, hasName: html.includes(s.data.name.split(' ')[0]) }
  }
  // 인계 후보: 진행 중·예정 이벤트 중 shop_id 없음 + 주소/장소명이 겹침
  const today = new Date().toISOString().slice(0, 10)
  const ev = await svc.from('events').select('id, title, place_name, place_addr, place_detail, start_date, end_date, shop_id')
    .is('shop_id', null).or(`end_date.is.null,end_date.gte.${today}`)
  const rk = roadKey(s.data?.addr)
  const candidates = (ev.data ?? []).filter((e) => {
    const sameRoad = rk && roadKey(e.place_addr) === rk
    const nameHit = s.data && [e.place_name, e.place_detail].some((v) => v && norm(v).includes(norm(s.data.name).slice(0, 6)))
    return sameRoad || nameHit
  }).map((e) => ({ event_id: e.id, title: e.title, place_name: e.place_name, place_addr: e.place_addr, period: `${e.start_date}~${e.end_date}` }))
  out.push({
    id, name: s.data?.name, slug: s.data?.slug, db: s.error ? s.error.message : { status: s.data.status, addr: s.data.addr, floor: s.data.floor_info, lat: s.data.lat, lng: s.data.lng },
    anon: a.error ? a.error.message : !!a.data, http, url: s.data ? `${SITE}/shop/${s.data.slug}` : null, handoff_candidates: candidates,
  })
}
console.log(JSON.stringify(out, null, 1))
