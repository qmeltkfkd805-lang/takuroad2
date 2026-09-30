// 2026-09-29(j) 샵 등록분 건물 매핑용 places — kakao_place_id 로 있으면 재사용, 없을 때만 만든다.
// 기존 places 는 비어 있는 parking/parking_note 만 채운다(덮어쓰기 없음). 변경 전 행을 backups/ 에 남긴다.
//   node scripts/shops/ensurePlaces-2026-09-29-j.mjs [--dry]
// 주차 안내 출처: 커넥트현대 청주 위치/주차 ehyundai.com/newPortal/DP/WC/WC000000_V.do?branchCd=B00179000 (2026-09-29 브라우저 렌더 텍스트로 확인) / 스타필드 하남 starfield.co.kr/hanam/about/parkingInfo.do (2026-09-29 브라우저)
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFile } from 'fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry')

const NEW = [
  { slug: 'connect-hyundai-cheongju-1129842715', name: '커넥트현대 청주', place_type: 'DEPARTMENT_STORE', addr: '충북 청주시 흥덕구 2순환로 1225', region: '충북', district: '청주시 흥덕구',
    lat: 36.62692169858845, lng: 127.43071540910543, kakao_place_id: '1129842715', category_name: '가정,생활 > 백화점',
    parking: true, parking_note: '주차 가능(유료)\n입차 후 30분 이내 출차 시 무료, 이후 10분당 1,000원(1일 최대 70,000원)\n구매 시 무료: 1만원 이상 1시간 · 3만원 이상 2시간 · 5만원 이상 3시간 · 10만원 이상 5시간 · 30만원 이상 당일',
    access_note: '청주고속버스터미널과 건물 바로 연결' },
  { slug: 'starfield-hanam-25894201', name: '스타필드 하남', place_type: 'SHOPPING_MALL', addr: '경기 하남시 미사대로 750', region: '경기', district: '하남시',
    lat: 37.545512916608395, lng: 127.22367994072209, kakao_place_id: '25894201', category_name: '가정,생활 > 복합쇼핑몰',
    parking: true, parking_note: '주차 가능(무료)\n트레이더스 이용 고객은 지하주차장 이용', access_note: null },
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
  const file = `scripts/shops/backups/places-before-2026-09-29-j-${Date.now()}.json`
  await writeFile(file, JSON.stringify(touched, null, 1))
  console.log('backup', file)
}
