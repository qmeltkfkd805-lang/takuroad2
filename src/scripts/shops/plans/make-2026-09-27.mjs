// 2026-09-27 plan 생성기 — node scripts/shops/plans/make-2026-09-27.mjs
import { writeFileSync } from 'node:fs'
const D = '2026-09-27'
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const all = (open, close) => Object.fromEntries(DAYS.map((d) => [d, { open, close }]))
const split = (wd, we, weDays) => Object.fromEntries(DAYS.map((d) => [d, weDays.includes(d) ? we : wd]))
const src = (url, fields) => ({ url, fields, checked_at: D })
const LOTTE_DJ = '50d153c6-da83-4ef6-8ef1-6a16bfd0bf24'
const SINDORIM = 'a8644d38-c8dc-42fc-a06c-6b97327e1412'
const LC_ANNEX = '886751d0-19ad-4e74-87cf-5f771d79a76a'
const SINDORIM_PARKING = '주차 가능(유료) — 일반 주차장 B3F~B7F\n최초 30분 무료, 이후 30분당 1,500원\n2만원 이상 구매 영수증 제시 시 2시간 30분 추가(총 3시간)\n우대 할인 중복 불가 · 등록: 1F·10F 안내데스크, 이마트 고객센터 앞'
const SINDORIM_SRC = src('http://wtm21.co.kr/23', ['place_id', 'parking', 'parking_note'])

const items = [
  {
    action: 'insert', key: 'popmart-daejeon', brand: '팝마트',
    brand_links: ['https://www.popmart.com/kr/store-list', 'https://www.popmart.com/kr', 'https://www.instagram.com/popmart_korea/'],
    fields: {
      name: '팝마트 대전점', addr: '대전 서구 계룡로 598', floor_info: '롯데백화점 대전점 1층', cats: ['굿즈샵'], phone: null,
      hours: split({ open: '10:30', close: '20:00' }, { open: '10:30', close: '20:30' }, ['fri', 'sat', 'sun']),
      shop_link: 'https://www.popmart.com/kr', sns_links: ['https://www.instagram.com/popmart_korea/'],
      place_id: LOTTE_DJ, parking: true,
      parking_note: '주차 가능(유료)\n최초 30분 무료, 이후 10분당 1,000원\n구매 시 무료: 1만원 1시간 · 5만원 2시간 · 10만원 3시간 · 20만원 4시간 · 30만원 5시간\n카드 결제만 가능(현금 불가)',
      description: 'POP MART(팝마트) 공식 아트토이 매장으로, 롯데백화점 대전점 1층에 있습니다. 월~목 10:30~20:00, 금~일 10:30~20:30 영업합니다(공식 매장 안내). 백화점 휴점일은 롯데백화점 대전점 공지를 확인해 주세요.',
    },
    goods_types: ['figure-new', 'keyring'],
    sources: [
      src('https://www.popmart.com/kr/store-list', ['name', 'floor_info', 'hours']),
      src('https://www.lotteshopping.com/store/main?cstrCd=0012', ['addr', 'place_id', 'parking', 'parking_note']),
      src('https://www.popmart.com/kr', ['goods_types']),
    ],
    unconfirmed: ['phone', 'closed_days'], photo: 'needed',
    notes: '공식 매장 안내는 "대전 롯데 백화점 (1F)" 표기 — 도로명은 롯데백화점 대전점 공식 지점 안내. 지점 취급 IP 공식 안내 없음 → 작품 연결 안 함',
  },
  {
    action: 'insert', key: 'figurepresso-sindorim', brand: '피규어프레소',
    brand_links: ['https://figurepresso.com', 'https://x.com/figurepresso'],
    fields: {
      name: '피규어프레소 신도림점', addr: '서울 구로구 새말로 97', floor_info: '신도림 테크노마트 3층 58호', cats: ['굿즈샵'], phone: '010-7106-9467',
      hours: all('12:00', '21:00'), shop_link: 'https://figurepresso.com', sns_links: [],
      place_id: SINDORIM, parking: true, parking_note: SINDORIM_PARKING,
      description: '정품 피규어 전문 매장 피규어프레소의 신도림점으로, 신도림 테크노마트 3층 58호(에스컬레이터 바로 앞)에 있습니다. 2026년 5월 홍대 에프레소점이 이곳으로 확장 이전했습니다. 매일 12:00~21:00 영업하며, 매월 둘째·넷째 목요일은 휴무입니다(공식 안내). 신도림역 3번 출구에서 지하 통로로 연결됩니다.',
    },
    goods_types: ['figure-new'],
    sources: [
      src('https://figurepresso.com/board/product/read.html?no=128956&board_no=1', ['name', 'addr', 'floor_info', 'description']),
      src('https://figurepresso.com/fp_contect.html', ['hours', 'phone', 'closed_days', 'goods_types']),
      SINDORIM_SRC,
    ],
    unconfirmed: ['sns_links'], photo: 'needed',
    notes: '둘째·넷째 목요일 휴무는 hours 구조로 표현 불가 → description. 공식 X 6개 중 이 지점 계정 미확인(sns 비움)',
  },
  {
    action: 'insert', key: 'hanwoori-sindorim', brand: '한우리',
    brand_links: ['https://www.gamewoori.com', 'https://www.instagram.com/hanwooriofficial/'],
    fields: {
      name: '한우리 신도림 테크노마트점', addr: '서울 구로구 새말로 97', floor_info: '신도림 테크노마트 2층 37호', cats: ['게임샵'], phone: '02-2111-7144',
      hours: all('10:30', '20:30'), shop_link: 'https://www.gamewoori.com', sns_links: [],
      place_id: SINDORIM, parking: true, parking_note: SINDORIM_PARKING,
      description: 'PlayStation·닌텐도 스위치 등 콘솔 게임을 판매하는 게임샵 한우리(겜우리)의 신도림 테크노마트 매장으로, 2층 37호에 있습니다. 매일 10:30~20:30 영업하며, 매월 둘째·넷째 화요일은 휴무입니다(공식 안내).',
    },
    sources: [
      src('https://www.gamewoori.com/location.html', ['name', 'addr', 'floor_info', 'phone']),
      src('https://www.gamewoori.com/', ['hours', 'closed_days']),
      src('http://wtm21.co.kr/19', ['closed_days']),
      SINDORIM_SRC,
    ],
    unconfirmed: [], photo: 'needed',
    notes: '둘째·넷째 화요일 휴무(테크노마트 건물 휴점일과 같음)는 description. 노원 한우리는 공식 주소 미표기로 보류',
  },
  {
    action: 'insert', key: 'lashinbang-seoul-main', brand: '라신반',
    brand_links: ['https://x.com/lashinbang_kr', 'https://www.instagram.com/lashinbang_kr/'],
    fields: {
      name: '라신반 서울본점', addr: '서울 마포구 양화로 178-5', floor_info: 'LC타워 별관 지하 1층', cats: ['중고샵', '굿즈샵'], phone: null,
      hours: null, shop_link: 'https://x.com/lashinbang_kr', sns_links: ['https://x.com/lashinbang_kr', 'https://www.instagram.com/lashinbang_kr/'],
      place_id: LC_ANNEX,
      description: '일본 중고 애니메이션 굿즈·피규어 전문점 라신반(Lashinbang)의 한국 서울본점으로, 홍대입구역 4번 출구에서 도보 3분 거리 LC타워 별관 지하 1층에 있습니다. 중고 굿즈 매입도 합니다. 영업시간·전화번호는 공식 계정 안내에 따라 네이버 플레이스를 확인해 주세요.',
    },
    goods_types: ['figure-new'],
    works: [{ tag_id: 'e3f9dbfd-e491-4433-9af1-6c0b146f5746', primary: false, evidence: '라신반 코리아 공식 X "#라신반_서울본점 #귀멸의_칼날 다양한 미니 피규어" 입고 게시물 — 서울본점' }],
    sources: [
      src('https://x.com/lashinbang_kr/status/1970046428614684682', ['name', 'addr', 'floor_info']),
      src('https://x.com/lashinbang_kr', ['sns_links', 'description']),
      src('https://x.com/lashinbang_kr/status/1974695748987130284', ['description']),
      src('https://x.com/lashinbang_kr/status/2033495320693448972', ['works', 'goods_types']),
    ],
    unconfirmed: ['hours', 'phone', 'parking'], photo: 'needed',
    notes: '공식 X 프로필: "홍대 LC타워 #라신반_서울본점", 영업시간·전화는 네이버 플레이스 참고 안내 — 지도 정보라 hours 비움',
  },
  {
    action: 'insert', key: 'lashinbang-seoul-2', brand: '라신반',
    brand_links: ['https://x.com/lashinbang_kr', 'https://www.instagram.com/lashinbang_kr/'],
    fields: {
      name: '라신반 서울2호점', addr: '서울 구로구 새말로 97', floor_info: '신도림 테크노마트 3층', cats: ['중고샵', '굿즈샵'], phone: null,
      hours: all('12:00', '20:00'), shop_link: 'https://x.com/lashinbang_kr', sns_links: ['https://x.com/lashinbang_kr', 'https://www.instagram.com/lashinbang_kr/'],
      place_id: SINDORIM, parking: true, parking_note: SINDORIM_PARKING,
      description: '일본 중고 애니메이션 굿즈·피규어 전문점 라신반(Lashinbang)의 한국 두 번째 직영점으로, 신도림역 2번 출구 앞 신도림 테크노마트 3층에 있습니다. 매일 12:00~20:00 영업합니다(2025년 7월 공식 공지 기준). 중고 굿즈는 예약 없이 상시 매입합니다.',
    },
    goods_types: ['figure-new'],
    sources: [
      src('https://x.com/lashinbang_kr/status/1921047418256122326', ['name', 'addr', 'floor_info']),
      src('https://x.com/lashinbang_kr/status/1937754846108745748', ['hours']),
      src('https://x.com/lashinbang_kr/status/1983816250984952290', ['description']),
      SINDORIM_SRC,
    ],
    unconfirmed: ['phone', 'closed_days', 'hours_recency'], photo: 'needed',
    notes: '호수 미확인. 영업시간은 2025-06 공지(7/1부터 12~20시) — 최신 공지로 재확인 필요',
  },
  // ── 순환 재점검 (공식 bnkrmall·애니메이트 매장 안내 2026-09-27)
  {
    action: 'update', key: 'recheck-gashapon-jamsil', shop_id: 'd98e6a5a-c257-44b7-bae6-82652377f658', expect_updated_at: '2026-09-26T14:56:33.801627+00:00',
    fields: {
      floor_info: '롯데월드 쇼핑몰동 지하 1층 36호', hours: { ...all('10:00', '21:00'), yearRound: true },
      shop_link: 'https://www.bnkrmall.co.kr/etc/gashapon-official_store.do',
      description: '반다이 공식 캡슐토이 매장(GASHAPON BANDAI OFFICIAL SHOP, 공식 표기 "GBO 롯데월드점")으로, 롯데월드 쇼핑몰동 지하 1층 36호에 있습니다. 연중무휴 10:00~21:00 영업합니다(공식 안내). 2호선 잠실역 4번 출구 롯데월드 정문 쪽입니다.',
    },
    overwrite: ['floor_info', 'hours'], reason: '반다이남코코리아 공식 가샤폰 매장 안내(GBO 롯데월드점) — 호수·연중무휴 보완',
    sources: [src('https://www.bnkrmall.co.kr/etc/gashapon-official_store.do', ['floor_info', 'hours', 'shop_link', 'description'])],
  },
  {
    action: 'update', key: 'recheck-funsquare-suwon', shop_id: '384328ab-cb33-4682-93c1-f1c2076a036f', expect_updated_at: '2026-09-23T06:13:06.962354+00:00',
    fields: { phone: '031-690-1509', shop_link: 'https://www.bnkrmall.co.kr/etc/funsquare_store.do', hours: { ...all('10:00', '22:00'), yearRound: true } },
    overwrite: ['hours'], reason: '반다이남코코리아 공식 펀스퀘어 매장 안내 — 전화·연중무휴 보완',
    sources: [src('https://www.bnkrmall.co.kr/etc/funsquare_store.do', ['phone', 'shop_link', 'hours'])],
  },
  {
    action: 'update', key: 'recheck-gashapon-yongsan', shop_id: 'ca2043d4-5891-44b3-9bec-c5a19369d14c', expect_updated_at: '2026-09-23T06:13:15.663467+00:00',
    fields: {
      phone: '02-2012-2700', floor_info: '리빙파크 6층 반다이남코코리아 스토어 내',
      shop_link: 'https://www.bnkrmall.co.kr/etc/gashapon-official_store.do', sns_links: ['https://www.bnkrmall.co.kr/etc/bandainamcokorea_store.do'],
    },
    overwrite: ['floor_info', 'shop_link', 'sns_links'], reason: '공식 표기 "GBO 아이파크점 (반다이남코코리아 스토어 내)" — 위치·전화 보완, 스킴 없는 해외 링크 교체',
    sources: [src('https://www.bnkrmall.co.kr/etc/gashapon-official_store.do', ['phone', 'floor_info', 'shop_link']), src('https://www.bnkrmall.co.kr/etc/bandainamcokorea_store.do', ['hours', 'sns_links'])],
  },
  {
    action: 'update', key: 'recheck-gbase-ak-suwon', shop_id: '3b042b45-de7c-429c-b786-3859c44b1757', expect_updated_at: '2026-09-15T15:23:38.354168+00:00',
    fields: {
      description: '건담 프라모델부터 한정판 상품, 조립용품까지 한자리에서 만날 수 있는 건담 공식 전문 매장입니다. AK플라자 수원점 5층에 있으며 매일 10:30~22:00 영업하고, AK플라자 지정 휴일에 휴무합니다(공식 안내).',
    },
    overwrite: ['description'], reason: '공식 건담베이스 매장 안내와 대조 — 시간·전화 일치, 휴무 기준 설명 보완',
    sources: [src('https://www.bnkrmall.co.kr/etc/gundam-base_store.do', ['hours', 'phone', 'description'])],
  },
  {
    action: 'update', key: 'recheck-animate-suwon', shop_id: '173a029b-fc61-4282-be89-58e4ade23cbf', expect_updated_at: '2026-09-23T06:13:05.072647+00:00',
    fields: { shop_link: 'https://x.com/animate_suwon', sns_links: ['https://x.com/animate_suwon'] },
    overwrite: ['shop_link', 'sns_links'], reason: '일본 본사 링크(animate.co.jp) → 한국 공식 온라인샵 매장 안내에 나오는 매장 공식 X 로 교체(pending 항목)',
    sources: [src('https://www.animate-onlineshop.co.kr/main/html.php?htmid=service/shopinfo.html', ['phone', 'shop_link', 'sns_links'])],
  },
]
writeFileSync('scripts/shops/plans/2026-09-27.json', JSON.stringify({ name: D, items }, null, 1))
console.log('items', items.length)
