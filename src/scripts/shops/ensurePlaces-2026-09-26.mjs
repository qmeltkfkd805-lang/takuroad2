// 2026-09-26 샵 건물 매핑용 공유 장소(places) 생성 — kakao_place_id 로 있으면 재사용, 없을 때만 만든다
//   node scripts/shops/ensurePlaces-2026-09-26.mjs [--dry]
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry')

const PLACES = [
  {
    slug: 'kukje-electronics-center-1903481629',
    name: '국제전자센터',
    place_type: 'SHOPPING_MALL',
    addr: '서울 서초구 효령로 304',
    region: '서울',
    district: '서초구',
    lat: 37.484734498793,
    lng: 127.01769492401,
    kakao_place_id: '1903481629',
    category_name: '가정,생활 > 상가,아케이드',
    // 공식 사이트(kecday.co.kr)는 2026-09-26 트래픽 한도로 조회 불가 → 2026-01 방문 확인 글 기준, 공식 대조 필요(pending)
    parking: true,
    parking_note: '주차 가능(유료) — 건물 지하 주차장\n최초 40분 무료\n이후 10분당 1,000원\n매장 구매·롯데마트 이용 시 주차 할인권 제공\n(2026년 1월 방문 기준 정보 — 변동 가능)',
    access_note: '지하철 3호선 남부터미널역과 지하로 연결',
    system_created: false,
  },
  {
    slug: 'starfield-goyang-627697814',
    name: '스타필드 고양',
    place_type: 'SHOPPING_MALL',
    addr: '경기 고양시 덕양구 고양대로 1955',
    region: '경기',
    district: '고양시 덕양구',
    lat: null,
    lng: null,
    kakao_place_id: '627697814',
    category_name: '가정,생활 > 복합쇼핑몰',
    parking: null,
    parking_note: null,
    system_created: false,
  },
]

const k = process.env.NEXT_PUBLIC_KAKAO_REST_KEY
for (const p of PLACES) {
  const got = await db.from('places').select('id, name, slug').eq('kakao_place_id', p.kakao_place_id).maybeSingle()
  if (got.error) throw got.error
  if (got.data) { console.log('EXISTS', got.data.id, got.data.name); continue }
  if (p.lat == null) {
    const j = await (await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?query=' + encodeURIComponent(p.name), { headers: { Authorization: 'KakaoAK ' + k } })).json()
    const d = j.documents.find((x) => x.id === p.kakao_place_id)
    if (!d) throw new Error('kakao place not found ' + p.name)
    p.lat = Number(d.y); p.lng = Number(d.x)
  }
  if (dry) { console.log('DRY_INSERT', p.name, p.lat, p.lng); continue }
  const r = await db.from('places').insert(p).select('id, name, slug').single()
  if (r.error) throw r.error
  console.log('INSERTED', r.data.id, r.data.name, r.data.slug)
}
