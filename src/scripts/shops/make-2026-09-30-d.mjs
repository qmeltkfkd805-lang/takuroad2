// 2026-09-30 4차 plan 생성 — 제이에스 스토어 홍대본점, 라스트원 홍대, 우주가챠 강남점·홍대점·건대점
import { writeFileSync } from 'fs'
const D = '2026-09-30'
const NAME = '2026-09-30-d'
const day = (o, c) => ({ open: o, close: c })
const all = (o, c) => Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((k) => [k, day(o, c)]))
const wk = (wo, wc, eo, ec) => ({ ...all(wo, wc), sat: day(eo, ec), sun: day(eo, ec) })
const src = (url, fields, note) => ({ url, fields, checked_at: D, note })
const GM = (id) => `https://www.gachamap.co.kr/store/${id}`

const JS_IG = 'https://www.instagram.com/jsstore_hongdae/'
const JS_OFF = 'https://www.instagram.com/js_store_official/'
const L1_IG = 'https://www.instagram.com/last1_hongdae/'
const UJ_X = 'https://x.com/wouldyougacha'
const UJ_IG = 'https://www.instagram.com/wouldyougacha/'
const UJ_BIO = '공식 X 프로필(브라우저 비로그인): "강남/홍대/건대 통합계정 / 강남점 신논현역④ · 홍대점 홍대입구역⑦ · 건대점 건대입구역⑤ / 1~9pm (토일12오픈) / 가격,재고문의 메세지 / 매달 신상200종이상입고 / 플미NO 가품NO / 봉은사로2길13 / 와우산로29길66 / 아차산로242", 2017-08 가입, 게시물 7,685 (게시 목록은 비로그인 미표시)'
const ujHours = wk('13:00', '21:00', '12:00', '21:00')
const ujDesc = (area, exit, addr) => `캡슐토이(가챠) 전문점 우주가챠의 ${area} 매장입니다. 매달 신상 가챠를 들여오며, 정품만 취급한다고 안내하고 있습니다.\n평일 13:00~21:00 · 토·일 12:00~21:00(공식 X 안내). 가격·재고 문의는 공식 X 메시지로 받습니다.\n${exit} · ${addr}. 우주가챠 강남점·홍대점·건대점은 같은 브랜드(통합 계정)입니다.`

const items = [
  {
    action: 'insert', key: 'jsstore-hongdae', photo: 'needed', brand: '제이에스 스토어', brand_links: [JS_IG, JS_OFF],
    fields: {
      name: '제이에스 스토어 홍대본점', addr: '서울 마포구 와우산로29길 48-24', floor_info: '1층',
      cats: ['피규어샵', '굿즈샵', '쿠지'], shop_link: JS_IG, sns_links: [JS_IG, JS_OFF], phone: '02-337-3338',
      hours: { ...all('12:00', '21:00'), yearRound: true },
      description: '피규어·이치방쿠지(제일복권)를 파는 제이에스 스토어의 홍대 본점입니다.\n연중무휴 12:00~21:00(결제 마감 20:45, 공식 인스타그램 안내).\n마포구 와우산로29길 48-24 1층.',
    },
    goods_types: ['figure-new', 'ichiban-kuji'],
    works: [],
    link_events: [],
    sources: [
      src(JS_IG, ['name', 'addr', 'floor_info', 'hours', 'phone', 'cats', 'description', 'goods_types'], '공식 인스타그램 프로필(브라우저 비로그인): "제이에스 스토어 홍대본점 / 연중무휴 OPEN 12:00 ~ CLOSE 21:00 (결제마감 20:45) / 마포구 와우산로29길 48-24 1층 / Tel. 02)-337-3338 / 피규어·제일복권 소식 & 덕후 콘텐츠 → instagram.com/js_store_official / 스마트 스토어 / 찾아오시는 길", 팔로워 5,250'),
      src(GM('e2d96aca-6156-4c32-856d-95f0826a4c35'), [], '발견용(가챠맵 홍대 목록, 같은 주소·전화)'),
    ],
    unconfirmed: ['works(게시물 비로그인 미표시)', 'recent_post'],
    notes: '브랜드 계정 js_store_official — 다른 지점 존재 여부 미확인',
  },
  {
    action: 'insert', key: 'lastone-hongdae', photo: 'needed', brand: '라스트원', brand_links: [L1_IG],
    fields: {
      name: '라스트원 홍대점', addr: '서울 마포구 와우산로29길 37', floor_info: '2층',
      cats: ['가챠', '피규어샵', '쿠지', '굿즈샵'], shop_link: L1_IG, sns_links: [L1_IG],
      hours: { ...all('13:00', '20:30'), tue: null },
      description: '가챠·피규어·쿠지와 소품을 파는 홍대 매장 라스트원입니다.\n13:00~20:30, 매주 화요일 정기휴무(공식 인스타그램 안내). 문의는 인스타그램 DM(팔로우 후 가능).\n마포구 와우산로29길 37 2층. 자매 매장으로 합정의 퍼스트원이 있습니다.',
    },
    goods_types: ['gacha-new', 'figure-new', 'ichiban-kuji'],
    works: [],
    link_events: [],
    sources: [
      src(L1_IG, ['name', 'addr', 'floor_info', 'hours', 'cats', 'description', 'goods_types'], '공식 인스타그램 프로필(브라우저 비로그인): 표시명 "라스트원 홍대 | 홍대가챠샵, 홍대피규어, 홍대쿠지샵, 홍대소품샵, 홍대고전소품샵, 홍대카페" / "13:00-20:30 / 매주 화요일 정기휴무 / 서울 마포구 와우산로29길 37 2층 / 자매샵 : 퍼스트원 합정(서교동400-2)", 팔로워 2,716'),
      src(GM('0d9029ff-1e13-4e41-a2b2-50984753e1cf'), [], '발견용(가챠맵 홍대 목록, 같은 주소)'),
    ],
    unconfirmed: ['phone(가챠맵 0507 번호는 공식 미표기)', 'works', 'recent_post'],
    notes: '표시명에 "홍대카페" 가 있으나 카페 운영 공식 설명 없음 → 음식점/카페 카테고리 안 넣음. 자매샵 퍼스트원 합정(서교동 400-2)은 다음 후보',
  },
  {
    action: 'insert', key: 'woojugacha-gangnam', photo: 'needed', brand: '우주가챠', brand_links: [UJ_X],
    fields: {
      name: '우주가챠 강남점', addr: '서울 강남구 봉은사로2길 13',
      cats: ['가챠'], shop_link: UJ_X, sns_links: [UJ_X, UJ_IG],
      hours: ujHours,
      description: ujDesc('강남(신논현역)', '신논현역 4번 출구', '강남구 봉은사로2길 13'),
    },
    goods_types: ['gacha-new'],
    works: [], link_events: [],
    sources: [src(UJ_X, ['name', 'addr', 'hours', 'cats', 'description'], UJ_BIO)],
    unconfirmed: ['floor_info', 'phone', 'closed_days', 'recent_post'],
    notes: '같은 브랜드 다른 건물 3곳 → 지점별 행',
  },
  {
    action: 'insert', key: 'woojugacha-hongdae', photo: 'needed', brand: '우주가챠', brand_links: [UJ_X],
    fields: {
      name: '우주가챠 홍대점', addr: '서울 마포구 와우산로29길 66',
      cats: ['가챠'], shop_link: UJ_X, sns_links: [UJ_X, UJ_IG],
      hours: ujHours,
      description: ujDesc('홍대', '홍대입구역 7번 출구', '마포구 와우산로29길 66'),
    },
    goods_types: ['gacha-new'],
    works: [], link_events: [],
    sources: [src(UJ_X, ['name', 'addr', 'hours', 'cats', 'description'], UJ_BIO), src(GM('1592f81e-c9e1-4424-a6bf-db2ef23b0c92'), [], '발견용(가챠맵 홍대 목록, 같은 주소)')],
    unconfirmed: ['floor_info', 'phone', 'closed_days', 'recent_post'],
    notes: '',
  },
  {
    action: 'insert', key: 'woojugacha-kondae', photo: 'needed', brand: '우주가챠', brand_links: [UJ_X],
    fields: {
      name: '우주가챠 건대점', addr: '서울 광진구 아차산로 242',
      cats: ['가챠'], shop_link: UJ_X, sns_links: [UJ_X, UJ_IG],
      hours: ujHours,
      description: ujDesc('건대', '건대입구역 5번 출구', '광진구 아차산로 242'),
    },
    goods_types: ['gacha-new'],
    works: [], link_events: [],
    sources: [src(UJ_X, ['name', 'addr', 'hours', 'cats', 'description'], UJ_BIO), src(GM('57580a7e-2d1e-4e7c-bc1d-d51addb51452'), [], '발견용(가챠맵 성수·건대 목록 — 2층·0507-1377-9825·가챠 97종·쿠지 47종 표기, 공식 대조 전 층·전화·쿠지 안 넣음)')],
    unconfirmed: ['floor_info(가챠맵 2층)', 'phone', 'closed_days', 'ichiban-kuji(가챠맵만)', 'recent_post'],
    notes: '',
  },
]
writeFileSync(`scripts/shops/plans/${NAME}.json`, JSON.stringify({ name: NAME, items }, null, 1))
console.log('wrote', NAME, items.length)
