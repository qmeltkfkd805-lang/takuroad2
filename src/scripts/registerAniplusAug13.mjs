import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const base = 'https://bc8azosk4j.ecn.cdn.ofs.kr/TShop/collabo/'
const badIds = ['bbffebe0-da18-4b62-83ec-bcdd42ed4c58', 'fa91fed7-8ca5-47fb-9ca6-44f4e3f6688a', 'b61ddf48-52fc-4bb4-b4d0-afbd8b82e14f']
const weekly = (open, close) => Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => [day, { open, close }]))

const removed = await db.from('events').delete().in('id', badIds)
if (removed.error) throw removed.error

const tags = {}
for (const slug of ['low-tide-in-twilight', 'oshi-no-ko', 'uma-musume']) {
  const result = await db.from('tags').select('id').eq('slug', slug).single()
  if (result.error) throw result.error
  tags[slug] = result.data.id
}

const places = {}
for (const kakaoId of ['577828045', '1789799749']) {
  const result = await db.from('places').select('id').eq('kakao_place_id', kakaoId).single()
  if (result.error) throw result.error
  places[kakaoId] = result.data.id
}

const locations = [
  {
    suffix: '서울 합정점',
    values: {
      place_id: places['577828045'], place_name: '애니플러스샵 서울1호합정점', place_addr: '서울 마포구 월드컵로3길 14',
      place_lat: 37.5510351582633, place_lng: 126.912345619688, place_detail: '딜라이트 스퀘어 B101-105',
      hours: weekly('10:00', '22:00'), hours_info: '매일 10:00~22:00\n설·추석 당일 휴무', parking: true,
      parking_note: '마포한강2차 푸르지오 지하주차장 이용 가능\n1만원 구매 시마다 30분 할인\n최대 4시간 할인',
    },
  },
  {
    suffix: '부산 서면점',
    values: {
      place_id: places['1789799749'], place_name: '애니플러스샵 부산서면점', place_addr: '부산 부산진구 중앙대로 672',
      place_lat: 35.1528125701021, place_lng: 129.059658823729, place_detail: '삼정타워 9층',
      hours: weekly('11:00', '22:00'), hours_info: '매일 11:00~22:00\n연중무휴', parking: true,
      parking_note: '삼정타워 지하주차장 이용 가능\n애니플러스 구매 금액에 따라 최대 5시간 무료',
    },
  },
]

const events = [
  {
    tag_id: tags['low-tide-in-twilight'], title: '물가의 밤 The Animation × 애니플러스 콜라보 카페', type: 'collab_cafe',
    start_date: '2026-07-02', end_date: '2026-08-16', cover_url: base + 'list_20260608170337_1780905817354_a47bcaf7.png',
    entry_info: '현장 선착순 입장', ticket_urls: [],
    source_urls: ['https://shop.aniplustv.com/offline-shop/collabo-cafe?collaboId=109', 'https://x.com/ANIPLUS_SHOP'],
    description: `웹툰 물가의 밤을 원작으로 한 애니메이션과 애니플러스가 함께하는 기간 한정 콜라보 카페입니다.
작품의 분위기와 등장인물을 활용한 콜라보 메뉴, 음료, 공식 굿즈를 한 공간에서 만나볼 수 있습니다.

카페 메뉴와 굿즈 구성, 구매 특전은 주차별 또는 재고 상황에 따라 달라질 수 있습니다.
특전과 한정 상품은 준비된 수량이 모두 소진되면 행사 기간 중에도 조기 종료될 수 있습니다.

현재 공식 예약 대상 목록에는 포함되어 있지 않아 별도의 예약 링크 없이 현장에서 이용할 수 있습니다.`,
  },
  {
    tag_id: tags['oshi-no-ko'], title: '【최애의 아이】 3기 × 애니플러스 콜라보 카페', type: 'collab_cafe',
    start_date: '2026-08-13', end_date: '2026-09-13', cover_url: base + 'list_20260629085019_1782690619549_757dc487.png',
    entry_info: '현장 선착순 입장', ticket_urls: [],
    source_urls: ['https://shop.aniplustv.com/offline-shop/collabo-cafe?collaboId=112', 'https://x.com/ANIPLUS_SHOP'],
    description: `TV 애니메이션 【최애의 아이】 3기와 애니플러스가 함께하는 기간 한정 콜라보 카페입니다.
작품과 등장인물을 테마로 구성한 콜라보 메뉴, 음료, 공식 굿즈와 구매 특전을 만나볼 수 있습니다.

콜라보 굿즈는 별도 예약 없이 구매할 수 있습니다.
카페 이용 시 공식 안내에 따라 성인 인증과 본인 확인이 진행될 수 있으므로 생년월일을 확인할 수 있는 실물 신분증 또는 공식 모바일 신분증을 준비해야 합니다.
대리 인증과 캡처한 신분증 화면은 인정되지 않습니다.

메뉴 및 상품별 판매 수량과 특전은 현장 재고 상황에 따라 조기 소진될 수 있습니다.`,
  },
  {
    tag_id: tags['uma-musume'], title: '우마무스메 프리티 더비 × 애니플러스 콜라보 카페', type: 'collab_cafe',
    start_date: '2026-08-20', end_date: '2026-10-04', cover_url: base + 'list_20260728152921_1785220161749_762d9d52.png',
    entry_info: '사전예약 후 입장',
    ticket_urls: [{ url: 'https://shop.aniplustv.com/offline-shop/reservation', label: '콜라보 카페 예약하기' }],
    source_urls: ['https://shop.aniplustv.com/offline-shop/collabo-cafe?collaboId=113', 'https://x.com/ANIPLUS_SHOP'],
    description: `게임 우마무스메 프리티 더비와 애니플러스가 함께하는 기간 한정 콜라보 카페입니다.
우마무스메 캐릭터를 테마로 구성한 콜라보 메뉴, 음료, 공식 굿즈와 방문 특전을 만나볼 수 있습니다.

공식 예약 페이지에서 지점과 이용 일시를 선택해 예약한 뒤 방문해야 합니다.
예약 회차와 본인 확인에 필요한 정보는 예약 완료 화면의 안내를 확인해 주세요.

메뉴와 굿즈, 구매 특전은 준비된 수량이 모두 소진되면 행사 기간 중에도 조기 종료될 수 있습니다.`,
  },
]

const output = []
for (const event of events) {
  for (const location of locations) {
    const title = `${event.title} (${location.suffix})`
    const duplicate = await db.from('events').select('id').eq('title', title).maybeSingle()
    if (duplicate.error) throw duplicate.error
    if (duplicate.data) continue
    const result = await db.from('events').insert({ ...event, ...location.values, title, updated_at: new Date().toISOString() })
      .select('id,title,start_date,end_date,place_name,place_detail,hours_info,entry_info,parking,parking_note,cover_url,source_urls,ticket_urls').single()
    if (result.error) throw result.error
    output.push(result.data)
  }
}

console.log(JSON.stringify(output, null, 2))
