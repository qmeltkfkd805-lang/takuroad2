import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const tag = (await db.from('tags').select('id').eq('slug', 'studio-ghibli').single()).data
if (!tag) throw new Error('스튜디오 지브리 태그가 없습니다.')

const weekly = (open, close) => Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, { open, close }]),
)

async function ensurePlace({ kakaoPlaceId, row }) {
  let { data } = await db.from('places').select('id').eq('kakao_place_id', kakaoPlaceId).maybeSingle()
  if (!data) {
    const result = await db.from('places').insert(row).select('id').single()
    if (result.error) throw result.error
    data = result.data
  }
  const addr = row.addr.replace(/\s/g, '')
  const mapped = await db.from('place_address_map').upsert({ addr, place_id: data.id }, { onConflict: 'addr' })
  if (mapped.error) throw mapped.error
  return data.id
}

const artCenter = await ensurePlace({
  kakaoPlaceId: '259569525',
  row: {
    slug: 'jeju-donghwa-village', name: '제주동화마을', place_type: 'CULTURE_SPACE',
    addr: '제주특별자치도 제주시 구좌읍 비자림로 1191', region: '제주', district: '제주시',
    lat: 33.43543497779248, lng: 126.73204032152246, kakao_place_id: '259569525',
    parking: true, parking_note: '제주동화마을 공식 안내 기준 600대 동시 주차 가능',
  },
})

const airport = await ensurePlace({
  kakaoPlaceId: '10808261',
  row: {
    slug: 'jeju-international-airport', name: '제주국제공항', place_type: 'EVENT_HALL',
    addr: '제주특별자치도 제주시 공항로 2', region: '제주', district: '제주시',
    lat: 33.50683984835887, lng: 126.49272304493574, kakao_place_id: '10808261',
    parking: true, parking_note: '제주국제공항 유료 주차장 이용 가능. 요금은 한국공항공사 주차 안내에서 확인',
  },
})

const events = [
  {
    tag_id: tag.id, type: 'exhibition', title: '스튜디오 지브리展 in Jeju',
    start_date: '2026-07-11', end_date: '2033-10-31',
    cover_url: 'https://akcdn-daewonplayd.cafe24img.com/popcondplay/ticket/20260709_ghibli_jeju/ghibli_jeju_01.jpg',
    place_id: artCenter, place_name: '제주동화마을', place_addr: '제주특별자치도 제주시 구좌읍 비자림로 1191',
    place_lat: 33.43543497779248, place_lng: 126.73204032152246,
    place_detail: '동화 아트센터 (공식 전시장 안내 주소: 비자림로 1183)',
    parking: true, parking_note: '제주동화마을 공식 안내 기준 600대 동시 주차 가능',
    hours: weekly('09:00', '19:00'), hours_info: '매일 09:00~19:00 · 매표 및 입장 마감 18:00',
    entry_info: '사전예매 가능\n현장 구매 후 입장',
    description: '전체관람가입니다. 관람 소요시간은 약 90분이며, 현재 판매 티켓은 표기된 유효기간 내에 사용해야 합니다. 할인 대상은 현장 매표소에서 증빙서류 확인 후 구매할 수 있습니다.',
    source_urls: ['https://www.popcondplay.com/ip/news/view/574', 'https://www.jejudonghwa.com/'],
    ticket_urls: ['https://www.popcondplay.com/reserve/view/72', 'https://nol.yanolja.com/ticket/products/26009468'],
  },
  {
    tag_id: tag.id, type: 'popup', title: '스튜디오 지브리展 in Jeju X 도토리숲 POP-UP STORE',
    start_date: '2026-07-09', end_date: '2026-09-27',
    cover_url: 'https://api.cdn.visitjeju.net/photomng/imgpath/202607/02/c63b6c81-1ed6-4b64-886b-93e2c9702694.webp',
    place_id: airport, place_name: '제주국제공항', place_addr: '제주특별자치도 제주시 공항로 2',
    place_lat: 33.50683984835887, place_lng: 126.49272304493574, place_detail: '도착층 3번 게이트 앞',
    parking: true, parking_note: '제주국제공항 유료 주차장 이용 가능. 요금은 한국공항공사 주차 안내에서 확인',
    hours: weekly('08:00', '20:00'), hours_info: '매일 08:00~20:00', entry_info: '현장 선착순 입장',
    description: '1만원 이상 구매 시 제주 한정 아트워크 엽서, 5만원 이상 구매 시 제주 한정 아트워크 러기지택을 증정합니다. 증정품은 준비 수량 소진 시 조기 종료될 수 있습니다.',
    source_urls: ['https://www.popcondplay.com/ip/news/view/612', 'https://visitjeju.net/kr/festival/view?contentsid=CNTS_300000000014514'],
    ticket_urls: [],
  },
]

for (const event of events) {
  const { data: duplicate } = await db.from('events').select('id,title').eq('title', event.title).maybeSingle()
  if (duplicate) {
    console.log('SKIP', duplicate)
    continue
  }
  const { data, error } = await db.from('events').insert({ ...event, updated_at: new Date().toISOString() }).select('id,title').single()
  if (error) throw error
  console.log('INSERT', data)
}
