import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '헌터×헌터 × 브이스퀘어 팝업스토어·콜라보 카페'
const officialPost = 'https://x.com/v_square_kr/status/2094382695438762234'

const duplicates = await db.from('events').select('*').or('title.ilike.%헌터×헌터%브이스퀘어%,title.ilike.%HUNTER%V-SQUARE%')
if (duplicates.error) throw duplicates.error
const place = await db.from('places').select('*').eq('name', '스타시티몰').single()
if (place.error) throw place.error
const tag = await db.from('tags').select('*').eq('slug', 'hunter-x-hunter').single()
if (tag.error) throw tag.error

await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-hunter-hunter-vsquare-${Date.now()}.json`, JSON.stringify({ events: duplicates.data, place: place.data, tag: tag.data }, null, 2))

const objectPath = 'event-posters/hunter-hunter-vsquare-2026-main.jpg'
const upload = await db.storage.from('event-goods').upload(
  objectPath,
  await readFile('scripts/work-menu-goods-images/hunter-vsquare-2026/official-main.jpg'),
  { contentType: 'image/jpeg', upsert: true },
)
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(objectPath).data.publicUrl

const hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, { open: '11:00', close: '20:00' }]))
const payload = {
  tag_id: tag.data.id,
  type: 'collab_cafe',
  title,
  start_date: '2026-09-18',
  end_date: '2026-10-18',
  reserve_start: null,
  reserve_end: null,
  entry_info: null,
  description: '헌터×헌터의 주요 캐릭터를 테마로 운영되는 브이스퀘어 공식 팝업스토어·콜라보 카페입니다.\n작품을 활용한 콜라보 메뉴와 굿즈를 순차적으로 공개할 예정입니다.',
  cover_url: coverUrl,
  place_id: place.data.id,
  place_name: place.data.name,
  place_addr: place.data.addr,
  place_lat: place.data.lat,
  place_lng: place.data.lng,
  place_detail: '롯데시네마 건대입구 3F 브이스퀘어',
  parking: null,
  parking_note: null,
  hours,
  hours_info: '매일 11:00~20:00\n카페 주문 마감 19:00',
  source_urls: [officialPost, 'https://vsquare.co.kr/'],
  ticket_urls: [],
  updated_by: editor,
  updated_at: new Date().toISOString(),
}

const exact = duplicates.data.find((event) => event.start_date === payload.start_date && event.end_date === payload.end_date)
const saved = exact
  ? await db.from('events').update(payload).eq('id', exact.id).select('*').single()
  : await db.from('events').insert({ ...payload, created_by: editor }).select('*').single()
if (saved.error) throw saved.error

console.log(JSON.stringify({
  status: exact ? 'UPDATED' : 'INSERTED',
  eventId: saved.data.id,
  title,
  coverUrl,
  pending: ['입장 방식', '메뉴·특전 이미지', 'MD 목록·가격', '스타시티몰 공식 주차요금'],
}, null, 2))
