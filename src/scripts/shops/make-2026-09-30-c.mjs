// 2026-09-30 3차 plan 생성 — 원피규어 광주점, 부산 굿즈샵 코다와리, 제이굿즈 부산점·울산점·창원점 + 제이굿즈 수원점 재점검
import { writeFileSync } from 'fs'
const D = '2026-09-30'
const NAME = '2026-09-30-c'
const day = (o, c) => ({ open: o, close: c })
const all = (o, c) => Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((k) => [k, day(o, c)]))
const wk = (wo, wc, eo, ec) => ({ ...all(wo, wc), sat: day(eo, ec), sun: day(eo, ec) })
const T = {
  jjk: '7fc6cb70-c059-40e3-86a4-39dc28b6b32c', mha: 'b6a65af7-85e0-4390-9986-6057487c19d1', sanrio: 'f6dff3d1-5a30-409d-849c-9a34d111b1be',
  saiki: 'd257e15e-f28c-4a88-82a6-c970af0cfd45', csm: 'b4f20ef8-6f3b-438e-8efb-91ccfca790ac', chiikawa: 'b507243e-1408-47a1-9aeb-f4245127d3dc',
  ccs: '06c370c8-8630-4370-8db4-7691f6172d6e', natsume: '69f68ebd-7061-4b7f-96c2-022dcf228edf', holo: 'ac52f935-18c9-4f95-b87a-bece558a74fe',
  reborn: '4913fd41-a5e2-4c24-9297-2e799b1d16ce', kny: 'e3f9dbfd-e491-4433-9af1-6c0b146f5746', keroro: '41e73c70-0c1c-4950-9a01-4c0fd75820c5',
  teto: 'e7cb14d7-b982-417d-b1ca-23fe43cd5532', kon: '65510a89-9bec-4b5c-8216-dc24c8ce230b', haikyu: '2a88af81-4e08-446f-befa-312110884a20',
  db: 'c7c8efb0-41d2-4935-b0e6-5f9f59b2bc9e', eva: '1a97869d-63fb-4d86-a098-2551356d835b', gintama: 'cdc27204-c7f8-4f28-a4a7-fb7e8b7fc1b7',
  inuyasha: 'a44bc564-3245-452b-b4d0-20848daadbc0', miku: '94dea875-614e-4e2d-ba30-ea509385603b',
}
const OFG_X = 'https://x.com/OneFi_Gwangju'
const KOD_X = 'https://x.com/kodawari_gs'
const KOD_SS = 'https://smartstore.naver.com/saturn_peach'
const JBS_X = 'https://x.com/JGoods_bs'
const JUS_X = 'https://x.com/JGoods_US'
const JCW_X = 'https://x.com/JGoods_CW'
const JSW_X = 'https://x.com/JGoods_SW'
const JG_BRAND = [JSW_X, JBS_X, JUS_X, JCW_X]
const src = (url, fields, note) => ({ url, fields, checked_at: D, note })
const w = (tag_id, evidence) => ({ tag_id, evidence })

const items = [
  {
    action: 'insert', key: 'onefigure-gwangju', photo: 'needed', brand: '원피규어', brand_links: [OFG_X, 'https://x.com/OneFigure_Daegu'],
    fields: {
      name: '원피규어 광주점', addr: '광주 동구 중앙로160번길 34', floor_info: '2층',
      cats: ['피규어샵', '굿즈샵', '쿠지', '가챠'], shop_link: OFG_X, sns_links: [OFG_X], phone: '010-4683-0895',
      hours: all('13:00', '21:00'),
      description: '일본 직수입 정품 피규어·굿즈·이치방쿠지(제일복권)·캡슐가챠를 파는 원피규어의 광주 충장로 매장입니다. 이치방쿠지를 많이 보유한 매장으로 소개하고 있습니다.\n영업시간 13:00~21:00(공식 X 안내). 명절 영업 여부는 공식 X 공지를 확인하세요.\n광주 동구 중앙로160번길 34 2층.',
    },
    goods_types: ['figure-new', 'ichiban-kuji', 'gacha-new'],
    works: [
      w(T.natsume, '공식 X 2026-09-29 쿠지 재입고 — 나츠메 우인장 Tribute Gallery'),
      w(T.holo, '공식 X 2026-09-29 쿠지 재입고 — 홀로라이브 VILLAIN STYLE'),
      w(T.reborn, '공식 X 2026-09-29 쿠지 입고 — 가정교사 히트맨 REBORN 오미쿠지'),
      w(T.kny, '공식 X 2026-09-28 피규어 입고 — 귀멸의 칼날 유대의 장'),
    ],
    link_events: [],
    sources: [src(OFG_X, ['name', 'addr', 'floor_info', 'hours', 'phone', 'cats', 'description'], '공식 X 프로필(브라우저 비로그인): "광주 충장로점 | 광주 제일복권 최다보유샵 / 일본 직수입 정품 피규어 굿즈 이치방쿠지 복권 캡슐 가챠 전문샵 / 영업시간 PM1:00~PM9:00 / 광주광역시 중앙로160번길 34 2F / tel 010-4683-0895", 2024-06 가입, 2026-09-28·29 입고 게시, 09-07 추석 연휴 정상영업 공지')],
    unconfirmed: ['closed_days'],
    notes: '원피규어 대구점(b0739b70)과 같은 브랜드 다른 지역 — 따로 등록. 정기 휴무 표기 없음(연중무휴 명시 없음 → yearRound 넣지 않음)',
  },
  {
    action: 'insert', key: 'kodawari-busan', photo: 'needed', brand: '코다와리', brand_links: [KOD_X, KOD_SS],
    fields: {
      name: '부산 굿즈샵 코다와리', addr: '부산 부산진구 서전로10번길 71', floor_info: '지하 1층',
      cats: ['굿즈샵', '피규어샵', '가챠', '쿠지'], shop_link: KOD_X, sns_links: [KOD_X, KOD_SS],
      hours: all('12:00', '21:00'),
      description: '부산 서면의 일본 애니메이션 정품 굿즈샵입니다. 피규어·캡슐가챠·리멘트·이치방쿠지(제일복권) 등을 판매합니다.\n매일 12:00~21:00(공식 X 안내). 통신판매 문의는 X DM 으로 받습니다.\n부산진구 서전로10번길 71 지하 1층.',
    },
    goods_types: ['figure-new', 'gacha-new', 'ichiban-kuji'],
    works: [
      w(T.keroro, '공식 X 2026-09-29 입고 — 개구리 중사 케로로 피규어(쿠루루·도로로)'),
      w(T.teto, '공식 X 2026-09-29 입고 — 카사네 테토 데포르메 피규어 2종'),
      w(T.kon, '공식 X 2026-09-29 입고 — 케이온! Luminasta 피규어(유이·아즈사)'),
    ],
    link_events: [],
    sources: [src(KOD_X, ['name', 'addr', 'floor_info', 'hours', 'cats', 'sns_links', 'description'], '공식 X 프로필(브라우저 비로그인): "서면 피규어·가챠·리멘트·제일복권 등 일본 애니메이션 정품 굿즈샵 / 영업시간 매일 오후 12시~오후 9시 / 통판 문의는 디엠 / 부산광역시 부산진구 서전로10번길71, 지하1층 / smartstore.naver.com/saturn_peach", 2025-08 가입, 2026-09-29 입고 게시')],
    unconfirmed: ['phone'],
    notes: '작품 행 없음(연결 못 함): 로젠메이든(09-29 소우세이세키 피규어)·가나디(08-31 가챠)',
  },
  {
    action: 'insert', key: 'jgoods-busan', photo: 'needed', brand: '제이굿즈', brand_links: JG_BRAND,
    fields: {
      name: '제이굿즈 부산점', addr: '부산 부산진구 신천대로50번길 65', floor_info: '2층 · 지하',
      cats: ['굿즈샵', '가챠', '쿠지', '피규어샵'], shop_link: JBS_X, sns_links: [JBS_X], phone: '051-802-2248',
      hours: { ...wk('12:00', '21:00', '11:00', '21:00'), yearRound: true },
      description: '가챠·이치방쿠지(제일복권)·애니 굿즈·피규어 정품 매장 제이굿즈의 부산 서면 매장입니다. 2층과 지하 두 층으로 운영합니다.\n· 2층: 051-802-2248\n· 지하: 051-804-2248\n연중무휴, 평일 12:00~21:00 · 토·일·공휴일 11:00~21:00(공식 X 안내).\n제이굿즈 수원점·울산점·창원점과 같은 브랜드입니다.',
    },
    goods_types: ['gacha-new', 'ichiban-kuji', 'figure-new'],
    works: [
      w(T.jjk, '공식 X 2026-09-29 캡슐가챠 입고 — 주술회전 어깨쿵'),
      w(T.mha, '공식 X 2026-09-29 입고 — 나의 히어로 아카데미아 지로 피규어'),
      w(T.sanrio, '공식 X 2026-09-29 입고 — 해피쿠지 산리오 할로윈 2026'),
      w(T.saiki, '공식 X 2026-09-29 입고 — 사이키 쿠스오의 재난 타피누이'),
      w(T.csm, '공식 X 2026-09-29 입고 — 제일복권 체인소맨 레제편 2탄'),
    ],
    link_events: [],
    sources: [src(JBS_X, ['name', 'addr', 'floor_info', 'hours', 'phone', 'cats', 'description'], '공식 X 프로필(브라우저 비로그인): "가챠&제일복권&애니굿즈&피규어 공식샵 2층&지하 / 연중무휴!! 영업시간(12:00~21:00 // 공휴일,토,일 11:00~21:00) / 수원점·울산점·창원점 / ☎ 2층 051-802-2248 · 지하 051-804-2248 / 부산진구 신천대로50번길 65 2층,지하", 2017-02 가입, 2026-09-29 입고 게시')],
    unconfirmed: ['floor_info(지하 층 번호 — "지하" 로만 표기)'],
    notes: '같은 건물 2층·지하 두 매장 = 한 행(지침 3-5 의 3 원칙 준용). 수원 제이굿즈(be171fd6)와 같은 브랜드',
  },
  {
    action: 'insert', key: 'jgoods-ulsan', photo: 'needed', brand: '제이굿즈', brand_links: JG_BRAND,
    fields: {
      name: '제이굿즈 울산점', addr: '울산 중구 젊음의2거리 29', floor_info: '3층 306호',
      cats: ['굿즈샵', '가챠', '쿠지', '피규어샵'], shop_link: JUS_X, sns_links: [JUS_X], phone: '010-5708-1032',
      hours: { ...wk('13:00', '20:00', '12:00', '21:00'), yearRound: true },
      description: '애니 굿즈·피규어·이치방쿠지(제일복권)·캡슐가챠 전문점 제이굿즈의 울산 매장입니다.\n연중무휴, 평일 13:00~20:00 · 주말·공휴일 12:00~21:00(공식 X 안내). 통신판매 문의는 X DM.\n울산 중구 젊음의2거리 29 3층 306호. 제이굿즈 수원점·부산점·창원점과 같은 브랜드입니다.',
    },
    goods_types: ['figure-new', 'ichiban-kuji', 'gacha-new'],
    works: [
      w(T.chiikawa, '공식 X 2026-09-24 재입고 — 치이카와 쥬얼리 스윙 챰'),
      w(T.ccs, '공식 X 2026-09-23 제일복권 입고 — 카드캡터 사쿠라(#카캡사) 메이크업 브러쉬 스탠드 등'),
    ],
    link_events: [],
    sources: [src(JUS_X, ['name', 'addr', 'floor_info', 'hours', 'phone', 'cats', 'description'], '공식 X 프로필(브라우저 비로그인): "애니굿즈 & 피규어 & 제일복권 & 캡슐가챠 전문점 / 운영시간 연중무휴 13시~20시 (주말,공휴일 12시~21시) / ☎ 010-5708-1032 / 울산 중구 젊음의2거리 29 3층 306호", 2019-11 가입, 2026-09-23·24 게시')],
    unconfirmed: [],
    notes: '작품 행 없음(연결 못 함): 도원암귀(09-23 제일복권)',
  },
  {
    action: 'insert', key: 'jgoods-changwon', photo: 'needed', brand: '제이굿즈', brand_links: JG_BRAND,
    fields: {
      name: '제이굿즈 창원점', addr: '경남 창원시 성산구 원이대로 672', floor_info: '지하 1층',
      cats: ['굿즈샵', '가챠', '쿠지', '피규어샵'], shop_link: JCW_X, sns_links: [JCW_X], phone: '055-263-2248',
      hours: { ...all('13:00', '20:00'), mon: null },
      description: '가챠·이치방쿠지(제일복권)·굿즈·피규어 정품 매장 제이굿즈의 창원 상남동 매장입니다.\n13:00~20:00, 매주 월요일 정기휴무(공식 X 안내). 명절 휴무는 공식 X 공지를 확인하세요.\n창원시 성산구 원이대로 672 지하 1층. 제이굿즈 수원점·부산점·울산점과 같은 브랜드입니다.',
    },
    goods_types: ['gacha-new', 'ichiban-kuji', 'figure-new'],
    works: [
      w(T.gintama, '공식 X 2026-09-24 제일복권 입고 — 은혼전 part.2'),
      w(T.haikyu, '공식 X 2026-09-24 제일복권 입고 — 하이큐!! 카라스노의 미래'),
      w(T.db, '공식 X 2026-09-24 제일복권 입고 — 드래곤볼 GT'),
      w(T.eva, '공식 X 2026-09-24 제일복권 입고 — 에반게리온 신극장판: 서'),
    ],
    link_events: [],
    sources: [src(JCW_X, ['name', 'addr', 'floor_info', 'hours', 'phone', 'cats', 'description'], '공식 X 프로필(브라우저 비로그인): "상남동 / 가챠&쿠지&굿즈&피규어 공식제품만 수입합니다 / 매주(월) 정기휴무 / 영업시간(1시오픈~8시 마감) / ☎ 055-263-2248 / 성산구 상남동 원이대로672 지하1층", 2024-04 가입, 2026-09-23 추석 공지·09-24 입고 게시')],
    unconfirmed: [],
    notes: '',
  },
  {
    action: 'update', key: 'jgoods-suwon', shop_id: 'be171fd6-61e5-4f5c-8235-fa8680050534', expect_updated_at: '2026-09-29T15:17:39.385947+00:00',
    overwrite: ['name', 'hours', 'floor_info', 'sns_links'],
    fields: {
      name: '제이굿즈 수원점',
      floor_info: '헌욱빌딩 2층',
      hours: { ...all('12:00', '21:00'), yearRound: true },
      sns_links: ['https://www.instagram.com/jgoods_sw/', JSW_X],
    },
    works: [
      w(T.inuyasha, '공식 X 2026-09-29 입고 — 이누야샤 트레이딩 카드·트레이딩 피규어'),
      w(T.miku, '공식 X 2026-09-29 입고 — 하츠네 미쿠 캔디 피규어'),
    ],
    goods_types: [],
    link_events: [],
    sources: [src(JSW_X, ['name', 'floor_info', 'hours', 'sns_links'], '공식 X 프로필(브라우저 비로그인): "애니굿즈 & 이치방쿠지 전문점 / 12:00~21:00 / 경기도 수원시 팔달구 갓매산로 55번길 18 헌욱빌딩 2층 / 연중무휴 / ☎ 031-246-4249 / 부산점·울산점", 2026-09-29 입고 게시(체인소맨 레제편 2탄·산리오 펑크파티 할로윈·이누야샤·미쿠)')],
    unconfirmed: ['parking_note(기존 "ak앱 3시간 쿠폰" 은 사용자 입력 팁 — 공식 대조 안 됨, 유지)'],
    notes: '변경 전 hours 12:21~20:00(오기로 보임) → 공식 12:00~21:00 연중무휴. 이름 "제이굿즈" → 공식 프로필명 "제이굿즈 수원점"(다른 지점 등록에 따라 구분). 전화·주소는 공식과 일치. 사용자 설명·주차 메모는 유지',
  },
]
writeFileSync(`scripts/shops/plans/${NAME}.json`, JSON.stringify({ name: NAME, items }, null, 1))
console.log('wrote', NAME, items.length)
