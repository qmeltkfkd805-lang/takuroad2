import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '언슬립: AFTER CLASS 공식 콜라보 카페'
const mainSource = 'https://x.com/JMEESHOP/status/2092915047580446860'
const cafeSource = 'https://x.com/Cafe_Lebom'
const workSource = 'https://www.lezhin.com/ko/comic/unsleep'
const posterUrl = 'https://pbs.twimg.com/media/HQuGXAxbcAABz58.jpg?name=orig'

const existing = await db.from('events').select('*').or('title.ilike.%언슬립%,title.ilike.%UNSLEEP%')
if (existing.error) throw existing.error
const existingTag = await db.from('tags').select('*').eq('slug', 'unsleep').maybeSingle()
if (existingTag.error) throw existingTag.error

await mkdir('scripts/event-backups', { recursive: true })
const stamp = Date.now()
await writeFile(`scripts/event-backups/before-unsleep-after-class-${stamp}.json`, JSON.stringify({ events: existing.data, tag: existingTag.data }, null, 2))

let tag = existingTag.data
if (!tag) {
  const insertedTag = await db.from('tags').insert({
    name: '언슬립',
    slug: 'unsleep',
    ip_type: '웹툰',
    english_name: 'UNSLEEP',
    genres: ['BL', '캠퍼스', '로맨스 코미디'],
    description: '현외 작가의 캠퍼스 BL 웹툰입니다.',
    official_url: workSource,
    twitter_url: 'https://x.com/JMEESHOP',
    created_by: editor,
  }).select('*').single()
  if (insertedTag.error) throw insertedTag.error
  tag = insertedTag.data
}

const posterResponse = await fetch(posterUrl)
if (!posterResponse.ok) throw new Error(`Poster download failed: ${posterResponse.status}`)
const posterPath = 'event-posters/unsleep-after-class-cafe-2026.jpg'
const upload = await db.storage.from('event-images').upload(posterPath, Buffer.from(await posterResponse.arrayBuffer()), {
  contentType: 'image/jpeg',
  upsert: true,
})
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-images').getPublicUrl(posterPath).data.publicUrl

const payload = {
  tag_id: tag.id,
  type: 'collab_cafe',
  title,
  start_date: '2026-09-19',
  end_date: '2026-10-11',
  reserve_start: '2026-09-08',
  reserve_end: null,
  entry_info: '사전예약 후 입장\n성인만 입장 가능',
  description: '웹툰 「언슬립」의 작품 세계를 테마로 진행되는 공식 콜라보 카페입니다.\n\n주말에만 운영되며 성인만 입장할 수 있습니다. 1~2주 차 예약은 9월 8일 15시, 3~4주 차 예약은 9월 29일 15시에 캐치테이블에서 열립니다.',
  cover_url: coverUrl,
  place_id: null,
  place_name: '카페 레봄',
  place_addr: '서울 성동구 연무장11길 8',
  place_lat: null,
  place_lng: null,
  place_detail: 'CORNER50 1층',
  parking: null,
  parking_note: null,
  hours: null,
  hours_info: '주말 운영\n회차별 운영시간 추후 공개',
  source_urls: [mainSource, cafeSource, workSource],
  ticket_urls: [],
  updated_by: editor,
  updated_at: new Date().toISOString(),
}

const duplicate = await db.from('events').select('id').eq('title', title).eq('start_date', payload.start_date).maybeSingle()
if (duplicate.error) throw duplicate.error
const result = duplicate.data
  ? await db.from('events').update(payload).eq('id', duplicate.data.id).select('*').single()
  : await db.from('events').insert({ ...payload, created_by: editor }).select('*').single()
if (result.error) throw result.error

console.log(JSON.stringify({ status: duplicate.data ? 'UPDATED' : 'INSERTED', event: result.data, tag: { id: tag.id, name: tag.name }, pending: ['운영 시각', '주차 안내', '캐치테이블 URL', '메뉴·굿즈 상세'] }, null, 2))
