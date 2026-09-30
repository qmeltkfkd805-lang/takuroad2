// 공식 X·인스타그램 확인분 A (2026-09-21): 타몬 군 Gratte · 니지산지 큥bro/THE BOOM 페어 · 이루마 군 클럽★데빌 · 코난 WIND FESTIVAL(AK홍대)
// 원본: scripts/work-official-0921/<key>/ (facts.json 에 공식 출처와 확인 내용 기록)
// 이미지: 포스터 → covers/<sha256>.webp, 메뉴·굿즈·특전은 원본에서 잘라 → compact-official-events/<sha256>.webp
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { uploadEventImage } from './lib/uploadEventImage.mjs'
import { openBatch, box } from './lib/eventBatch.mjs'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const dir = 'scripts/work-official-0921'
const busanNotice = 'https://www.animate-onlineshop.co.kr/board/view.php?bdId=notice2&sno=46'
const shopMap = 'https://m.animate-onlineshop.co.kr/main/html.php?htmid=service%2Fmap.html'

const T = {
  tamon: '타몬 군 지금 어느 쪽?! Gratte',
  niji: 'NIJISANJI 『큥bro』『THE BOOM』 페어 & Gratte',
  iruma: '악마에 입문했습니다! 이루마 군 if Episode of 魔fia 「클럽★데빌」',
  conan: '명탐정 코난 WIND FESTIVAL 팝업스토어 in AK플라자 홍대',
}
const batch = await openBatch(db, { name: 'official-0921-a', editor, titles: Object.values(T) })

// ---------- 지점 템플릿 ----------
const rowById = async (id) => { const r = await db.from('events').select('*').eq('id', id).single(); if (r.error) throw r.error; return r.data }
const personaHongdae = await rowById('0e1b8dd0-7363-41a2-b657-0de9f50f9d0e')   // AK플라자 홍대 · 주차 안내 포함
const personaJamsil = await rowById('dd6783fb-c186-4243-af5c-0b27bae4139e')    // 롯데월드 쇼핑몰 · 주차 안내 포함
const hanakoBusan = await rowById('6df4b8d3-df80-46c4-944c-6b7fb7278fb0')      // 삼정타워
const hanakoSuwon = await rowById('f0824c77-efdd-4f15-9d94-d90100961743')      // AK플라자 수원
const place = (tpl, detail) => ({
  place_id: tpl.place_id, place_name: tpl.place_name, place_addr: tpl.place_addr,
  place_lat: tpl.place_lat, place_lng: tpl.place_lng, place_detail: detail,
  parking: tpl.parking, parking_note: tpl.parking_note,
})
const JAMSIL_ADDR = '서울 송파구 올림픽로 240'
const SUWON_ADDR = '경기 수원시 팔달구 덕영대로 924'
const lookup = {
  jamsilStore: { addr: JAMSIL_ADDR, nameHint: '애니메이트 잠실롯데점' },
  jamsilCafe: { addr: JAMSIL_ADDR, nameHint: '애니메이트 카페 잠실롯데점' },
  suwonStore: { placeId: hanakoSuwon.place_id, addr: SUWON_ADDR, nameHint: '애니메이트 ak플라자 수원점' },
}

const out = []
const record = (status, saved, goods) => out.push({ status, id: saved.id, title: saved.title, shop_id: saved.shop_id, series_key: saved.series_key, goods: goods.join('') })

// ===================== 1. 타몬 군 지금 어느 쪽?! Gratte =====================
{
  const k = `${dir}/tamon-gratte`
  const s = 3.096 // menu-1.jpg 원본(3096px) / 미리보기(1000px)
  const cover = await uploadEventImage(db, `${k}/poster.jpg`, { folder: 'covers', maxWidth: 1200 })
  const img = async (b) => (await uploadEventImage(db, `${k}/menu-1.jpg`, { folder: 'compact-official-events', maxWidth: 720, crop: box(s, b) })).url
  const latte = { name: '타몬 군 그라떼 (도안 22종 중 선택)', kind: 'menu', price: 7000, image: await img([25, 200, 168, 418]) }
  const cookie = { name: '타몬 군 아이싱 쿠키 (도안 22종 중 선택)', kind: 'menu', price: 6500, image: await img([182, 200, 318, 418]) }
  const ice = { name: '타몬 군 아이스크림 (도안 22종 중 선택)', kind: 'menu', price: 7000, image: await img([335, 200, 478, 418]) }
  const coaster = { name: '랜덤 아크릴 코스터 12종 (메뉴 1개당 유상 특전)', kind: 'goods', price: 7500, image: await img([12, 515, 988, 692]) }
  const sources = ['https://x.com/animatecafe_js/status/2096131213916581894', 'https://x.com/animatecafe_js/status/2101144253028315605']
  const menuText = '그라떼 7,000원(베이스: 아이스 아메리카노·아이스 초코라떼·아이스 딸기라떼·소다 에이드·메론 소다), 아이싱 쿠키 6,500원, 아이스크림 7,000원(바닐라·초코·녹차·딸기·망고)'
  const coasterText = '메뉴 1개를 주문할 때마다 유상 특전 랜덤 아크릴 코스터(전 12종)를 7,500원에 1개 구매할 수 있습니다. 코스터는 종류를 고를 수 없고 같은 그림이 나올 수 있으며, 준비 수량이 소진되면 판매가 끝납니다. 매장 상황에 따라 정리권 배부나 구매 수량 제한이 있을 수 있습니다.'
  const branches = [
    {
      suffix: '홍대점', ...place(personaHongdae, '5층 애니메이트 카페 홍대점'), shopLookup: null,
      lead: `「타몬 군 지금 어느 쪽?!」 일러스트를 올린 애니메이트 카페 Gratte입니다. 도안 22종 중 원하는 그림을 골라 주문하며, ${menuText}을 판매합니다.`,
      goods: [latte, cookie, ice, coaster],
    },
    {
      suffix: '잠실롯데점', ...place(personaJamsil, 'B1층 애니메이트 카페 잠실롯데점'), shopLookup: lookup.jamsilCafe,
      lead: `「타몬 군 지금 어느 쪽?!」 일러스트를 올린 애니메이트 카페 Gratte입니다. 도안 22종 중 원하는 그림을 골라 주문하며, ${menuText}을 판매합니다.`,
      goods: [latte, cookie, ice, coaster],
    },
    {
      suffix: '부산점', ...place(hanakoBusan, '삼정타워 11층 애니메이트 카페 부산점 (쿠키 출장 판매)'), shopLookup: null,
      lead: '「타몬 군 지금 어느 쪽?!」 Gratte의 쿠키 출장 판매점입니다. 공식 포스터에 부산점은 〈쿠키 출장 판매점〉으로 안내되어 있어, 도안 22종 중 골라 주문하는 아이싱 쿠키(6,500원)를 중심으로 판매합니다. 그라떼·아이스크림은 홍대점·잠실롯데점에서 판매합니다.',
      extra: '애니메이트 부산점은 매장 이전 리뉴얼로 10월 11일(일)에 현 매장 영업을 마치고 10월 30일(금)에 새 매장을 열 예정입니다. 부산점 쿠키 판매 일정은 방문 전 매장 공지를 확인해 주세요.',
      goods: [cookie, coaster],
    },
  ]
  for (const b of branches) {
    const { saved, status } = await batch.saveEvent({
      tag_id: 'a6059a41-b8c5-45c1-9f90-809f3893bb5e', type: 'collab_cafe', title: `${T.tamon} (${b.suffix})`,
      start_date: '2026-09-19', end_date: '2026-11-01', reserve_start: null, reserve_end: null,
      entry_info: b.suffix === '부산점'
        ? '자유 이용 · 아이싱 쿠키 6,500원\n메뉴 1개당 랜덤 아크릴 코스터 7,500원 추가 구매 가능\n특전 소진 시 종료'
        : '자유 이용 · 그라떼·아이스크림 각 7,000원 / 아이싱 쿠키 6,500원\n메뉴 1개당 랜덤 아크릴 코스터 7,500원 추가 구매 가능\n특전 소진 시 종료',
      hours: null, hours_info: '매장 운영시간에 따라 이용\nGratte 주문 마감은 현장 안내 확인',
      description: [b.lead, `주문은 매장 카운터나 키오스크에서 도안 번호를 골라 진행하고, 특전은 카운터에서 결제할 때 함께 받습니다. ${coasterText}`, ...(b.extra ? [b.extra] : [])].join('\n\n'),
      cover_url: cover.url, ...b, suffix: undefined, shopLookup: undefined, lead: undefined, extra: undefined, goods: undefined,
      source_urls: b.suffix === '부산점' ? [...sources, busanNotice] : sources, ticket_urls: [],
    }, { shopLookup: b.shopLookup })
    record(status, saved, await batch.addGoods(saved.id, b.goods))
  }
}

// ===================== 2. NIJISANJI 큥bro·THE BOOM 페어 & Gratte =====================
{
  const k = `${dir}/nijisanji-gratte`
  const s = 3.096
  const cover = await uploadEventImage(db, `${k}/poster.jpg`, { folder: 'covers', maxWidth: 1200 })
  const coaster = {
    name: 'NIJISANJI 큥bro·THE BOOM 코스터 8종 (30,000원당 구매 특전)', kind: 'goods', price: null,
    image: (await uploadEventImage(db, `${k}/benefit-fair.jpg`, { folder: 'compact-official-events', maxWidth: 960, crop: box(s, [20, 265, 990, 585]) })).url,
  }
  const menuImg = async (b) => (await uploadEventImage(db, `${k}/menu-1.jpg`, { folder: 'compact-official-events', maxWidth: 720, crop: box(s, b) })).url
  const latte = { name: 'NIJISANJI 그라떼 (도안 8종 중 선택)', kind: 'menu', price: 7000, image: await menuImg([40, 255, 300, 395]) }
  const cookie = { name: 'NIJISANJI 아이싱 쿠키 (일일 한정 수량)', kind: 'menu', price: 6500, image: await menuImg([318, 255, 470, 402]) }
  const sources = ['https://x.com/animate_hongdae/status/2101204644521546067', 'https://x.com/animate_hongdae/status/2101204648673829094', 'https://x.com/animatecafe_js/status/2101204646522228868']
  const benefitText = '행사 기간 중 「NIJISANJI」·「NIJISANJI EN」 관련 굿즈와 그라떼 구매 금액 30,000원당 코스터(전 8종) 1개를 랜덤으로 증정합니다. 큥bro(4종)와 THE BOOM(4종) 중 그룹은 고를 수 있지만 그림은 고를 수 없습니다. 특전은 소진 시 종료되며, 티켓·쿠지, 온라인 쿠지·캡슐 토이, 쿠마메이트 관련 상품, 일부 TCG는 대상에서 제외됩니다.'
  const gratteText = '그라떼는 7,000원(베이스: 아이스 아메리카노·아이스 초코라떼·아이스 딸기라떼·소다 에이드·메론 소다), 아이싱 쿠키는 6,500원이며 쿠키는 하루 판매 수량이 정해져 있습니다. 도안은 큥bro 4종·THE BOOM 4종 중에서 고릅니다.'
  const lead = 'NIJISANJI의 유닛 『큥bro』와 『THE BOOM』 일러스트를 활용한 애니메이트 한정 페어입니다. 페어 굿즈와 구매 특전, 개최를 기념한 Gratte 메뉴를 함께 만날 수 있습니다.'
  const branches = [
    {
      suffix: '홍대점', ...place(personaHongdae, '5층 애니메이트 홍대점 (페어·Gratte)'), shopLookup: null,
      body: [lead, `홍대점은 페어와 Gratte를 함께 진행합니다. ${gratteText}`, benefitText], goods: [coaster, latte, cookie],
    },
    {
      suffix: '잠실롯데점', ...place(personaJamsil, 'B1층 애니메이트 잠실롯데점 (페어) · 애니메이트 카페 잠실롯데점 (Gratte)'), shopLookup: lookup.jamsilStore,
      body: [lead, `잠실롯데점은 애니메이트 잠실롯데점에서 페어를, 같은 층 애니메이트 카페 잠실롯데점에서 Gratte를 진행합니다. ${gratteText}`, benefitText], goods: [coaster, latte, cookie],
    },
    {
      suffix: '부산점', ...place(hanakoBusan, '삼정타워 11층 애니메이트 부산점 (페어)'), shopLookup: null,
      body: [lead, '부산점은 페어만 진행하며 Gratte는 판매하지 않습니다. 매장 이전 리뉴얼 오픈 일정으로 부산점 페어는 10월 11일(일)까지만 열립니다.', benefitText], goods: [coaster],
    },
  ]
  for (const b of branches) {
    const { saved, status } = await batch.saveEvent({
      tag_id: '63d2954e-2390-42ed-ad2c-af42c2a4b49c', type: 'popup', title: `${T.niji} (${b.suffix})`,
      start_date: '2026-10-03', end_date: '2026-10-25', reserve_start: null, reserve_end: null,
      entry_info: b.suffix === '부산점'
        ? '관련 굿즈 구매 30,000원당 코스터 8종 중 랜덤 1개 증정 (그룹 선택 가능)\n부산점은 10/11까지 · Gratte 미운영'
        : '관련 굿즈·그라떼 구매 30,000원당 코스터 8종 중 랜덤 1개 증정 (그룹 선택 가능)\n그라떼 7,000원 / 아이싱 쿠키 6,500원 (일일 한정)',
      hours: null,
      hours_info: b.suffix === '부산점' ? '매장 운영시간에 따라 이용. 부산점은 매장 이전으로 10월 11일(일)까지 운영' : '매장 운영시간에 따라 이용',
      description: b.body.join('\n\n'),
      cover_url: cover.url,
      place_id: b.place_id, place_name: b.place_name, place_addr: b.place_addr, place_lat: b.place_lat, place_lng: b.place_lng,
      place_detail: b.place_detail, parking: b.parking, parking_note: b.parking_note,
      source_urls: b.suffix === '부산점' ? [...sources, busanNotice] : sources, ticket_urls: [],
    }, { shopLookup: b.shopLookup })
    record(status, saved, await batch.addGoods(saved.id, b.goods))
  }
}

// ===================== 3. 이루마 군 클럽★데빌 =====================
{
  const k = `${dir}/iruma-clubdevil`
  const cover = await uploadEventImage(db, `${k}/poster.jpg`, { folder: 'covers', maxWidth: 1200 })
  const gs = 2526 / 885 // goods-1 원본 / 미리보기
  const gimg = async (b) => (await uploadEventImage(db, `${k}/goods-1.jpg`, { folder: 'compact-official-events', maxWidth: 720, crop: box(gs, b) })).url
  const card = {
    name: '클럽★데빌 명함풍 카드 (15,000원당 구매 특전)', kind: 'goods', price: null,
    image: (await uploadEventImage(db, `${k}/benefit.jpg`, { folder: 'compact-official-events', maxWidth: 960, crop: box(2.4, [15, 320, 990, 632]) })).url,
  }
  const osGoods = [
    { name: '캔뱃지 컬렉션 (랜덤 전 12종, 1팩 1개입)', price: 6000, image: await gimg([22, 140, 433, 398]) },
    { name: '아크릴 스탠드 (6종, 각)', price: 27000, image: await gimg([450, 140, 860, 398]) },
    { name: '아크릴 키홀더 (6종, 각)', price: 12000, image: await gimg([22, 408, 433, 666]) },
    { name: '클리어 파일 (6종, 각)', price: 6000, image: await gimg([450, 408, 860, 666]) },
    { name: '스티커 셀렉션 (랜덤 전 12종, 1팩 1매입)', price: 4500, image: await gimg([22, 678, 433, 936]) },
    { name: '아크릴 패널', price: 45000, image: await gimg([450, 678, 860, 936]) },
    { name: '지폐풍 메모 (100매 묶음)', price: 12000, image: await gimg([22, 946, 433, 1204]) },
    { name: '의상 모티브 키홀더 (4종, 각)', price: 15000, image: await gimg([450, 946, 860, 1204]) },
  ].map((g) => ({ ...g, kind: 'goods' }))
  const source = ['https://x.com/animate_hongdae/status/2093534104146833783']
  const lead = '「악마에 입문했습니다! 이루마 군」의 스핀오프 「if Episode of 魔fia」를 테마로 한 「클럽★데빌」 행사입니다. hiro자 작가의 신규 일러스트를 사용한 오리지널 굿즈를 선보입니다.'
  const benefitText = '행사 기간 중 대상 상품을 15,000원 구매할 때마다 신규 일러스트 명함풍 카드(이루마·오페라·카르에고·알리스·클라라·아메리)를 랜덤으로 1장 증정합니다. 특전은 선택할 수 없고 소진 시 종료됩니다.'
  const branches = [
    {
      suffix: '홍대점', ...place(personaHongdae, '5층 애니메이트 홍대점 (POPUPSHOP)'), shopLookup: null,
      body: [lead, '홍대점은 POPUPSHOP(OS) 개최 매장입니다. 캔뱃지 컬렉션(6,000원), 아크릴 스탠드(각 27,000원), 아크릴 키홀더(각 12,000원), 클리어 파일(각 6,000원), 스티커 셀렉션(4,500원), 아크릴 패널(45,000원), 지폐풍 메모(12,000원), 의상 모티브 키홀더(각 15,000원)가 공개되었습니다. 상품 이미지는 예시로 실제와 다를 수 있습니다.', benefitText],
      goods: [card, ...osGoods],
    },
    {
      suffix: '잠실롯데점', ...place(personaJamsil, '롯데월드 쇼핑몰동 B1층 애니메이트 잠실롯데점 (페어)'), shopLookup: lookup.jamsilStore,
      body: [lead, '잠실롯데점은 페어 개최 매장입니다. POPUPSHOP 굿즈는 홍대점 기준으로 공개되어 있어, 페어 매장의 취급 상품은 매장 안내를 확인해 주세요.', benefitText], goods: [card],
    },
    {
      suffix: '부산점', ...place(hanakoBusan, '애니메이트 부산점 (페어)'), shopLookup: null,
      body: [lead, '부산점은 페어 개최 매장입니다. 애니메이트 부산점은 10월 30일(금) 이전 리뉴얼 오픈 예정이라, 이 페어는 새 매장에서 진행됩니다. 새 매장 위치는 애니메이트 부산점 공지를 확인해 주세요. POPUPSHOP 굿즈는 홍대점 기준으로 공개되어 있습니다.', benefitText], goods: [card],
    },
    {
      suffix: '수원점', ...place(hanakoSuwon, 'AK플라자 수원 5층 애니메이트 수원점 (페어)'), shopLookup: lookup.suwonStore,
      body: [lead, '수원점은 페어 개최 매장입니다. POPUPSHOP 굿즈는 홍대점 기준으로 공개되어 있어, 페어 매장의 취급 상품은 매장 안내를 확인해 주세요.', benefitText], goods: [card],
    },
  ]
  for (const b of branches) {
    const { saved, status } = await batch.saveEvent({
      tag_id: 'cdab8396-5f6f-4107-baa5-46bdae17d1c5', type: 'popup', title: `${T.iruma} (${b.suffix})`,
      start_date: '2026-11-21', end_date: '2026-12-06', reserve_start: null, reserve_end: null,
      entry_info: '자유 입장 · 대상 상품 15,000원 구매당 명함풍 카드 랜덤 1장 증정\n특전 소진 시 종료',
      hours: null, hours_info: '매장 운영시간에 따라 이용',
      description: b.body.join('\n\n'), cover_url: cover.url,
      place_id: b.place_id, place_name: b.place_name, place_addr: b.place_addr, place_lat: b.place_lat, place_lng: b.place_lng,
      place_detail: b.place_detail, parking: b.parking, parking_note: b.parking_note,
      source_urls: b.suffix === '부산점' ? [...source, shopMap, busanNotice] : [...source, shopMap], ticket_urls: [],
    }, { shopLookup: b.shopLookup })
    record(status, saved, await batch.addGoods(saved.id, b.goods))
  }
}

// ===================== 4. 명탐정 코난 WIND FESTIVAL (AK플라자 홍대) =====================
{
  const k = `${dir}/conan-wind-festival`
  const s = 1.4 // 1400px 원본 / 1000px 미리보기
  const cover = await uploadEventImage(db, `${k}/poster.jpg`, { folder: 'covers', maxWidth: 1000 })
  const cut = async (file, b) => (await uploadEventImage(db, `${k}/${file}`, { folder: 'compact-official-events', maxWidth: 880, crop: box(s, b) })).url
  const rows = [[60, 150, 940, 365], [60, 370, 940, 595], [60, 600, 940, 822], [60, 825, 940, 1040]]
  const goods = [
    { name: '렌티큘러 엽서 - 오프닝/엔딩 (2종, 각)', price: 7000, image: await cut('goods-1.jpg', rows[0]) },
    { name: '랜덤 홀로그램 캔뱃지 - 스틸시리즈02 (10종)', price: 7000, image: await cut('goods-1.jpg', rows[1]) },
    { name: '랜덤 홀로그램 거울버튼 - 오프닝엔딩01 (8종)', price: 8000, image: await cut('goods-1.jpg', rows[2]) },
    { name: '랜덤 증명사진 아크릴 키링 03 (5종)', price: 10000, image: await cut('goods-1.jpg', rows[3]) },
    { name: '홀로그램 와이드 티켓 엽서 (3종, 각)', price: 4000, image: await cut('goods-2.jpg', rows[0]) },
    { name: '트래블 스티커 세트 2매입 (2종, 각)', price: 8000, image: await cut('goods-2.jpg', rows[1]) },
    { name: '투명 다꾸 스티커 (4종, 각)', price: 2300, image: await cut('goods-2.jpg', rows[2]) },
    { name: '깃털 장식 아크릴 키링 (9종, 각)', price: 12000, image: await cut('goods-2.jpg', rows[3]) },
  ].map((g) => ({ ...g, kind: 'goods' }))
  const { saved, status } = await batch.saveEvent({
    tag_id: 'a48e942e-23f9-4900-ad93-adedb29d92ce', type: 'popup', title: T.conan,
    start_date: '2026-09-21', end_date: '2026-10-08', reserve_start: null, reserve_end: null,
    entry_info: '자유 입장 · 랜덤 럭키드로우 1회 4,000원',
    hours: null, hours_info: 'AK플라자 홍대 영업시간에 따라 운영',
    description: [
      '굿즈 브랜드 모모리(MOMORY)가 여는 「명탐정 코난」 WIND FESTIVAL 팝업스토어입니다. 8월 더현대 서울 팝업에 이어 AK플라자 홍대 3층에서 9월 21일부터 10월 8일까지 열립니다.',
      '신상품으로 렌티큘러 엽서(각 7,000원), 랜덤 홀로그램 캔뱃지(7,000원), 랜덤 홀로그램 거울버튼(8,000원), 랜덤 증명사진 아크릴 키링(10,000원), 홀로그램 와이드 티켓 엽서(각 4,000원), 트래블 스티커 세트(각 8,000원), 투명 다꾸 스티커(각 2,300원), 깃털 장식 아크릴 키링(각 12,000원)을 판매합니다. 일부 상품에는 「명탐정 코난: 하이웨이의 타천사」 디자인이 쓰였고, 공개 목록 외 기존 상품도 판매될 수 있습니다.',
      '포토기기에서 랜덤 럭키드로우(1회 4,000원)를 뽑을 수 있습니다. 히든 럭키드로우 2종은 하루에 각 1개씩만 나오며, 당첨 카드를 스태프에게 보여주면 당일 판매 상품 중 원하는 1개를 추가로 받을 수 있습니다(랜덤 상품은 랜덤 제공). 공식 안내에 럭키드로우 구성이 12종(일반 10·히든 2)과 14개(일반 12·히든 2)로 함께 표기되어 있어 현장 안내를 확인해 주세요.',
    ].join('\n\n'),
    cover_url: cover.url, ...place(personaHongdae, '3층 팝업 공간 (MOMORY)'),
    source_urls: ['https://www.instagram.com/p/DdQpj1kk4Co/'], ticket_urls: [],
  })
  record(status, saved, await batch.addGoods(saved.id, goods))
}

console.log(JSON.stringify(out, null, 2))
console.log('rows:', out.length)
