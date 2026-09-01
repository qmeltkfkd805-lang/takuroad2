import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '하츠네 미쿠-Chocoanimal Miku Wagon × 애니메이트 카페'
const mainSource = 'https://x.com/animatecafe_js/status/2090725607793434787'
const cafeSource = 'https://x.com/animatecafe_js'
const officialProject = 'https://www.animatecafe.jp/event/ac000738'

const imageDefs = [
  ['cover', 'https://pbs.twimg.com/media/HQNqRTAacAAFyCA.jpg?name=orig'],
  ['campaign', 'https://cdn.animatecafe.jp/cafeweb/images/CWvpWdhfA1pYlZb4kowohcPNq28wGT3a.jpg'],
  ['menu-goods', 'https://cdn.animatecafe.jp/cafeweb/images/ndapGjo1nCFDbFdEwyqGv2YOKrzaXIN5.jpg'],
]

const existing = await db.from('events').select('*').or('title.ilike.%Chocoanimal%,title.ilike.%초코애니멀%')
if (existing.error) throw existing.error
const tagQuery = await db.from('tags').select('*').or('name.eq.하츠네 미쿠,slug.eq.hatsune-miku').limit(1).maybeSingle()
if (tagQuery.error) throw tagQuery.error
if (!tagQuery.data) throw new Error('하츠네 미쿠 태그를 찾지 못했습니다.')

await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-hatsune-miku-chocoanimal-${Date.now()}.json`, JSON.stringify({ events: existing.data }, null, 2))

const urls = {}
for (const [key, url] of imageDefs) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${key} download failed: ${response.status}`)
  const path = key === 'cover'
    ? 'event-posters/hatsune-miku-chocoanimal-animate-cafe-2026.jpg'
    : `goods/2026/hatsune-miku-chocoanimal-${key}.jpg`
  const upload = await db.storage.from('event-goods').upload(path, Buffer.from(await response.arrayBuffer()), { contentType: 'image/jpeg', upsert: true })
  if (upload.error) throw upload.error
  urls[key] = db.storage.from('event-goods').getPublicUrl(path).data.publicUrl
}

const template = await db.from('events').select('place_id,place_name,place_addr,place_lat,place_lng,parking,parking_note').eq('id', 'af91b699-2b6a-440d-bd64-60747e54d6a4').single()
if (template.error) throw template.error

const dailyHours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => [day, { open: '10:00', close: '21:00' }]))
const payload = {
  tag_id: tagQuery.data.id,
  type: 'collab_cafe',
  title,
  start_date: '2026-09-04',
  end_date: '2026-10-13',
  reserve_start: null,
  reserve_end: null,
  entry_info: '현장 선착순 입장',
  description: '하츠네 미쿠와 피아프로 캐릭터즈가 초콜릿과 동물을 모티브로 한 「Chocoanimal Miku Wagon」 비주얼로 등장하는 공식 콜라보 카페입니다.\n\n테마 메뉴와 주문 특전, 한정 굿즈를 함께 만날 수 있으며 일부 메뉴와 특전은 준비 수량 소진 시 조기 종료될 수 있습니다.',
  cover_url: urls.cover,
  ...template.data,
  place_detail: 'B1F 애니메이트 카페 잠실롯데점',
  hours: dailyHours,
  hours_info: '매일 10:00~21:00\n라스트오더 20:30',
  source_urls: [mainSource, cafeSource, officialProject],
  ticket_urls: [],
  updated_by: editor,
  updated_at: new Date().toISOString(),
}

const duplicate = await db.from('events').select('id').eq('title', title).eq('start_date', payload.start_date).maybeSingle()
if (duplicate.error) throw duplicate.error
const saved = duplicate.data
  ? await db.from('events').update(payload).eq('id', duplicate.data.id).select('*').single()
  : await db.from('events').insert({ ...payload, created_by: editor }).select('*').single()
if (saved.error) throw saved.error

const goodsRows = [
  { name: 'Chocoanimal Miku Wagon 공식 캠페인 안내', kind: 'goods', image_url: urls.campaign },
  { name: 'Chocoanimal Miku Wagon 공식 메뉴·굿즈 안내', kind: 'goods', image_url: urls['menu-goods'] },
]
for (const row of goodsRows) {
  const found = await db.from('event_goods').select('id').eq('event_id', saved.data.id).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (found.error) throw found.error
  if (!found.data) {
    const added = await db.from('event_goods').insert({ ...row, event_id: saved.data.id, price: null, created_by: editor, updated_by: editor })
    if (added.error) throw added.error
  }
}

console.log(JSON.stringify({ status: duplicate.data ? 'UPDATED' : 'INSERTED', eventId: saved.data.id, title, images: goodsRows.length, pending: ['한국 잠실점 메뉴·굿즈 개별 공지의 원본 게시물 URL 확인 후 한국어 안내 이미지로 교체 검토'] }, null, 2))

