import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '폼폼푸린의 와-앙만두 팝업스토어'
const sourceUrls = ['https://www.instagram.com/hk_zip/', 'https://www.instagram.com/sanrio_kr/', 'https://www.hdc-iparkmall.com/main/location']

const duplicates = await db.from('events').select('*').or('title.ilike.%와-앙만두%,title.ilike.%와앙만두%')
if (duplicates.error) throw duplicates.error
const placeResult = await db.from('places').select('*').eq('name', '아이파크몰 용산점').limit(1).maybeSingle()
if (placeResult.error) throw placeResult.error
if (!placeResult.data) throw new Error('아이파크몰 용산점 장소를 찾지 못했습니다.')
const place = placeResult.data

let tagResult = await db.from('tags').select('*').or('name.ilike.%폼폼푸린%,english_name.ilike.%Pompompurin%').limit(1).maybeSingle()
if (tagResult.error) throw tagResult.error
let tag = tagResult.data
if (!tag) {
  const created = await db.from('tags').insert({
    name: '폼폼푸린', slug: 'pompompurin', english_name: 'Pompompurin', ip_type: '캐릭터',
    genres: ['캐릭터'], description: '산리오의 골든리트리버 캐릭터입니다.',
    official_url: 'https://www.sanrio.co.jp/characters/pompompurin/', created_by: editor,
  }).select('*').single()
  if (created.error) throw created.error
  tag = created.data
}

await mkdir('scripts/event-backups', { recursive: true })
await mkdir('scripts/event-goods-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-pompompurin-wang-mandu-${Date.now()}.json`, JSON.stringify({ events: duplicates.data, place, tag }, null, 2))

const posterPath = 'event-posters/pompompurin-wang-mandu-2026-main.jpg'
const poster = await readFile('scripts/work-menu-goods-images/pompompurin/01.jpg')
const posterUpload = await db.storage.from('event-goods').upload(posterPath, poster, { contentType: 'image/jpeg', upsert: true })
if (posterUpload.error) throw posterUpload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(posterPath).data.publicUrl

const hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'sun'].map((day) => [day, { open: '10:30', close: '20:30' }]))
hours.fri = { open: '10:30', close: '21:00' }
hours.sat = { open: '10:30', close: '21:00' }
const payload = {
  tag_id: tag.id, type: 'popup', title,
  start_date: '2026-09-02', end_date: '2026-09-27', reserve_start: null, reserve_end: null,
  entry_info: '현장예약 후 입장\n대기 없을 시 바로 입장 가능',
  description: '폼폼푸린 탄생 30주년을 기념해 왕만두집 사장님으로 변신한 폼폼푸린과 친구들을 만나는 공식 캐릭터 팝업스토어입니다.\n\n현장 대기는 09:30부터 등록할 수 있으며 1명이 최대 2명까지 등록할 수 있습니다.\n호출 후 15분 안에 방문하지 않으면 예약이 취소될 수 있습니다.\n당일 수용 인원을 넘으면 현장예약이 조기 마감될 수 있습니다.\n\n7만원 이상 구매 후 공식 운영 계정 팔로우를 인증하면 영수증 1건당 와앙만두 기프트세트 1개를 받을 수 있습니다.\n준비 수량 소진 시 증정은 종료됩니다.',
  cover_url: coverUrl,
  place_id: place.id, place_name: place.name, place_addr: place.addr, place_lat: place.lat, place_lng: place.lng,
  place_detail: '리빙파크 6F',
  parking: true,
  parking_note: place.parking_note || '주차 가능\n기본요금 10분당 1,500원\n당일 영수증에 따라 무료 주차 적용',
  hours, hours_info: '일~목 10:30~20:30\n금·토·공휴일 10:30~21:00\n현장예약 접수 09:30부터',
  source_urls: sourceUrls, ticket_urls: [], updated_by: editor, updated_at: new Date().toISOString(),
}

const exact = duplicates.data.find((event) => event.start_date === payload.start_date)
const saved = exact
  ? await db.from('events').update(payload).eq('id', exact.id).select('*').single()
  : await db.from('events').insert({ ...payload, created_by: editor }).select('*').single()
if (saved.error) throw saved.error

const beforeGoods = await db.from('event_goods').select('*').eq('event_id', saved.data.id)
if (beforeGoods.error) throw beforeGoods.error
await writeFile(`scripts/event-goods-backups/before-pompompurin-wang-mandu-${Date.now()}.json`, JSON.stringify(beforeGoods.data, null, 2))

const goods = [
  { file: '02.jpg', name: '폼폼푸린 와앙만두 봉제인형·마스코트 컬렉션' },
  { file: '03.jpg', name: '폼폼푸린 와앙만두 미니 피규어·스퀴시 컬렉션' },
  { file: '04.jpg', name: '폼폼푸린 와앙만두 키링·파우치 컬렉션' },
  { file: '05.jpg', name: '폼폼푸린 왕만두 스퀴시' },
  { file: '06.jpg', name: '폼폼푸린 와앙만두 대형 인형·쿠션 컬렉션' },
  { file: '07.jpg', name: '폼폼푸린 와앙만두 봉제 굿즈 컬렉션' },
  { file: '08.jpg', name: '폼폼푸린 와앙만두 식기세트' },
  { file: '09.jpg', name: '폼폼푸린 와앙만두 대형·중형 인형' },
]
const results = []
for (const row of goods) {
  const duplicate = await db.from('event_goods').select('id').eq('event_id', saved.data.id).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) { results.push({ name: row.name, status: 'SKIPPED_DUPLICATE' }); continue }
  const objectPath = `${saved.data.id}/official-pompompurin-wang-mandu-${row.file}`
  const image = await readFile(`scripts/work-menu-goods-images/pompompurin/${row.file}`)
  const upload = await db.storage.from('event-goods').upload(objectPath, image, { contentType: 'image/jpeg', upsert: true })
  if (upload.error) throw upload.error
  const imageUrl = db.storage.from('event-goods').getPublicUrl(objectPath).data.publicUrl
  const inserted = await db.from('event_goods').insert({ event_id: saved.data.id, name: row.name, kind: 'goods', price: null, image_url: imageUrl, created_by: editor, updated_by: editor })
  if (inserted.error) throw inserted.error
  results.push({ name: row.name, status: 'INSERTED' })
}

console.log(JSON.stringify({ status: exact ? 'UPDATED' : 'INSERTED', eventId: saved.data.id, title, goodsInserted: results.filter((row) => row.status === 'INSERTED').length, pending: ['공식 상품 가격표 원본', '일일 한정 수량 안내 원본'] }, null, 2))

