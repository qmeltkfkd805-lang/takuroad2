// 2026-09-29(k) 샵 등록분 건물 매핑용 places — kakao_place_id 로 있으면 재사용, 없을 때만 만든다.
// 기존 places 는 비어 있는 parking/parking_note 만 채운다(덮어쓰기 없음). 변경 전 행을 backups/ 에 남긴다.
//   node scripts/shops/ensurePlaces-2026-09-29-k.mjs [--dry]
// 주차 안내 출처(2026-09-29 브라우저 렌더 텍스트): 롯데백화점 센텀시티점 lotteshopping.com/store/main?cstrCd=0027 /
//   마리오아울렛 mariooutlet.com/information/directions?Tab=3
// 와이즈파크(yzpark.kr) 공식 사이트는 접속 불가(타임아웃) — 주차장 존재만(카카오 부속 주차장 항목) parking true, 노트 비움 → pending "공식 대조"
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFile } from 'fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry')

const NEW = [
  { slug: 'lotte-department-centum-city-7856243', name: '롯데백화점 센텀시티점', place_type: 'DEPARTMENT_STORE', addr: '부산 해운대구 센텀남대로 59', region: '부산', district: '해운대구',
    lat: 35.16981500549287, lng: 129.1310930492833, kakao_place_id: '7856243', category_name: '가정,생활 > 백화점 > 롯데백화점',
    parking: true, parking_note: '주차 가능(유료)\n최초 30분 무료, 이후 10분당 500원\n구매 시 무료: 1만원 이상 1시간 · 3만원 이상 2시간 · 5만원 이상 3시간 · 10만원 이상 4시간 · 20만원 이상 5시간\n현금 결제 불가(카드만)', access_note: null },
  { slug: 'mario-outlet-3-11952414', name: '마리오아울렛 3관', place_type: 'SHOPPING_MALL', addr: '서울 금천구 벚꽃로 266', region: '서울', district: '금천구',
    lat: 37.4785062262483, lng: 126.8850818753139, kakao_place_id: '11952414', category_name: '가정,생활 > 상설할인매장',
    parking: true, parking_note: '주차 가능(유료)\n입차 후 30분 무료, 이후 10분당 500원\n구매 시 무료: 5만원 미만 1시간 · 5만원 이상 2시간 · 10만원 이상 3시간 · 20만원 이상 4시간 · 30만원 이상 5시간 · 40만원 이상 6시간 · 50만원 이상 당일\n결제 시 차량번호 등록하면 자동 적용, 현금 결제 불가', access_note: null },
  { slug: 'yz-park-hongdae-17469830', name: '와이즈파크 홍대', place_type: 'SHOPPING_MALL', addr: '서울 마포구 양화로 176', region: '서울', district: '마포구',
    lat: 37.5572572432364, lng: 126.925140808483, kakao_place_id: '17469830', category_name: '가정,생활 > 상가,아케이드',
    parking: true, parking_note: null, access_note: null },
  { slug: 'yz-park-busan-22676228', name: '와이즈파크 광복점', place_type: 'SHOPPING_MALL', addr: '부산 중구 광복로39번길 6', region: '부산', district: '중구',
    lat: 35.0995975753445, lng: 129.029598788017, kakao_place_id: '22676228', category_name: '가정,생활 > 상가,아케이드',
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
  const file = `scripts/shops/backups/places-before-2026-09-29-k-${Date.now()}.json`
  await writeFile(file, JSON.stringify(touched, null, 1))
  console.log('backup', file)
}
