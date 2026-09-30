// 2026-09-27 샵 등록분 건물 매핑용 places — kakao_place_id 로 있으면 재사용, 없을 때만 만든다.
// 기존 places 는 비어 있는 parking/parking_note 만 채운다(덮어쓰기 없음). 변경 전 행을 backups/ 에 남긴다.
//   node scripts/shops/ensurePlaces-2026-09-27.mjs [--dry]
// 주차 안내 출처: 롯데백화점 대전점 lotteshopping.com/store/main?cstrCd=0012 · 신도림테크노마트 wtm21.co.kr/23 (2026-09-27 브라우저 렌더 텍스트로 확인)
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFile } from 'fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry')

const NEW = [
  { slug: 'lotte-department-store-daejeon-9755754', name: '롯데백화점 대전점', place_type: 'DEPARTMENT_STORE', addr: '대전 서구 계룡로 598', region: '대전', district: '서구',
    lat: 36.340653703926, lng: 127.389624974978, kakao_place_id: '9755754', category_name: '가정,생활 > 백화점 > 롯데백화점',
    parking: true, parking_note: '주차 가능(유료)\n최초 30분 무료, 이후 10분당 1,000원\n구매 시 무료: 1만원 1시간 · 5만원 2시간 · 10만원 3시간 · 20만원 4시간 · 30만원 5시간\n카드 결제만 가능(현금 불가)' },
  { slug: 'sindorim-technomart-10997504', name: '신도림테크노마트', place_type: 'SHOPPING_MALL', addr: '서울 구로구 새말로 97', region: '서울', district: '구로구',
    lat: 37.5070442017747, lng: 126.89022717990068, kakao_place_id: '10997504', category_name: '가정,생활 > 상가,아케이드',
    parking: true, parking_note: '주차 가능(유료) — 일반 주차장 B3F~B7F\n최초 30분 무료, 이후 30분당 1,500원\n2만원 이상 구매 영수증 제시 시 2시간 30분 추가(총 3시간)\n우대 할인 중복 불가 · 등록: 1F·10F 안내데스크, 이마트 고객센터 앞',
    access_note: '신도림역과 지하로 연결' },
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
  const file = `scripts/shops/backups/places-before-2026-09-27-${Date.now()}.json`
  await writeFile(file, JSON.stringify(touched, null, 1))
  console.log('backup', file)
}
