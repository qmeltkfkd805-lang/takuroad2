import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const now = new Date().toISOString()

let placeResult = await db.from('places').select('*').eq('kakao_place_id', '26992232').maybeSingle()
if (placeResult.error) throw placeResult.error
if (!placeResult.data) {
  placeResult = await db.from('places').insert({
    slug: 'hyundai-uplex-sinchon',
    name: '현대백화점유플렉스 신촌점',
    place_type: 'DEPARTMENT_STORE',
    addr: '서울 서대문구 연세로 13',
    region: '서울',
    district: '서대문구',
    lat: 37.55673777941326,
    lng: 126.93661730245256,
    kakao_place_id: '26992232',
    category_name: '가정,생활 > 백화점 > 현대백화점',
    parking: true,
    parking_note: '주차 가능(유료)\n최초 30분 무료, 초과 시 10분당 1,000원\n3만원 이상 구매 시 1시간, 5만원 이상 2시간, 10만원 이상 3시간 무료\n30만원 이상 구매 시 당일 무료',
  }).select('*').single()
  if (placeResult.error) throw placeResult.error
}
const place = placeResult.data

let tagResult = await db.from('tags').select('*').eq('slug', 'the-summer-hikaru-died').maybeSingle()
if (tagResult.error) throw tagResult.error
if (!tagResult.data) {
  tagResult = await db.from('tags').insert({ name: '히카루가 죽은 여름', slug: 'the-summer-hikaru-died' }).select('*').single()
  if (tagResult.error) throw tagResult.error
}

const event = {
  tag_id: tagResult.data.id,
  type: 'collab_cafe',
  title: '히카루가 죽은 여름 × MOAE:KU 콜라보 카페 (신촌점)',
  start_date: '2026-07-31',
  end_date: '2026-08-25',
  reserve_start: '2026-07-24',
  reserve_end: null,
  entry_info: '사전예약 후 입장',
  description: '애니메이션 「히카루가 죽은 여름」을 테마로 한 공식 콜라보 카페입니다. 캐릭터 메뉴와 공식 상품, 이용 특전을 만날 수 있습니다.',
  cover_url: 'https://media.orings.co.kr/static/place/2026-07-30/03199f70-1408-4c2f-babc-a3eeacebf653.jpg',
  place_id: place.id,
  place_name: place.name,
  place_addr: place.addr,
  place_lat: place.lat,
  place_lng: place.lng,
  place_detail: '지하 2층 MOAE:KU',
  parking: place.parking,
  parking_note: place.parking_note,
  hours: Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(day => [day, { open: '10:30', close: '22:00' }])),
  hours_info: '매일 10:30~22:00',
  source_urls: [
    'https://www.instagram.com/p/DbFvZfGGSTm/',
    'https://drmedia.kr/',
    'https://ehyundai.com/newPortal/uplex/DP/WC/WC000000_V.do?branchCd=B00127100',
  ],
  ticket_urls: [{
    url: 'https://booking.naver.com/booking/6/bizes/1404271/items/7899155?area=ple&lang=ko&startDate=2026-07-24&theme=place',
    label: '콜라보 카페 예약하기',
  }],
  updated_at: now,
}

const existing = await db.from('events').select('id').eq('title', event.title).eq('start_date', event.start_date).maybeSingle()
if (existing.error) throw existing.error
const result = existing.data
  ? await db.from('events').update(event).eq('id', existing.data.id).select('*').single()
  : await db.from('events').insert(event).select('*').single()
if (result.error) throw result.error
console.log(JSON.stringify({ status: existing.data ? 'UPDATE' : 'INSERT', event: result.data }, null, 2))
