import { writeFileSync } from 'node:fs'
const D = '2026-09-28'
const KUJI = 'https://ichibankuji.kr/shop'
const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const H = (wk, we, extra = {}) => ({ ...Object.fromEntries(days.map((d, i) => [d, i < 5 ? wk : we])), ...extra })
const T = {
  nikke: '63f2a778-7dca-469d-a2c1-8b139d82637f', tensura: 'bfaaebb3-0123-4cfd-ad52-6b0dec5c87f3',
  onepiece: 'c80c180f-4b11-4a6b-8a7f-ec4b412ecf42', sanrio: 'f6dff3d1-5a30-409d-849c-9a34d111b1be',
  mha: 'b6a65af7-85e0-4390-9986-6057487c19d1', gundam: '98516d1a-f883-4cb0-95f8-e588dc3c5da7',
  onepunch: '1b11603b-608b-4470-b628-569bf12321da', yamada: '7c30f569-398b-4b91-9d12-6792453861af',
  miku: '94dea875-614e-4e2d-ba30-ea509385603b', baki: '42a62851-c7ae-4ad3-a611-536723dae6ad',
}
const src = (url, fields, note) => ({ url, fields, checked_at: D, ...(note ? { note } : {}) })

const items = [
  {
    action: 'insert', key: 'hiddentoy-daegu', brand: '히든토이', brand_links: ['https://hiddentoy.com'],
    fields: { name: '히든토이 대구본점', addr: '대구 중구 동성로 23-1', cats: ['가챠', '쿠지', '굿즈샵'], phone: '010-5759-6664',
      shop_link: 'https://pf.kakao.com/_rxfxcvT', sns_links: ['https://pf.kakao.com/_rxfxcvT', 'https://band.us/@likehyeon', 'https://www.instagram.com/hidden_toy/', 'https://x.com/hidden_toy', 'https://blog.naver.com/hiddentoy'],
      description: '"전국 최대 규모 가챠샵"을 내건 대구 동성로의 가챠 전문점으로, 캡슐토이(가챠)와 제일복권(이치방쿠지)을 팝니다. 동성로에서 본점 외에 별관·2호점도 운영하며, 매장별 가챠 입고 현황은 공식 밴드·블로그에 올라옵니다.\n공식 채널 공지 기준 연중무휴입니다. 영업시간은 공식 채널 표기가 서로 달라 방문 전 카카오톡 채널로 확인해 주세요.' },
    goods_types: ['gacha-new', 'ichiban-kuji'],
    works: [
      { tag_id: T.gundam, evidence: '공식 밴드 2026-09-25 "히든토이 본점" 신상 입고 — 하비재팬 건담 웨폰즈+SD건담 가챠' },
    ],
    sources: [
      src('https://pf.kakao.com/_rxfxcvT', ['name', 'addr', 'description', 'shop_link'], '공식 카카오톡 채널 "전국 최대 규모 가챠샵 히든토이 대구 본점", 매장 주소 대구 중구 동성로 23-1, 공지 "매장 주소: 동성로 23-1 (본점), 영업시간: 연중 무휴. 오전 9시~오전 1시" ↔ 채널 운영시간 10:00~24:00 (불일치 → hours 비움) (브라우저 렌더)'),
      src('https://band.us/@likehyeon', ['works', 'goods_types', 'description'], '공식 밴드(리더 히든토이 대구본점) 2026-09-17~26 본점·본점(별관)·2호점 입고 게시(브라우저 렌더)'),
      src(KUJI, ['phone', 'goods_types'], '이치방쿠지 공식 판매처 목록 "히든토이 본점 | 대구 중구 동성로6길 43 B1 | 010-5759-6664 | 제일복권 가챠 전문소품샵 / 스파크랜드 옆 AWESOME 옷가게 건물" — 주소는 공식 채널(동성로 23-1)과 다름(별관·2호점일 가능성) → 공식 채널 주소 사용'),
    ],
    unconfirmed: ['hours', 'floor_info', 'annex_2nd_store_location', 'parking'], photo: 'needed',
    notes: '카카오맵 "히든토이" 동성로 23-1 일치. 별관·2호점 위치(동성로6길 43 B1 등) 공식 확인되면 같은 건물이면 설명 줄, 다른 건물이면 판단. 단독 건물 — place 없음',
  },
  {
    action: 'insert', key: 'hiddentoy-ilsan', brand: '히든토이', brand_links: [],
    fields: { name: '히든토이 일산점', addr: '경기 고양시 덕양구 화중로 98', floor_info: '지하 1층', cats: ['가챠', '쿠지', '굿즈샵'], phone: '010-6274-3475',
      hours: H({ open: '14:00', close: '21:00' }, { open: '14:00', close: '21:00' }, { tue: null }),
      shop_link: 'https://x.com/hiddentoy_ilsan', sns_links: ['https://x.com/hiddentoy_ilsan', 'https://pf.kakao.com/_zduSK', 'https://band.us/n/afa95aYdodwbw'],
      description: '제일복권(이치방쿠지)과 가챠 전문점으로, 산리오 소품도 함께 팝니다. 화정역 3번 출구에서 걸어갈 수 있는 건물 지하 1층에 있습니다.\n영업시간은 14:00~21:00, 화요일 휴무입니다(공식 계정 안내). 구매·문의는 카카오톡 채널로 받습니다.' },
    goods_types: ['ichiban-kuji', 'gacha-new'],
    works: [
      { tag_id: T.nikke, evidence: '공식 X 2026-03-18 승리의 여신: 니케 챕터6 제일복권 입고' },
      { tag_id: T.tensura, evidence: '공식 X 2026-03-16 전생슬 극장판 창해의 눈물 가챠 입고' },
      { tag_id: T.onepiece, evidence: '공식 X 2026-03-06 원피스 악마를 품은 자들 3탄 제일복권 입고' },
      { tag_id: T.sanrio, evidence: '공식 X 2026-02-04 산리오 캔 가챠 입고 + 프로필 "산리오 소품"' },
    ],
    sources: [
      src('https://x.com/hiddentoy_ilsan', ['name', 'addr', 'floor_info', 'hours', 'description', 'goods_types'], 'X 프로필 "{제일복권}{가챠} 전문, 산리오 소품까지, 영업시간 14:00~21:00(휴무-화), 경기도 고양시 덕양구 화정동 968-3 지하 1층"(브라우저 렌더)'),
      src('https://x.com/hiddentoy_ilsan/status/2034146926208422200', ['works']),
      src('https://x.com/hiddentoy_ilsan/status/2033404130774192477', ['works']),
      src('https://x.com/hiddentoy_ilsan/status/2029817100936827217', ['works']),
      src('https://x.com/hiddentoy_ilsan/status/2018928447364763798', ['works']),
      src(KUJI, ['addr', 'phone'], '이치방쿠지 공식 판매처 목록 "히든토이 일산점 | 고양 덕양구 화중로 98 B1 | 010-6274-3475 | 화정역 3번출구 … 지하 1층" — 카카오 "히든토이 일산점" 화중로 98 일치'),
    ],
    unconfirmed: ['parking'], photo: 'needed', notes: '이름은 일산점이나 위치는 덕양구 화정동. 마지막 확인 게시 2026-03 + 판매처 목록 등재',
  },
  {
    action: 'insert', key: 'parkseobang-daejeon', brand: '박서방', brand_links: ['https://litt.ly/psb0083', 'https://sgtherong2.godomall.com/'],
    fields: { name: '박서방 대전본점', addr: '대전 서구 계룡로 616', floor_info: '오렌지타운 3층', cats: ['프라모델', '피규어샵', '쿠지', '서점'], phone: '042-537-0083',
      hours: { mon: { open: '10:30', close: '19:00' }, tue: null, wed: { open: '10:30', close: '19:00' }, thu: { open: '10:30', close: '19:00' },
        fri: { open: '10:30', close: '19:00' }, sat: { open: '10:30', close: '19:00' }, sun: { open: '12:00', close: '19:00' } },
      shop_link: 'https://litt.ly/psb0083', sns_links: ['https://x.com/park_seobang', 'https://www.instagram.com/parkseobang.lnc/', 'https://blog.naver.com/psb0083', 'https://smartstore.naver.com/psbgundam'],
      description: '대전에서 30년 된 하비샵으로, 건프라 등 프라모델과 도색 도료·공구, 피규어, 제일복권(이치방쿠지), 굿즈, 만화책·소설책을 팝니다. 성심당 롯데점에서 1분 거리 오렌지타운 3층에 있습니다.\n영업시간은 10:30~19:00(일요일 12:00 오픈), 화요일 정기휴무입니다(공식 계정 안내).' },
    goods_types: ['plamodel-new', 'figure-new', 'ichiban-kuji', 'manga'],
    works: [
      { tag_id: T.mha, evidence: '공식 X 2026-09-25 나의 히어로 아카데미아 반프레스토 피규어·만화책·캐릭터북 판매 중' },
      { tag_id: T.nikke, evidence: '공식 X 2026-09-24 굿스마일 승리의 여신 니케 1/7 모더니아 피규어 입고' },
      { tag_id: T.gundam, evidence: '공식 X 2026-09-24 제일복권 기동전사 건담 지쿠악스 Vol.2 + 프로필 건프라' },
    ],
    sources: [
      src('https://x.com/park_seobang', ['name', 'addr', 'floor_info', 'hours', 'phone', 'description'], 'X 프로필 "대전 30년 전통 하비샵, 위치: 대전 서구 계룡로 616 오렌지타운 3층 (성심당 롯데점 1분거리), 영업시간 10:30~19:00 (화요일 정기휴무) *일요일 OPEN 12:00*, 042-537-0083" + 2026-09-25 정상 영업 공지(브라우저 렌더)'),
      src('https://litt.ly/psb0083', ['goods_types', 'description', 'hours'], '공식 링크 페이지 "제일복권, 피규어, 굿즈, 만화책, 소설책, 프라모델, 도색 도료&재료 … 매 주 일요일 OPEN 12:00~19:00, 지점(제주점, 동탄점) 영업중"'),
      src('https://x.com/park_seobang/status/2103339783246504014', ['works']),
      src('https://x.com/park_seobang/status/2102984619847201080', ['works']),
      src('https://x.com/park_seobang/status/2102980947985772574', ['works']),
    ],
    unconfirmed: ['parking'], photo: 'needed', notes: '카카오 "박서방 대전본점" 계룡로 616 일치. 오렌지타운은 상가 건물이나 카카오 건물 항목 없음 — place 없음',
  },
  {
    action: 'insert', key: 'parkseobang-jeju', brand: '박서방', brand_links: ['https://litt.ly/psb0083'],
    fields: { name: '박서방 제주지점', addr: '제주특별자치도 제주시 월랑로 59', floor_info: '4층', cats: ['프라모델', '피규어샵', '쿠지', '서점'], phone: '064-742-0083',
      hours: H({ open: '10:30', close: '19:30' }, { open: '10:30', close: '20:30' }, { yearRound: true }),
      shop_link: 'https://litt.ly/psb_jeju', sns_links: ['https://x.com/psbjeju', 'https://litt.ly/psb_jeju'],
      description: '제주 노형동의 복합 하비샵으로, 이치방쿠지(제일복권)·피규어·건프라와 도색용품·조립 도구, 애니 굿즈, 만화책·라이트노벨·일본 잡지와 원서를 팝니다. 중고 위탁 판매도 합니다.\n영업시간은 평일 10:30~19:30, 주말 10:30~20:30이며 연중무휴입니다(공식 계정 안내).' },
    goods_types: ['plamodel-new', 'figure-new', 'ichiban-kuji', 'manga', 'light-novel'],
    works: [
      { tag_id: T.yamada, evidence: '공식 X 2026-09-28 야마다 군과 Lv999의 사랑을 하다 8권 입고' },
      { tag_id: T.onepunch, evidence: '공식 X 2026-09-28 원펀맨 35권 입고' },
      { tag_id: T.miku, evidence: '공식 X 2026-09-28 넨도로이드 하츠네 미쿠 MIKU WITH YOU 2025 Ver. 입고' },
      { tag_id: T.baki, evidence: '공식 X 2026-09-28 바키도 Luminasta 한마 바키 피규어 입고' },
    ],
    sources: [
      src('https://x.com/psbjeju', ['name', 'addr', 'floor_info', 'hours', 'description'], 'X 프로필 "제주 노형동 하비샵 · 이치방쿠지 / 피규어 / 건프라 / 만화책, 평일 10:30-19:30 (주말 20:30) 연중무휴, 대한민국 제주시 월랑로 59 4층" + 고정 게시물(2026-07-25) 같은 내용(브라우저 렌더)'),
      src('https://litt.ly/psb_jeju', ['phone', 'goods_types', 'description'], '공식 링크 페이지 "애니굿즈, 만화책, 라노벨, 일본잡지, 일본원서, 프라모델, 건프라, 도색용품, 프라모델조립도구, 중고위탁 판매 … 문의전화 064-742-0083"'),
      src('https://x.com/psbjeju/status/2104504185194704970', ['works']),
      src('https://x.com/psbjeju/status/2104504134045171718', ['works']),
      src('https://x.com/psbjeju/status/2104504032832471290', ['works']),
      src('https://x.com/psbjeju/status/2104499869071364502', ['works']),
    ],
    unconfirmed: ['parking'], photo: 'needed', notes: '이치방쿠지 판매처 목록의 "다랑곶1길 노형타워 3층" 은 옛 위치로 보임 — 공식 X 현재 표기(월랑로 59 4층) 사용. 10-16~21 탐라문화제 "메이커앤하비" 참가는 단기 행사라 등록 안 함. 공식 블로그·인스타 링크 URL 미확인이라 sns_links 제외',
  },
  {
    action: 'insert', key: 'parkseobang-dongtan', brand: '박서방', brand_links: ['https://litt.ly/psb0083'],
    fields: { name: '박서방 동탄점', addr: '경기 화성시 동탄구 동탄대로5길 21', floor_info: '라크몽 A동 4층 E410호', cats: ['프라모델', '쿠지'], phone: '070-4833-0083',
      shop_link: 'https://www.instagram.com/psbdongtan/', sns_links: ['https://www.instagram.com/psbdongtan/'],
      description: '대전 하비샵 박서방의 동탄 지점으로, 프라모델과 제일복권(이치방쿠지)을 팝니다. 동탄호수공원 앞 라크몽 A동 4층(디스커버리 옆)에 있습니다.' },
    goods_types: ['plamodel-new', 'ichiban-kuji'],
    works: [],
    sources: [
      src(KUJI, ['name', 'addr', 'floor_info', 'phone', 'description'], '이치방쿠지 공식 판매처 목록 "박서방 동탄점 | 경기 화성시 동탄대로5길 21 A동 4층 E410호 | 070-4833-0083 | 동탄호수공원 앞 라크몽 A동 4층 디스커버리 옆"'),
      src('https://litt.ly/psb0083', ['brand'], '박서방 대전본점 공식 링크 페이지 "지점 (제주점, 동탄점) 영업중"'),
      src('https://www.instagram.com/psbdongtan/', ['shop_link'], '공식 IG "동탄 라크몽 박서방 Dongtan Parkseobang"(검색 결과 표시, 로그인 벽). 소개의 11:00~19:00·화 휴무는 검색 요약뿐이라 hours 비움'),
    ],
    unconfirmed: ['hours', 'instagram_direct', 'parking', 'place_id'], photo: 'needed',
    notes: '카카오 "박서방 동탄점" 동탄대로5길 21 일치. 라크몽은 상가 단지이나 카카오에 건물 자체 항목(복합쇼핑몰·상가) 없음 — place 보류, pending',
  },
]
writeFileSync('scripts/shops/plans/2026-09-28-o.json', JSON.stringify({ name: '2026-09-28-o', items }, null, 1))
console.log(items.length)
