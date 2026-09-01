import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const tagId = 'a44bc564-3245-452b-b4d0-20848daadbc0'
const now = new Date().toISOString()

const candidates = [
  {
    key: 'hongdae',
    title: '이누야샤 POP-UP STORE (홍대점)',
    placeId: '6c9bad49-7a5b-43d3-b2df-405a2e5df390',
    placeName: 'AK플라자 홍대',
    addr: '서울 마포구 양화로 188',
    lat: 37.5578085490102,
    lng: 126.926407838298,
    detail: '4층 LIMITION',
    image: 'https://naverbooking-phinf.pstatic.net/20260813_207/1786577565954BERVY_PNG/image.png',
    ticket: 'https://booking.naver.com/booking/12/bizes/1716768',
    hours: {
      mon: { open: '11:00', close: '22:00' }, tue: { open: '11:00', close: '22:00' },
      wed: { open: '11:00', close: '22:00' }, thu: { open: '11:00', close: '22:00' },
      fri: { open: '11:00', close: '22:00' }, sat: { open: '10:30', close: '22:00' },
      sun: { open: '10:30', close: '22:00' },
    },
    hoursInfo: '월~금 11:00~22:00\n토·일 10:30~22:00',
    parkingNote: '주차 가능\n주중 최초 30분 3,000원, 이후 10분당 1,000원\n주말 최초 30분 5,000원, 이후 30분당 5,000원\n1만원 이상 구매 시 1시간, 3만원 이상 2시간, 5만원 이상 3시간 무료',
  },
  {
    key: 'suwon',
    title: '이누야샤 POP-UP STORE (수원점)',
    placeId: 'f33d897a-5a4a-4fcb-a5ef-bfcd2c8c2f47',
    placeName: 'AK플라자 수원',
    addr: '경기 수원시 팔달구 덕영대로 924',
    lat: 37.2655920786361,
    lng: 127.000180381035,
    detail: '5층 SMG STORE',
    image: 'https://naverbooking-phinf.pstatic.net/20260813_196/1786583950851y4Gua_PNG/image.png',
    ticket: 'https://booking.naver.com/booking/12/bizes/1716815',
    hours: Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(day => [day, { open: '10:30', close: '22:00' }])),
    hoursInfo: '매일 10:30~22:00',
    parkingNote: '주차 가능\n최초 30분 무료, 이후 10분당 500원\n1만원 이상 1시간, 3만원 이상 2시간, 5만원 이상 3시간, 10만원 이상 4시간 무료\n구매 고객 최대 4시간 무료',
  },
]

const titles = candidates.map(item => item.title)
const old = await db.from('events').select('*').in('title', titles)
if (old.error) throw old.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-inuyasha-popup-${Date.now()}.json`, JSON.stringify(old.data, null, 2))

const output = []
for (const item of candidates) {
  const response = await fetch(item.image)
  if (!response.ok) throw new Error(`poster download failed: ${response.status} ${item.image}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const storagePath = `covers/2026/inuyasha-popup-${item.key}.png`
  const upload = await db.storage.from('event-goods').upload(storagePath, bytes, { contentType: 'image/png', upsert: true })
  if (upload.error) throw upload.error
  const coverUrl = db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl

  const event = {
    tag_id: tagId,
    type: 'popup',
    title: item.title,
    start_date: '2026-09-01',
    end_date: '2026-09-22',
    reserve_start: '2026-08-24',
    reserve_end: null,
    entry_info: '사전예약 후 입장\n현장예약 가능\n9월 7일부터 현장 선착순 입장',
    description: '「이누야샤」의 캐릭터 굿즈와 구매 특전을 만날 수 있는 공식 팝업스토어입니다.\n\n9월 1일은 사전예약자만 입장할 수 있습니다. 9월 2일부터 6일까지는 예약 노쇼가 발생한 경우에만 현장 나우웨이팅 등록 후 입장할 수 있으며 조기 마감될 수 있습니다.\n\n예약은 1인 1매 기준이며 입장 인원 수만큼 각각 예약해야 합니다.',
    cover_url: coverUrl,
    place_id: item.placeId,
    place_name: item.placeName,
    place_addr: item.addr,
    place_lat: item.lat,
    place_lng: item.lng,
    place_detail: item.detail,
    parking: true,
    parking_note: item.parkingNote,
    hours: item.hours,
    hours_info: item.hoursInfo,
    source_urls: ['https://x.com/limition_pick', 'https://x.com/smgstore_kr', 'https://m.akplaza.com/store/introduce?store=51'],
    ticket_urls: [{ url: item.ticket, label: '팝업 사전예약하기' }],
    updated_by: editor,
    updated_at: now,
  }

  const existing = old.data.find(row => row.title === item.title)
  const result = existing
    ? await db.from('events').update(event).eq('id', existing.id).select('id,title,start_date,end_date,reserve_start,reserve_end,place_name,place_detail,hours_info,entry_info,cover_url,ticket_urls').single()
    : await db.from('events').insert(event).select('id,title,start_date,end_date,reserve_start,reserve_end,place_name,place_detail,hours_info,entry_info,cover_url,ticket_urls').single()
  if (result.error) throw result.error
  output.push({ status: existing ? 'UPDATE' : 'INSERT', ...result.data })
}

console.log(JSON.stringify(output, null, 2))
