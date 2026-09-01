import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const yongsanId = 'c0920feb-0d05-49c9-b247-e7fa73257378'
const title = '개구리 중사 케로로 × SUB.ST 팝업스토어 (신촌점)'

const yongsan = await db.from('events').select('*').eq('id', yongsanId).single()
if (yongsan.error) throw yongsan.error
const goods = await db.from('event_goods').select('*').eq('event_id', yongsanId).eq('is_deleted', false)
if (goods.error) throw goods.error
const place = await db.from('places').select('*').eq('name', '현대백화점 신촌점').single()
if (place.error) throw place.error
const duplicates = await db.from('events').select('*').or('title.ilike.%케로로%신촌%,title.ilike.%신촌%케로로%')
if (duplicates.error) throw duplicates.error

await mkdir('scripts/event-backups', { recursive: true })
await mkdir('scripts/event-goods-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-keroro-sinchon-${Date.now()}.json`, JSON.stringify({ duplicates: duplicates.data, yongsan: yongsan.data, place: place.data }, null, 2))

const uploadPoster = async (file, objectPath) => {
  const upload = await db.storage.from('event-goods').upload(objectPath, await readFile(file), { contentType: 'image/jpeg', upsert: true })
  if (upload.error) throw upload.error
  return db.storage.from('event-goods').getPublicUrl(objectPath).data.publicUrl
}
const sinchonCover = await uploadPoster('scripts/work-menu-goods-images/keroro-sinchon/01.jpg', 'event-posters/keroro-subst-sinchon-2026-main.jpg')
const yongsanCover = await uploadPoster('scripts/work-menu-goods-images/keroro-sinchon/02.jpg', 'event-posters/keroro-subst-yongsan-2026-main.jpg')

const sourceUrls = [
  'https://x.com/substreet_',
  'https://x.com/ovvio_official',
  'https://www.ehyundai.com/newPortal/DP/DP000000_V.do?branchCd=B00127100',
]
const hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, { open: '10:30', close: '22:00' }]))
const payload = {
  tag_id: yongsan.data.tag_id, type: 'popup', title,
  start_date: '2026-08-28', end_date: '2026-09-14', reserve_start: null, reserve_end: null,
  entry_info: '현장 자유 입장',
  description: '개구리 중사 케로로와 SUB.ST가 함께 선보이는 공식 팝업스토어입니다.\n케로로 소대의 신규 오리지널 MD와 기존 인기 굿즈를 함께 만날 수 있습니다.\n\n상품과 구매 특전은 준비 수량이 소진되면 조기 종료될 수 있습니다.',
  cover_url: sinchonCover,
  place_id: place.data.id, place_name: place.data.name, place_addr: place.data.addr, place_lat: place.data.lat, place_lng: place.data.lng,
  place_detail: 'U-PLEX B2 MOAE:KU 옆 SUB.ST 스페이스',
  parking: true, parking_note: place.data.parking_note,
  hours, hours_info: '매일 10:30~22:00',
  source_urls: sourceUrls, ticket_urls: [], updated_by: editor, updated_at: new Date().toISOString(),
}
const exact = duplicates.data.find((event) => event.start_date === payload.start_date && event.end_date === payload.end_date)
const saved = exact
  ? await db.from('events').update(payload).eq('id', exact.id).select('*').single()
  : await db.from('events').insert({ ...payload, created_by: editor }).select('*').single()
if (saved.error) throw saved.error

const existingGoods = await db.from('event_goods').select('*').eq('event_id', saved.data.id)
if (existingGoods.error) throw existingGoods.error
await writeFile(`scripts/event-goods-backups/before-keroro-sinchon-${Date.now()}.json`, JSON.stringify(existingGoods.data, null, 2))
for (const row of goods.data) {
  if (existingGoods.data.some((item) => item.name === row.name && !item.is_deleted)) continue
  const inserted = await db.from('event_goods').insert({
    event_id: saved.data.id, name: row.name, kind: row.kind, price: row.price, image_url: row.image_url,
    created_by: editor, updated_by: editor,
  })
  if (inserted.error) throw inserted.error
}

const fixedYongsan = await db.from('events').update({
  cover_url: yongsanCover,
  source_urls: ['https://x.com/substreet_', 'https://x.com/ovvio_official', 'https://www.hdc-iparkmall.com/main/webrender.do'],
  parking: true,
  parking_note: '주차 가능\n기본요금 10분당 1,500원\n당일 영수증에 따라 무료 주차 적용',
  updated_by: editor, updated_at: new Date().toISOString(),
}).eq('id', yongsanId)
if (fixedYongsan.error) throw fixedYongsan.error

console.log(JSON.stringify({ status: exact ? 'UPDATED' : 'INSERTED', eventId: saved.data.id, title, goodsLinked: goods.data.length, yongsanCoverFixed: true }, null, 2))
