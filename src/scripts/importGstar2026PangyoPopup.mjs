import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '지스타 2026 판업스토어'
const officialSite = 'https://www.gstar.or.kr/'
const hyundaiInfo = 'https://ehyundai.com/newPortal/DP/WC/WC000000_V.do?branchCd=B00148000'

const duplicates = await db.from('events').select('*').or('title.ilike.%지스타 2026%판업%,title.ilike.%G-STAR 2026%판업%')
if (duplicates.error) throw duplicates.error

const placeResult = await db.from('places').select('*').or('name.ilike.%현대백화점 판교%,name.ilike.%판교점%현대백화점%').limit(1).maybeSingle()
if (placeResult.error) throw placeResult.error
let place = placeResult.data
if (!place) {
  const kakaoResponse = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent('현대백화점 판교점')}`,
    { headers: { Authorization: `KakaoAK ${process.env.NEXT_PUBLIC_KAKAO_REST_KEY}` } },
  )
  if (!kakaoResponse.ok) throw new Error(`Kakao place search failed: ${kakaoResponse.status}`)
  const documents = (await kakaoResponse.json()).documents
  const found = documents.find((item) => item.place_name === '현대백화점 판교점')
  if (!found) throw new Error('카카오 장소 검색에서 현대백화점 판교점을 찾지 못했습니다.')
  const created = await db.from('places').insert({
    slug: 'hyundai-department-store-pangyo', name: '현대백화점 판교점', place_type: 'DEPARTMENT_STORE',
    addr: found.road_address_name || found.address_name, region: '경기', district: '성남시 분당구',
    lat: Number(found.y), lng: Number(found.x), kakao_place_id: found.id, category_name: found.category_name,
    parking: true,
    parking_note: '주차 가능\n최초 30분 무료, 이후 10분당 1,000원\n5만원 이상 구매 1시간·10만원 이상 2시간·15만원 이상 3시간·20만원 이상 5시간 무료',
  }).select('*').single()
  if (created.error) throw created.error
  place = created.data
}

let tagResult = await db.from('tags').select('*').or('name.ilike.%지스타%,english_name.ilike.%G-STAR%').limit(1).maybeSingle()
if (tagResult.error) throw tagResult.error
let tag = tagResult.data
if (!tag) {
  const created = await db.from('tags').insert({
    name: '지스타', slug: 'g-star', english_name: 'G-STAR', ip_type: '게임 전시회',
    genres: ['게임', '전시', '체험'],
    description: '국내외 게임사와 게임 콘텐츠를 소개하는 국제게임전시회입니다.',
    official_url: officialSite, created_by: editor,
  }).select('*').single()
  if (created.error) throw created.error
  tag = created.data
}

await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-gstar-2026-pangyo-popup-${Date.now()}.json`, JSON.stringify({ events: duplicates.data, place, tag }, null, 2))

const poster = await readFile('scripts/work-menu-goods-images/gstar-2026-popup-poster.jpg')
const posterPath = 'event-posters/gstar-2026-pangyo-popup-main.jpg'
const upload = await db.storage.from('event-goods').upload(posterPath, poster, { contentType: 'image/jpeg', upsert: true })
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(posterPath).data.publicUrl

const hours = {
  tue: { open: '10:30', close: '20:00' },
  wed: { open: '10:30', close: '20:00' },
  thu: { open: '10:30', close: '20:00' },
  fri: { open: '10:30', close: '20:30' },
  sat: { open: '10:30', close: '20:30' },
  sun: { open: '10:30', close: '20:30' },
}

const payload = {
  tag_id: tag.id,
  type: 'popup',
  title,
  start_date: '2026-09-01',
  end_date: '2026-09-06',
  reserve_start: null,
  reserve_end: null,
  entry_info: '현장 자유 입장',
  description: '국제게임전시회 지스타 2026을 본 행사보다 먼저 만나는 공식 팝업스토어입니다.\n\n지스타 스페셜 패스를 얼리버드 가격으로 현장 판매하며, 이동건 작가의 웹툰 「유미의 세포들」 협업 굿즈와 지스타 공식 상품을 공개합니다. 현대자동차 심레이싱 체험과 현장 경품 이벤트도 함께 진행됩니다.\n\n스페셜 패스와 굿즈는 준비 수량 소진 시 조기 품절될 수 있습니다.',
  cover_url: coverUrl,
  place_id: place.id,
  place_name: place.name,
  place_addr: place.addr,
  place_lat: place.lat,
  place_lng: place.lng,
  place_detail: '4F 아이코닉 스퀘어',
  parking: true,
  parking_note: '주차 가능\n최초 30분 무료, 이후 10분당 1,000원\n5만원 이상 구매 1시간·10만원 이상 2시간·15만원 이상 3시간·20만원 이상 5시간 무료',
  hours,
  hours_info: '9월 1일~3일 10:30~20:00\n9월 4일~6일 10:30~20:30',
  source_urls: [officialSite, hyundaiInfo],
  ticket_urls: [],
  updated_by: editor,
  updated_at: new Date().toISOString(),
}

const exact = duplicates.data.find((event) => event.start_date === payload.start_date)
const saved = exact
  ? await db.from('events').update(payload).eq('id', exact.id).select('*').single()
  : await db.from('events').insert({ ...payload, created_by: editor }).select('*').single()
if (saved.error) throw saved.error

console.log(JSON.stringify({
  status: exact ? 'UPDATED' : 'INSERTED',
  eventId: saved.data.id,
  title: saved.data.title,
  place: `${saved.data.place_name} / ${saved.data.place_detail}`,
  coverUrl,
  pending: ['굿즈별 상세 이미지와 가격표', '현장 이벤트 세부 참여 조건'],
}, null, 2))


