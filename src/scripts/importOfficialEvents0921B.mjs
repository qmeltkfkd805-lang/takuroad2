// 공식 확인분 B (2026-09-21): 주술회전 시부야사변 카페 · 내가 키운 S급들 · 하이큐 쉬는 시간(수원) · 블루 록 NEO EGOIST LEAGUE · 쿠로코의 농구 · SideM
// 원본·facts.json·crops.json: scripts/work-official-0921/<key>/
// crops.json = 공식 리스트 이미지에서 품목별로 잘라낼 영역(원본 픽셀)과 이름·가격 — 대조 시트로 육안 확인 후 사용
// 실행: node scripts/importOfficialEvents0921B.mjs <key> [<key> ...]
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { uploadEventImage } from './lib/uploadEventImage.mjs'
import { openBatch } from './lib/eventBatch.mjs'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const dir = 'scripts/work-official-0921'
const keys = process.argv.slice(2)
if (!keys.length) throw new Error('key required')

const rowById = async (id) => { const r = await db.from('events').select('*').eq('id', id).single(); if (r.error) throw r.error; return r.data }
const place = (tpl, detail) => ({
  place_id: tpl.place_id, place_name: tpl.place_name, place_addr: tpl.place_addr,
  place_lat: tpl.place_lat, place_lng: tpl.place_lng, place_detail: detail, parking: tpl.parking, parking_note: tpl.parking_note,
})
const tpl = {
  akHongdae: await rowById('0e1b8dd0-7363-41a2-b657-0de9f50f9d0e'),   // AK플라자 홍대
  ipark: await rowById('e315dfb6-024a-4fa1-850f-2432d8d0fd5c'),       // 아이파크몰 용산점 도파민 스테이션
  akSuwon: await rowById('f0824c77-efdd-4f15-9d94-d90100961743'),     // AK플라자 수원
  hyundaiSeoul: await rowById('d3c23f98-6119-4c83-98d3-a82a83e1dd08'), // 더현대 서울
}

const defs = {
  'jjk-shibuya-boxcafe': {
    tag: '7fc6cb70-c059-40e3-86a4-39dc28b6b32c', type: 'collab_cafe', title: '주술회전 콜라보 카페 2026 시부야사변 × BOX cafe&space',
    start: '2026-09-23', end: '2026-12-01', reserve: ['2026-09-18', '2026-09-22'], poster: 'poster_main.jpg',
    place: place(tpl.akHongdae, '3층 BOX cafe&space'),
    entry: '주말·공휴일 및 지정일은 네이버 사전 예약제(1 ID당 최대 2명, 80분 7회차), 그 외 기간 자율 입장\n좌석 이용 시 1인 1메뉴 · 후기 예약은 추후 오픈',
    hours: '11:00~21:15 (공식 프로필 기준)\n전기 예약 회차 11:00~21:20 · 메뉴 주문은 회차 종료 20분 전까지',
    tickets: ['https://booking.naver.com/booking/12/bizes/1496194'],
    body: [
      '애니메이션 「주술회전」의 시부야사변을 테마로 한 콜라보 카페가 AK플라자 홍대 3층 BOX cafe&space에서 열립니다. 이타도리 유지, 후시구로 메구미, 쿠기사키 노바라, 고죠 사토루, 나나미 켄토의 콘셉트 메뉴를 전기(9/23~10/28)와 후기(10/29~12/1)로 나누어 선보입니다.',
      '통상 메뉴는 캐릭터 드링크 5종과 테이크아웃 옥문강 티라미수(각 8,000원)입니다. 전기 한정으로 1학년의 인연 파르페 3종(각 12,000원), 고죠 사토루 최강 미소 샌드·나나미 켄토 토마토 조림 파스타(각 15,000원), 후기 한정으로 흑섬 라멘·공명 또띠아·옥견 카레(각 15,000원), 무하한 주술 팬케이크·넥타이 모티프 쉬폰 케이크(각 12,000원)가 준비됩니다.',
      '메뉴 1개당 시즌별 사각 코스터(5종) 1개를 랜덤 증정하며, 옥문강 티라미수는 코스터 대신 필름 카드(5종)를 드립니다. 콜라보 MD(캔뱃지·아크릴 스탠드·아크릴 키링·SD 아크릴 스탠드·SD 아크릴 키링·엽서 세트)를 30,000원 이상 구매하면 영수증당 오리지널 티켓(5종) 1장을 랜덤 증정합니다. 럭키드로우는 추후 공개 예정입니다.',
      '전기 사전 예약은 9월 18일 15:00에 열렸고, 주말·공휴일과 9/23~10/2, 10/5, 10/9는 예약 테이블로 운영합니다. 그 밖의 날은 자율 입장입니다. 회차 시작 10분이 지나도록 입장하지 않으면 노쇼 처리되며, 음료와 테이크아웃 메뉴 외에는 포장이 되지 않습니다.',
    ],
  },
  's-class-dungeon-break': {
    tag: 'f4b93054-9cb6-45e2-a01c-928a93dba2a9', type: 'popup', title: '내가 키운 S급들 팝업스토어 던전 브레이크: 용산',
    start: '2026-09-23', end: '2026-10-15', reserve: ['2026-09-11', '2026-09-25'], poster: 'poster_main.jpg',
    // 16: 13번(키오스크 포토카드)과 같은 상품이 특전 목록에 중복, 18: 디지털 배경화면은 이미지 없음 → 설명에만 안내
    skip: [16, 18],
    place: place(tpl.ipark, '리빙파크 3층 도파민 스테이션'),
    entry: '9/23~9/25 네이버 사전 예약 입장(30분 단위, 1회 1인, ID당 최대 2회)\n9/26부터 예약 없이 현장 입장',
    hours: '매일 10:30~22:00 (사전 예약 기간 입장은 21:00까지)',
    tickets: ['https://booking.naver.com/booking/12/bizes/1729351'],
    body: [
      '웹툰 「내가 키운 S급들」의 공식 팝업스토어로, 웹툰프렌즈 릴레이 팝업의 세 번째 행사입니다. 던전 브레이크 콘셉트로 꾸민 용산 아이파크몰 리빙파크 3층 도파민 스테이션에서 신제품 MD를 처음 공개합니다.',
      '9월 23일부터 25일까지는 네이버 사전 예약자만 입장할 수 있고(30분 단위, 예약 1회당 1인), 9월 26일부터는 예약 없이 방문할 수 있습니다. 상황에 따라 현장 대기 등록이 생길 수 있습니다.',
      '「내가 키운 S급들」 신제품은 종류당 1인 2개로 구매가 제한됩니다. 영수증 1장 기준 70,000원 이상 구매하면 에폭시 스티커팩 1세트를 1인 1회 증정하며, 도서·포토카드 키오스크·가챠 상품은 특전 대상에서 빠집니다. 포토카드 키오스크에서는 한정 포토카드 10종을 판매하고, 현장 임무 3가지를 완수하면 용산 한정 헌터 자격증을, 현장 게임에 참여하면 주차별 디지털 배경화면을 받을 수 있습니다.',
      '현금 없는 매장이며, 교환·환불은 구매일로부터 14일 이내 제품·영수증·결제수단을 지참해야 합니다. 팝업 종료 후 온라인 판매와 재입고는 미정입니다.',
    ],
  },
  'haikyu-break-time-suwon': {
    tag: '2a88af81-4e08-446f-befa-312110884a20', type: 'popup', title: '하이큐!! 쉬는 시간 POP-UP STORE ENCORE IN SUWON',
    start: '2026-09-24', end: '2026-10-13', reserve: [null, null], poster: 'poster_main.jpg',
    place: place(tpl.akSuwon, '5층 SMG STORE'),
    shopLookup: { placeId: tpl.akSuwon.place_id, addr: '경기 수원시 팔달구 덕영대로 924', nameHint: 'SMG ak플라자 수원점' },
    entry: '무료 · 사전 예약 없이 현장 입장\n혼잡 시 매장 앞 나우웨이팅 등록 후 대기',
    hours: '매일 10:30~22:00',
    tickets: [],
    body: [
      '애니메이션 「하이큐!!」의 쉬는 시간 팝업스토어가 AK플라자 수원 5층 SMG STORE에서 앙코르로 열립니다. 쉬는 시간 일러스트의 캔배지, 아크릴 명찰, 학생증 카드, 아크릴 스탠드와 학교 플래카드 스타일 아크릴 키링, 교복 단추 스타일 메탈 배지 등을 판매합니다.',
      '플랫 가챠 신상품 2종(학교 엠블럼 와펜, 학생수첩 노트 & 스티커, 각 6,000원)을 이번 수원 앙코르 팝업에서 먼저 선보입니다. 가챠 머신은 상품별 1대이며 카드 결제만 가능하고, 대기가 많으면 1인 연속 2회로 제한됩니다.',
      '당일 영수증 기준 20,000원마다 캐릭터 북마크(12종) 1장을 랜덤 증정합니다. 영수증 합산은 되지 않고 플랫 가챠 결제 금액은 제외됩니다. 입장은 무료이며 예약 없이 방문하면 되고, 혼잡할 때는 매장 앞 나우웨이팅으로 대기를 등록합니다. 모든 상품은 한정 수량이며 생수 외 음식물 반입은 할 수 없습니다.',
    ],
  },
  'bluelock-neo-egoist': {
    tag: '77a9bc04-00de-4071-baf2-571f4fcef31d', type: 'popup', title: 'BLUE LOCK 2026 THE LAST POP-UP : NEO EGOIST LEAGUE',
    start: '2026-10-01', end: '2026-10-07', reserve: ['2026-09-17', '2026-10-04'], poster: 'poster_main.jpg',
    place: place(tpl.hyundaiSeoul, '지하 2층 ATTAG!'),
    entry: '10/1~10/4 오전 2개 회차(10:30·11:15)는 네이버 사전 예약, 그 외 시간은 당일 현장 QR 예약(10:00부터 접수)\n1인 1명 · 실물/모바일 신분증 필수',
    hours: '10/1·10/6·10/7 10:30~20:00 (입장 마감 19:30)\n10/2~10/5 10:30~20:30 (입장 마감 20:00)',
    tickets: ['https://m.booking.naver.com/booking/12/bizes/1736544/items/8054229'],
    body: [
      '학산문화사가 여는 「블루 록」 2026년 마지막 팝업스토어로, 10월 1일부터 7일까지 더현대 서울 지하 2층 ATTAG!에서 열립니다. 오리지널 MD와 함께 이 팝업에서만 파는 「블루 록 킥오프 팩」(1~3권 합본 세트, 18,000원, 500세트 한정)과 정식 발매에 앞서 판매하는 「블루 록 37권 한정판」(45,000원)을 만날 수 있습니다. 행사장 판매 도서는 모두 10% 할인됩니다.',
      '10월 1일~4일 오전 1·2회차(10:30, 11:15)는 9월 17일 오픈한 네이버 사전 예약으로 입장하며, 그 외 시간과 10월 5~7일은 당일 10시부터 현장 QR로 예약 등록 후 호출 순서대로 입장합니다. 예약은 1회당 본인 1인이며 실물 또는 모바일 신분증이 필요합니다. 대기가 없으면 자율 입장으로 바뀝니다.',
      '팝업 기간 블루 록 상품·도서 구매 30,000원마다 증명사진(7종) 1장을 랜덤 증정하고(온·오프라인 공통), 오프라인에서는 70,000원 이상 구매 시 쇼핑백, 영수증당 카드 스티커(7종) 1장(선착순), 입장객 전원 손목띠를 드립니다. 바스타드 뮌헨 듀오 유리컵과 멀티 스탠드 세트는 하루 100개 한정이며, 상품별 1인 구매 수량 제한이 있습니다.',
      '온라인은 더현대Hi에서 10월 1일 10:30부터 7일 20:00까지 판매하고 10월 28일부터 순차 발송합니다. 온·오프라인 판매 상품은 다를 수 있습니다.',
    ],
  },
  'kuroko-limition': {
    tag: '21d4f0fb-a1a0-49f1-8713-9a980b216f2c', type: 'popup', title: '쿠로코의 농구 POP-UP STORE',
    start: '2026-10-15', end: '2026-11-10', reserve: [null, null], poster: 'poster_schedule.jpg',
    place: place(tpl.akHongdae, '4층 LIMITION'),
    entry: '입장 방식 추후 공지 (현재 사전 예약 안내 없음)\n당일 영수증 20,000원당 코스터·50,000원당 스티커 랜덤 증정',
    hours: 'AK플라자 홍대 영업시간에 따라 운영',
    tickets: [],
    body: [
      '애니메이션 「쿠로코의 농구」 팝업스토어가 AK플라자 홍대 4층 LIMITION에서 10월 15일부터 11월 10일까지 열립니다. 한국 팝업스토어 오리지널 굿즈를 판매합니다.',
      '랜덤 캔배지(5,500원), 랜덤 아크릴 명찰(7,000원), 랜덤 선수 티켓(4,500원), 증명사진 세트(12,000원), 아크릴 블록(10,000원), 장면컷 아크릴 스탠드(17,000원), 테츠야 2호 마우스 패드(8,000원), 멀티클리너(5,500원), 세이린 농구부 반팔 티셔츠(39,000원), A3 포스터(7,500원), 데스크 장패드(28,000원), 랜덤 아크릴 카드(7,000원), 포토 스튜디오 스타일 엽서 세트(18,000원), 명대사 키링(12,000원), 유니폼 스트랩 키링(19,000원)이 공개되었습니다.',
      '당일 영수증 기준 20,000원마다 캐릭터 코스터(7종) 1개, 50,000원마다 캐릭터 스티커(7종) 1장을 랜덤으로 증정합니다. 영수증 합산은 되지 않고, 특전은 선택·교환할 수 없으며 소진 시 조기 종료됩니다. 입장 방식은 아직 공지되지 않았습니다.',
    ],
  },
  'sidem-respong': {
    tag: '2ee1269f-0c23-49c1-8e2d-3af51376db1c', type: 'collab_cafe', title: '레트로카페 THE IDOLM@STER SideM in CAFE Re:SPONG',
    start: '2026-10-08', end: '2026-10-21', reserve: ['2026-09-17', '2026-10-21'], poster: 'main_poster_x.jpg',
    place: {
      place_id: null, place_name: 'CAFE Re:SPONG', place_addr: '서울 마포구 양화로18안길 22',
      place_lat: 37.5567732928865, place_lng: 126.925815364934, place_detail: '4층 CAFE Re:SPONG', parking: null, parking_note: null,
    },
    entry: '네이버 예약제 (9/17 20:00 오픈, 예약 1건당 1명, 타임당 70분)\n타임 시작 20분 경과 시 미도착하면 예약 취소',
    hours: '예약 타임제 · 10/8 및 금·토·일 11:00·12:30·14:00·16:30·18:00 / 월~목 15:00·16:30·18:00',
    tickets: ['https://booking.naver.com/booking/17/bizes/1732104/items/8030347'],
    body: [
      '일본 SMILE BASE CAFE에서 진행했던 「아이돌마스터 SideM」 레트로카페 콜라보를 홍대 CAFE Re:SPONG에서 다시 선보입니다. 10월 8일 카페 그랜드 오픈과 함께 시작하는 첫 콜라보로, High×Joker·Altessimo·W의 집사풍 일러스트와 315 프로덕션 콘셉트 메뉴, 한정 굿즈를 만날 수 있습니다.',
      '메뉴는 High×Joker 나폴리탄·Altessimo 샌드위치 세트(각 12,000원), W 카레(14,000원), 유닛 디저트 3종(각 11,000원), 유닛 주스 3종·315 프로덕션 크림소다 3종·캐릭터 카페라떼 BOX A/B/C(각 7,000원)입니다. 콜라보 메뉴 1개를 주문할 때마다 노벨티 랜덤 코스터(14종) 1장을 드립니다. 크림소다는 제로 칼로리 사이다로 바꿀 수 있습니다.',
      '굿즈는 카페 현장에서 판매하며, 랜덤 콜라보 캔뱃지(7,000원), 랜덤 아크릴 체키풍 카드(6,000원), 아크릴 스탠드(18,000원), 랜덤 미니 캐릭터 캔뱃지(7,000원)·아크릴 스탠드(11,000원), 프로필 트레이딩 카드 BOX A/B/C(각 5,000원)가 있습니다.',
      '이용은 네이버 예약제입니다. 예약은 9월 17일 20:00에 열렸고, 오픈 첫날과 금·토·일은 11:00·12:30·14:00·16:30·18:00, 월~목은 15:00·16:30·18:00 회차로 운영하며 회차당 70분입니다. 회차 시작 20분이 지나도 도착하지 않으면 예약이 취소됩니다. 해외 거주자는 LINE 공식 계정으로 예약을 문의할 수 있습니다.',
    ],
  },
}

for (const key of keys) {
  const d = defs[key]
  if (!d) throw new Error(`unknown key ${key}`)
  const k = `${dir}/${key}`
  const facts = JSON.parse(await readFile(`${k}/facts.json`, 'utf8'))
  const crops = JSON.parse(await readFile(`${k}/crops.json`, 'utf8'))
  const batch = await openBatch(db, { name: `official-0921-b-${key}`, editor, titles: [d.title] })

  const cover = await uploadEventImage(db, `${k}/${d.poster}`, { folder: 'covers', maxWidth: 1200, maxHeight: 1600 })
  const goods = []
  for (const [i, c] of crops.entries()) {
    if (d.skip?.includes(i + 1) || !c.file) continue
    let image = null
    if (c.file && c.box) {
      const [l, t, r, b] = c.box
      image = (await uploadEventImage(db, `${k}/${c.file}`, {
        folder: 'compact-official-events', maxWidth: 800, maxHeight: 900,
        crop: { left: Math.round(l), top: Math.round(t), width: Math.round(r - l), height: Math.round(b - t) },
      })).url
    }
    goods.push({ name: c.name, kind: c.kind === 'menu' ? 'menu' : 'goods', price: c.price ?? null, image })
  }

  const { saved, status } = await batch.saveEvent({
    tag_id: d.tag, type: d.type, title: d.title, start_date: d.start, end_date: d.end,
    reserve_start: d.reserve[0], reserve_end: d.reserve[1],
    entry_info: d.entry, hours: null, hours_info: d.hours, description: d.body.join('\n\n'),
    cover_url: cover.url, ...d.place, source_urls: facts.official_urls, ticket_urls: d.tickets,
  }, d.shopLookup ? { shopLookup: d.shopLookup } : {})
  const result = await batch.addGoods(saved.id, goods)
  console.log(JSON.stringify({ status, id: saved.id, title: saved.title, shop_id: saved.shop_id, goods: `${result.filter((r) => r === 'ok').length}/${goods.length}`, noImage: goods.filter((g) => !g.image).map((g) => g.name) }))
}
