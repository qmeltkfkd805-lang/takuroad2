// 2026-09-30 2차 plan 생성 — SMG CAFE 신촌, 애니팝굿즈샵 삼성역·의정부로데오, 애니피스 논현역, 원피규어 대구점
import { writeFileSync } from 'fs'
const D = '2026-09-30'
const NAME = '2026-09-30-b'
const day = (o, c) => ({ open: o, close: c })
const all = (o, c) => Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((k) => [k, day(o, c)]))
const UPLEX = 'e5915b03-9aad-4b68-866b-cb6cdc42bbf8'
const UPLEX_NOTE = '주차 가능(유료)\n최초 30분 무료, 초과 시 10분당 1,000원\n3만원 이상 구매 시 1시간, 5만원 이상 2시간, 10만원 이상 3시간 무료\n30만원 이상 구매 시 당일 무료'
const T = {
  epic7: '5f39c94e-4c5a-4606-8bb1-78dbc4132b18', face: '34b220ee-d7fc-42cc-95c3-ae259e76a192', ouran: '4d4b02e7-2835-45ce-8357-c92992d69387',
  db: 'c7c8efb0-41d2-4935-b0e6-5f9f59b2bc9e', gintama: 'cdc27204-c7f8-4f28-a4a7-fb7e8b7fc1b7', eva: '1a97869d-63fb-4d86-a098-2551356d835b',
  ansatsu: 'c6b58ffd-0566-487b-a233-61198442f6b6', jjk: '7fc6cb70-c059-40e3-86a4-39dc28b6b32c', chiikawa: 'b507243e-1408-47a1-9aeb-f4245127d3dc',
  sanrio: 'f6dff3d1-5a30-409d-849c-9a34d111b1be', miku: '94dea875-614e-4e2d-ba30-ea509385603b', cinna: '1b6f3b0c-9e7b-470c-a588-f6d521c5a17e',
  mha: 'b6a65af7-85e0-4390-9986-6057487c19d1', digimon: '4b229a09-369d-4607-9d3b-04aa3f128c2c', nikke: '63f2a778-7dca-469d-a2c1-8b139d82637f',
  arknights: 'db691edb-dc03-4251-896f-22d8412a7200',
}
const SMG_X = 'https://x.com/smgcafe_kr'
const AP1_X = 'https://x.com/2anipop948474'
const AP2_X = 'https://x.com/AnipopGoods2nd'
const APC_X = 'https://x.com/anipeaceshop'
const OF_X = 'https://x.com/OneFigure_Daegu'

const items = [
  {
    action: 'insert', key: 'smgcafe-sinchon', photo: 'needed', brand: 'SMG CAFE', brand_links: [SMG_X, 'https://ohmakestore.com'],
    fields: {
      name: 'SMG CAFE 신촌점', addr: '서울 서대문구 연세로 13', floor_info: '현대백화점 신촌점 U-PLEX 지하 2층',
      cats: ['콜라보카페'], shop_link: SMG_X, sns_links: [SMG_X, 'https://ohmakestore.com', 'https://linktr.ee/cafeohmake'],
      hours: all('10:30', '22:00'), place_id: UPLEX, parking: true, parking_note: UPLEX_NOTE,
      description: '애니메이션·게임·웹툰 작품 콜라보 카페 SMG CAFE 의 신촌 매장입니다(구 오마케 카페 OH!MAKE). 작품별 콜라보 카페가 기간마다 바뀌어 열리고, 콜라보 메뉴와 MD 를 판매합니다.\n평일·주말 10:30~22:00(공식 X 안내). 콜라보별 예약·입장 방식은 공식 X 공지를 확인하세요. 문의는 DM 이 아닌 메일로 받습니다.\n현대백화점 신촌점 U-PLEX 지하 2층.',
    },
    goods_types: [],
    works: [
      { tag_id: T.epic7, evidence: '이 샵 이벤트 452ecf4d — 에픽세븐 8주년 × SMG CAFE 콜라보 카페(2026-08-29~09-30), 공식 X 08-22 고정 공지' },
      { tag_id: T.face, evidence: '이 샵 이벤트 df97a040 — 얼굴만으론 좋아할 수 없어요 × SMG CAFE 콜라보 카페(2026-07-31~08-26)' },
      { tag_id: T.ouran, evidence: '이 샵 이벤트 41993157 — 오란고교 사교클럽 × SMG CAFE 콜라보 카페(2026-10-02~11-30)' },
    ],
    link_events: [
      { event_id: '452ecf4d-45cf-4e4d-a9f9-a76b33afd3aa', alias: 'SMG CAFE', evidence: 'place_detail "지하 2층 SMG CAFE", 연세로 13' },
      { event_id: 'df97a040-eb90-4680-adf3-a83c44051dd4', alias: 'SMG CAFE', evidence: 'place_detail "지하 2층 SMG CAFE", 연세로 13' },
      { event_id: '41993157-e994-4f2b-a5c1-83f5af00d34d', alias: 'SMG CAFE', evidence: 'place_detail "지하 2층 SMG CAFE (구 OH!MAKE)", 연세로 13' },
    ],
    sources: [
      { url: SMG_X, fields: ['name', 'floor_info', 'hours', 'sns_links', 'description'], checked_at: D, note: '공식 X 프로필(브라우저 비로그인): "📍 신촌 현대백화점 U-PLEX B2 / 📅 평일&주말 10:30 – 22:00 / DM 문의는 받지 않습니다. 메일 문의 / SMG STORE 자사몰 ohmakestore.com / linktr.ee/cafeohmake", 2025-09 가입, 08-22 에픽세븐 8주년 콜라보 고정 공지' },
      { url: 'place e5915b03 현대백화점유플렉스 신촌점', fields: ['parking_note'], checked_at: D, note: '기존 place 노트 복사' },
    ],
    unconfirmed: ['phone', 'goods_types'],
    notes: '같은 층 MOAE:KU 신촌점과 다른 매장. SMG STORE(굿즈샵 — 수원·대구·부산)와 업종이 달라 따로 등록. 2026-11 U-PLEX 지하 올리브영 입점 예정 — B2 유지 여부 11월 점검',
  },
  {
    action: 'insert', key: 'anipop-samsung', photo: 'needed', brand: '애니팝굿즈샵', brand_links: [AP1_X, AP2_X],
    fields: {
      name: '애니팝굿즈샵 삼성역점', addr: '서울 강남구 영동대로85길 13', floor_info: '5층',
      cats: ['굿즈샵', '가챠', '쿠지', '피규어샵'], shop_link: AP1_X, sns_links: [AP1_X],
      hours: all('11:00', '21:00'),
      description: '애니메이션 굿즈 전문점 애니팝굿즈샵의 삼성역 매장입니다. 인기 애니메이션 굿즈·피규어·이치방쿠지(제일복권)를 판매하고, 캡슐가챠 200대 이상을 진열하고 있습니다. 작품 테마 팝업 행사가 열리기도 합니다.\n매일 11:00~21:00(공식 X 안내). 리뉴얼을 위해 2026-09-22~10-18 재고정리 할인을 진행한다고 공지했습니다. 명절 휴무 등은 공식 X 공지를 확인하세요. 매장·상품 문의는 X DM.\n같은 건물 지하 1층 "애니팝 만화카페 & 캡슐토이" 는 별도 매장입니다.',
    },
    goods_types: ['figure-new', 'ichiban-kuji', 'gacha-new', 'card-new'],
    works: [
      { tag_id: T.jjk, evidence: '공식 X 2026-09-16 캡슐토이 입고(주술회전 사멸회유 컬렉션 피규어·러버 키홀더), 09-12~ 주술회전 팬텀 퍼레이드 테마 팝업(이벤트 d4903b86)' },
      { tag_id: T.nikke, evidence: '공식 X 2026-09-19 매장 입고 — 승리의 여신: 니케 바이스 슈발츠 부스터 팩 Vol.2(한글판)' },
      { tag_id: T.arknights, evidence: '이 샵 이벤트 85c620bc — 명일방주 앰비언스 시네스티시아 팝업스토어(5층 애니팝 굿즈샵)' },
    ],
    link_events: [
      { event_id: 'd4903b86-f09c-4726-a49b-0836a3e081e6', alias: '애니팝굿즈샵 삼성역점', evidence: 'place_name "애니팝굿즈샵 삼성역점", 영동대로85길 13 5층' },
      { event_id: '85c620bc-e4ca-4782-99b3-06644771792c', alias: '애니팝 굿즈샵', evidence: 'place_detail "5층 애니팝 굿즈샵", 영동대로85길 13' },
    ],
    sources: [
      { url: AP1_X, fields: ['name', 'addr', 'floor_info', 'hours', 'goods_types', 'description', 'works'], checked_at: D, note: '공식 X 프로필(브라우저 비로그인): "애니메이션 굿즈 전문점 애니팝 굿즈샵 / 인기 애니메이션 굿즈 / 피규어 / 이치방쿠지 등 판매중 / 캡슐가챠 총 200대 이상 진열중 / 영업시간 11:00 ~ 21:00 / 강남구 영동대로 85길 13, 5층", 09-21 고정 "리뉴얼을 위해 9.22~10.18 재고정리 할인", 09-19 니케 카드 입고, 09-16 캡슐토이 입고, 09-18 추석 9/25 전 지점 휴무' },
    ],
    unconfirmed: ['phone'],
    notes: '지하 1층 애니팝 만화카페 & 캡슐토이(@popani420103, 24시간·02-552-6052)는 만화카페 업종 + 마지막 게시 2025-05 → 등록 안 함(pending). 리뉴얼 후(10-18 이후) 층·시간 변동 재확인',
  },
  {
    action: 'insert', key: 'anipop-uijeongbu', photo: 'needed', brand: '애니팝굿즈샵', brand_links: [AP2_X, AP1_X],
    fields: {
      name: '애니팝굿즈샵 의정부로데오점', addr: '경기 의정부시 행복로 18', floor_info: '지하 1층',
      cats: ['굿즈샵', '쿠지', '피규어샵'], shop_link: AP2_X, sns_links: [AP2_X], phone: '031-821-5307',
      hours: { ...all('12:00', '21:00'), tue: null },
      description: '애니굿즈·피규어·쿠지 전문점 애니팝굿즈샵의 의정부 로데오 매장입니다(2026년 3월 3일 오픈). 이치방쿠지(제일복권)와 애니메이션 굿즈·피규어를 판매합니다.\n12:00~21:00. 2026년 8월 둘째 주부터 일시적으로 매주 화요일 휴무(공식 X 고정 공지) — 화요일 영업 재개 여부는 공식 X 를 확인하세요. 매장·상품 문의는 X DM.',
    },
    goods_types: ['ichiban-kuji', 'figure-new', 'plushie-new'],
    works: [
      { tag_id: T.db, evidence: '공식 X 2026-09-29 제일복권 입고 안내 — 이치방쿠지 드래곤볼 GT(10-01 판매 시작)' },
      { tag_id: T.gintama, evidence: '공식 X 2026-09-29 제일복권 입고 안내 — 은혼 탄생 20주년 은혼전 Part.2(10-01)' },
      { tag_id: T.eva, evidence: '공식 X 2026-09-29 제일복권 입고 안내 — 이치방쿠지 에반게리온 신극장판: 서(10-01)' },
      { tag_id: T.ansatsu, evidence: '공식 X 2026-09-28 신규 굿즈 입고 — 암살교실 쿠루미 타피누이' },
      { tag_id: T.jjk, evidence: '공식 X 2026-09-28 신규 굿즈 입고 — 주술회전' },
    ],
    link_events: [],
    sources: [
      { url: AP2_X, fields: ['name', 'addr', 'floor_info', 'hours', 'phone', 'goods_types', 'description', 'works'], checked_at: D, note: '공식 X 프로필(브라우저 비로그인): "애니굿즈/피규어/쿠지 전문점 애니팝굿즈샵 의정부 로데오점 / 매일 12:00 ~ 21:00 / 2026년 3월 3일 오픈! / 031)821-5307 / 경기도 의정부시행복로 18 지하1층", 08-07 고정 "8월 둘째 주부터 일시적으로 매주 화요일 매장 휴무", 09-29 쿠지 입고 3건, 09-28 굿즈 입고' },
    ],
    unconfirmed: [],
    notes: '화요일 휴무는 "일시적" 공지 — 해제 공지 나오면 hours.tue 복구',
  },
  {
    action: 'insert', key: 'anipeace-nonhyeon', photo: 'needed', brand: '애니피스', brand_links: [APC_X],
    fields: {
      name: '애니피스 논현역점', addr: '서울 서초구 신반포로47길 33-2', floor_info: '지상 매장 · 지하 확장 매장',
      cats: ['굿즈샵', '쿠지', '피규어샵'], shop_link: APC_X, sns_links: [APC_X, 'https://open.kakao.com/o/gYfgLK9g'],
      hours: { mon: null, tue: day('12:00', '19:00'), wed: day('12:00', '19:00'), thu: day('12:00', '19:00'), fri: day('12:00', '19:00'), sat: day('13:00', '18:00'), sun: null, holiday: 'closed' },
      description: '논현역 근처의 제일복권(이치방쿠지)·피규어·굿즈 전문점 애니피스입니다. 치이카와·산리오 등 캐릭터 굿즈와 애니메이션 쿠지를 판매합니다.\n화~금 12:00~19:00, 토 13:00~18:00, 일·월·공휴일 휴무(공식 X 안내).\n2026년 6월 24일부터 기존 지상 매장과 별도로 지하 확장 매장을 함께 운영합니다(공식 X 약도 안내).',
    },
    goods_types: ['ichiban-kuji', 'figure-new', 'plushie-new'],
    works: [
      { tag_id: T.chiikawa, evidence: '공식 X 2026-09-28 상품 입고 — 치이카와 피규어 마스코트·누이 봉제인형 박스·치이카와x산리오 콜라보 카드굿즈' },
      { tag_id: T.sanrio, evidence: '공식 X 2026-09-28 상품 입고 — 산리오캐릭터즈 초코박스·치이카와x산리오 콜라보' },
      { tag_id: T.gintama, evidence: '공식 X 2026-09-23 상품 입고 — 제일복권 은혼 20주년 은혼전 ~스무살의 모임~ 두번째' },
    ],
    link_events: [],
    sources: [
      { url: APC_X, fields: ['name', 'addr', 'floor_info', 'hours', 'goods_types', 'description', 'works'], checked_at: D, note: '공식 X 프로필(브라우저 비로그인) "굿즈샵 논현역 애니피스": "논현역 피규어 & 굿즈 & 제일복권 / 서초구 신반포로 47길 33-2 / 영업시간 화요일 ~ 금요일 12:00 ~ 19:00 토요일 13:00 ~ 18:00 / 매주 일요일,월요일 및 공휴일 휴무", 06-23 고정 "확장 이전 공사 완료, 6월 24일부터 … 기존 지상 매장과 별개로 지하에 확장된 매장", 09-28·09-24·09-23 입고 공지' },
    ],
    unconfirmed: ['phone', 'floor_info'],
    notes: '지상 매장 층(1층 등) 공식 표기 없음 — "지상/지하" 로만. 나가노의 곰 은 작품 행 없음(나가노마켓과 다름) — 연결 안 함',
  },
  {
    action: 'insert', key: 'onefigure-daegu', photo: 'needed', brand: '원피규어', brand_links: [OF_X, 'https://x.com/OneFi_Gwangju', 'https://smartstore.naver.com/onefi'],
    fields: {
      name: '원피규어 대구점', addr: '대구 중구 동성로 8-1', floor_info: '지하 1층',
      cats: ['피규어샵', '굿즈샵', '쿠지'], shop_link: OF_X, sns_links: [OF_X, 'https://smartstore.naver.com/onefi'], phone: '010-5723-0895',
      hours: { ...all('11:00', '20:30'), sat: day('11:00', '21:00'), yearRound: true },
      description: '대구 동성로의 피규어·굿즈 전문샵 원피규어 대구점입니다. 일본 직수입 정품 영화·애니메이션 피규어와 굿즈 약 8,000종, 제일복권(이치방쿠지) 등 각종 쿠지를 판매합니다.\n11:00~20:30(토요일 21:00까지), 연중무휴(공식 X 안내). 명절 영업시간은 공식 X 공지를 확인하세요.',
    },
    goods_types: ['figure-new', 'ichiban-kuji'],
    works: [
      { tag_id: T.miku, evidence: '공식 X 2026-09-30 피규어 입고 — 하츠네 미쿠×시나모롤 POP UP PARADE 하츠네 미쿠 L size' },
      { tag_id: T.cinna, evidence: '공식 X 2026-09-30 피규어 입고 — 하츠네 미쿠×시나모롤 POP UP PARADE' },
      { tag_id: T.mha, evidence: '공식 X 2026-09-30 피규어 입고 — 나의 히어로 아카데미아 Fluffy Puffy·GLITTER&GLAMOURS' },
      { tag_id: T.digimon, evidence: '공식 X 2026-09-30 피규어 입고 — 디지몬 어드벤처 디지바이스 스탠드! 엔젤몬' },
    ],
    link_events: [],
    sources: [
      { url: OF_X, fields: ['name', 'addr', 'floor_info', 'hours', 'phone', 'goods_types', 'description', 'works'], checked_at: D, note: '공식 X 프로필(브라우저 비로그인): "영업시간 11:00~20:30 (토 21:00) 연중무휴 / tel:010-5723-0895 / 동성로 최대규모 피규어 굿즈 전문샵 / 약 8,000종의 영화, 애니메이션 피규어, 굿즈, 제일복권 등 각종 쿠지 / 일본 직수입 정품 / 대구광역시 중구 동성로 8-1 지하 1층", 09-07 고정 "원피규어 대구1호점 추석 연휴 정상영업", 09-30 피규어 입고 4건' },
    ],
    unconfirmed: [],
    notes: '고정 공지에 "대구1호점" 표기 — 대구 2호점 존재 여부 확인(같은 이름·다른 건물이면 별도 행). 원피규어 광주점(@OneFi_Gwangju, 중앙로160번길 34 2층)은 다음 후보',
  },
]
writeFileSync(`scripts/shops/plans/${NAME}.json`, JSON.stringify({ name: NAME, items }, null, 1))
console.log('wrote', items.length)
