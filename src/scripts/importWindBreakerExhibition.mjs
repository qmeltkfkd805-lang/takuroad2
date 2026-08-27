import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const now = new Date().toISOString()

const placeResult = await db.from('places').select('*').eq('kakao_place_id', '1156421273').single()
if (placeResult.error) throw placeResult.error
const place = placeResult.data

let tagResult = await db.from('tags').select('*').eq('slug', 'wind-breaker-satoru-nii').maybeSingle()
if (tagResult.error) throw tagResult.error
if (!tagResult.data) {
  tagResult = await db.from('tags').insert({
    name: 'WIND BREAKER (니이 사토루)',
    slug: 'wind-breaker-satoru-nii',
  }).select('*').single()
  if (tagResult.error) throw tagResult.error
}

const event = {
  tag_id: tagResult.data.id,
  type: 'exhibition',
  title: 'WIND BREAKER 5th ANNIVERSARY EXHIBITION',
  start_date: '2026-07-09',
  end_date: '2026-08-23',
  reserve_start: '2026-05-29',
  reserve_end: null,
  entry_info: '티켓 구매 후 입장',
  description: '니이 사토루의 만화 「WIND BREAKER」 연재 5주년을 기념하는 원화전입니다. 작품의 주요 장면과 캐릭터를 담은 원화를 관람하고 전시 기념 상품을 만날 수 있습니다.\n\n마지막 입장은 운영 종료 1시간 전까지 가능합니다.',
  cover_url: 'https://pbs.twimg.com/media/HIFj9sCakAAFC55.jpg?name=orig',
  place_id: place.id,
  place_name: place.name,
  place_addr: place.addr,
  place_lat: place.lat,
  place_lng: place.lng,
  place_detail: '3층 Space Galleria 서울 홍대',
  parking: place.parking,
  parking_note: place.parking_note,
  hours: {
    mon: { open: '11:00', close: '22:00' },
    tue: { open: '11:00', close: '22:00' },
    wed: { open: '11:00', close: '22:00' },
    thu: { open: '11:00', close: '22:00' },
    fri: { open: '11:00', close: '22:00' },
    sat: { open: '10:30', close: '22:00' },
    sun: { open: '10:30', close: '22:00' },
  },
  hours_info: '월~금 11:00~22:00\n토·일·공휴일 10:30~22:00\n입장 마감 21:00',
  source_urls: [
    'https://x.com/SpaceGalleriaKR/status/2054033831305572824',
    'https://www.popcondplay.com/ip/news/view/525',
  ],
  ticket_urls: [
    { url: 'https://ticket.melon.com/performance/index.htm?prodId=213312', label: '전시 예매하기' },
  ],
  updated_at: now,
}

const existing = await db.from('events').select('id').eq('title', event.title).eq('start_date', event.start_date).maybeSingle()
if (existing.error) throw existing.error

const result = existing.data
  ? await db.from('events').update(event).eq('id', existing.data.id).select('*').single()
  : await db.from('events').insert(event).select('*').single()
if (result.error) throw result.error

console.log(JSON.stringify({ status: existing.data ? 'UPDATE' : 'INSERT', event: result.data }, null, 2))
