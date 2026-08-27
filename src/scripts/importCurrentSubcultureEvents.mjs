import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const now = new Date().toISOString()
const daily = (open, close) => Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, { open, close }]))

async function ensurePlace(row) {
  const found = await db.from('places').select('*').eq('kakao_place_id', row.kakao_place_id).maybeSingle()
  if (found.error) throw found.error
  if (found.data) {
    const updated = await db.from('places').update({ parking: row.parking, parking_note: row.parking_note }).eq('id', found.data.id).select('*').single()
    if (updated.error) throw updated.error
    return updated.data
  }
  const inserted = await db.from('places').insert(row).select('*').single()
  if (inserted.error) throw inserted.error
  return inserted.data
}

const lotte = await ensurePlace({
  slug: 'lotte-world-tower-mall', name: '롯데월드타워&롯데월드몰', place_type: 'SHOPPING_MALL',
  addr: '서울 송파구 올림픽로 300', region: '서울', district: '송파구', lat: 37.5136519138098, lng: 127.104079482694,
  kakao_place_id: '14650655', category_name: '가정,생활 > 복합쇼핑몰', parking: true,
  parking_note: '주차 가능(유료)\n10:00~20:00 10분당 500원\n그 외 시간 10분당 200원\n팝업 상품 구매에 따른 무료 주차 할인은 제공되지 않습니다.',
})

const hyundai = await ensurePlace({
  slug: 'the-hyundai-seoul', name: '더현대 서울', place_type: 'DEPARTMENT_STORE',
  addr: '서울 영등포구 여의대로 108', region: '서울', district: '영등포구', lat: 37.5258720710291, lng: 126.928446124112,
  kakao_place_id: '1662602781', category_name: '가정,생활 > 백화점 > 현대백화점', parking: true,
  parking_note: '주차 가능(유료)\n최초 30분 무료, 초과 시 10분당 2,000원\n5만원 이상 구매 시 1시간, 10만원 이상 2시간, 15만원 이상 3시간 무료',
})

const iparkResult = await db.from('places').select('*').eq('kakao_place_id', '7990380').single()
if (iparkResult.error) throw iparkResult.error
const ipark = iparkResult.data

const musinsaResult = await db.from('places').select('*').eq('kakao_place_id', '472114233').single()
if (musinsaResult.error) throw musinsaResult.error
const musinsa = musinsaResult.data

const shinsegaeResult = await db.from('places').select('*').eq('kakao_place_id', '22386977').single()
if (shinsegaeResult.error) throw shinsegaeResult.error
const shinsegae = shinsegaeResult.data
const shinsegaeParking = '주차 가능(유료)\n15분당 1,500원\n5만원 이상 구매 시 1시간, 10만원 이상 2시간, 15만원 이상 3시간 무료\n무료 주차는 최대 3시간'
await db.from('places').update({ parking: true, parking_note: shinsegaeParking }).eq('id', shinsegae.id)

const events = [
  {
    tag_id: '41e73c70-0c1c-4950-9a01-4c0fd75820c5', type: 'popup', title: '개구리 중사 케로로 × SUB.ST 팝업스토어 (용산점)',
    start_date: '2026-08-28', end_date: '2026-09-14', reserve_start: null, reserve_end: null,
    entry_info: '현장 입장',
    description: '개구리 중사 케로로와 SUB.ST가 함께 선보이는 팝업스토어입니다. 작품을 활용한 공식 굿즈를 만날 수 있습니다.',
    cover_url: null, place_id: ipark.id, place_name: ipark.name, place_addr: ipark.addr, place_lat: ipark.lat, place_lng: ipark.lng,
    place_detail: '리빙파크 6층 모애쿠 옆 서브스트릿 스페이스', parking: ipark.parking, parking_note: ipark.parking_note,
    hours: { mon:{open:'10:30',close:'20:30'},tue:{open:'10:30',close:'20:30'},wed:{open:'10:30',close:'20:30'},thu:{open:'10:30',close:'20:30'},fri:{open:'10:30',close:'21:00'},sat:{open:'10:30',close:'21:00'},sun:{open:'10:30',close:'20:30'} },
    hours_info: '월~목·일 10:30~20:30\n금·토 10:30~21:00',
    source_urls: ['https://www.instagram.com/p/Db-Y8_Lo8r2/', 'https://www.hdc-iparkmall.com/main/webrender.do'], ticket_urls: [], updated_at: now,
  },
  {
    tag_id: '6200fb96-d722-4cbf-b09c-d5967f598ee7', type: 'popup', title: '포켓몬 무릉도원 팝업스토어',
    start_date: '2026-08-16', end_date: '2026-08-31', reserve_start: null, reserve_end: null, entry_info: '현장 입장',
    description: '포켓몬을 주제로 꾸민 무릉도원 팝업스토어입니다. 행사 한정 공간에서 공식 상품과 다양한 포켓몬 콘텐츠를 만날 수 있습니다.',
    cover_url: null, place_id: lotte.id, place_name: lotte.name, place_addr: lotte.addr, place_lat: lotte.lat, place_lng: lotte.lng,
    place_detail: '1층 아트리움', parking: lotte.parking, parking_note: lotte.parking_note, hours: daily('10:30','22:00'), hours_info: '매일 10:30~22:00',
    source_urls: ['https://www.instagram.com/p/DbnFauAjwZz/'], ticket_urls: [], updated_at: now,
  },
  {
    tag_id: '89fcd21d-ccbb-4e44-8bc4-4b31c37d21e6', type: 'popup', title: '이치방쿠지 × 무신사 팝업스토어',
    start_date: '2026-08-01', end_date: '2026-08-31', reserve_start: null, reserve_end: null, entry_info: '현장 입장',
    description: '여러 애니메이션과 캐릭터 작품의 이치방쿠지를 한자리에서 만나는 팝업스토어입니다.\n\n이치방쿠지 3회 이상 구매 시 스트링백을 1인 1회 증정합니다. 영수증 합산은 불가하며 준비 수량 소진 시 종료됩니다.',
    cover_url: null, place_id: musinsa.id, place_name: musinsa.name, place_addr: musinsa.addr, place_lat: musinsa.lat, place_lng: musinsa.lng,
    place_detail: '무신사 스토어 성수@대림창고', parking: musinsa.parking, parking_note: musinsa.parking_note, hours: daily('11:00','22:00'), hours_info: '매일 11:00~22:00',
    source_urls: ['https://www.instagram.com/p/DbcpUOhlGg-/', 'https://www.musinsa.com/content/1508713701736260383'], ticket_urls: [], updated_at: now,
  },
  {
    tag_id: '0a0a8588-9e58-438b-90b0-837fc2e44b81', type: 'popup', title: '해즈빈 호텔 팝업스토어',
    start_date: '2026-08-11', end_date: '2026-08-19', reserve_start: null, reserve_end: null, entry_info: '현장 입장',
    description: '애니메이션 해즈빈 호텔이 국내에서 처음 선보이는 공식 팝업스토어입니다. 신규 상품을 포함한 공식 굿즈를 만날 수 있습니다.',
    cover_url: null, place_id: hyundai.id, place_name: hyundai.name, place_addr: hyundai.addr, place_lat: hyundai.lat, place_lng: hyundai.lng,
    place_detail: '지하 2층 아이코닉존', parking: hyundai.parking, parking_note: hyundai.parking_note,
    hours: { mon:{open:'10:30',close:'20:00'},tue:{open:'10:30',close:'20:00'},wed:{open:'10:30',close:'20:00'},thu:{open:'10:30',close:'20:00'},fri:{open:'10:30',close:'20:30'},sat:{open:'10:30',close:'20:30'},sun:{open:'10:30',close:'20:30'} },
    hours_info: '월~목 10:30~20:00\n금~일 10:30~20:30',
    source_urls: ['https://x.com/0_percent_seoul/status/2084149048211308567', 'https://ehyundai.com/newPortal/DP/WC/WC000000_V.do?branchCd=B00140000'], ticket_urls: [], updated_at: now,
  },
  {
    tag_id: '98401509-3de0-4d38-8c0e-ae944b2e76aa', type: 'popup', title: '기간한정 JUMP SHOP in SEOUL 제3탄',
    start_date: '2026-09-23', end_date: '2026-10-06', reserve_start: null, reserve_end: null, entry_info: '입장 방식 추후 공개',
    description: '집영사 공인 공식 JUMP SHOP 팝업스토어입니다. 원피스, 주술회전, 하이큐!!, 가정교사 히트맨 리본! 등 점프 작품의 원작 일러스트 상품을 만날 수 있습니다.',
    cover_url: null, place_id: shinsegae.id, place_name: shinsegae.name, place_addr: shinsegae.addr, place_lat: shinsegae.lat, place_lng: shinsegae.lng,
    place_detail: '센트럴시티 1층 오픈스테이지', parking: true, parking_note: shinsegaeParking, hours: daily('10:00','21:00'), hours_info: '매일 10:00~21:00',
    source_urls: ['https://x.com/smg_comic', 'https://www.instagram.com/smc_comics_smc/', 'https://addir.shinsegae.com/store/main.do?storCd=SC00003'], ticket_urls: [], updated_at: now,
  },
]

const results = []
for (const event of events) {
  const existing = await db.from('events').select('id,title').eq('title', event.title).eq('start_date', event.start_date).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) {
    const updated = await db.from('events').update(event).eq('id', existing.data.id).select('id,title,start_date,end_date,place_name,place_detail,hours_info,entry_info,parking,parking_note,cover_url,source_urls,ticket_urls').single()
    if (updated.error) throw updated.error
    results.push({ status: 'UPDATE', ...updated.data })
  } else {
    const inserted = await db.from('events').insert(event).select('id,title,start_date,end_date,place_name,place_detail,hours_info,entry_info,parking,parking_note,cover_url,source_urls,ticket_urls').single()
    if (inserted.error) throw inserted.error
    results.push({ status: 'INSERT', ...inserted.data })
  }
}

console.log(JSON.stringify(results, null, 2))
