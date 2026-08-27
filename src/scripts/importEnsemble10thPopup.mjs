import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const now = new Date().toISOString()

const { data: place, error: placeError } = await db.from('places').select('*').eq('kakao_place_id', '7990380').single()
if (placeError) throw placeError

const event = {
  tag_id: '03aff521-f417-4fec-b2ad-2fe0d4308d73',
  type: 'popup',
  title: '앙상블스타즈!! 10주년 팝업스토어 - SPOTLIGHT ON STAGE',
  start_date: '2026-08-11',
  end_date: '2026-08-26',
  reserve_start: '2026-08-04',
  reserve_end: null,
  entry_info: '사전예약 후 입장\n현장 입장은 공식 공지 시 가능',
  description: '앙상블스타즈!! 10주년을 기념해 새로운 테마 상품과 전시 공간을 선보이는 팝업스토어입니다.\n\n네이버 ID 1개당 1매만 예약할 수 있습니다. 현장 대기 입장은 여유 인원이 생길 때 공식 X에서 별도로 안내됩니다.',
  cover_url: 'https://media.orings.co.kr/static/place/2026-08-12/4a51b11f-31bb-4348-b3d4-d3017c6cc319.jpg',
  place_id: place.id,
  place_name: place.name,
  place_addr: place.addr,
  place_lat: place.lat,
  place_lng: place.lng,
  place_detail: '3층 도파민스테이션 더 팝업',
  parking: place.parking,
  parking_note: place.parking_note,
  hours: Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(day => [day, { open: '10:30', close: '22:00' }])),
  hours_info: '매일 10:30~22:00',
  source_urls: ['https://x.com/MofunOffline', 'https://x.com/EnsembleStoreSH'],
  ticket_urls: [{ url: 'https://booking.naver.com/booking/6/bizes/1705400', label: '팝업 예약하기' }],
  updated_at: now,
}

const existing = await db.from('events').select('id').eq('title', event.title).eq('start_date', event.start_date).maybeSingle()
if (existing.error) throw existing.error
const result = existing.data
  ? await db.from('events').update(event).eq('id', existing.data.id).select('*').single()
  : await db.from('events').insert(event).select('*').single()
if (result.error) throw result.error
console.log(JSON.stringify({ status: existing.data ? 'UPDATE' : 'INSERT', event: result.data }, null, 2))
