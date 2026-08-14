import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const tagId = 'a4ba496d-ae3c-4666-a5f0-aba18d7d0fbb'
const coverUrl = 'https://cdn.popga.co.kr/spot/5007/main/9809c382-c55f-4eb4-8c91-77f345a8d458_1765802490287_thumbnail_MAIN_W480.webp'

const { data: hongdae, error: hongdaeError } = await db
  .from('places')
  .select('id,name,addr,lat,lng,parking,parking_note')
  .eq('kakao_place_id', '1156421273')
  .single()
if (hongdaeError) throw hongdaeError

let { data: busan, error: busanLookupError } = await db
  .from('places')
  .select('id,name,addr,lat,lng,parking,parking_note')
  .eq('kakao_place_id', '1952409629')
  .maybeSingle()
if (busanLookupError) throw busanLookupError

if (!busan) {
  const created = await db.from('places').insert({
    slug: 'animate-busan',
    name: '애니메이트 부산점',
    place_type: 'SHOPPING_MALL',
    addr: '부산 부산진구 중앙대로 672',
    region: '부산',
    district: '부산진구',
    lat: 35.1530135123952,
    lng: 129.059606833427,
    kakao_place_id: '1952409629',
    category_name: '가정,생활 > 취미 > 취미용품점',
    parking: true,
    parking_note: '주차 가능(유료)\n30분 무료 후 10분당 1,000원\n1만원 이상 구매 시 1시간 무료\n3만원 이상 구매 시 2시간 무료\n5만원 이상 구매 시 3시간 무료\n10만원 이상 구매 시 4시간 무료\n20만원 이상 구매 시 5시간 무료',
  }).select('id,name,addr,lat,lng,parking,parking_note').single()
  if (created.error) throw created.error
  busan = created.data
}

const common = {
  tag_id: tagId,
  type: 'collab_cafe',
  start_date: '2025-12-19',
  end_date: '2026-01-13',
  reserve_start: null,
  reserve_end: null,
  entry_info: '현장 입장',
  description: '캐릭캐릭 체인지의 원작 일러스트와 캐릭터를 테마로 한 콜라보 카페입니다. 작품의 분위기를 담은 드링크와 디저트, 공식 굿즈를 함께 만날 수 있습니다.\n\n콜라보 메뉴 1종 주문 시 총 11종 중 랜덤 코스터 1장이 제공되며, 특전은 준비 수량 소진 시 종료됩니다.',
  cover_url: coverUrl,
  ticket_urls: [],
  updated_at: new Date().toISOString(),
}

const events = [
  {
    ...common,
    title: '캐릭캐릭 체인지 × 애니메이트 카페 (서울 홍대점)',
    place_id: hongdae.id,
    place_name: hongdae.name,
    place_addr: hongdae.addr,
    place_lat: hongdae.lat,
    place_lng: hongdae.lng,
    place_detail: '5층 애니메이트 카페 홍대점',
    parking: hongdae.parking,
    parking_note: hongdae.parking_note,
    hours: {
      mon: { open: '11:00', close: '22:00' }, tue: { open: '11:00', close: '22:00' },
      wed: { open: '11:00', close: '22:00' }, thu: { open: '11:00', close: '22:00' },
      fri: { open: '11:00', close: '22:00' }, sat: { open: '10:30', close: '22:00' },
      sun: { open: '10:30', close: '22:00' },
    },
    hours_info: '평일 11:00~22:00\n주말·공휴일 10:30~22:00\n라스트 오더 21:00',
    source_urls: ['https://x.com/animatecafe_kor', 'https://static-www.akplaza.com/store/facility?store=51'],
  },
  {
    ...common,
    title: '캐릭캐릭 체인지 × 애니메이트 카페 (부산점)',
    place_id: busan.id,
    place_name: busan.name,
    place_addr: busan.addr,
    place_lat: busan.lat,
    place_lng: busan.lng,
    place_detail: '삼정타워 11층 1102호',
    parking: busan.parking,
    parking_note: busan.parking_note,
    hours: {
      mon: { open: '11:00', close: '22:00' }, tue: { open: '11:00', close: '22:00' },
      wed: { open: '11:00', close: '22:00' }, thu: { open: '11:00', close: '22:00' },
      fri: { open: '11:00', close: '22:30' }, sat: { open: '11:00', close: '22:30' },
      sun: { open: '11:00', close: '22:00' },
    },
    hours_info: '일~목 11:00~22:00\n금·토 11:00~22:30',
    source_urls: ['https://x.com/animatecafe_bs', 'https://www.samjungtower.com/main/13'],
  },
]

const results = []
for (const event of events) {
  const duplicate = await db.from('events').select('id,title').eq('title', event.title).eq('start_date', event.start_date).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) {
    results.push({ status: 'SKIP', ...duplicate.data })
    continue
  }
  const inserted = await db.from('events').insert(event).select('id,title,start_date,end_date,place_name,place_detail,hours_info,entry_info,parking,parking_note,cover_url,source_urls,ticket_urls,description').single()
  if (inserted.error) throw inserted.error
  results.push({ status: 'INSERT', ...inserted.data })
}

console.log(JSON.stringify(results, null, 2))
