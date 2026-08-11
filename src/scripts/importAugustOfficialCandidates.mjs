import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const weekly = (open, close) => Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, { open, close }]),
)

let { data: yaibaTag } = await db.from('tags').select('id').eq('slug', 'yaiba').maybeSingle()
if (!yaibaTag) {
  const created = await db.from('tags').insert({
    name: '용검전설 YAIBA', slug: 'yaiba', english_name: 'YAIBA',
    ip_type: '만화,애니', genres: ['액션', '모험', '코미디'],
    description: '천하제일의 사무라이를 꿈꾸는 쿠로가네 야이바가 강적들과 맞서는 검술 액션 모험 작품.',
    official_url: 'https://www.yaiba-pr.com/', aliases: ['YAIBA', '진 사무라이전 YAIBA'],
  }).select('id').single()
  if (created.error) throw created.error
  yaibaTag = created.data
}

const tagRows = await db.from('tags').select('id,slug').in('slug', ['detective-conan', 'hatsune-miku'])
if (tagRows.error) throw tagRows.error
const tags = Object.fromEntries(tagRows.data.map((tag) => [tag.slug, tag.id]))

async function ensurePlace(kakaoPlaceId, row) {
  let { data } = await db.from('places').select('id').eq('kakao_place_id', kakaoPlaceId).maybeSingle()
  if (!data) {
    const result = await db.from('places').insert(row).select('id').single()
    if (result.error) throw result.error
    data = result.data
  }
  const mapped = await db.from('place_address_map').upsert({
    addr: row.addr.replace(/\s/g, ''), place_id: data.id,
  }, { onConflict: 'addr' })
  if (mapped.error) throw mapped.error
  return data.id
}

const fanbase = await ensurePlace('294700540', {
  slug: 'fanbase-hongdae', name: '팬베이스 홍대점', place_type: 'SHOPPING_MALL',
  addr: '서울 마포구 양화로 178-5', region: '서울', district: '마포구',
  lat: 37.5576899049237, lng: 126.925430108069, kakao_place_id: '294700540',
  category_name: '가정,생활 > 문구,사무용품 > 디자인문구',
  parking: null, parking_note: '공식 주차 지원 및 주차요금 안내 없음',
})

const akHongdae = await ensurePlace('1156421273', {
  slug: 'ak-plaza-hongdae', name: 'AK플라자 홍대', place_type: 'DEPARTMENT_STORE',
  addr: '서울 마포구 양화로 188', region: '서울', district: '마포구',
  lat: 37.55780854901018, lng: 126.92640783829829, kakao_place_id: '1156421273',
  category_name: '가정,생활 > 백화점 > AK플라자', parking: true,
  parking_note: '주차 가능(유료)\n최초 30분 2,000원\n이후 10분당 1,000원\n1만원 구매 시 1시간 무료\n3만원 구매 시 2시간 무료\n5만원 구매 시 3시간 무료',
})

const fanbaseBase = {
  type: 'popup', start_date: '2026-08-12', end_date: '2026-08-30',
  place_id: fanbase, place_name: '팬베이스 홍대점', place_addr: '서울 마포구 양화로 178-5',
  place_lat: 37.5576899049237, place_lng: 126.925430108069, place_detail: 'LC타워 별관 지하 2층',
  parking: null, parking_note: '공식 주차 지원 및 주차요금 안내 없음',
  hours: weekly('11:00', '20:00'), hours_info: '매일 11:00~20:00',
  entry_info: '현장 입장', ticket_urls: [], source_urls: ['https://x.com/Fanding_Store'],
}

const events = [
  {
    ...fanbaseBase, tag_id: tags['detective-conan'],
    title: '명탐정 코난: 하이웨이의 타천사 팝업스토어',
    description: '극장판 국내 개봉 기념 팝업스토어입니다. 팬베이스 홍대점 오리지널 굿즈와 팝업 한정 굿즈를 판매합니다.',
    source_urls: ['https://x.com/Fanding_Store', 'https://x.com/conan_movie_kr'],
  },
  {
    ...fanbaseBase, tag_id: yaibaTag.id, title: '용검전설 YAIBA 팝업스토어',
    description: '용검전설 YAIBA 한국 팝업스토어입니다. 팬베이스 홍대점 오리지널 굿즈를 판매합니다.',
    source_urls: ['https://x.com/Fanding_Store', 'https://www.yaiba-pr.com/'],
  },
  {
    tag_id: tags['hatsune-miku'], type: 'popup', title: '하츠네 미쿠 in AK PLAZA HONGDAE',
    start_date: '2026-07-17', end_date: '2026-08-13',
    place_id: akHongdae, place_name: 'AK플라자 홍대', place_addr: '서울 마포구 양화로 188',
    place_lat: 37.55780854901018, place_lng: 126.92640783829829, place_detail: '2층 새틀라이트 플러스',
    parking: true, parking_note: '주차 가능(유료)\n최초 30분 2,000원\n이후 10분당 1,000원\n1만원 구매 시 1시간 무료\n3만원 구매 시 2시간 무료\n5만원 구매 시 3시간 무료',
    hours: {
      mon: { open: '11:00', close: '21:40' }, tue: { open: '11:00', close: '21:40' },
      wed: { open: '11:00', close: '21:40' }, thu: { open: '11:00', close: '21:40' },
      fri: { open: '11:00', close: '21:40' }, sat: { open: '10:30', close: '21:40' },
      sun: { open: '10:30', close: '21:40' },
    },
    hours_info: '평일 11:00~21:40\n주말 10:30~21:40', entry_info: '현장 입장',
    description: '하츠네 미쿠 테마 상품과 굿즈를 판매합니다. 3만원 구매마다 랜덤 특제 카드 1장을 증정하며, 특전은 수량 소진 시 종료됩니다.',
    source_urls: ['https://x.com/SATELLITE_kr'], ticket_urls: [],
  },
]

for (const event of events) {
  const { data: duplicate } = await db.from('events').select('id,title').eq('title', event.title).maybeSingle()
  if (duplicate) {
    console.log('SKIP', duplicate)
    continue
  }
  const result = await db.from('events').insert({ ...event, updated_at: new Date().toISOString() }).select('id,title').single()
  if (result.error) throw result.error
  console.log('INSERT', result.data)
}
