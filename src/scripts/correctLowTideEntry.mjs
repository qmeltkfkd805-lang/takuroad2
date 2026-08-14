import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const description = `웹툰 물가의 밤을 원작으로 한 애니메이션과 애니플러스가 함께하는 기간 한정 콜라보 카페입니다.
작품의 분위기와 등장인물을 활용한 콜라보 메뉴, 음료, 공식 굿즈를 한 공간에서 만나볼 수 있습니다.

카페는 만 19세 이상만 이용할 수 있으며 예약자와 동반자 모두 신분증 확인이 진행됩니다.
입장권 1매당 동반자 1인을 포함해 최대 2인까지 입장할 수 있습니다.
미성년자도 콜라보 굿즈는 구매할 수 있습니다.

네이버 예약과 현장예약을 병행합니다.
예약시간부터 30분 안에 방문하지 않으면 노쇼로 자동 취소되며, 남은 좌석은 운영 상황에 따라 현장 대기자에게 제공됩니다.
현장예약으로 카페를 이용할 때도 성인 인증이 필요합니다.

카페 메뉴와 굿즈 구성, 구매 특전은 주차별 또는 재고 상황에 따라 달라질 수 있습니다.
특전과 한정 상품은 준비된 수량이 모두 소진되면 행사 기간 중에도 조기 종료될 수 있습니다.`

const updates = [
  {
    suffix: '서울 합정점',
    ticket_urls: [{ url: 'https://booking.naver.com/booking/12/bizes/445544/items/7759161', label: '콜라보 카페 예약하기' }],
  },
  {
    suffix: '부산 서면점',
    ticket_urls: [{ url: 'https://booking.naver.com/booking/12/bizes/619683/items/7759188', label: '콜라보 카페 예약하기' }],
  },
]

const output = []
for (const update of updates) {
  const result = await db.from('events').update({
    entry_info: '사전예약 후 입장\n현장예약 가능',
    ticket_urls: update.ticket_urls,
    description,
    updated_at: new Date().toISOString(),
  }).eq('title', `물가의 밤 The Animation × 애니플러스 콜라보 카페 (${update.suffix})`)
    .select('id,title,entry_info,ticket_urls,description').single()
  if (result.error) throw result.error
  output.push(result.data)
}

console.log(JSON.stringify(output, null, 2))
