import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const officialUrl = 'https://m.animate-onlineshop.co.kr/board/view.php?bdId=event&sno=484&noheader=y'
const storeUrl = 'https://www.animate-onlineshop.co.kr/main/html.php?htmid=service%2Fshopinfo.html'
const hoursUrl = 'https://www.animate-onlineshop.co.kr/board/view.php?bdId=notice2&sno=2'
const posterUrl = 'https://cdn-pro-web-250-117.cdn-nhncommerce.com/animatete13_godomall_com/data/editor/board/event/f646e1ac7c01bee5572525a1dbc661c5_120627.jpeg'
const titleBase = 'Re:제로부터 시작하는 이세계 생활 4th season FAIR in animate'
const branches = [
  { suffix: '홍대점', placeId: '6c9bad49-7a5b-43d3-b2df-405a2e5df390', detail: '5층 애니메이트 홍대점', hours: [['mon','11:00','21:40'],['tue','11:00','21:40'],['wed','11:00','21:40'],['thu','11:00','21:40'],['fri','11:00','21:40'],['sat','10:30','21:40'],['sun','10:30','21:40']], hoursInfo: '월~금 11:00~21:40\n토·일 10:30~21:40' },
  { suffix: '잠실롯데점', placeId: '1a2065ca-3c50-406b-a261-62bfaa979c24', detail: '롯데월드 쇼핑몰동 B1층 애니메이트 잠실롯데점', hours: [['mon','10:00','20:40'],['tue','10:00','20:40'],['wed','10:00','20:40'],['thu','10:00','20:40'],['fri','10:00','21:10'],['sat','10:00','21:10'],['sun','10:00','20:40']], hoursInfo: '월~목·일 10:00~20:40\n금·토 10:00~21:10' },
  { suffix: '부산점', placeId: 'b467aaa6-a278-4498-9faa-7ee848631247', detail: '삼정타워 11층 애니메이트 부산점', hours: [['mon','11:00','21:40'],['tue','11:00','21:40'],['wed','11:00','21:40'],['thu','11:00','21:40'],['fri','11:00','22:10'],['sat','11:00','22:10'],['sun','11:00','21:40']], hoursInfo: '월~목·일 11:00~21:40\n금·토 11:00~22:10' },
  { suffix: '수원점', placeId: 'f33d897a-5a4a-4fcb-a5ef-bfcd2c8c2f47', detail: '5층 애니메이트 수원점', hours: [['mon','10:30','20:30'],['tue','10:30','20:30'],['wed','10:30','20:30'],['thu','10:30','20:30'],['fri','10:30','20:30'],['sat','10:30','20:30'],['sun','10:30','20:30']], hoursInfo: '매일 10:30~20:30\nAK플라자 수원점 휴점일에는 휴무' },
]
const titles = branches.map((branch) => `${titleBase} (${branch.suffix})`)
const existing = await db.from('events').select('*').in('title', titles)
if (existing.error) throw existing.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-rezero-animate-fair-${Date.now()}.json`, JSON.stringify(existing.data, null, 2))

const placesResult = await db.from('places').select('*').in('id', branches.map((branch) => branch.placeId))
if (placesResult.error) throw placesResult.error
const places = Object.fromEntries(placesResult.data.map((place) => [place.id, place]))
const posterResponse = await fetch(posterUrl)
if (!posterResponse.ok) throw new Error(`Official poster download failed ${posterResponse.status}`)
const storagePath = 'covers/2026/re-zero-4th-season-animate-fair-main.jpeg'
const upload = await db.storage.from('event-goods').upload(storagePath, Buffer.from(await posterResponse.arrayBuffer()), { contentType: 'image/jpeg', upsert: true })
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl

const results = []
for (const branch of branches) {
  const title = `${titleBase} (${branch.suffix})`
  const place = places[branch.placeId]
  if (!place) throw new Error(`Place missing: ${branch.suffix}`)
  const record = {
    tag_id: 'aedfd403-e50a-4717-b509-74ff2362eae5', type: 'popup', title,
    start_date: '2026-08-26', end_date: '2026-09-13', reserve_start: null, reserve_end: null,
    entry_info: '현장 선착순 입장',
    description: '「Re:제로부터 시작하는 이세계 생활」 4th season을 기념해 관련 상품과 구매 특전을 만날 수 있는 애니메이트 공식 페어입니다.\n\n관련 상품을 구매하거나 예약한 금액 15,000원마다 브로마이드 8종 중 1장을 랜덤 증정합니다. 티켓과 쿠지는 특전 대상에서 제외되며, 특전은 준비 수량이 소진되면 조기 종료됩니다.',
    cover_url: coverUrl,
    place_id: place.id, place_name: place.name, place_addr: place.addr, place_lat: place.lat, place_lng: place.lng, place_detail: branch.detail,
    parking: place.parking, parking_note: place.parking_note,
    hours: Object.fromEntries(branch.hours.map(([day, open, close]) => [day, { open, close }])), hours_info: branch.hoursInfo,
    source_urls: [officialUrl, storeUrl, hoursUrl], ticket_urls: [], updated_by: editor, updated_at: new Date().toISOString(),
  }
  const old = existing.data.find((event) => event.title === title)
  const result = old
    ? await db.from('events').update(record).eq('id', old.id).select('id,title,start_date,end_date,place_name,hours_info,cover_url').single()
    : await db.from('events').insert(record).select('id,title,start_date,end_date,place_name,hours_info,cover_url').single()
  if (result.error) throw result.error
  results.push({ status: old ? 'UPDATE' : 'INSERT', ...result.data })
}
console.log(JSON.stringify(results, null, 2))
