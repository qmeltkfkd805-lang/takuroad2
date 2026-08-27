import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const now = new Date().toISOString()

const { data: place, error: placeError } = await db.from('places').select('*').eq('kakao_place_id', '26992232').single()
if (placeError) throw placeError

let { data: tag, error: tagError } = await db.from('tags').select('*').eq('slug', 'epic-seven').maybeSingle()
if (tagError) throw tagError
if (!tag) {
  const created = await db.from('tags').insert({ name: '에픽세븐', slug: 'epic-seven' }).select('*').single()
  if (created.error) throw created.error
  tag = created.data
}

const eventPayload = {
  tag_id: tag.id,
  type: 'collab_cafe',
  title: '에픽세븐 8주년 × SMG CAFE 콜라보 카페',
  start_date: '2026-08-29',
  end_date: '2026-09-30',
  reserve_start: '2026-08-25',
  reserve_end: null,
  entry_info: '사전예약 후 입장\n자율 입장 가능 시간 운영',
  description: '「에픽세븐」 8주년을 기념하는 공식 콜라보 카페입니다.\n\n실낙원 시즌 한정 메뉴는 테이크아웃할 수 없습니다. 메뉴 구매 특전 코스터는 일부 제외 메뉴가 있으며 준비 수량 소진 시 종료됩니다.',
  cover_url: null,
  place_id: place.id,
  place_name: place.name,
  place_addr: place.addr,
  place_lat: place.lat,
  place_lng: place.lng,
  place_detail: '지하 2층 SMG CAFE',
  parking: place.parking,
  parking_note: place.parking_note,
  hours: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => [day, { open: '10:30', close: '22:00' }])),
  hours_info: '매일 10:30~22:00\n예약 회차 11:00~21:20',
  source_urls: [
    'https://x.com/smgcafe_kr/status/2092173264995123676',
    'https://x.com/smgcafe_kr/status/2091769637990215784',
    'https://x.com/smgcafe_kr/status/2092154825899462995',
    'https://ehyundai.com/newPortal/uplex/DP/WC/WC000000_V.do?branchCd=B00127100',
  ],
  ticket_urls: [{ url: 'https://booking.naver.com/booking/12/bizes/1521753', label: '콜라보 카페 예약하기' }],
  updated_at: now,
}

const existing = await db.from('events').select('*').eq('title', eventPayload.title).eq('start_date', eventPayload.start_date).maybeSingle()
if (existing.error) throw existing.error

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const eventBackup = `scripts/event-goods-backups/before-epic-seven-event-${stamp}.json`
await writeFile(eventBackup, JSON.stringify(existing.data, null, 2), 'utf8')

const eventResult = existing.data
  ? await db.from('events').update(eventPayload).eq('id', existing.data.id).select('*').single()
  : await db.from('events').insert(eventPayload).select('*').single()
if (eventResult.error) throw eventResult.error
const eventId = eventResult.data.id

const { data: beforeGoods, error: beforeGoodsError } = await db.from('event_goods').select('*').eq('event_id', eventId)
if (beforeGoodsError) throw beforeGoodsError
const goodsBackup = `scripts/event-goods-backups/before-epic-seven-menu-goods-${stamp}.json`
await writeFile(goodsBackup, JSON.stringify(beforeGoods, null, 2), 'utf8')

const rows = [
  { name: '실낙원 시즌 드링크 메뉴', kind: 'menu', file: 'img-6.jpg' },
  { name: '실낙원 시즌 푸드·디저트 메뉴', kind: 'menu', file: 'img-7.jpg' },
  { name: '실낙원 시즌 메뉴 구매 특전', kind: 'goods', file: 'img-8.jpg' },
  { name: '리제트 보조배터리 MD 프리뷰', kind: 'goods', file: 'img-1.jpg' },
  { name: '리제트 보조배터리 구성 안내', kind: 'goods', file: 'img-2.jpg' },
  { name: '리제트 보조배터리 사양 안내', kind: 'goods', file: 'img-3.jpg' },
  { name: '리제트 보조배터리 사용 예시', kind: 'goods', file: 'img-4.jpg' },
]

const results = []
for (const row of rows) {
  const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) {
    results.push({ ...row, status: 'SKIPPED_DUPLICATE' })
    continue
  }
  const objectPath = `${eventId}/official-x-${row.file}`
  const image = await readFile(`scripts/work-menu-goods-images/epic7/${row.file}`)
  const upload = await db.storage.from('event-goods').upload(objectPath, image, { contentType: 'image/jpeg', upsert: true })
  if (upload.error) throw upload.error
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const inserted = await db.from('event_goods').insert({
    event_id: eventId,
    name: row.name,
    kind: row.kind,
    price: null,
    image_url: publicData.publicUrl,
    created_by: editorId,
    updated_by: editorId,
  })
  if (inserted.error) throw inserted.error
  results.push({ ...row, status: 'INSERTED' })
}

console.log(JSON.stringify({
  eventStatus: existing.data ? 'UPDATED' : 'INSERTED',
  eventId,
  eventBackup,
  goodsBackup,
  results,
}, null, 2))
