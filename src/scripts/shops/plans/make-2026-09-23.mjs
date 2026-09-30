// 2026-09-23 샵 반영 계획 생성 — node scripts/shops/plans/make-2026-09-23.mjs → plans/2026-09-23.json
// 모든 핵심 값은 아래 sources 의 공식 페이지에서 2026-09-23 에 확인했다. 사진은 사용 허락된 것이 없어 넣지 않는다.
import { writeFile } from 'node:fs/promises'

const D = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const h = (open, close) => ({ open, close })
const every = (open, close, extra = {}) => ({ ...Object.fromEntries(D.map((d) => [d, h(open, close)])), ...extra })
const split = (days, a, b) => Object.fromEntries(D.map((d) => [d, days.includes(d) ? h(...b) : h(...a)]))
const checked = '2026-09-23'
const src = (url, fields) => ({ url, fields, checked_at: checked })

const ANIMATE_INFO = 'https://www.animate-onlineshop.co.kr/main/html.php?htmid=service%2Fshopinfo.html'
const ANIMATE_MAP = 'https://m.animate-onlineshop.co.kr/main/html.php?htmid=service%2Fmap.html'
const ANIPLUS = 'https://shop.aniplustv.com/offline-shop'
const ANIPLUS_RES = 'https://shop.aniplustv.com/offline-shop/reservation'
const GBASE = 'https://www.bnkrmall.co.kr/etc/gundam-base_store.do'
const FUNSQ = 'https://www.bnkrmall.co.kr/etc/funsquare_store.do'
const brand_links = [ANIMATE_INFO, 'https://www.animate-onlineshop.co.kr/', ANIPLUS, GBASE, FUNSQ, 'https://cafe.naver.com/gbasekorea']
const PLACE = {
  akHongdae: '6c9bad49-7a5b-43d3-b2df-405a2e5df390',
  samjung: '6a3e3e01-c868-4948-b8a6-942678852eeb',
  delight2: '9403b9d4-21e1-4614-a1c0-581d1284f619',
  hyundaiPangyo: '15093c3e-1302-4f59-be17-6b8af208554c',
  lotteWorldMall: '037ee556-bbf3-42f0-ae4a-b126d859d1c1',
}

const gbaseDesc = (where) => `반다이남코코리아가 운영하는 건담 공식 전문 매장 THE GUNDAM BASE(건담베이스)의 ${where} 매장입니다. 건담 프라모델과 한정 상품, 조립용품을 판매합니다.`

const items = [
  // ── 애니메이트 (공식 매장 안내 + 공식 X)
  {
    action: 'insert', key: 'animate-hongdae', brand_links,
    fields: {
      name: '애니메이트 홍대점', addr: '서울 마포구 양화로 188', place_id: PLACE.akHongdae,
      floor_info: '애경타워(AK PLAZA 홍대) 5층',
      cats: ['굿즈샵', '서점'], custom_goods: ['애니메이션 굿즈', '만화·라이트노벨', '특전 페어'],
      hours: every('11:00', '21:40'),
      phone: '02-3144-7357', shop_link: ANIMATE_INFO, sns_links: ['https://x.com/animate_hongdae'],
      description: '일본 애니메이션·만화·게임 전문점 애니메이트의 한국 매장입니다. 애니메이션 굿즈와 만화·라이트노벨을 판매하고, 작품별 구매 특전 페어를 수시로 진행합니다.',
    },
    sources: [src(ANIMATE_INFO, ['name', 'addr', 'building', 'floor']), src(ANIMATE_MAP, ['addr', 'sns']), src('https://x.com/animate_hongdae', ['hours', 'phone', 'floor'])],
    unconfirmed: ['정기 휴무', '금·토 영업시간 차이 여부', '주차', '가는 길'], photo: 'needed',
  },
  {
    action: 'insert', key: 'animate-cafe-hongdae', brand_links,
    fields: {
      name: '애니메이트 카페 홍대점', addr: '서울 마포구 양화로 188', place_id: PLACE.akHongdae,
      floor_info: '애경타워(AK PLAZA 홍대) 5층',
      cats: ['콜라보카페'], custom_goods: ['콜라보 메뉴', '메뉴 특전', '그라테'],
      hours: every('11:00', '22:00'),
      phone: '02-322-1279', shop_link: 'https://x.com/animatecafe_kor', sns_links: ['https://x.com/animatecafe_kor', 'https://www.instagram.com/animatecafe_korea/'],
      description: '애니메이트가 운영하는 상설 콜라보 카페입니다. 작품별 콜라보 메뉴와 메뉴 특전을 기간마다 바꿔 진행합니다. 라스트오더 21:00이며, 입장 방식(자율 입장·사전 예약·정리권)은 콜라보마다 달라 공식 X 공지를 확인해야 합니다. 메뉴 테이크아웃도 가능합니다.',
    },
    sources: [src('https://x.com/animatecafe_kor', ['hours', 'last_order', 'phone', 'floor', 'entry'])],
    unconfirmed: ['정기 휴무', '주말 10:30 오픈이 상시인지(현 콜라보 공지에만 있음)', '주차'], photo: 'needed',
  },
  {
    action: 'insert', key: 'animate-busan', brand_links,
    fields: {
      name: '애니메이트 부산점', addr: '부산 부산진구 중앙대로 672', place_id: PLACE.samjung,
      floor_info: '삼정타워 11층 (10월 11일까지 영업하는 현 매장)',
      cats: ['굿즈샵', '서점'], custom_goods: ['애니메이션 굿즈', '만화·라이트노벨', '특전 페어'],
      hours: split(['fri', 'sat'], ['11:00', '21:40'], ['11:00', '22:10']),
      phone: '051-808-0993', shop_link: ANIMATE_INFO, sns_links: ['https://x.com/animate_busan'],
      temporary_holiday_start: '2026-10-12', temporary_holiday_end: '2026-10-29',
      temporary_holiday_message: '매장 이전으로 휴점합니다. 삼정타워 11층 현 매장은 10월 11일(일)까지 영업하고, 10월 30일(금) 롯데백화점 부산본점에서 새로 문을 엽니다. 새 매장의 층·영업시간은 아직 공개되지 않았습니다.',
      description: '애니메이트의 부산 매장입니다. 매장 이전 리뉴얼로 삼정타워 11층 현 매장은 2026년 10월 11일(일)까지 영업하고, 10월 30일(금) 롯데백화점 부산본점에서 새로 문을 엽니다(새 매장 층·영업시간 미공개). 온라인샵 매장 수령은 10월 12일~11월 1일 중단됩니다.',
    },
    sources: [src(ANIMATE_INFO, ['addr', 'phone']), src('https://www.animate-onlineshop.co.kr/board/view.php?bdId=notice2&sno=46', ['closing 10-11', 'opening 10-30', 'pickup pause']), src('https://x.com/animate_busan', ['hours', 'floor', 'new location 롯데백화점 부산본점'])],
    unconfirmed: ['새 매장 층·영업시간·전화', '정기 휴무', '주차'], photo: 'needed',
    notes: '10-30 이전 오픈 — 새 층 공개 시 새 샵 행 등록 + 이 행은 relocated/closed 처리 (옛 주소를 이전 후 위치로 안내 금지)',
  },
  {
    action: 'insert', key: 'animate-cafe-busan', brand_links,
    fields: {
      name: '애니메이트 카페 부산점', addr: '부산 부산진구 중앙대로 672', place_id: PLACE.samjung,
      floor_info: '삼정타워 11층 (10월 13일까지 영업하는 현 매장)',
      cats: ['콜라보카페'], custom_goods: ['콜라보 메뉴', '메뉴 특전', '그라테'],
      hours: every('11:00', '22:00'),
      phone: '051-808-0994', shop_link: 'https://x.com/animatecafe_bs', sns_links: ['https://x.com/animatecafe_bs'],
      temporary_holiday_start: '2026-10-14', temporary_holiday_end: '2026-10-29',
      temporary_holiday_message: '매장 이전으로 휴점합니다. 현 매장은 10월 13일(화)까지 영업하고, 10월 30일 롯데백화점 부산본점에서 새로 문을 엽니다. 새 매장 층은 아직 공개되지 않았습니다.',
      description: '애니메이트가 운영하는 테이크아웃 전문 콜라보 카페입니다(라스트오더 21:00). 이전으로 현 매장은 2026년 10월 13일(화)까지 영업하고, 10월 30일 롯데백화점 부산본점에서 새로 문을 엽니다(새 층 미공개).',
    },
    sources: [src('https://x.com/animatecafe_bs', ['hours', 'last_order', 'phone', 'take-out', 'floor', 'relocation dates'])],
    unconfirmed: ['새 매장 층·영업시간', '정기 휴무'], photo: 'needed',
    notes: '10-30 이전 오픈 — 애니메이트 부산점과 함께 처리',
  },
  {
    action: 'update', key: 'animate-suwon-fill', shop_id: '173a029b-fc61-4282-be89-58e4ade23cbf', expect_updated_at: '2026-09-15T06:42:29.059659+00:00',
    fields: { phone: '031-240-1993', shop_link: ANIMATE_INFO }, overwrite: ['shop_link'],
    reason: '전화번호 누락 보완, 공식 링크를 일본 본사 사이트에서 애니메이트코리아 공식 매장 안내로 교체',
    sources: [src(ANIMATE_INFO, ['addr', 'floor', 'phone'])],
  },

  // ── 애니플러스 (공식 오프라인샵 안내·예약 안내)
  {
    action: 'insert', key: 'aniplus-hapjeong', brand_links,
    fields: {
      name: '애니플러스 서울 합정점', addr: '서울 마포구 월드컵로3길 14', place_id: PLACE.delight2,
      floor_info: '딜라이트스퀘어 지하 1층 B101~105호 (교보문고 맞은편)',
      cats: ['굿즈샵', '콜라보카페'], custom_goods: ['애니메이션 굿즈', '콜라보 카페'],
      hours: every('10:00', '22:00'),
      phone: '070-7162-3000', shop_link: ANIPLUS, sns_links: ['https://x.com/ANIPLUS_SEOUL'],
      parking: true, parking_note: '마포한강2차 푸르지오 지하주차장 이용, 구매 금액별 최대 4시간 무료',
      temporary_holiday_start: '2026-09-25', temporary_holiday_end: '2026-09-25', temporary_holiday_message: '추석 당일 휴무 (설·추석 당일 정기 휴무)',
      description: '애니플러스가 운영하는 애니메이션 굿즈샵으로, 매장 안에서 작품별 콜라보 카페 두 곳을 함께 운영합니다. 콜라보 카페는 공식 사이트에서 사전 예약(예약금 1인 10,000원, 이용 시 반환)하며 1인 1일 1회차만 예약할 수 있습니다. 설·추석 당일은 휴무입니다. 2·6호선 합정역 8번 출구 방향 연결통로로 이어집니다.',
    },
    sources: [src(ANIPLUS, ['name', 'addr', 'building', 'hours', 'closed days', 'phone', 'parking', 'access', 'unit']), src(ANIPLUS_RES, ['reservation'])],
    unconfirmed: ['임시 휴무(공식 X 접속 불가)'], photo: 'needed',
  },
  {
    action: 'insert', key: 'aniplus-seomyeon', brand_links,
    fields: {
      name: '애니플러스 부산 서면점', addr: '부산 부산진구 중앙대로 672', place_id: PLACE.samjung,
      floor_info: '삼정타워 9층',
      cats: ['굿즈샵', '콜라보카페'], custom_goods: ['애니메이션 굿즈', '콜라보 카페'],
      hours: every('11:00', '22:00', { yearRound: true }),
      phone: '070-7162-7048', shop_link: ANIPLUS, sns_links: ['https://x.com/ANIPLUS_BUSAN'],
      parking: true, parking_note: '삼정타워 지하주차장 이용, 구매 금액별 최대 5시간 무료',
      description: '애니플러스가 운영하는 애니메이션 굿즈샵으로, 매장 안에서 작품별 콜라보 카페 두 곳을 함께 운영합니다. 콜라보 카페는 공식 사이트에서 사전 예약(예약금 1인 10,000원, 이용 시 반환)하며 1인 1일 1회차만 예약할 수 있습니다. 1·2호선 서면역 2번 출구 방향 연결통로로 이어집니다.',
    },
    sources: [src(ANIPLUS, ['name', 'addr', 'building', 'floor', 'hours', 'phone', 'parking', 'access']), src(ANIPLUS_RES, ['reservation'])],
    unconfirmed: ['임시 휴무(공식 X 접속 불가)'], photo: 'needed',
  },

  // ── 반다이남코코리아 FUN SQUARE (공식 매장 안내)
  ...[
    { key: 'funsquare-timessquare', name: 'FUN SQUARE 타임스퀘어점', addr: '서울 영등포구 영중로 15', floor: '타임스퀘어 지하 1층', phone: '02-2069-2674', parking: '타임스퀘어 주차장 이용 가능', access: '1호선 영등포역과 연결됩니다.' },
    { key: 'funsquare-lotteworldmall', name: 'FUN SQUARE 롯데월드몰점', addr: '서울 송파구 올림픽로 300', floor: '롯데월드몰 2층', phone: '02-3213-4273', parking: '롯데월드몰 주차 이용 가능 (주차 지원 불가)', access: '잠실역 지하 통로로 롯데월드몰 지하 1층과 바로 연결됩니다.', place: PLACE.lotteWorldMall },
    { key: 'funsquare-gimpo', name: 'FUN SQUARE 롯데몰 김포공항점', addr: '서울 강서구 하늘길 38', floor: '롯데몰 김포공항점 GF층', phone: '02-6116-5053', parking: '롯데몰 김포공항점 주차 이용 가능 (주차 지원 불가)', access: '김포공항역 3번 출구에서 지하 연결통로로 도보 5분입니다.' },
  ].map((f) => ({
    action: 'insert', key: f.key, brand_links,
    fields: {
      name: f.name, addr: f.addr, place_id: f.place ?? null, floor_info: f.floor,
      cats: ['굿즈샵', '가챠'], custom_goods: ['반다이 캐릭터 굿즈', '가샤폰'],
      hours: every('10:30', '22:00'), phone: f.phone, shop_link: FUNSQ, sns_links: [],
      parking: true, parking_note: f.parking,
      description: `반다이남코코리아가 운영하는 공식 캐릭터 굿즈 매장 FUN SQUARE입니다. 매장 안에 가샤폰 반다이 오피셜샵이 함께 있습니다. 반다이남코코리아 멤버십 혜택은 적용되지 않습니다. ${f.access}`,
    },
    sources: [src(FUNSQ, ['name', 'addr', 'floor', 'hours', 'phone', 'parking', 'access']), src('https://www.bnkrmall.co.kr/etc/gashapon-official_store.do', ['GBO 입점'])],
    unconfirmed: ['정기 휴무', '가샤폰 외 취급 상품 범위'], photo: 'needed',
  })),
  {
    action: 'update', key: 'funsquare-suwon-fill', shop_id: '384328ab-cb33-4682-93c1-f1c2076a036f', expect_updated_at: '2026-09-15T15:23:38.354168+00:00',
    fields: { phone: '031-690-1509', shop_link: FUNSQ, hours: every('10:00', '22:00', { yearRound: true }) }, overwrite: ['hours'],
    reason: '전화·공식 링크 누락 보완, 공식 안내의 연중무휴 표시 추가(시간 동일)',
    sources: [src(FUNSQ, ['addr', 'floor', 'hours', 'yearRound', 'phone', 'parking'])],
  },

  // ── 건담베이스 (반다이남코코리아 공식 매장 안내)
  ...[
    { key: 'gbase-goyang', name: '건담베이스 고양점', addr: '경기 고양시 덕양구 고양대로 1955', floor: '스타필드 고양 2층 (일렉트로마트 옆)', phone: '031-5173-2479', hours: every('10:00', '22:00'), parking: '스타필드 고양 주차장 이용 (주차요금 무료)', extra: '스타필드 고양 지정 휴일에는 휴무합니다. 3호선 삼송역 3번 출구에서 도보 약 8분입니다.' },
    { key: 'gbase-pangyo', name: '건담베이스 판교점', addr: '경기 성남시 분당구 판교역로146번길 20', floor: '현대백화점 판교점 5층', phone: '031-5170-1551', hours: split(['fri', 'sat', 'sun'], ['10:30', '20:00'], ['10:30', '20:30']), parking: '현대백화점 판교점 유료주차장 이용 가능', place: PLACE.hyundaiPangyo, extra: '공휴일은 주말과 같은 시간(10:30~20:30)에 운영합니다. 신분당선 판교역 3번 출구에서 도보 5분입니다.' },
    { key: 'gbase-seomyeon', name: '건담베이스 서면점', addr: '부산 부산진구 중앙대로 672', floor: '삼정타워 7층 702호', phone: '051-818-3440', hours: { ...split(['fri', 'sat'], ['11:00', '22:00'], ['11:00', '22:30']), yearRound: true }, parking: '삼정타워 유료 주차장 이용 가능 (공간이 좁아 대중교통 권장)', place: PLACE.samjung, extra: '연중무휴입니다. 1·2호선 서면역 2번 출구에서 직진 약 430m입니다.' },
    { key: 'gbase-centum', name: '건담베이스 센텀시티점', addr: '부산 해운대구 센텀남대로 35', floor: '신세계백화점 센텀시티몰 3층', phone: '051-745-1468', hours: split(['fri', 'sat', 'sun'], ['10:30', '20:00'], ['10:30', '20:30']), parking: '신세계 센텀시티몰 주차장 이용 가능', extra: '월 1회 월요일 휴무하며, 공휴일은 주말과 같은 시간에 운영합니다. 부산 2호선 센텀시티역과 연결됩니다.' },
    { key: 'gbase-daegu', name: '건담베이스 대구점', addr: '대구 중구 동성로2길 95', floor: 'BL빌딩 4층', phone: '053-426-2805', hours: every('11:00', '21:00'), parking: '동성로 중앙주차장(2.28공원 지하주차장) 이용 가능', th: ['2026-09-25', '2026-09-25', '추석 당일 휴무 (명절 당일 정기 휴무)'], extra: '명절 당일은 휴무입니다. 대구 1호선 중앙로역 2번 출구(대현프리몰 20번 출구)에서 가깝습니다.' },
    { key: 'gbase-daejeon', name: '건담베이스 대전점', addr: '대전 동구 동서대로1695번길 30', floor: '대전복합터미널 동관 2층', phone: '042-625-2805', hours: every('11:00', '21:00'), parking: '대전복합터미널 주차장 이용 가능', extra: '' },
  ].map((g) => ({
    action: 'insert', key: g.key, brand_links,
    fields: {
      name: g.name, addr: g.addr, place_id: g.place ?? null, floor_info: g.floor,
      cats: ['굿즈샵', '프라모델'], custom_goods: ['건담 프라모델', '한정 상품', '조립용품'],
      hours: g.hours, phone: g.phone, shop_link: GBASE, sns_links: ['https://cafe.naver.com/gbasekorea'],
      parking: true, parking_note: g.parking,
      ...(g.th ? { temporary_holiday_start: g.th[0], temporary_holiday_end: g.th[1], temporary_holiday_message: g.th[2] } : {}),
      description: `${gbaseDesc(g.name.replace('건담베이스 ', ''))} ${g.extra}`.trim(),
    },
    sources: [src(GBASE, ['name', 'addr', 'floor', 'hours', 'closed days', 'phone', 'parking', 'access'])],
    unconfirmed: ['추석 연휴 영업(공식 카페 공지 36783 이미지 미확인)'], photo: 'needed',
  })),
]

await writeFile('scripts/shops/plans/2026-09-23-main.json', JSON.stringify({ name: '2026-09-23-main', items }, null, 1))
console.log('items', items.length)
