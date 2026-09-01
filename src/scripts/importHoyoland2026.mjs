import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = 'HoYoLAND 2026'
const startDate = '2026-10-02'
const officialMain = 'https://game.naver.com/lounge/ZZZ/temp/335158'
const officialTicketEvent = 'https://game.naver.com/lounge/ZZZ/board/detail/8116723'

const duplicateResult = await db
  .from('events')
  .select('*')
  .or('title.ilike.%HoYoLAND 2026%,title.ilike.%호요랜드2026%,title.ilike.%호요랜드 2026%')
if (duplicateResult.error) throw duplicateResult.error

const placeResult = await db
  .from('places')
  .select('*')
  .or('name.ilike.%KINTEX%,name.ilike.%킨텍스%')
  .limit(1)
  .maybeSingle()
if (placeResult.error) throw placeResult.error

let place = placeResult.data
if (!place) {
  const kakaoResponse = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent('킨텍스 제2전시장')}`,
    { headers: { Authorization: `KakaoAK ${process.env.NEXT_PUBLIC_KAKAO_REST_KEY}` } },
  )
  if (!kakaoResponse.ok) throw new Error(`Kakao place search failed: ${kakaoResponse.status}`)
  const documents = (await kakaoResponse.json()).documents
  const found = documents.find((item) => /킨텍스.*제2전시장|제2전시장.*킨텍스/.test(item.place_name)) ?? documents[0]
  if (!found) throw new Error('킨텍스 제2전시장 장소 검색 결과를 찾지 못했습니다.')

  const created = await db.from('places').insert({
    slug: 'kintex-second-exhibition-center',
    name: '킨텍스 제2전시장',
    place_type: 'EXHIBITION',
    addr: found.road_address_name || found.address_name,
    region: '경기',
    district: '고양시 일산서구',
    lat: Number(found.y),
    lng: Number(found.x),
    kakao_place_id: found.id,
    category_name: found.category_name,
    parking: true,
    parking_note: '주차 가능\n일반 차량 1일 정상요금 19,000원\n제2전시장 주차센터 031-995-7265',
  }).select('*').single()
  if (created.error) throw created.error
  place = created.data
}

let tagResult = await db
  .from('tags')
  .select('*')
  .or('name.ilike.%HoYoLAND%,name.ilike.%호요랜드%,name.ilike.%호요버스%')
  .limit(1)
  .maybeSingle()
if (tagResult.error) throw tagResult.error

let tag = tagResult.data
if (!tag) {
  const created = await db.from('tags').insert({
    name: 'HoYoLAND',
    slug: 'hoyoland',
    english_name: 'HoYoLAND',
    ip_type: '게임 행사',
    genres: ['게임', '전시', '체험'],
    description: 'HoYoverse의 주요 게임을 한자리에서 만나는 공식 오프라인 종합 행사입니다.',
    official_url: officialMain,
    created_by: editor,
  }).select('*').single()
  if (created.error) throw created.error
  tag = created.data
}

await mkdir('scripts/event-backups', { recursive: true })
await writeFile(
  `scripts/event-backups/before-hoyoland-2026-${Date.now()}.json`,
  JSON.stringify({ events: duplicateResult.data, place, tag }, null, 2),
)

const poster = await readFile('scripts/work-menu-goods-images/hoyoland-2026-press.jpg')
const posterPath = 'event-posters/hoyoland-2026-main.jpg'
const upload = await db.storage.from('event-goods').upload(posterPath, poster, {
  contentType: 'image/jpeg',
  upsert: true,
})
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(posterPath).data.publicUrl

const payload = {
  tag_id: tag.id,
  type: 'official_event',
  title,
  start_date: startDate,
  end_date: '2026-10-05',
  reserve_start: null,
  reserve_end: null,
  entry_info: null,
  description: '붕괴3rd, 원신, 미해결사건부, 붕괴: 스타레일, 젠레스 존 제로 등 HoYoverse 대표 게임 5종을 한자리에서 만나는 공식 종합 게임 행사입니다.\n\n게임별 테마 전시와 현장 콘텐츠, 팬 2차 창작물을 소개하는 전시존이 함께 마련됩니다. 세부 프로그램과 일반 입장권 판매 일정은 공식 커뮤니티에서 순차적으로 공개됩니다.',
  cover_url: coverUrl,
  place_id: place.id,
  place_name: place.name,
  place_addr: place.addr,
  place_lat: place.lat,
  place_lng: place.lng,
  place_detail: '제2전시장 7·8홀 및 후면광장',
  parking: true,
  parking_note: '주차 가능\n일반 차량 1일 정상요금 19,000원\n제2전시장 주차센터 031-995-7265',
  hours: null,
  hours_info: '운영시간 추후 공식 안내 예정',
  source_urls: [officialMain, officialTicketEvent],
  ticket_urls: [],
  updated_by: editor,
  updated_at: new Date().toISOString(),
}

const exact = duplicateResult.data.find((event) => event.start_date === startDate)
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
  pending: ['일별 운영시간', '일반 입장권 예매 기간·URL', '게임별 메뉴·굿즈 이미지'],
}, null, 2))

