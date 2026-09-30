// 2026-09-26 (2차) 샵 등록분 건물 매핑용 places — kakao_place_id 로 있으면 재사용, 없을 때만 만든다.
// 기존 places 는 비어 있는 parking/parking_note 만 채운다(덮어쓰기 없음). 변경 전 행을 backups/ 에 남긴다.
//   node scripts/shops/ensurePlaces-2026-09-26-b.mjs [--dry]
// 주차 안내 출처: 각 건물 공식 주차 안내 페이지(2026-09-26 브라우저 렌더 텍스트로 확인)
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFile } from 'fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry')

const NEW = [
  { slug: 'starfield-anseong-1331103660', name: '스타필드 안성', place_type: 'SHOPPING_MALL', addr: '경기 안성시 공도읍 서동대로 3930-39', region: '경기', district: '안성시',
    lat: 36.99502539359405, lng: 127.14709467672208, kakao_place_id: '1331103660', category_name: '가정,생활 > 복합쇼핑몰',
    parking: true, parking_note: '주차 가능(무료)\n트레이더스 이용 고객은 지하주차장 이용' },
  { slug: 'shinsegae-centum-city-7969139', name: '신세계백화점 센텀시티점', place_type: 'DEPARTMENT_STORE', addr: '부산 해운대구 센텀남대로 35', region: '부산', district: '해운대구',
    lat: 35.16864392798528, lng: 129.12907174004943, kakao_place_id: '7969139', category_name: '가정,생활 > 백화점 > 신세계백화점',
    parking: true, parking_note: '주차 가능(유료)\n최초 30분 무료, 이후 10분당 1,000원\n구매 시 무료: 1만원 이상 1시간 · 3만원 이상 2시간 · 5만원 이상 3시간 · 10만원 이상 4시간 · 20만원 이상 5시간\n식당가 이용 시 2시간 무료\n센텀시티몰(센텀4로 15) 포함 같은 주차 기준',
    access_note: '센텀시티몰(센텀4로 15)은 백화점과 지하·브릿지로 연결된 별관' },
  { slug: 'lotte-mall-gimpo-airport-15200464', name: '롯데몰 김포공항점', place_type: 'SHOPPING_MALL', addr: '서울 강서구 하늘길 38', region: '서울', district: '강서구',
    lat: 37.5633661796519, lng: 126.803148162496, kakao_place_id: '15200464', category_name: '가정,생활 > 복합쇼핑몰',
    parking: true, parking_note: '주차 가능(유료)\n최초 30분 무료, 이후 30분당 1,000원\n구매 시 무료: 1만원 1시간 · 3만원 2시간 · 5만원 3시간 · 10만원 6시간 · 30만원 12시간\n시네마·전시관 당일 관람권 제시 시 3시간 무료' },
  { slug: 'times-square-yeongdeungpo-11411449', name: '타임스퀘어', place_type: 'SHOPPING_MALL', addr: '서울 영등포구 영중로 15', region: '서울', district: '영등포구',
    lat: 37.5172951503156, lng: 126.90393083403768, kakao_place_id: '11411449', category_name: '가정,생활 > 복합쇼핑몰',
    parking: true, parking_note: '주차 가능(유료)\n최초 30분 무료, 이후 10분당 1,000원\n매장 이용 시 주차할인권 제공(일부 매장 제외), 1일 최대 8시간\n심야(20:00~09:00) 기본요금 50% 할인' },
  { slug: 'daejeon-complex-terminal-east-17385285', name: '대전복합터미널 동관', place_type: 'SHOPPING_MALL', addr: '대전 동구 동서대로1695번길 30', region: '대전', district: '동구',
    lat: 36.3513060565101, lng: 127.437408288317, kakao_place_id: '17385285', category_name: '교통,수송 > 교통시설 > 고속,시외버스터미널',
    parking: true, parking_note: '주차 가능(유료, 24시간)\n20분 이내 출차 시 무료, 최초 30분 1,000원, 이후 10분당 300원\n1일 최대 15,000원\n이마트·신세계 스타일마켓 구매 시: 1만원 이상 1시간 · 3만원 이상 2시간 · 5만원 이상 3시간 · 10만원 이상 4시간 할인\n할인 중복 불가, 카드·삼성페이만 가능(현금 불가)' },
]
// 기존 places: 비어 있을 때만 채움
const FILL = [
  { kakao_place_id: '627697814', parking: true, parking_note: '주차 가능(무료)\n21시 이후 2F~RF층 입차 제한(1층 주차장 이용)\n트레이더스 이용 고객은 지하주차장 이용' }, // 스타필드 고양
  { kakao_place_id: '1863118323', parking: true, parking_note: '주차 가능(유료)\n6시간 무료, 이후 10분당 500원(1일 최대 18,000원)\n본건물 혼잡 시 대유평공원 B1~B2 주차장 이용 가능' }, // 스타필드 수원
  { kakao_place_id: '8558184', parking: true, parking_note: '주차 가능(유료)\n입차 후 20분 이내 출차 시 무료, 15분당 1,500원(1일 최대 60,000원)\n코엑스몰 구매 시: 5만원 이상 1시간 · 10만원 이상 2시간 · 15만원 이상 3시간 무료(일부 매장 제외)\n카카오T 주차 모바일 결제 시 20% 할인' }, // 스타필드 코엑스몰
]

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
  const file = `scripts/shops/backups/places-before-2026-09-26-b-${Date.now()}.json`
  await writeFile(file, JSON.stringify(touched, null, 1))
  console.log('backup', file)
}
