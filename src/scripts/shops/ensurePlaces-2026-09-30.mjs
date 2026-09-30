// 2026-09-30 샵 등록분 건물 매핑용 places — kakao_place_id 로 있으면 재사용, 없을 때만 만든다.
// 기존 places 는 비어 있는 parking/parking_note 만 채운다(덮어쓰기 없음). 변경 전 행을 backups/ 에 남긴다.
//   node scripts/shops/ensurePlaces-2026-09-30.mjs [--dry]
// 주차 안내 출처(2026-09-30 브라우저 렌더 텍스트): 현대시티아울렛 동대문점 ehyundai.com/newPortal/outlet/DP/WC/WC000000_V.do?branchCd=B00173000
// 뉴코아아울렛 부천점 공식 오시는 길(elandretail.com/store09.do?branchID=00110012)에 주차 요금 없음 — 주차장 존재만(카카오 부속 주차장 항목) parking true, 노트 비움 → pending "공식 대조"
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFile } from 'fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry')

const NEW = [
  { slug: 'hyundai-city-outlet-dongdaemun-7854378', name: '현대시티아울렛 동대문점', place_type: 'SHOPPING_MALL', addr: '서울 중구 장충단로13길 20', region: '서울', district: '중구',
    lat: 37.5687810426011, lng: 127.00769716004001, kakao_place_id: '7854378', category_name: '가정,생활 > 상설할인매장 > 현대아울렛',
    parking: true, parking_note: '주차 가능(유료)\n최초 30분(평일)·1시간(주말) 무료, 이후 10분당 800원\n구매 시 무료: 1만원 이상 1시간 · 3만원 이상 2시간 · 5만원 이상 3시간 · 10만원 이상 5시간\n재출력 영수증은 할인 제외', access_note: null },
  { slug: 'newcore-outlet-bucheon-11635390', name: '뉴코아아울렛 부천점', place_type: 'SHOPPING_MALL', addr: '경기 부천시 원미구 송내대로 239', region: '경기', district: '부천시',
    lat: 37.50457790010505, lng: 126.75678611106476, kakao_place_id: '11635390', category_name: '가정,생활 > 상설할인매장 > 뉴코아아울렛',
    parking: true, parking_note: null, access_note: null },
]
const FILL = []

const touched = []
for (const p of NEW) {
  const got = await db.from('places').select('id, name').eq('kakao_place_id', p.kakao_place_id).maybeSingle()
  if (got.error) throw got.error
  if (got.data) { console.log('EXISTS', got.data.id, got.data.name); continue }
  if (dry) { console.log('DRY_INSERT', p.name); continue }
  const r = await db.from('places').insert({ ...p, system_created: false }).select('id, name, slug').single()
  if (r.error) throw r.error
  console.log('INSERTED', r.data.id, r.data.name, r.data.slug)
}
for (const f of FILL) {
  const got = await db.from('places').select('*').eq('kakao_place_id', f.kakao_place_id).single()
  if (got.error) throw got.error
  const cur = got.data
  const patch = {}
  if (cur.parking == null) patch.parking = f.parking
  if (!cur.parking_note) patch.parking_note = f.parking_note
  if (!Object.keys(patch).length) { console.log('KEEP', cur.name); continue }
  touched.push(cur)
  if (dry) { console.log('DRY_FILL', cur.name, Object.keys(patch)); continue }
  const r = await db.from('places').update(patch).eq('id', cur.id).eq('updated_at', cur.updated_at).select('id').maybeSingle()
  if (r.error) throw r.error
  console.log(r.data ? 'FILLED' : 'SKIP_CHANGED', cur.name, Object.keys(patch))
}
if (!dry && touched.length) {
  const file = `scripts/shops/backups/places-before-2026-09-30-${Date.now()}.json`
  await writeFile(file, JSON.stringify(touched, null, 1))
  console.log('backup', file)
}
