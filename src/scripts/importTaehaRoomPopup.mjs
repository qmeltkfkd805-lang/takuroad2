import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '〈태하의 방 : 시든 꽃에 눈물을〉 팝업스토어'
const officialUrl = 'https://www.navercorp.com/media/pressReleasesDetail?seq=10034618'
const officialInstagram = 'https://www.instagram.com/webtoonfriends/'
const bookingUrl = 'https://booking.naver.com/booking/12/bizes/1713280/items/7943092'

const existing = await db.from('events').select('*').eq('title', title).eq('start_date', '2026-08-29').maybeSingle()
if (existing.error) throw existing.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-taeha-room-${Date.now()}.json`, JSON.stringify(existing.data, null, 2))

const place = await db.from('places').select('*').eq('id', '045ed3e4-9d81-4f68-a4c7-e6815f0ccadc').single()
if (place.error) throw place.error

const parkingNote = '주차 가능(유료)\n기본요금 10분당 1,500원\n무료 회차 없음\n당일 영수증 할인은 최대 5시간까지 적용'
const placeUpdate = await db.from('places').update({ parking: true, parking_note: parkingNote, updated_at: new Date().toISOString() }).eq('id', place.data.id)
if (placeUpdate.error) throw placeUpdate.error

let tag = await db.from('tags').select('*').eq('slug', 'tears-on-a-withered-flower').maybeSingle()
if (tag.error) throw tag.error
if (!tag.data) {
  tag = await db.from('tags').insert({
    name: '시든 꽃에 눈물을', slug: 'tears-on-a-withered-flower', ip_type: '웹툰',
    genres: ['로맨스', '드라마'],
    description: '삶에 지친 나해수 앞에 나타난 연하남 범태하를 중심으로 전개되는 현대 로맨스 웹툰.',
    official_url: 'https://comic.naver.com/webtoon/list?titleId=827190',
  }).select('*').single()
  if (tag.error) throw tag.error
}

const posterSource = 'https://naverbooking-phinf.pstatic.net/20260806_242/1786012909919tbxpH_JPEG/image.jpg'
const image = await fetch(posterSource)
if (!image.ok) throw new Error(`Official poster download failed ${image.status}`)
const storagePath = 'covers/2026/taeha-room-withered-flower-main.jpg'
const upload = await db.storage.from('event-goods').upload(storagePath, Buffer.from(await image.arrayBuffer()), { contentType: 'image/jpeg', upsert: true })
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl

const record = {
  tag_id: tag.data.id,
  type: 'popup_store',
  title,
  start_date: '2026-08-29',
  end_date: '2026-09-22',
  reserve_start: '2026-08-29',
  reserve_end: '2026-09-08',
  entry_info: '사전예약 후 입장 (8월 29일~9월 8일)\n9월 9일부터 현장 입장',
  description: '네이버웹툰 〈시든 꽃에 눈물을〉의 범태하 방을 오프라인에 구현한 공식 팝업스토어입니다. 신규 MD와 인기 굿즈, 단행본을 한자리에서 만나볼 수 있습니다.\n\n사전예약자 한정 특전이 제공됩니다. 현장에서는 구매 금액별 캐릭터 프로필 티켓 특전과 럭키드로우 이벤트가 진행되며, 특전과 상품은 재고 소진 시 조기 종료될 수 있습니다.',
  cover_url: coverUrl,
  place_id: place.data.id,
  place_name: place.data.name,
  place_addr: place.data.addr,
  place_lat: place.data.lat,
  place_lng: place.data.lng,
  place_detail: '3층 도파민스테이션',
  parking: true,
  parking_note: parkingNote,
  hours: {
    mon: { open: '10:30', close: '22:00' }, tue: { open: '10:30', close: '22:00' },
    wed: { open: '10:30', close: '22:00' }, thu: { open: '10:30', close: '22:00' },
    fri: { open: '10:30', close: '22:00' }, sat: { open: '10:30', close: '22:00' },
    sun: { open: '10:30', close: '22:00' },
  },
  hours_info: '매일 10:30~22:00',
  source_urls: [officialUrl, officialInstagram],
  ticket_urls: [{ url: bookingUrl, label: '팝업 사전예약하기' }],
  updated_by: editor,
  updated_at: new Date().toISOString(),
}

const result = existing.data
  ? await db.from('events').update(record).eq('id', existing.data.id).select('*').single()
  : await db.from('events').insert(record).select('*').single()
if (result.error) throw result.error

console.log(JSON.stringify({ status: existing.data ? 'UPDATE' : 'INSERT', event: result.data, place: { id: place.data.id, name: place.data.name }, coverUrl }, null, 2))
