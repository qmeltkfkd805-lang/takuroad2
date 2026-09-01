import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '팬게이머 팝업스토어: 썸머게임클럽'
const bookingUrl = 'https://m.booking.naver.com/booking/12/bizes/1488055?theme=place&entry=pll&lang=ko'
const sourceUrls = [
  'https://x.com/fangamer_popup',
  'https://www.fangamer.eu/blogs/news/peak-absolum',
  'https://www.ehyundai.com/newPortal/DP/DP000000_V.do?branchCd=B00127100',
  'https://ehyundai.com/newPortal/uplex/DP/WC/WC000000_V.do?branchCd=B00127100',
]

const duplicates = await db.from('events').select('*').or('title.ilike.%팬게이머%,title.ilike.%썸머게임클럽%')
if (duplicates.error) throw duplicates.error

let placeResult = await db.from('places').select('*').eq('name', '현대백화점 신촌점').limit(1).maybeSingle()
if (placeResult.error) throw placeResult.error
let place = placeResult.data
if (!place) {
  const kakaoResponse = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent('현대백화점 신촌점')}`,
    { headers: { Authorization: `KakaoAK ${process.env.NEXT_PUBLIC_KAKAO_REST_KEY}` } },
  )
  if (!kakaoResponse.ok) throw new Error(`Kakao place search failed: ${kakaoResponse.status}`)
  const documents = (await kakaoResponse.json()).documents
  const found = documents.find((item) => item.place_name.includes('현대백화점 신촌점'))
  if (!found) throw new Error('카카오 장소 검색에서 현대백화점 신촌점을 찾지 못했습니다.')
  const created = await db.from('places').insert({
    slug: 'hyundai-department-store-sinchon', name: '현대백화점 신촌점', place_type: 'DEPARTMENT_STORE',
    addr: found.road_address_name || found.address_name, region: '서울', district: '서대문구',
    lat: Number(found.y), lng: Number(found.x), kakao_place_id: found.id, category_name: found.category_name,
    parking: true,
    parking_note: '최초 30분 무료\n초과 10분당 1,000원\n3만원 이상 구매 시 1시간 무료\n5만원 이상 구매 시 2시간 무료\n10만원 이상 구매 시 3시간 무료\n30만원 이상 구매 시 당일 무료',
  }).select('*').single()
  if (created.error) throw created.error
  place = created.data
}

let tagResult = await db.from('tags').select('*').eq('slug', 'fangamer').limit(1).maybeSingle()
if (tagResult.error) throw tagResult.error
let tag = tagResult.data
if (!tag) {
  const created = await db.from('tags').insert({
    name: '팬게이머', slug: 'fangamer', english_name: 'Fangamer', ip_type: '게임', genres: ['게임', '인디게임'],
    description: '게임 개발사와 협업해 공식 게임 굿즈를 제작·판매하는 브랜드입니다.',
    official_url: 'https://www.fangamer.com/', created_by: editor,
  }).select('*').single()
  if (created.error) throw created.error
  tag = created.data
}

await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-fangamer-summer-game-club-${Date.now()}.json`, JSON.stringify({ events: duplicates.data, place, tag }, null, 2))

const posterPath = 'event-posters/fangamer-summer-game-club-2026-main.jpg'
const poster = await readFile('scripts/work-menu-goods-images/fangamer-summer/01.jpg')
const posterUpload = await db.storage.from('event-goods').upload(posterPath, poster, { contentType: 'image/jpeg', upsert: true })
if (posterUpload.error) throw posterUpload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(posterPath).data.publicUrl

const hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, { open: '10:30', close: '22:00' }]))
const payload = {
  tag_id: tag.id, type: 'popup', title,
  start_date: '2026-08-24', end_date: '2026-09-06', reserve_start: null, reserve_end: null,
  entry_info: '사전예약 후 입장\n현장예약 가능',
  description: '언더테일, 델타룬, 할로우 나이트, 스타듀 밸리 등 인기 인디게임의 공식 굿즈를 한자리에서 만나는 팬게이머 팝업스토어입니다.\n게임 플레이 성향 테스트, 드로잉 존, 게임 OST 바이닐 감상 공간 등 체험 콘텐츠도 운영됩니다.\n\n사전예약자는 네이버 예약 내역과 예약자 본인의 실물 신분증을 지참해야 합니다.\n예약 시각 10분 전부터 10분 후까지 대기 후 입장할 수 있으며 이후에는 입장이 제한됩니다.\n퇴장 후 재입장은 불가하고, 현장예약은 사전예약자 입장 후 접수 순서에 따라 진행되며 현장 상황에 따라 조기 마감될 수 있습니다.\n\n만 14세 미만은 법적 보호자가 예약한 뒤 보호자 1인과 만 14세 미만 고객 1인이 함께 입장할 수 있습니다.\n상품과 사은품은 한정 수량으로 운영되어 조기 소진되거나 구매 수량이 제한될 수 있습니다.',
  cover_url: coverUrl,
  place_id: place.id, place_name: place.name, place_addr: place.addr, place_lat: place.lat, place_lng: place.lng,
  place_detail: 'U-PLEX 1F 팝업 행사장',
  parking: true, parking_note: place.parking_note,
  hours, hours_info: '매일 10:30~22:00',
  source_urls: sourceUrls,
  ticket_urls: [{ url: bookingUrl, label: '팝업 사전예약하기' }],
  updated_by: editor, updated_at: new Date().toISOString(),
}

const exact = duplicates.data.find((event) => event.start_date === payload.start_date && event.end_date === payload.end_date)
const saved = exact
  ? await db.from('events').update(payload).eq('id', exact.id).select('*').single()
  : await db.from('events').insert({ ...payload, created_by: editor }).select('*').single()
if (saved.error) throw saved.error

console.log(JSON.stringify({ status: exact ? 'UPDATED' : 'INSERTED', eventId: saved.data.id, title, place: place.name, coverUrl, pending: ['공식 MD 상품 리스트 이미지', '공식적으로 명시된 사전예약 오픈·마감일'] }, null, 2))
