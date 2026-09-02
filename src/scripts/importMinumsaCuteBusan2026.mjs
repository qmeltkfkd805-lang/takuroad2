import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { findShopId } from './lib/findShopId.mjs'
import { resolveSeriesKey } from './lib/seriesKey.mjs'

config({ path: '../.env.local' })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '민음사 × 오늘의귀여움 팝업 - 문장 너머의 세계: 몰입의 바다'
const officialGoods = [
  ['부실감자 액정 클리너 - 세계문학전집', 'https://sibf.minumsa.com/wp-content/uploads/2026/06/8800285938409_%EB%AF%BC%EC%9D%8C%EC%82%AC-%EB%B6%80%EC%8B%A4%EA%B0%90%EC%9E%90-%EC%95%A1%EC%A0%95%ED%81%B4%EB%A6%AC%EB%84%88%EC%84%B8%EA%B3%84%EB%AC%B8%ED%95%99%EC%A0%84%EC%A7%91_A.png'],
  ['부실감자 스탬프', 'https://sibf.minumsa.com/wp-content/uploads/2026/06/8800285938614_%EB%AF%BC%EC%9D%8C%EC%82%AC-%EB%B6%80%EC%8B%A4%EA%B0%90%EC%9E%90-%EC%8A%A4%ED%83%AC%ED%94%84_A.png'],
  ['치즈덕 스탬프', 'https://sibf.minumsa.com/wp-content/uploads/2026/06/8800285938621_%EB%AF%BC%EC%9D%8C%EC%82%AC-%EC%B9%98%EC%A6%88%EB%8D%95-%EC%8A%A4%ED%83%AC%ED%94%84_A.png'],
  ['부실감자 마킹 액세서리 - 세계문학전집과 함께', 'https://sibf.minumsa.com/wp-content/uploads/2026/06/8800285938706_%EB%AF%BC%EC%9D%8C%EC%82%AC-%EB%B6%80%EC%8B%A4%EA%B0%90%EC%9E%90-%EB%A7%88%ED%82%B9%EC%95%85%EC%84%B8%EC%82%AC%EB%A6%AC%EC%84%B8%EA%B3%84%EB%AC%B8%ED%95%99%EC%A0%84%EC%A7%91%EA%B3%BC-%ED%95%A8%EA%BB%98_A.png'],
  ['찌그렁오리 아크릴 키링 - 독서', 'https://sibf.minumsa.com/wp-content/uploads/2026/06/8800285938713_%EB%AF%BC%EC%9D%8C%EC%82%AC-%EC%B0%8C%EA%B7%B8%EB%A0%81%EC%98%A4%EB%A6%AC-%EC%95%84%ED%81%AC%EB%A6%B4-%ED%82%A4%EB%A7%81%EB%8F%85%EC%84%9C_A.png'],
  ['김바덕 아크릴 키링 - 독서', 'https://sibf.minumsa.com/wp-content/uploads/2026/06/8800285938744_%EB%AF%BC%EC%9D%8C%EC%82%AC-%EA%B9%80%EB%B0%94%EB%8D%95-%EC%95%84%ED%81%AC%EB%A6%B4-%ED%82%A4%EB%A7%81%EB%8F%85%EC%84%9C_A.png'],
  ['부실감자 렌티큘러 책갈피', 'https://sibf.minumsa.com/wp-content/uploads/2026/06/8800285938751_%EB%AF%BC%EC%9D%8C%EC%82%AC-%EB%B6%80%EC%8B%A4%EA%B0%90%EC%9E%90-%EB%A0%8C%ED%8B%B0%ED%81%98%EB%9F%AC-%EC%B1%85%EA%B0%88%ED%94%BC_A.png'],
  ['치즈덕 렌티큘러 책갈피', 'https://sibf.minumsa.com/wp-content/uploads/2026/06/8800285938768_%EB%AF%BC%EC%9D%8C%EC%82%AC-%EC%B9%98%EC%A6%88%EB%8D%95-%EB%A0%8C%ED%8B%B0%ED%81%98%EB%9F%AC-%EC%B1%85%EA%B0%88%ED%94%BC_A.png'],
  ['부실감자 컵 피규어', 'https://sibf.minumsa.com/wp-content/uploads/2026/06/8800285938799_%EB%AF%BC%EC%9D%8C%EC%82%AC-%EB%B6%80%EC%8B%A4%EA%B0%90%EC%9E%90-%EC%BB%B5%ED%94%BC%EA%B7%9C%EC%96%B4_A.png'],
  ['미니 북 키링 - 세계문학전집', 'https://sibf.minumsa.com/wp-content/uploads/2026/06/8800383910017_%EB%AF%BC%EC%9D%8C%EC%82%AC-%EB%AF%B8%EB%8B%88-%EB%B6%81-%ED%82%A4%EB%A7%81-%EC%84%B8%EB%AC%B8%EC%A0%84_A.png'],
  ['미니 북 키링 - 절판도서', 'https://sibf.minumsa.com/wp-content/uploads/2026/06/8800383910024_%EB%AF%BC%EC%9D%8C%EC%82%AC-%EB%AF%B8%EB%8B%88-%EB%B6%81-%ED%82%A4%EB%A7%81-%EC%A0%88%ED%8C%90%EB%8F%84%EC%84%9C_A.png'],
]

const duplicateQuery = await db.from('events').select('*')
  .or('title.ilike.%문장 너머의 세계%,title.ilike.%오늘의귀여움%,title.ilike.%민음사%')
if (duplicateQuery.error) throw duplicateQuery.error

const placeQuery = await db.from('places').select('*').eq('id', '6a3e3e01-c868-4948-b8a6-942678852eeb').single()
if (placeQuery.error) throw placeQuery.error

let tagQuery = await db.from('tags').select('*').or('name.eq.오늘의귀여움,slug.eq.today-cuteness').limit(1).maybeSingle()
if (tagQuery.error) throw tagQuery.error
if (!tagQuery.data) {
  tagQuery = await db.from('tags').insert({ name: '오늘의귀여움', slug: 'today-cuteness', created_by: editor }).select('*').single()
  if (tagQuery.error) throw tagQuery.error
}

await mkdir('scripts/event-backups', { recursive: true })
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
await writeFile(
  `scripts/event-backups/before-minumsa-cute-busan-${stamp}.json`,
  JSON.stringify({ events: duplicateQuery.data, place: placeQuery.data, tag: tagQuery.data }, null, 2),
)

const posterPath = 'event-posters/minumsa-today-cuteness-busan-2026.png'
const posterUpload = await db.storage.from('event-goods').upload(
  posterPath,
  await readFile('tmp-minumsa-event.png'),
  { contentType: 'image/png', upsert: true },
)
if (posterUpload.error) throw posterUpload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(posterPath).data.publicUrl

const event = {
  tag_id: tagQuery.data.id,
  type: 'popup',
  title,
  start_date: '2026-08-28',
  end_date: '2026-09-30',
  reserve_start: null,
  reserve_end: null,
  entry_info: '사전예약 후 입장\n현장예약 가능',
  description: '민음사의 책을 오늘의귀여움 캐릭터 15종이 새롭게 해석한 「문장 너머의 세계」 팝업스토어입니다.\n세계문학전집과 민음의 시를 재해석한 도서, 캡슐 토이와 캐릭터 굿즈를 만날 수 있습니다.\n\n현장예약은 준비된 인원이 마감되면 조기 종료될 수 있습니다.',
  cover_url: coverUrl,
  place_id: placeQuery.data.id,
  place_name: '삼정타워',
  place_addr: '부산 부산진구 중앙대로 672',
  place_lat: placeQuery.data.lat,
  place_lng: placeQuery.data.lng,
  place_detail: '7층 팝업존',
  parking: true,
  parking_note: '30분 무료 후 10분당 1,000원\n구매금액 1만원/3만원/5만원/10만원/20만원 이상 시 각각 1/2/3/4/5시간 무료',
  hours: {
    mon: { open: '11:00', close: '22:00' },
    tue: { open: '11:00', close: '22:00' },
    wed: { open: '11:00', close: '22:00' },
    thu: { open: '11:00', close: '22:00' },
    fri: { open: '11:00', close: '22:30' },
    sat: { open: '11:00', close: '22:30' },
    sun: { open: '11:00', close: '22:00' },
  },
  hours_info: '일~목 11:00~22:00\n금·토 11:00~22:30',
  source_urls: [
    'https://www.samjungtower.com/main',
    'https://www.samjungtower.com/main/26',
    'https://www.instagram.com/p/DcN2nYkhSlI/',
    'https://sibf.minumsa.com/오늘의귀여움x민음사/',
  ],
  ticket_urls: [{ url: 'https://booking.kakao.com/detail/ticketStore/307413?t_src=sharing', label: '팝업 예약하기' }],
  updated_by: editor,
  updated_at: new Date().toISOString(),
}

event.shop_id = await findShopId(db, {
  placeId: event.place_id,
  addr: event.place_addr,
  nameHint: event.place_detail || event.place_name,
})
event.series_key = await resolveSeriesKey(db, {
  title: event.title,
  startDate: event.start_date,
  endDate: event.end_date,
})

const exact = duplicateQuery.data.find((row) => row.title === title && row.start_date === event.start_date && row.place_id === event.place_id)
const saved = exact
  ? await db.from('events').update(event).eq('id', exact.id).select('*').single()
  : await db.from('events').insert({ ...event, created_by: editor }).select('*').single()
if (saved.error) throw saved.error

const beforeGoods = await db.from('event_goods').select('*').eq('event_id', saved.data.id)
if (beforeGoods.error) throw beforeGoods.error
await writeFile(
  `scripts/event-goods-backups/before-minumsa-cute-busan-${stamp}.json`,
  JSON.stringify(beforeGoods.data, null, 2),
)

let goodsInserted = 0
for (const [index, [name, url]] of officialGoods.entries()) {
  const duplicate = await db.from('event_goods').select('id')
    .eq('event_id', saved.data.id).eq('name', name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) continue

  const response = await fetch(url)
  if (!response.ok) throw new Error(`${name} image download failed: ${response.status}`)
  const objectPath = `${saved.data.id}/official-minumsa-cute-goods-${index + 1}.png`
  const upload = await db.storage.from('event-goods').upload(
    objectPath,
    Buffer.from(await response.arrayBuffer()),
    { contentType: response.headers.get('content-type') || 'image/png', upsert: true },
  )
  if (upload.error) throw upload.error
  const imageUrl = db.storage.from('event-goods').getPublicUrl(objectPath).data.publicUrl
  const inserted = await db.from('event_goods').insert({
    event_id: saved.data.id,
    name,
    kind: 'goods',
    price: null,
    image_url: imageUrl,
    created_by: editor,
    updated_by: editor,
  })
  if (inserted.error) throw inserted.error
  goodsInserted += 1
}

const placeUpdate = await db.from('places').update({
  parking: true,
  parking_note: event.parking_note,
  updated_by: editor,
  updated_at: new Date().toISOString(),
}).eq('id', placeQuery.data.id)
if (placeUpdate.error) throw placeUpdate.error

console.log(JSON.stringify({
  status: exact ? 'UPDATED' : 'INSERTED',
  event: {
    id: saved.data.id,
    title: saved.data.title,
    start_date: saved.data.start_date,
    end_date: saved.data.end_date,
    place_id: saved.data.place_id,
    place_detail: saved.data.place_detail,
    shop_id: saved.data.shop_id,
    series_key: saved.data.series_key,
    cover_url: saved.data.cover_url,
  },
  goodsInserted,
  reservationDates: 'OFFICIAL_PAGE_DOES_NOT_DISCLOSE_DATES',
}, null, 2))
