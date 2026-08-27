import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const now = new Date().toISOString()

const { data: place, error: placeError } = await db.from('places').select('*').eq('kakao_place_id', '26992232').single()
if (placeError) throw placeError
let tag = await db.from('tags').select('*').eq('slug', 'it-takes-more-than-a-pretty-face-to-fall-in-love').maybeSingle()
if (tag.error) throw tag.error
if (!tag.data) {
  tag = await db.from('tags').insert({ name: '얼굴만으론 좋아할 수 없어요', slug: 'it-takes-more-than-a-pretty-face-to-fall-in-love' }).select('*').single()
  if (tag.error) throw tag.error
}

const event = {
  tag_id: tag.data.id, type: 'collab_cafe', title: '얼굴만으론 좋아할 수 없어요 × SMG CAFE 콜라보 카페',
  start_date: '2026-07-31', end_date: '2026-08-26', reserve_start: null, reserve_end: null,
  entry_info: '현장 선착순 입장',
  description: '만화 「얼굴만으론 좋아할 수 없어요」를 테마로 한 공식 콜라보 카페입니다. 캐릭터 메뉴와 공식 상품, 메뉴 구매 특전을 만날 수 있습니다.',
  cover_url: 'https://media.orings.co.kr/static/place/2026-07-23/cf44ecd2-ab8e-4a60-bb2d-bf8a8cd80675.webp',
  place_id: place.id, place_name: place.name, place_addr: place.addr, place_lat: place.lat, place_lng: place.lng,
  place_detail: '지하 2층 SMG CAFE', parking: place.parking, parking_note: place.parking_note,
  hours: Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(day => [day, { open: '10:30', close: '22:00' }])),
  hours_info: '매일 10:30~22:00',
  source_urls: ['https://www.instagram.com/p/Da_szDgE-HR/', 'https://x.com/smgcafe_kr', 'https://ehyundai.com/newPortal/uplex/DP/WC/WC000000_V.do?branchCd=B00127100'],
  ticket_urls: [], updated_at: now,
}
const existing = await db.from('events').select('id').eq('title', event.title).eq('start_date', event.start_date).maybeSingle()
if (existing.error) throw existing.error
const result = existing.data ? await db.from('events').update(event).eq('id', existing.data.id).select('*').single() : await db.from('events').insert(event).select('*').single()
if (result.error) throw result.error
console.log(JSON.stringify({ status: existing.data ? 'UPDATE' : 'INSERT', event: result.data }, null, 2))
