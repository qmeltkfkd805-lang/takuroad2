import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { findShopId } from './lib/findShopId.mjs'
import { resolveSeriesKey } from './lib/seriesKey.mjs'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '나가노마켓 POP UP SHOP 0% SEOUL'

const duplicates = await db.from('events').select('*')
  .or('title.ilike.%나가노마켓%,title.ilike.%나가노 마켓%,title.ilike.%농담곰%')
if (duplicates.error) throw duplicates.error

let tag = await db.from('tags').select('*').or('name.eq.나가노마켓,slug.eq.nagano-market').limit(1).maybeSingle()
if (tag.error) throw tag.error
if (!tag.data) {
  tag = await db.from('tags').insert({ name: '나가노마켓', slug: 'nagano-market', created_by: editor }).select('*').single()
  if (tag.error) throw tag.error
}

await mkdir('scripts/event-backups', { recursive: true })
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
await writeFile(
  `scripts/event-backups/before-nagano-market-hongdae-${stamp}.json`,
  JSON.stringify({ duplicates: duplicates.data, tag: tag.data }, null, 2),
)

const posterPath = 'event-posters/nagano-market-hongdae-2026-main.jpg'
const posterUpload = await db.storage.from('event-goods').upload(
  posterPath,
  await readFile('scripts/work-nagano-hongdae/cover.jpg'),
  { contentType: 'image/jpeg', upsert: true },
)
if (posterUpload.error) throw posterUpload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(posterPath).data.publicUrl

const event = {
  tag_id: tag.data.id,
  type: 'popup',
  title,
  start_date: '2026-08-28',
  end_date: '2026-10-11',
  reserve_start: '2026-08-26',
  reserve_end: null,
  entry_info: '8월 28일 사전예약 후 입장',
  description: '일러스트레이터 나가노의 캐릭터와 세계관을 다양한 공식 굿즈로 만나는 팝업스토어입니다.\n농담곰을 비롯한 캐릭터 인형, 마스코트, 가방, 지갑, 파우치와 생활 잡화 등을 판매합니다.\n\n「푹신말랑! 블랙 한가득 인형 뽑기」와 「말랑폭신! 담곰이만 한가득 인형 뽑기」는 각각 1인 최대 3회까지 이용할 수 있습니다.\n상품은 재고 상황에 따라 품절되거나 판매 일정이 변경될 수 있습니다.',
  cover_url: coverUrl,
  place_id: null,
  place_name: '0% SEOUL',
  place_addr: '서울 마포구 월드컵북로2길 29',
  place_lat: 37.5566301550651,
  place_lng: 126.922359591309,
  place_detail: '주스코리아 제로퍼센트',
  parking: false,
  parking_note: '전용 주차장 없음\n대중교통 이용 권장',
  hours: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, { open: '11:00', close: '21:00' }])),
  hours_info: '매일 11:00~21:00',
  source_urls: [
    'https://x.com/naganomkt_seoul/status/2087820290084814856',
    'https://x.com/naganomkt_seoul/status/2092145616814211471',
    'https://x.com/naganomkt_seoul/status/2092144683296399664',
    'https://x.com/naganomkt_seoul/status/2092144545840672954',
  ],
  ticket_urls: [{ url: 'https://booking.naver.com/booking/13/bizes/1581639', label: '팝업 예약하기' }],
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

const exact = duplicates.data.find((row) => row.start_date === event.start_date && row.end_date === event.end_date && row.place_addr === event.place_addr)
const saved = exact
  ? await db.from('events').update(event).eq('id', exact.id).select('*').single()
  : await db.from('events').insert({ ...event, created_by: editor }).select('*').single()
if (saved.error) throw saved.error

const beforeGoods = await db.from('event_goods').select('*').eq('event_id', saved.data.id)
if (beforeGoods.error) throw beforeGoods.error
await writeFile(
  `scripts/event-goods-backups/before-nagano-market-hongdae-${stamp}.json`,
  JSON.stringify(beforeGoods.data, null, 2),
)

let goodsInserted = 0
for (let index = 1; index <= 8; index += 1) {
  const name = `나가노마켓 공식 상품 라인업 ${index}`
  const duplicate = await db.from('event_goods').select('id')
    .eq('event_id', saved.data.id).eq('name', name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) continue

  const objectPath = `${saved.data.id}/official-nagano-market-goods-${index}.jpg`
  const upload = await db.storage.from('event-goods').upload(
    objectPath,
    await readFile(`scripts/work-nagano-hongdae/goods-${index}.jpg`),
    { contentType: 'image/jpeg', upsert: true },
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

console.log(JSON.stringify({
  status: exact ? 'UPDATED' : 'INSERTED',
  event: {
    id: saved.data.id,
    title: saved.data.title,
    start_date: saved.data.start_date,
    end_date: saved.data.end_date,
    place_name: saved.data.place_name,
    place_detail: saved.data.place_detail,
    shop_id: saved.data.shop_id,
    series_key: saved.data.series_key,
    cover_url: saved.data.cover_url,
  },
  goodsInserted,
}, null, 2))
