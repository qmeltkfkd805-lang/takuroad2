import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { findShopId } from './lib/findShopId.mjs'
import { resolveSeriesKey } from './lib/seriesKey.mjs'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '2026 K리그 × 산리오캐릭터즈 썸머캠프 팝업스토어 (수원)'

const duplicates = await db.from('events').select('*')
  .or('title.ilike.%K리그%산리오%,title.ilike.%썸머캠프%팝업%')
if (duplicates.error) throw duplicates.error

const placeResult = await db.from('places').select('*')
  .or('name.ilike.%타임빌라스 수원%,addr.ilike.%세화로 134%').limit(1).maybeSingle()
if (placeResult.error) throw placeResult.error
if (!placeResult.data) throw new Error('타임빌라스 수원 장소를 찾지 못했습니다.')
const place = placeResult.data

const tagResult = await db.from('tags').select('*')
  .or('name.ilike.%산리오%,slug.ilike.%sanrio%').limit(1).maybeSingle()
if (tagResult.error) throw tagResult.error
if (!tagResult.data) throw new Error('산리오 태그를 찾지 못했습니다.')

await mkdir('scripts/event-backups', { recursive: true })
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
await writeFile(
  `scripts/event-backups/before-kleague-sanrio-suwon-${stamp}.json`,
  JSON.stringify({ duplicates: duplicates.data, place, tag: tagResult.data }, null, 2),
)

const posterPath = 'event-posters/kleague-sanrio-summer-camp-suwon-2026-main.jpeg'
const posterUpload = await db.storage.from('event-goods').upload(
  posterPath,
  await readFile('scripts/work-kleague-sanrio-suwon/01-cover.jpeg'),
  { contentType: 'image/jpeg', upsert: true },
)
if (posterUpload.error) throw posterUpload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(posterPath).data.publicUrl

const event = {
  tag_id: tagResult.data.id,
  type: 'popup',
  title,
  start_date: '2026-08-28',
  end_date: '2026-09-06',
  reserve_start: null,
  reserve_end: null,
  entry_info: '현장 선착순 입장',
  description: 'K리그 구단과 산리오캐릭터즈가 함께한 썸머캠프 한정 상품과 체험 콘텐츠를 만나는 공식 팝업스토어입니다.\n\n태닝 헬로키티 대형 벌룬 포토존, 포토이즘 부스, 행운의 가챠와 수원 한정 스탬프 이벤트가 운영됩니다.\n상품과 이벤트 특전은 준비 수량 소진 시 조기 종료될 수 있습니다.\n\n9월 4일 14:00부터 15:30까지 박종윤·임형철의 일일 아르바이트 이벤트가 진행됩니다.',
  cover_url: coverUrl,
  place_id: place.id,
  place_name: place.name,
  place_addr: place.addr,
  place_lat: place.lat,
  place_lng: place.lng,
  place_detail: '쇼핑몰 1층 센터홀',
  parking: true,
  parking_note: '주차 가능(유료)\n최초 30분 무료\n초과 10분당 1,000원\n1만원 이상 구매 시 1시간, 3만원 이상 2시간, 5만원 이상 3시간, 10만원 이상 4시간 무료',
  hours: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, { open: '10:30', close: '22:00' }])),
  hours_info: '매일 10:30~22:00',
  source_urls: [
    'https://www.kleague.com/news_view.do?orderBy=seq&page=1&seq=96147&viewOption=album',
    'https://www.lotteshopping.com/shpgnews/shpgnewsDetail?shpgNewsNo=SNM00000000000555233',
    'https://www.lotteshopping.com/store/main?cstrCd=0404',
  ],
  ticket_urls: [],
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

const exact = duplicates.data.find((row) => row.start_date === event.start_date && row.end_date === event.end_date && row.place_id === event.place_id)
const saved = exact
  ? await db.from('events').update(event).eq('id', exact.id).select('*').single()
  : await db.from('events').insert({ ...event, created_by: editor }).select('*').single()
if (saved.error) throw saved.error

const beforeGoods = await db.from('event_goods').select('*').eq('event_id', saved.data.id)
if (beforeGoods.error) throw beforeGoods.error
await writeFile(
  `scripts/event-goods-backups/before-kleague-sanrio-suwon-${stamp}.json`,
  JSON.stringify(beforeGoods.data, null, 2),
)

const goodsName = 'K리그 × 산리오캐릭터즈 썸머캠프 공식 MD 리스트'
const duplicateGoods = await db.from('event_goods').select('id')
  .eq('event_id', saved.data.id).eq('name', goodsName).eq('is_deleted', false).maybeSingle()
if (duplicateGoods.error) throw duplicateGoods.error
let goodsStatus = 'SKIPPED_DUPLICATE'
if (!duplicateGoods.data) {
  const objectPath = `${saved.data.id}/official-kleague-sanrio-suwon-md.jpeg`
  const upload = await db.storage.from('event-goods').upload(
    objectPath,
    await readFile('scripts/work-kleague-sanrio-suwon/02-md.jpeg'),
    { contentType: 'image/jpeg', upsert: true },
  )
  if (upload.error) throw upload.error
  const imageUrl = db.storage.from('event-goods').getPublicUrl(objectPath).data.publicUrl
  const inserted = await db.from('event_goods').insert({
    event_id: saved.data.id,
    name: goodsName,
    kind: 'goods',
    price: null,
    image_url: imageUrl,
    created_by: editor,
    updated_by: editor,
  })
  if (inserted.error) throw inserted.error
  goodsStatus = 'INSERTED'
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
  goods: goodsStatus,
}, null, 2))
