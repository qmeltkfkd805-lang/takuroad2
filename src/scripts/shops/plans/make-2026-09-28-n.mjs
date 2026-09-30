import { writeFileSync } from 'node:fs'
const D = '2026-09-28'
const KUJI = 'https://ichibankuji.kr/shop'
const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const H = (wk, we, extra = {}) => ({ ...Object.fromEntries(days.map((d, i) => [d, i < 5 ? wk : we])), ...extra })
const T = {
  haikyu: '2a88af81-4e08-446f-befa-312110884a20', mha: 'b6a65af7-85e0-4390-9986-6057487c19d1',
  hangyodon: '65d582e0-b629-4d53-98df-e49ad82ff99d', kimetsu: 'e3f9dbfd-e491-4433-9af1-6c0b146f5746',
  gintama: 'cdc27204-c7f8-4f28-a4a7-fb7e8b7fc1b7', bluelock: '77a9bc04-00de-4071-baf2-571f4fcef31d',
  bluearchive: '32995c8f-a09f-4a45-8efc-47a5e3b51e8a', conan: 'a48e942e-23f9-4900-ad93-adedb29d92ce',
  bocchi: 'b351c970-1944-4128-9cd3-de89bb826ff3',
}
const SPARK = 'bd1a6fc0-7c55-4768-aca0-6e29f27a3dbf'
const SPARK_NOTE = '주차 가능(유료)\n기본 30분 2,400원, 이후 10분당 1,000원\n스파크몰 입점 매장 구매 시: 5만원 이상 1시간 무료 · 10만원 이상 2시간\n테마파크 이용·매장 구매 합산 하루 최대 3시간'
const src = (url, fields, note) => ({ url, fields, checked_at: D, ...(note ? { note } : {}) })

const items = [
  {
    action: 'insert', key: 'hoka-sangjum', brand: '호카상점', brand_links: [],
    fields: { name: '호카상점', addr: '서울 마포구 어울마당로 153-3', floor_info: '1층', cats: ['굿즈샵'], phone: '0507-1474-9066',
      hours: H({ open: '12:00', close: '20:00' }, { open: '11:00', close: '21:00' }),
      shop_link: 'https://x.com/hoka_sangjum', sns_links: ['https://x.com/hoka_sangjum', 'https://www.instagram.com/hoka_sangjum/', 'https://pf.kakao.com/_SxhxeZn'],
      description: '"소녀들의 미학 컬렉션"을 내건 홍대 애니 굿즈샵으로, 아크릴 스탠드·캔배지·클리어 카드·마스코트 등 애니메이션 굿즈를 입고 소식과 함께 판매합니다.\n영업시간은 월~금 12:00~20:00, 토·일 11:00~21:00입니다(공식 계정 안내). 문의는 카카오톡 채널 "호카상점".' },
    goods_types: ['acrylic-stand', 'can-badge-new', 'card-new', 'plushie-new'],
    works: [
      { tag_id: T.haikyu, evidence: '공식 X 2026-09-28 입고 공지 — 하이큐 팬파크 메모리얼 아크릴 스탠드' },
      { tag_id: T.mha, evidence: '공식 X 2026-09-28 입고 공지 — 나의 히어로 아카데미아 지로리 마스코트·타와랏코' },
    ],
    sources: [
      src('https://x.com/hoka_sangjum', ['name', 'addr', 'floor_info', 'hours', 'description', 'goods_types'], 'X 프로필 "홍대 애니굿즈샵, 월-금 12:00~20:00 | 토-일 11:00~21:00, 서울 마포구 어울마당로 153-3, 1층" + 2026-09-28 영업 공지(브라우저 렌더)'),
      src('https://x.com/hoka_sangjum/status/2104431545373319211', ['works', 'goods_types']),
      src('https://x.com/hoka_sangjum/status/2104423425662152962', ['works', 'goods_types']),
      src('https://x.com/hoka_sangjum/status/2104035662093795815', ['goods_types'], '디그잇 트레이딩 클리어 카드 입고(작품 미등록)'),
      src(KUJI, ['phone', 'hours'], '이치방쿠지 공식 판매처 목록 "호카상점 | 어울마당로 153-3 1층 | 0507-1474-9066 | 월~금 12~20, 토~일 11~21"'),
    ],
    unconfirmed: ['parking', 'holiday'], photo: 'needed', notes: '단독 건물 — place 없음. 캔배지는 2025 입고 공지(히카루가 죽은 여름·가라오케 가자) 기준',
  },
  {
    action: 'insert', key: 'urara-hongdae', brand: '스페이스 우라라', brand_links: ['https://litt.ly/urara'],
    fields: { name: '스페이스 우라라 홍대점', addr: '서울 마포구 와우산로29길 48-29', floor_info: '지하 1층', cats: ['굿즈샵', '쿠지', '가챠', '피규어샵'], phone: '0507-1334-5345',
      hours: H({ open: '12:00', close: '22:00' }, { open: '11:00', close: '22:00' }, { yearRound: true }),
      shop_link: 'https://x.com/SpaceUrara', sns_links: ['https://x.com/SpaceUrara', 'https://www.instagram.com/space_urara/', 'https://litt.ly/urara'],
      description: '피규어·아트토이·애니메이션 굿즈와 제일복권(이치방쿠지)·가챠를 파는 캐릭터 굿즈샵 스페이스 우라라의 1호점입니다. 홍대입구역 6·7번 출구에서 걸어서 2분 거리 건물 지하 1층에 있습니다.\n영업시간은 주중 12:00~22:00, 주말 11:00~22:00이며 연중무휴입니다(공식 계정 안내).' },
    goods_types: ['figure-new', 'ichiban-kuji', 'gacha-new'],
    works: [
      { tag_id: T.hangyodon, evidence: '공식 X 2026-09-17·09-27 한교동 아타리쿠지 입고·판매 공지' },
      { tag_id: T.kimetsu, evidence: '공식 X 2026-08-17 귀멸의 칼날 일륜도 메지루시 마스코트 가챠 입고' },
    ],
    sources: [
      src('https://x.com/SpaceUrara', ['name', 'addr', 'floor_info', 'hours', 'description', 'goods_types'], 'X 프로필 "캐릭터 굿즈샵 스페이스 우라라 홍대점, 피규어&아트토이&애니굿즈 판매! 연중무휴! 주중 12~22시, 주말 11~22시, 와우산로 29길 48-29 지하1층, 홍대입구역 6,7번 출구 도보 2분"(브라우저 렌더)'),
      src('https://x.com/SpaceUrara/status/2104078339690659908', ['works']),
      src('https://x.com/SpaceUrara/status/2100485206616801620', ['works']),
      src('https://x.com/SpaceUrara/status/2089274329079177633', ['works', 'goods_types']),
      src('https://litt.ly/urara', ['brand'], '"1호점 홍대 / 2호점 대구 / 3호점 화곡"'),
      src(KUJI, ['phone'], '이치방쿠지 공식 판매처 목록 "스페이스 우라라 홍대점 | 0507-1334-5345"'),
    ],
    unconfirmed: ['parking'], photo: 'needed', notes: '2026-09-07~20 타임스퀘어 팝업은 단기 행사라 등록 안 함. 단독 건물 — place 없음',
  },
  {
    action: 'insert', key: 'urara-daegu', brand: '스페이스 우라라', brand_links: ['https://litt.ly/urara'],
    fields: { name: '스페이스 우라라 동성로스파크점', addr: '대구 중구 동성로6길 61', floor_info: '동성로 스파크 3층', cats: ['굿즈샵', '쿠지'], phone: '010-4966-5345',
      hours: H({ open: '12:00', close: '21:00' }, { open: '11:00', close: '22:00' }),
      shop_link: 'https://x.com/spaceurara_DG', sns_links: ['https://x.com/spaceurara_DG', 'https://www.instagram.com/space.urara/', 'https://litt.ly/urara'],
      place_id: SPARK, parking: true, parking_note: SPARK_NOTE,
      description: '홍대에서 온 캐릭터 굿즈샵 스페이스 우라라의 2호점으로, 대관람차로 알려진 동성로 스파크 쇼핑몰 3층에 있습니다. 제일복권(이치방쿠지)과 캐릭터 굿즈를 팔고 코스프레 포토부스가 있습니다.\n영업시간은 평일 12:00~21:00, 주말·공휴일 11:00~22:00이며 쇼핑몰 휴점일에는 쉽니다(공식 계정 안내).' },
    goods_types: ['ichiban-kuji', 'plushie-new'],
    works: [
      { tag_id: T.mha, evidence: '지점 공식 X 2025-12-19 입고 완료 — 나의 히어로 아카데미아 치비 누이구루미' },
      { tag_id: T.gintama, evidence: '지점 공식 X 2025-12-19 입고 완료 — 은혼 치비 누이구루미' },
      { tag_id: T.bluelock, evidence: '지점 공식 X 2025-12-19 입고 완료 — 블루록 치비 누이구루미' },
      { tag_id: T.bluearchive, evidence: '지점 공식 X 2025-12-19 입고 완료 — 블루 아카이브 치비 누이구루미' },
    ],
    sources: [
      src('https://x.com/spaceurara_DG', ['name', 'addr', 'floor_info', 'hours', 'description', 'goods_types'], 'X 프로필 "동성로스파크 3층, 제일복권/캐릭터굿즈 + 코스프레 포토부스, 쇼핑몰 점휴시 휴무, 평일 12-21시, 주말 11-22시, 대구 중구 동성로6길 61 스파크랜드 3층" + 게시물 "주말/공휴일 11:00~22:00"(브라우저 렌더). 마지막 게시물 2025-12'),
      src('https://x.com/spaceurara_DG/status/2001877332118876175', ['works', 'goods_types']),
      src(KUJI, ['phone'], '이치방쿠지 공식 판매처 목록 "스페이스 우라라 동성로스파크점 | 스파크랜드 3층 | 010-4966-5345 | 연중무휴"(2026 영업 근거)'),
      src('https://litt.ly/urara', ['brand'], '"2호점 대구"'),
      src('https://d-spark.kr/open_content/etc/faq.php?cate=c', ['parking', 'parking_note', 'place_id'], '동성로 스파크 공식 자주하는질문 주차(브라우저 렌더)'),
    ],
    unconfirmed: ['recent_activity'], photo: 'needed', notes: '지점 X 마지막 게시 2025-12 — 2026 영업은 이치방쿠지 판매처 목록·litt.ly 기준. 공휴일 시간은 설명에만',
  },
  {
    action: 'insert', key: 'urara-hwagok', brand: '스페이스 우라라', brand_links: ['https://litt.ly/urara'],
    fields: { name: '스페이스 우라라 강서화곡점', addr: '서울 강서구 화곡로 164', floor_info: '5층', cats: ['굿즈샵', '카드/TCG', '쿠지'],
      hours: H({ open: '12:00', close: '22:00' }, { open: '12:00', close: '22:00' }, { mon: null }),
      shop_link: 'https://x.com/urara_hwagok', sns_links: ['https://x.com/urara_hwagok', 'https://www.instagram.com/urara_hwagok/', 'https://litt.ly/urara'],
      description: '스페이스 우라라의 3호점으로, 애니 굿즈샵과 TCG 카드샵 "플레이아레나", 일본풍 킷사텐을 함께 운영합니다. 제일복권(이치방쿠지)과 포켓몬·원피스 카드 등을 팝니다.\n화곡역 6번 출구 바로 앞 던킨 건물 5층에 있으며, 영업시간은 12:00~22:00, 월요일 휴무입니다(공식 계정 안내).' },
    goods_types: ['ichiban-kuji', 'card-new'],
    works: [
      { tag_id: T.mha, evidence: '지점 공식 X 2026-08-29 나의 히어로 아카데미아 굿즈 입고' },
      { tag_id: T.conan, evidence: '지점 공식 X 2026-08-29 명탐정 코난 × 명탐정 프리큐어 슬리브 입고' },
      { tag_id: T.bocchi, evidence: '지점 공식 X 2026-08-29 봇치 더 록 굿즈 입고' },
    ],
    sources: [
      src('https://x.com/urara_hwagok', ['name', 'floor_info', 'hours', 'description', 'goods_types'], 'X 프로필 "스페이스우라라&플레이아레나 강서화곡점, 화곡역 6번출구 30초컷! 던킨건물 5층! 월요일 휴무/주중주말 12-22시, 제일복권 피규어 포켓몬카드 원피스카드 스포츠카드 홀로라이브카드"(브라우저 렌더)'),
      src('https://x.com/urara_hwagok/status/2093682207462469944', ['works']),
      src('https://x.com/urara_hwagok/status/2093682120594280887', ['works']),
      src('https://x.com/urara_hwagok/status/2093681994169491858', ['works']),
      src('http://medicalmap.co.kr/web/desk/biz/view.php?KCODE=1&sigun=6110000&gugun=3150000&bizid=3150000-104-2025-00277', ['addr'], '인허가 정보 "강서구 화곡로 164, 5층 502호" — 카카오 "던킨 화곡역점"·매장 항목 모두 화곡로 164(공식 "던킨건물" 과 일치). 호수는 넣지 않음'),
    ],
    unconfirmed: ['phone', 'room_no', 'parking'], photo: 'needed', notes: '카페(킷사텐) 겸영 — 대표 분류는 굿즈샵. 라라의 스타일기 입고(작품 미등록)',
  },
  {
    action: 'insert', key: 'toygoods-ansan', brand: '토이굿즈', brand_links: [],
    fields: { name: '토이굿즈 안산점', addr: '경기 안산시 단원구 고잔1길 40', floor_info: '1층 110호', cats: ['피규어샵', '굿즈샵', '가챠', '쿠지'], phone: '031-402-6615',
      hours: { mon: { open: '14:00', close: '21:00' }, tue: { open: '13:00', close: '21:00' }, wed: { open: '13:00', close: '21:00' }, thu: { open: '13:00', close: '21:00' },
        fri: { open: '13:00', close: '22:00' }, sat: { open: '13:00', close: '22:00' }, sun: { open: '13:00', close: '21:00' }, yearRound: true },
      shop_link: 'https://www.instagram.com/toygoods_ansan/', sns_links: ['https://www.instagram.com/toygoods_ansan/'],
      description: '안산 중앙동의 애니 캐릭터 굿즈·피규어·가챠 전문 매장으로, 이치방쿠지(제일복권)도 팝니다.\n영업시간은 13:00~21:00(월요일 14:00 오픈, 금·토 22:00 마감)이며 연중무휴입니다(매장 안내).' },
    goods_types: ['figure-new', 'gacha-new', 'ichiban-kuji'],
    works: [],
    sources: [
      src(KUJI, ['name', 'addr', 'floor_info', 'phone', 'hours', 'description'], '이치방쿠지 공식 판매처 목록(매장 등록) "토이굿즈 안산점 | 고잔1길 40 1층 110호 | 031-402-6615 | 애니캐릭터굿즈, 피규어, 가챠 전문 매장 연중무휴 13시~21시 운영(월요일은 14시 오픈, 금토는 22시 마감)"'),
      src('https://www.instagram.com/toygoods_ansan/', ['phone', 'hours', 'shop_link'], '공식 IG 소개(검색 결과 표시) "토이굿즈 애니피규어 이치방쿠지, 031-402-6615, 13:00~21:00·금토 22:00·월 14:00 오픈" — 로그인 벽으로 브라우저 직접 확인 못 함'),
    ],
    unconfirmed: ['works', 'parking', 'instagram_direct'], photo: 'needed', notes: 'IG 로그인 벽 — 입고 게시물 원문 확인 못 해 작품 연결 없음. 카카오 "토이굿즈" 고잔1길 40',
  },
  {
    action: 'insert', key: 'isekai-figure-cheonan', brand: '이세계피규어', brand_links: [],
    fields: { name: '이세계피규어', addr: '충남 천안시 서북구 두정상가1길 27', floor_info: '프라지움1차 2층', cats: ['피규어샵', '쿠지', '가챠'], phone: '041-556-0999',
      hours: H({ open: '12:00', close: '22:00' }, { open: '12:00', close: '22:00' }, { yearRound: true }),
      shop_link: 'https://www.instagram.com/isk_figures/', sns_links: ['https://www.instagram.com/isk_figures/'],
      description: '천안 두정동의 피규어 매장으로, 피규어와 제일복권(이치방쿠지), 가챠를 팝니다.\n영업시간은 매일 12:00~22:00, 연중무휴입니다(매장 안내).' },
    goods_types: ['figure-new', 'ichiban-kuji', 'gacha-new'],
    works: [],
    sources: [
      src(KUJI, ['name', 'addr', 'floor_info', 'phone', 'hours'], '이치방쿠지 공식 판매처 목록(매장 등록) "이세계피규어 | 두정상가1길 27 프라지움1차 2층 | 041-556-0999 | 매주 12시~22시 연중 무휴"'),
      src('https://www.instagram.com/isk_figures/', ['shop_link', 'description'], '공식 IG "천안 이세계 피규어 l 제일복권 l 피규어 l 천안두정동"(검색 결과 표시) — 로그인 벽으로 브라우저 직접 확인 못 함'),
    ],
    unconfirmed: ['works', 'parking', 'instagram_direct'], photo: 'needed', notes: '카카오 "이세계피규어" 두정상가1길 27 일치. 작품 근거 없음',
  },
]
writeFileSync('scripts/shops/plans/2026-09-28-n.json', JSON.stringify({ name: '2026-09-28-n', items }, null, 1))
console.log(items.length)
