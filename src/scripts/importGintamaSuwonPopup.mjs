import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const hongdaeId = '8c2cf282-ad6f-4143-9884-3983baae86aa'
const tagId = 'cdc27204-c7f8-4f28-a4a7-fb7e8b7fc1b7'
const coverUrl = 'https://naverbooking-phinf.pstatic.net/20260707_60/1783408495678l29IF_PNG/image.png'
const officialPostUrl = 'https://x.com/limition_pick/status/2077936325211336857'
const officialAccountUrl = 'https://x.com/limition_pick'
const akSuwonUrl = 'https://www.akplaza.com/ajax/html/getMainStore'
const parkingGuideUrl = 'https://www.akplaza.com/store/news/view?pre=main&seq=24&store=02'

const parkingNote = `최초 30분 무료
무료시간 초과 시 10분당 500원
1만원 이상~3만원 미만 구매 시 1시간 무료
3만원 이상~5만원 미만 구매 시 2시간 무료
5만원 이상~10만원 미만 구매 시 3시간 무료
10만원 이상 구매 시 4시간 무료
백화점·쇼핑몰 구매 고객은 최대 4시간 무료`

const { data: place, error: placeError } = await db
  .from('places')
  .update({
    parking: true,
    parking_note: parkingNote,
  })
  .eq('kakao_place_id', '354622584')
  .select('id,name,addr,lat,lng,parking,parking_note')
  .single()
if (placeError) throw placeError

const hongdaeUpdate = await db.from('events').update({
  reserve_start: '2026-07-27',
  reserve_end: null,
  entry_info: '8월 4일~9일 사전예약 후 입장\n8월 10일부터 현장 입장',
  ticket_urls: [{
    url: 'https://booking.naver.com/booking/12/bizes/1682018',
    label: '홍대점 팝업 예약하기',
  }],
  updated_at: new Date().toISOString(),
}).eq('id', hongdaeId)
if (hongdaeUpdate.error) throw hongdaeUpdate.error

const event = {
  tag_id: tagId,
  type: 'popup_store',
  title: '신극장판 은혼: 요시와라 대염상 POP-UP STORE (수원점)',
  start_date: '2026-08-04',
  end_date: '2026-08-30',
  reserve_start: '2026-07-27',
  reserve_end: null,
  entry_info: '8월 4일~9일 사전예약 후 입장\n8월 10일부터 현장 입장',
  description: `신극장판 은혼: 요시와라 대염상을 테마로 한 팝업스토어입니다. 작품의 캐릭터와 장면을 활용한 오리지널 굿즈와 구매 특전을 만날 수 있습니다.

사전예약은 1인 1매이며, 입장 인원 수만큼 각각 예약해야 합니다. 상품별 구매 개수 제한이 적용될 수 있습니다.`,
  cover_url: coverUrl,
  place_id: place.id,
  place_name: place.name,
  place_addr: place.addr,
  place_lat: place.lat,
  place_lng: place.lng,
  place_detail: '5층 SMG STORE',
  parking: true,
  parking_note: parkingNote,
  hours: {
    mon: { open: '10:30', close: '22:00' },
    tue: { open: '10:30', close: '22:00' },
    wed: { open: '10:30', close: '22:00' },
    thu: { open: '10:30', close: '22:00' },
    fri: { open: '10:30', close: '22:00' },
    sat: { open: '10:30', close: '22:00' },
    sun: { open: '10:30', close: '22:00' },
  },
  hours_info: '매일 10:30~22:00',
  source_urls: [officialPostUrl, officialAccountUrl, akSuwonUrl, parkingGuideUrl],
  ticket_urls: [{
    url: 'https://booking.naver.com/booking/12/bizes/1682019',
    label: '수원점 팝업 예약하기',
  }],
  updated_at: new Date().toISOString(),
}

const duplicate = await db
  .from('events')
  .select('id,title')
  .eq('title', event.title)
  .eq('start_date', event.start_date)
  .maybeSingle()
if (duplicate.error) throw duplicate.error

let result
if (duplicate.data) {
  const updated = await db.from('events').update(event).eq('id', duplicate.data.id).select('*').single()
  if (updated.error) throw updated.error
  result = { status: 'UPDATE', event: updated.data }
} else {
  const inserted = await db.from('events').insert(event).select('*').single()
  if (inserted.error) throw inserted.error
  result = { status: 'INSERT', event: inserted.data }
}

const { data: hongdae, error: hongdaeReadError } = await db
  .from('events')
  .select('id,title,reserve_start,reserve_end,entry_info,ticket_urls')
  .eq('id', hongdaeId)
  .single()
if (hongdaeReadError) throw hongdaeReadError

console.log(JSON.stringify({ result, hongdae, place }, null, 2))
