import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const storeUrl = 'https://www.animate-onlineshop.co.kr/main/html.php?htmid=service%2Fshopinfo.html'
const hoursUrl = 'https://www.animate-onlineshop.co.kr/board/view.php?bdId=notice2&sno=2'
const branches = [
  { suffix: '홍대점', placeId: '6c9bad49-7a5b-43d3-b2df-405a2e5df390', detail: '5층 애니메이트 홍대점', hours: [['mon','11:00','21:40'],['tue','11:00','21:40'],['wed','11:00','21:40'],['thu','11:00','21:40'],['fri','11:00','21:40'],['sat','10:30','21:40'],['sun','10:30','21:40']], hoursInfo: '월~금 11:00~21:40\n토·일 10:30~21:40' },
  { suffix: '잠실롯데점', placeId: '1a2065ca-3c50-406b-a261-62bfaa979c24', detail: '롯데월드 쇼핑몰동 B1층 애니메이트 잠실롯데점', hours: [['mon','10:00','20:40'],['tue','10:00','20:40'],['wed','10:00','20:40'],['thu','10:00','20:40'],['fri','10:00','21:10'],['sat','10:00','21:10'],['sun','10:00','20:40']], hoursInfo: '월~목·일 10:00~20:40\n금·토 10:00~21:10' },
  { suffix: '부산점', placeId: 'b467aaa6-a278-4498-9faa-7ee848631247', detail: '삼정타워 11층 애니메이트 부산점', hours: [['mon','11:00','21:40'],['tue','11:00','21:40'],['wed','11:00','21:40'],['thu','11:00','21:40'],['fri','11:00','22:10'],['sat','11:00','22:10'],['sun','11:00','21:40']], hoursInfo: '월~목·일 11:00~21:40\n금·토 11:00~22:10' },
]
const fairs = [
  {
    titleBase: '「장송의 프리렌」 ~꿈을 꾸는 마법~ 애니메이트 페어',
    tagId: 'fb8c03af-9bdc-4fb2-8fef-8d9a7792873c',
    officialUrl: 'https://m.animate-onlineshop.co.kr/board/view.php?bdId=event&sno=483&noheader=y',
    posterUrl: 'https://cdn-pro-web-250-117.cdn-nhncommerce.com/animatete13_godomall_com/data/editor/board/event/678900f5bc76e369cba94a06cd8f1d93_110052.jpeg',
    storagePath: 'covers/2026/frieren-dreaming-magic-animate-fair.jpeg',
    benefit: '비주얼 카드 10종 중 1장',
    intro: '「장송의 프리렌」의 ‘꿈을 꾸는 마법’ 일러스트 상품과 구매 특전을 만날 수 있는 애니메이트 공식 페어입니다.',
  },
  {
    titleBase: '오란고교 사교클럽 20주년 기념 페어',
    tagId: '4d4b02e7-2835-45ce-8357-c92992d69387',
    officialUrl: 'https://m.animate-onlineshop.co.kr/board/view.php?bdId=event&sno=481&noheader=y',
    posterUrl: 'https://cdn-pro-web-250-117.cdn-nhncommerce.com/animatete13_godomall_com/data/editor/board/event/a2f4267f8352238e9b5682ee5bcc581d_145831.jpeg',
    storagePath: 'covers/2026/ouran-20th-animate-fair.jpeg',
    benefit: '브로마이드 7종 중 1장',
    intro: '「오란고교 사교클럽」 20주년 기념 상품과 구매 특전을 만날 수 있는 애니메이트 공식 페어입니다.',
  },
]
const titles = fairs.flatMap((fair) => branches.map((branch) => `${fair.titleBase} (${branch.suffix})`))
const existing = await db.from('events').select('*').in('title', titles)
if (existing.error) throw existing.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-frieren-ouran-fairs-${Date.now()}.json`, JSON.stringify(existing.data, null, 2))
const placesResult = await db.from('places').select('*').in('id', branches.map((branch) => branch.placeId))
if (placesResult.error) throw placesResult.error
const places = Object.fromEntries(placesResult.data.map((place) => [place.id, place]))

const results = []
for (const fair of fairs) {
  const image = await fetch(fair.posterUrl)
  if (!image.ok) throw new Error(`Official poster download failed ${image.status}: ${fair.titleBase}`)
  const upload = await db.storage.from('event-goods').upload(fair.storagePath, Buffer.from(await image.arrayBuffer()), { contentType: 'image/jpeg', upsert: true })
  if (upload.error) throw upload.error
  const coverUrl = db.storage.from('event-goods').getPublicUrl(fair.storagePath).data.publicUrl
  for (const branch of branches) {
    const title = `${fair.titleBase} (${branch.suffix})`
    const place = places[branch.placeId]
    const record = {
      tag_id: fair.tagId, type: 'popup', title,
      start_date: '2026-08-15', end_date: '2026-08-30', reserve_start: null, reserve_end: null,
      entry_info: '현장 선착순 입장',
      description: `${fair.intro}\n\n관련 상품을 구매하거나 예약한 금액 15,000원마다 ${fair.benefit}을 랜덤 증정합니다. 티켓과 쿠지는 특전 대상에서 제외되며, 특전은 준비 수량이 소진되면 조기 종료됩니다.`,
      cover_url: coverUrl,
      place_id: place.id, place_name: place.name, place_addr: place.addr, place_lat: place.lat, place_lng: place.lng, place_detail: branch.detail,
      parking: place.parking, parking_note: place.parking_note,
      hours: Object.fromEntries(branch.hours.map(([day, open, close]) => [day, { open, close }])), hours_info: branch.hoursInfo,
      source_urls: [fair.officialUrl, storeUrl, hoursUrl], ticket_urls: [], updated_by: editor, updated_at: new Date().toISOString(),
    }
    const old = existing.data.find((event) => event.title === title)
    const result = old
      ? await db.from('events').update(record).eq('id', old.id).select('id,title,place_name,hours_info,cover_url').single()
      : await db.from('events').insert(record).select('id,title,place_name,hours_info,cover_url').single()
    if (result.error) throw result.error
    results.push({ status: old ? 'UPDATE' : 'INSERT', ...result.data })
  }
}
console.log(JSON.stringify(results, null, 2))
