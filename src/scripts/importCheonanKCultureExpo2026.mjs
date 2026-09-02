import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { findShopId } from './lib/findShopId.mjs'
import { resolveSeriesKey } from './lib/seriesKey.mjs'

config({ path: '../.env.local' })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '2026 천안 K-컬처박람회'

const existing = await db.from('events').select('*').ilike('title', '%K-컬처박람회%')
if (existing.error) throw existing.error
const existingPlaces = await db.from('places').select('*').or('name.ilike.%독립기념관%,addr.ilike.%독립기념관로 1%')
if (existingPlaces.error) throw existingPlaces.error

await mkdir('scripts/event-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
await writeFile(
  `scripts/event-backups/before-cheonan-kculture-expo-${stamp}.json`,
  JSON.stringify({ events: existing.data, places: existingPlaces.data }, null, 2),
)

let place = existingPlaces.data[0]
if (!place) {
  const insertedPlace = await db.from('places').insert({
    slug: 'independence-hall-of-korea',
    name: '독립기념관',
    place_type: 'CULTURE_SPACE',
    addr: '충남 천안시 동남구 목천읍 독립기념관로 1',
    region: '충남',
    district: '천안시 동남구',
    lat: 36.781204172252565,
    lng: 127.22390727583748,
    parking: true,
    parking_note: '1일 기준 소형 2,000원, 대형 3,000원\n장애인·경차·하이브리드·저공해차·병역이행 명문가 1,000원\n국가유공자 및 유족증 소지자 무료',
    system_created: false,
    category_name: '문화,관광 > 박물관 > 독립기념관',
  }).select('*').single()
  if (insertedPlace.error) throw insertedPlace.error
  place = insertedPlace.data
}

let tag = await db.from('tags').select('*').or('name.eq.K-컬처,slug.eq.k-culture').limit(1).maybeSingle()
if (tag.error) throw tag.error
if (!tag.data) {
  tag = await db.from('tags').insert({ name: 'K-컬처', slug: 'k-culture', created_by: editor }).select('*').single()
  if (tag.error) throw tag.error
}

const posterPath = 'event-posters/cheonan-kculture-expo-2026.jpg'
const posterUpload = await db.storage.from('event-goods').upload(
  posterPath,
  await readFile('scripts/work-kculture-2026/sns-title.jpg'),
  { contentType: 'image/jpeg', upsert: true },
)
if (posterUpload.error) throw posterUpload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(posterPath).data.publicUrl

const event = {
  tag_id: tag.data.id,
  type: 'exhibition',
  title,
  start_date: '2026-09-02',
  end_date: '2026-09-06',
  reserve_start: null,
  reserve_end: null,
  entry_info: '현장 입장',
  description: '웹툰·캐릭터·K-POP을 비롯한 K-컬처의 현재와 미래를 전시와 체험으로 만나는 박람회입니다.\nK-웹툰 산업전시관에서는 작가 특별전, 수상작 전시, 캐릭터 포토존과 라이브 드로잉 등을 운영합니다.\n\nK-POP 팝업 전시 「Be the K : K-컬처 헌터스」에서는 AI·XR 기술로 아이돌 캐릭터와 앨범 이미지, 포토카드와 굿즈를 만드는 체험을 진행합니다.\n9월 6일은 전시 프로그램별 운영 종료 시각이 평소보다 빠르므로 방문 시간을 확인해야 합니다.',
  cover_url: coverUrl,
  place_id: place.id,
  place_name: place.name,
  place_addr: place.addr,
  place_lat: place.lat,
  place_lng: place.lng,
  place_detail: '독립의 다리·주무대 인근 전시관 및 잔디광장',
  parking: true,
  parking_note: place.parking_note || '1일 기준 소형 2,000원, 대형 3,000원\n장애인·경차·하이브리드·저공해차·병역이행 명문가 1,000원\n국가유공자 및 유족증 소지자 무료',
  hours: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, { open: '10:00', close: '19:00' }])),
  hours_info: '주요 산업전시관 10:00~19:00\n주제전시 10:00~21:00\n9월 6일 주제전시 16:00 종료, 산업전시관·K-POP 팝업 17:00 종료',
  source_urls: [
    'https://www.kcultureexpo.com/kor/',
    'https://www.kcultureexpo.com/kor/02/02.php?v=2',
    'https://www.kcultureexpo.com/kor/04/02.php',
    'https://i815.or.kr/2018/tour/facility.do',
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

const duplicate = existing.data.find((row) => row.title === title && row.start_date === event.start_date && row.place_id === event.place_id)
const saved = duplicate
  ? await db.from('events').update(event).eq('id', duplicate.id).select('*').single()
  : await db.from('events').insert({ ...event, created_by: editor }).select('*').single()
if (saved.error) throw saved.error

console.log(JSON.stringify({
  status: duplicate ? 'UPDATED' : 'INSERTED',
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
}, null, 2))
