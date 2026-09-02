import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { findShopId } from './lib/findShopId.mjs'
import { resolveSeriesKey } from './lib/seriesKey.mjs'

config({ path: '../.env.local' })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '주술회전 팬텀 퍼레이드 팝업 스토어'
const officialPost = 'https://x.com/JJKphanpara_KR/status/2091072889932177496'

const duplicateResult = await db.from('events')
  .select('*')
  .or('title.ilike.%주술회전 팬텀 퍼레이드%,title.ilike.%팬텀퍼레이드 팝업%')
if (duplicateResult.error) throw duplicateResult.error

const tagResult = await db.from('tags').select('id').eq('slug', 'jujutsu-kaisen').single()
if (tagResult.error) throw tagResult.error

await mkdir('scripts/event-backups', { recursive: true })
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
await writeFile(
  `scripts/event-backups/before-jjk-phantom-parade-popup-${stamp}.json`,
  JSON.stringify(duplicateResult.data, null, 2),
)

const posterPath = 'event-posters/jjk-phantom-parade-popup-2026-main.jpg'
const poster = await readFile('scripts/work-jjk-1.jpg')
const posterUpload = await db.storage.from('event-goods').upload(posterPath, poster, {
  contentType: 'image/jpeg',
  upsert: true,
})
if (posterUpload.error) throw posterUpload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(posterPath).data.publicUrl

const event = {
  tag_id: tagResult.data.id,
  type: 'popup',
  title,
  start_date: '2026-09-12',
  end_date: '2026-10-11',
  reserve_start: null,
  reserve_end: null,
  entry_info: '현장 방문',
  description: `게임 주술회전 팬텀 퍼레이드의 세계관과 캐릭터를 테마로 꾸민 공식 오프라인 팝업 스토어입니다.\n\n주문 1건당 주문 리플릿 1부와 테마 쇼핑백 1개가 제공됩니다.\n스탬프 아크릴 스탠드를 26,000원 이상 구매하면 랜덤 특전 1종, 182,000원 이상 구매하면 7종 세트를 받을 수 있습니다.\n\n매장 디스플레이를 촬영하고 공식 해시태그와 함께 SNS에 올리면 게임 기프트 코드 포토카드를 받을 수 있습니다.\n모든 특전은 한정 수량으로 소진 시 종료됩니다.`,
  cover_url: coverUrl,
  place_id: null,
  place_name: '애니팝굿즈샵 삼성역점',
  place_addr: '서울 강남구 영동대로85길 13',
  place_lat: null,
  place_lng: null,
  place_detail: '5층 (주)우진플래닝',
  parking: null,
  parking_note: null,
  hours: null,
  hours_info: null,
  source_urls: [officialPost],
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

const exact = duplicateResult.data.find((row) => row.start_date === event.start_date && row.end_date === event.end_date)
const saved = exact
  ? await db.from('events').update(event).eq('id', exact.id).select('*').single()
  : await db.from('events').insert({ ...event, created_by: editor }).select('*').single()
if (saved.error) throw saved.error

const beforeGoods = await db.from('event_goods').select('*').eq('event_id', saved.data.id)
if (beforeGoods.error) throw beforeGoods.error
await writeFile(
  `scripts/event-goods-backups/before-jjk-phantom-parade-popup-${stamp}.json`,
  JSON.stringify(beforeGoods.data, null, 2),
)

const goods = [
  { file: 'scripts/work-jjk-2.jpg', suffix: '01', name: '팝업 한정 굿즈·구매 특전 안내 1' },
  { file: 'scripts/work-jjk-3.jpg', suffix: '02', name: '팝업 한정 굿즈·구매 특전 안내 2' },
]
const goodsResult = []
for (const row of goods) {
  const duplicate = await db.from('event_goods').select('id')
    .eq('event_id', saved.data.id).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) {
    goodsResult.push({ name: row.name, status: 'SKIPPED_DUPLICATE' })
    continue
  }

  const objectPath = `${saved.data.id}/official-jjk-phantom-parade-popup-${row.suffix}.jpg`
  const image = await readFile(row.file)
  const upload = await db.storage.from('event-goods').upload(objectPath, image, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (upload.error) throw upload.error
  const imageUrl = db.storage.from('event-goods').getPublicUrl(objectPath).data.publicUrl
  const inserted = await db.from('event_goods').insert({
    event_id: saved.data.id,
    name: row.name,
    kind: 'goods',
    price: null,
    image_url: imageUrl,
    created_by: editor,
    updated_by: editor,
  })
  if (inserted.error) throw inserted.error
  goodsResult.push({ name: row.name, status: 'INSERTED' })
}

console.log(JSON.stringify({
  status: exact ? 'UPDATED' : 'INSERTED',
  event: {
    id: saved.data.id,
    title: saved.data.title,
    start_date: saved.data.start_date,
    end_date: saved.data.end_date,
    place_name: saved.data.place_name,
    place_addr: saved.data.place_addr,
    place_detail: saved.data.place_detail,
    shop_id: saved.data.shop_id,
    series_key: saved.data.series_key,
    cover_url: saved.data.cover_url,
  },
  goods: goodsResult,
  pendingOfficialConfirmation: ['운영시간', '주차 가능 여부와 요금', '별도 입장·예약 운영 방식'],
}, null, 2))
