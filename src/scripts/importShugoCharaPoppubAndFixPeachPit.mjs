import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { findShopId } from './lib/findShopId.mjs'
import { resolveSeriesKey } from './lib/seriesKey.mjs'

config({ path: '../.env.local' })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const now = new Date().toISOString()

const placeResult = await db.from('places').select('*').eq('name', '아이파크몰 용산점').limit(1).maybeSingle()
if (placeResult.error) throw placeResult.error
if (!placeResult.data) throw new Error('아이파크몰 용산점을 찾지 못했습니다.')
const place = placeResult.data

const peachResult = await db.from('events').select('*').eq('title', 'PEACH-PIT 25주년 기념 특별전').maybeSingle()
if (peachResult.error) throw peachResult.error
if (!peachResult.data) throw new Error('수정할 PEACH-PIT 특별전을 찾지 못했습니다.')

const shugoDuplicates = await db.from('events').select('*')
  .ilike('title', '%캐릭캐릭체인지%팝퍼블%')
if (shugoDuplicates.error) throw shugoDuplicates.error

const obsoletePlaceResult = await db.from('places').select('*').eq('id', peachResult.data.place_id).maybeSingle()
if (obsoletePlaceResult.error) throw obsoletePlaceResult.error

await mkdir('scripts/event-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
await writeFile(
  `scripts/event-backups/before-shugo-poppub-peachpit-fix-${stamp}.json`,
  JSON.stringify({ peach: peachResult.data, shugoDuplicates: shugoDuplicates.data, obsoletePlace: obsoletePlaceResult.data }, null, 2),
)

let tagResult = await db.from('tags').select('*')
  .or('name.ilike.%캐릭캐릭 체인지%,name.ilike.%캐릭캐릭체인지%,slug.eq.shugo-chara')
  .limit(1).maybeSingle()
if (tagResult.error) throw tagResult.error
if (!tagResult.data) {
  tagResult = await db.from('tags').insert({
    name: '캐릭캐릭 체인지!',
    slug: 'shugo-chara',
    english_name: 'Shugo Chara!',
    ip_type: '만화·애니메이션',
    genres: ['순정', '마법소녀'],
    description: 'PEACH-PIT의 만화를 원작으로 한 애니메이션 작품입니다.',
    created_by: editor,
  }).select('*').single()
  if (tagResult.error) throw tagResult.error
}

const posterObjectPath = 'event-posters/shugo-chara-poppub-yongsan-2026-main.jpg'
const posterUpload = await db.storage.from('event-goods').upload(
  posterObjectPath,
  await readFile('scripts/work-shugo-cover.jpg'),
  { contentType: 'image/jpeg', upsert: true },
)
if (posterUpload.error) throw posterUpload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(posterObjectPath).data.publicUrl

const shugo = {
  tag_id: tagResult.data.id,
  type: 'collab_cafe',
  title: '캐릭캐릭체인지 × 팝퍼블 콜라보 카페',
  start_date: '2026-08-14',
  end_date: '2026-11-29',
  reserve_start: null,
  reserve_end: null,
  entry_info: '현장예약 후 입장\n대기 없을 시 바로 입장 가능',
  description: '새롭게 공개된 카페 스태프 일러스트를 테마로 캐릭캐릭체인지의 캐릭터 메뉴와 한정 굿즈를 만나는 공식 콜라보 카페입니다.\n\n현장 웨이팅은 매장 안내에 따라 접수하며, 메뉴와 굿즈는 당일 준비 수량에 따라 조기 품절될 수 있습니다.',
  cover_url: coverUrl,
  place_id: place.id,
  place_name: place.name,
  place_addr: place.addr,
  place_lat: place.lat,
  place_lng: place.lng,
  place_detail: '테마파크 6층 팝콘D스퀘어 팝퍼블 용산점',
  parking: place.parking,
  parking_note: place.parking_note,
  hours: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, { open: '10:30', close: '20:30' }])),
  hours_info: '매일 10:30~20:30\n라스트오더 19:30',
  source_urls: [
    'https://www.popcondplay.com/ip/news/view/682',
    'https://www.popcondplay.com/ip/news/13',
  ],
  ticket_urls: [],
  updated_by: editor,
  updated_at: now,
}

shugo.shop_id = await findShopId(db, {
  placeId: shugo.place_id,
  addr: shugo.place_addr,
  nameHint: shugo.place_detail || shugo.place_name,
})
shugo.series_key = await resolveSeriesKey(db, {
  title: shugo.title,
  startDate: shugo.start_date,
  endDate: shugo.end_date,
})

const shugoExact = shugoDuplicates.data.find((row) => row.start_date === shugo.start_date && row.end_date === shugo.end_date)
const shugoSaved = shugoExact
  ? await db.from('events').update(shugo).eq('id', shugoExact.id).select('*').single()
  : await db.from('events').insert({ ...shugo, created_by: editor }).select('*').single()
if (shugoSaved.error) throw shugoSaved.error

const peach = {
  place_id: place.id,
  place_name: place.name,
  place_addr: place.addr,
  place_lat: place.lat,
  place_lng: place.lng,
  place_detail: '테마파크 6층 팝콘D스퀘어 대원뮤지엄',
  parking: place.parking,
  parking_note: place.parking_note,
  ticket_urls: [{ url: 'https://www.popcondplay.com/reserve/view/94', label: '전시 예매하기' }],
  source_urls: [
    'https://www.popcondplay.com/ip/news/15',
    'https://www.haksanpub.co.kr/en/community/2501_notice/1216?currentPage=1&currentSearch=&currentTab=',
  ],
  description: '「캐릭캐릭 체인지!」, 「로젠 메이든」, 「좀비론」, 「디어즈」 등 PEACH-PIT의 대표작과 한국 최초 공개 원화를 만나는 작가 데뷔 25주년 특별전입니다.\n\n일반 티켓과 한정 굿즈가 포함된 네 종류의 패키지를 판매하며, 티켓과 패키지는 준비 수량 소진 시 판매가 종료될 수 있습니다.',
  updated_by: editor,
  updated_at: now,
}

peach.shop_id = await findShopId(db, {
  placeId: peach.place_id,
  addr: peach.place_addr,
  nameHint: peach.place_detail || peach.place_name,
})
peach.series_key = await resolveSeriesKey(db, {
  title: peachResult.data.title,
  startDate: peachResult.data.start_date,
  endDate: peachResult.data.end_date,
  excludeId: peachResult.data.id,
})

const peachSaved = await db.from('events').update(peach).eq('id', peachResult.data.id).select('*').single()
if (peachSaved.error) throw peachSaved.error

let obsoletePlaceCleanup = 'NOT_APPLICABLE'
if (obsoletePlaceResult.data?.name === '팝콘D스퀘어') {
  const references = await db.from('events').select('id', { count: 'exact', head: true }).eq('place_id', obsoletePlaceResult.data.id)
  if (references.error) throw references.error
  if (references.count === 0) {
    const removed = await db.from('places').delete().eq('id', obsoletePlaceResult.data.id)
    if (removed.error) throw removed.error
    obsoletePlaceCleanup = 'DELETED_UNUSED_PLACE'
  } else {
    obsoletePlaceCleanup = `KEPT_REFERENCED_${references.count}`
  }
}

console.log(JSON.stringify({
  shugo: {
    status: shugoExact ? 'UPDATED' : 'INSERTED',
    id: shugoSaved.data.id,
    title: shugoSaved.data.title,
    place_name: shugoSaved.data.place_name,
    place_detail: shugoSaved.data.place_detail,
    shop_id: shugoSaved.data.shop_id,
    series_key: shugoSaved.data.series_key,
    cover_url: shugoSaved.data.cover_url,
  },
  peachPit: {
    status: 'UPDATED',
    id: peachSaved.data.id,
    place_name: peachSaved.data.place_name,
    place_detail: peachSaved.data.place_detail,
    shop_id: peachSaved.data.shop_id,
    series_key: peachSaved.data.series_key,
    ticket_urls: peachSaved.data.ticket_urls,
  },
  obsoletePlaceCleanup,
  pendingOfficialAssets: ['캐릭캐릭체인지 메뉴 이미지', '캐릭캐릭체인지 굿즈 라인업 이미지'],
}, null, 2))
