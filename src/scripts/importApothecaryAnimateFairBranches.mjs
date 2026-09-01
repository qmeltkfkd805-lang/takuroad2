import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const tagId = '70ec9dbc-8eb6-41fd-bef2-9139a228fa86'
const officialUrl = 'https://m.animate-onlineshop.co.kr/board/view.php?bdId=event&memNo=&mypageFl=&noheader=&searchField=subject_contents&searchWord=%EC%95%BD%EC%82%AC%EC%9D%98&sno=469&totalPage=32'
const storeUrl = 'https://www.animate-onlineshop.co.kr/main/html.php?htmid=service%2Fshopinfo.html'
const hoursUrl = 'https://www.animate-onlineshop.co.kr/board/view.php?bdId=notice2&sno=2'
const posterUrl = 'https://cdn-pro-web-250-117.cdn-nhncommerce.com/animatete13_godomall_com/data/editor/board/event/4c2a9c81f69e8e38248078e1a771ff27_180531.jpg'

const branchTitles = [
  '약사의 혼잣말 × 애니메이트 콜라보 카페 (홍대점)',
  '약사의 혼잣말 × 애니메이트 콜라보 카페 (잠실점)',
  '약사의 혼잣말 만우절 페어 2026 in animate (부산점)',
  '약사의 혼잣말 만우절 페어 2026 in animate (수원점)',
]
const existing = await db.from('events').select('*').in('title', branchTitles)
if (existing.error) throw existing.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-apothecary-animate-fair-${Date.now()}.json`, JSON.stringify(existing.data, null, 2))

const posterResponse = await fetch(posterUrl)
if (!posterResponse.ok) throw new Error(`Official poster download failed ${posterResponse.status}`)
const storagePath = 'covers/2026/apothecary-animate-april-fools-fair-main.jpg'
const upload = await db.storage.from('event-goods').upload(storagePath, Buffer.from(await posterResponse.arrayBuffer()), { contentType: 'image/jpeg', upsert: true })
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl

const placesResult = await db.from('places').select('*').in('id', [
  '6c9bad49-7a5b-43d3-b2df-405a2e5df390',
  '1a2065ca-3c50-406b-a261-62bfaa979c24',
  'b467aaa6-a278-4498-9faa-7ee848631247',
  'f33d897a-5a4a-4fcb-a5ef-bfcd2c8c2f47',
])
if (placesResult.error) throw placesResult.error
const places = Object.fromEntries(placesResult.data.map((place) => [place.id, place]))
const weekly = (entries) => Object.fromEntries(entries)

const common = {
  tag_id: tagId,
  start_date: '2026-08-22',
  end_date: '2026-09-06',
  reserve_start: null,
  reserve_end: null,
  entry_info: '현장 선착순 입장',
  cover_url: coverUrl,
  source_urls: [officialUrl, storeUrl, hoursUrl],
  ticket_urls: [],
  updated_by: editor,
  updated_at: new Date().toISOString(),
}
const records = [
  {
    ...common,
    type: 'collab_cafe',
    title: branchTitles[0],
    description: '「약사의 혼잣말」 만우절 일러스트를 활용한 Gratte 메뉴와 공식 페어 상품을 만날 수 있는 콜라보 카페입니다.\n\n관련 상품·Gratte·유상 특전을 합산해 15,000원 구매할 때마다 비주얼 카드 7종 중 1장을 랜덤 증정합니다. 특전은 준비 수량이 소진되면 조기 종료됩니다.',
    place_id: places['6c9bad49-7a5b-43d3-b2df-405a2e5df390'].id,
    place_name: places['6c9bad49-7a5b-43d3-b2df-405a2e5df390'].name,
    place_addr: places['6c9bad49-7a5b-43d3-b2df-405a2e5df390'].addr,
    place_lat: places['6c9bad49-7a5b-43d3-b2df-405a2e5df390'].lat,
    place_lng: places['6c9bad49-7a5b-43d3-b2df-405a2e5df390'].lng,
    place_detail: '5층 애니메이트 카페 홍대점',
    parking: true,
    parking_note: places['6c9bad49-7a5b-43d3-b2df-405a2e5df390'].parking_note,
    hours: weekly([['mon',{open:'11:00',close:'21:40'}],['tue',{open:'11:00',close:'21:40'}],['wed',{open:'11:00',close:'21:40'}],['thu',{open:'11:00',close:'21:40'}],['fri',{open:'11:00',close:'21:40'}],['sat',{open:'10:30',close:'21:40'}],['sun',{open:'10:30',close:'21:40'}]]),
    hours_info: '월~금 11:00~21:40\n토·일 10:30~21:40',
  },
  {
    ...common,
    type: 'collab_cafe',
    title: branchTitles[1],
    description: '「약사의 혼잣말」 만우절 일러스트를 활용한 Gratte 메뉴와 공식 페어 상품을 만날 수 있는 콜라보 카페입니다.\n\n관련 상품·Gratte·유상 특전을 합산해 15,000원 구매할 때마다 비주얼 카드 7종 중 1장을 랜덤 증정합니다. 특전은 준비 수량이 소진되면 조기 종료됩니다.',
    place_id: places['1a2065ca-3c50-406b-a261-62bfaa979c24'].id,
    place_name: places['1a2065ca-3c50-406b-a261-62bfaa979c24'].name,
    place_addr: places['1a2065ca-3c50-406b-a261-62bfaa979c24'].addr,
    place_lat: places['1a2065ca-3c50-406b-a261-62bfaa979c24'].lat,
    place_lng: places['1a2065ca-3c50-406b-a261-62bfaa979c24'].lng,
    place_detail: '롯데월드 쇼핑몰동 B1층 애니메이트 카페 잠실롯데점',
    parking: true,
    parking_note: places['1a2065ca-3c50-406b-a261-62bfaa979c24'].parking_note,
    hours: weekly([['mon',{open:'10:00',close:'20:40'}],['tue',{open:'10:00',close:'20:40'}],['wed',{open:'10:00',close:'20:40'}],['thu',{open:'10:00',close:'20:40'}],['fri',{open:'10:00',close:'21:10'}],['sat',{open:'10:00',close:'21:10'}],['sun',{open:'10:00',close:'20:40'}]]),
    hours_info: '월~목·일 10:00~20:40\n금·토 10:00~21:10',
  },
  {
    ...common,
    type: 'popup',
    title: branchTitles[2],
    description: '「약사의 혼잣말」 만우절 일러스트 상품과 구매 특전을 만날 수 있는 애니메이트 공식 페어입니다.\n\n관련 상품·유상 특전을 합산해 15,000원 구매할 때마다 비주얼 카드 7종 중 1장을 랜덤 증정합니다. 특전은 준비 수량이 소진되면 조기 종료됩니다.',
    place_id: places['b467aaa6-a278-4498-9faa-7ee848631247'].id,
    place_name: places['b467aaa6-a278-4498-9faa-7ee848631247'].name,
    place_addr: places['b467aaa6-a278-4498-9faa-7ee848631247'].addr,
    place_lat: places['b467aaa6-a278-4498-9faa-7ee848631247'].lat,
    place_lng: places['b467aaa6-a278-4498-9faa-7ee848631247'].lng,
    place_detail: '삼정타워 11층',
    parking: true,
    parking_note: places['b467aaa6-a278-4498-9faa-7ee848631247'].parking_note,
    hours: weekly([['mon',{open:'11:00',close:'21:40'}],['tue',{open:'11:00',close:'21:40'}],['wed',{open:'11:00',close:'21:40'}],['thu',{open:'11:00',close:'21:40'}],['fri',{open:'11:00',close:'22:10'}],['sat',{open:'11:00',close:'22:10'}],['sun',{open:'11:00',close:'21:40'}]]),
    hours_info: '월~목·일 11:00~21:40\n금·토 11:00~22:10',
  },
  {
    ...common,
    type: 'popup',
    title: branchTitles[3],
    description: '「약사의 혼잣말」 만우절 일러스트 상품과 구매 특전을 만날 수 있는 애니메이트 공식 페어입니다.\n\n관련 상품·유상 특전을 합산해 15,000원 구매할 때마다 비주얼 카드 7종 중 1장을 랜덤 증정합니다. 특전은 준비 수량이 소진되면 조기 종료됩니다.',
    place_id: places['f33d897a-5a4a-4fcb-a5ef-bfcd2c8c2f47'].id,
    place_name: places['f33d897a-5a4a-4fcb-a5ef-bfcd2c8c2f47'].name,
    place_addr: places['f33d897a-5a4a-4fcb-a5ef-bfcd2c8c2f47'].addr,
    place_lat: places['f33d897a-5a4a-4fcb-a5ef-bfcd2c8c2f47'].lat,
    place_lng: places['f33d897a-5a4a-4fcb-a5ef-bfcd2c8c2f47'].lng,
    place_detail: '5층 애니메이트 수원점',
    parking: true,
    parking_note: places['f33d897a-5a4a-4fcb-a5ef-bfcd2c8c2f47'].parking_note,
    hours: weekly([['mon',{open:'10:30',close:'20:30'}],['tue',{open:'10:30',close:'20:30'}],['wed',{open:'10:30',close:'20:30'}],['thu',{open:'10:30',close:'20:30'}],['fri',{open:'10:30',close:'20:30'}],['sat',{open:'10:30',close:'20:30'}],['sun',{open:'10:30',close:'20:30'}]]),
    hours_info: '매일 10:30~20:30\nAK플라자 수원점 휴점일에는 휴무',
  },
]

const results = []
for (const record of records) {
  const old = existing.data.find((event) => event.title === record.title)
  const result = old
    ? await db.from('events').update(record).eq('id', old.id).select('id,title,start_date,end_date,place_name,place_detail,hours_info,cover_url,source_urls').single()
    : await db.from('events').insert(record).select('id,title,start_date,end_date,place_name,place_detail,hours_info,cover_url,source_urls').single()
  if (result.error) throw result.error
  results.push({ status: old ? 'UPDATE' : 'INSERT', ...result.data })
}
console.log(JSON.stringify(results, null, 2))
