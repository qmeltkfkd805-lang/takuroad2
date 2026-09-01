import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '블리치 천년혈전편 × 피규어프레소 공식 콜라보 카페'
const sourceUrl = 'https://x.com/figurepresso_cf/status/2093157518227001419'
const venueUrl = 'https://figurepresso.com/fp_contect.html'
const posterUrl = 'https://pbs.twimg.com/media/HQxjg5bawAAUDgH.jpg?name=orig'

const { data: existingEvents, error: existingError } = await db.from('events').select('*').ilike('title', '%블리치%')
if (existingError) throw existingError
const { data: existingPlaces, error: placesError } = await db.from('places').select('*').eq('kakao_place_id', '2128926655')
if (placesError) throw placesError

await mkdir('scripts/event-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-backups/before-bleach-thousand-year-cafe-${stamp}.json`
await writeFile(backup, JSON.stringify({ events: existingEvents, places: existingPlaces }, null, 2), 'utf8')

let place = existingPlaces[0]
if (!place) {
  const inserted = await db.from('places').insert({
    slug: 'figure-presso-fp-hongdae',
    name: '피규어프레소 FP점',
    place_type: 'CAFE',
    addr: '서울 마포구 와우산로29길 48-11',
    region: '서울',
    district: '마포구',
    lat: 37.55606222752837,
    lng: 126.92755940621115,
    kakao_place_id: '2128926655',
    category_name: '가정,생활 > 유아 > 장난감,완구',
    parking: false,
    parking_note: '주차 불가',
  }).select('*').single()
  if (inserted.error) throw inserted.error
  place = inserted.data
}

const imageResponse = await fetch(posterUrl)
if (!imageResponse.ok) throw new Error(`Poster download failed: ${imageResponse.status}`)
const poster = Buffer.from(await imageResponse.arrayBuffer())
const objectPath = 'event-posters/bleach-thousand-year-blood-war-figurepresso-2026.jpg'
const { error: uploadError } = await db.storage.from('event-images').upload(objectPath, poster, {
  contentType: 'image/jpeg',
  upsert: true,
})
if (uploadError) throw uploadError
const { data: publicData } = db.storage.from('event-images').getPublicUrl(objectPath)

const hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => [day, { open: '12:00', close: '21:00' }]))
const payload = {
  tag_id: '1027065f-cc43-424a-bc69-471cc38df7fd',
  type: 'collab_cafe',
  title,
  start_date: '2026-09-11',
  end_date: '2026-10-11',
  reserve_start: null,
  reserve_end: null,
  entry_info: '입장 방식 추후 공개',
  description: 'TV 애니메이션 「블리치 천년혈전편」을 주제로 진행되는 공식 콜라보 카페입니다.\n\n콜라보 메뉴와 특전, 굿즈 및 입장 방식은 공식 계정을 통해 추후 공개될 예정입니다.',
  cover_url: publicData.publicUrl,
  place_id: place.id,
  place_name: place.name,
  place_addr: place.addr,
  place_lat: place.lat,
  place_lng: place.lng,
  place_detail: '2층 더베이크 홍대피규어프레소FP점',
  parking: false,
  parking_note: '주차 불가',
  hours,
  hours_info: '매일 12:00~21:00\n라스트오더 20:00\n홀 마감 20:30',
  source_urls: [sourceUrl, venueUrl],
  ticket_urls: [],
  updated_by: editorId,
  updated_at: new Date().toISOString(),
}

const duplicate = await db.from('events').select('id').eq('title', title).eq('start_date', payload.start_date).maybeSingle()
if (duplicate.error) throw duplicate.error
const result = duplicate.data
  ? await db.from('events').update(payload).eq('id', duplicate.data.id).select('*').single()
  : await db.from('events').insert({ ...payload, created_by: editorId }).select('*').single()
if (result.error) throw result.error

console.log(JSON.stringify({ backup, status: duplicate.data ? 'UPDATE' : 'INSERT', event: result.data }, null, 2))
