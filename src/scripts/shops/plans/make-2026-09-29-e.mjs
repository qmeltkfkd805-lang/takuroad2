// 2026-09-29 6차 신규 5곳 plan 생성 — node scripts/shops/plans/make-2026-09-29-e.mjs
import { writeFileSync } from 'fs'
const H = (o, c) => ({ open: o, close: c })
const all = (o, c) => Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, H(o, c)]))
const C = '2026-09-29'
const IPARK = '045ed3e4-9d81-4f68-a4c7-e6815f0ccadc'
const IPARKNOTE = '주차 가능(유료)\n기본요금 10분당 1,500원\n무료 회차 없음\n당일 영수증 할인은 최대 5시간까지 적용'
const IPARKSRC = { url: 'https://www.iparkmall.co.kr/main/parking.do', fields: ['parking', 'parking_note', 'place_id'], checked_at: C, note: '아이파크몰 용산점 place(045ed3e4) 공식 주차 노트 그대로 복사(2026-09-26 등록분)' }
const SONGDO = '4958a1f1-12c9-46b3-8d86-bd18a0026e82'
const SONGDONOTE = '주차 가능\n평일(주중) 무료 개방\n주말·공휴일 구매 시 무료: 1만원 이상 3시간 · 10만원 이상 5시간\n무료 시간 이후 10분당 1,000원'
const nin = '7bd35887-9d63-4591-a390-7d75e9fe8bd7', marvel = '1c5747ab-d917-494a-88c1-a21b9d1d931b', banpresto = 'c35ab6b9-2db9-4de6-bb27-a4a88064acce'
const op = 'c80c180f-4b11-4a6b-8a7f-ec4b412ecf42', gintama = 'cdc27204-c7f8-4f28-a4a7-fb7e8b7fc1b7', frieren = 'fb8c03af-9bdc-4fb2-8fef-8d9a7792873c'
const dandadan = '82faacc1-27fc-4300-949a-f7742791e6b1', hxh = 'c0abe340-8f54-4c4d-b9e5-13dbb1ed7a47', kiki = 'e3e443ac-c28e-48db-9037-f604abc352c2'
const DW = 'https://www.popcondplay.com/ip/store/4'
const ninEv = 'popcondplay 닌텐도(Nintendo Switch 2) IP 매장 목록 "닌텐도의 게임 및 악세서리/캐릭터 상품까지 다양한 닌텐도 상품을 오프라인 대원샵에서" — 사이트 관행(닌텐도→게임) 작품 행 재사용'
const BPNEWS = 'https://www.popcondplay.com/ip/news/21'
const bp = (tag, what) => ({ tag_id: tag, evidence: `반프레스토 공식 소식(popcondplay ip/news/21, 2026-05) 추천상품 ${what} — "반프레스토 플래그쉽 스토어에서 만나요"` })

const items = [
  {
    action: 'insert', key: 'daewonshop-songdo', brand: '대원샵', brand_links: ['https://www.instagram.com/daewon_game/', DW],
    fields: {
      name: '대원샵 현대프리미엄아울렛 송도점', addr: '인천 연수구 송도국제대로 123', floor_info: '현대프리미엄아울렛 송도점 지하 1층', cats: ['게임샵', '굿즈샵'], phone: '0507-1472-2454',
      hours: all('10:30', '21:00'), shop_link: 'https://www.instagram.com/daewonshop_songdo/',
      sns_links: ['https://www.instagram.com/daewonshop_songdo/', DW],
      place_id: SONGDO, parking: true, parking_note: SONGDONOTE,
      description: '닌텐도 게임·액세서리와 캐릭터 상품을 파는 대원샵 매장으로, 현대프리미엄아울렛 송도점 지하 1층에 있습니다. 인천1호선 테크노파크역 2번 출구와 연결됩니다.\n영업시간은 10:30~21:00입니다(공식 매장 안내). 아울렛 휴점일은 현대프리미엄아울렛 공지를 확인하세요.',
    },
    goods_types: [], add_custom_goods: ['비디오게임', '게임기·게임 액세서리'],
    works: [{ tag_id: nin, evidence: ninEv, primary: true }],
    sources: [
      { url: DW, fields: ['name', 'addr', 'floor_info', 'phone', 'hours', 'cats', 'works', 'add_custom_goods', 'sns_links'], checked_at: C, note: '"대원샵 현대프리미엄아울렛 송도점 | 10:30~21:00 | 인천 연수구 송도국제대로 123 현대프리미엄아울렛 지하 1층 | 0507-1472-2454 | 테크노파크역 2번 출구에서 617m | 주차가능 | IG daewonshop_songdo"' },
      { url: 'https://www.ehyundai.com/newPortal/DP/WC/WC000000_V.do?branchCd=B00174000', fields: ['parking', 'parking_note', 'place_id'], checked_at: C, note: '현대프리미엄아울렛 송도점 위치/주차(브라우저 렌더): 상품금액별 무료 주차 — 주말 및 공휴일(*주중 무료개방) 1만원 이상 3시간·10만원 이상 5시간, 이후 10분당 1,000원. 테크노파크역 2번출구 바로 연결' },
    ],
    unconfirmed: ['closed_days'], photo: 'needed',
    notes: '새 place 현대프리미엄아울렛 송도점(4958a1f1, ensurePlaces-2026-09-29-e.mjs). 대원샵 더현대 대구점과 같은 방식(닌텐도, custom_goods 2). 피규어 공식 표기 없음 → figure-new 안 넣음',
  },
  {
    action: 'insert', key: 'daewonshop-yongsan', brand: '대원샵', brand_links: ['https://www.instagram.com/daewon_game/', DW],
    fields: {
      name: '대원샵 용산 아이파크몰점', addr: '서울 용산구 한강대로23길 55', floor_info: '아이파크몰 리빙파크 3층 도파민스테이션', cats: ['게임샵', '굿즈샵'], phone: '02-2012-3406',
      hours: all('10:30', '22:00'), shop_link: 'https://www.instagram.com/daewonshop_yongsan/',
      sns_links: ['https://www.instagram.com/daewonshop_yongsan/', DW],
      place_id: IPARK, parking: true, parking_note: IPARKNOTE,
      description: '닌텐도 게임·액세서리와 캐릭터 상품을 파는 대원샵 매장으로, 용산 아이파크몰 리빙파크 3층 도파민스테이션 안에 있습니다. 용산역 1번 출구에서 가깝습니다.\n영업시간은 10:30~22:00입니다(공식 매장 안내).',
    },
    goods_types: [], add_custom_goods: ['비디오게임', '게임기·게임 액세서리'],
    works: [{ tag_id: nin, evidence: ninEv, primary: true }],
    sources: [
      { url: DW, fields: ['name', 'addr', 'floor_info', 'phone', 'hours', 'cats', 'works', 'add_custom_goods', 'sns_links'], checked_at: C, note: '"대원샵 용산 아이파크몰점 | 10:30~22:00 | 서울 용산구 한강대로23길 55 아이파크몰 리빙파크 3층 도파민스테이션 | 02-2012-3406 | 용산역 1번 출구에서 100m | 주차가능 | IG daewonshop_yongsan"' },
      IPARKSRC,
    ],
    unconfirmed: ['closed_days'], photo: 'needed',
    notes: 'place 아이파크몰 용산점 주차 노트 복사. 같은 도파민스테이션의 치이카와샵·이치방쿠지 용산점·반프레스토 용산점과는 다른 매장(별도 행)',
  },
  {
    action: 'insert', key: 'banpresto-yongsan', brand: '반프레스토', brand_links: ['https://www.popcondplay.com/ip/store/21'],
    fields: {
      name: '반프레스토 용산점', addr: '서울 용산구 한강대로23길 55', floor_info: '아이파크몰 리빙파크 3층 도파민스테이션', cats: ['피규어샵', '굿즈샵'], phone: '02-2012-3041',
      hours: all('10:30', '22:00'), shop_link: 'https://www.popcondplay.com/ip/store/21',
      sns_links: ['https://www.popcondplay.com/ip/store/21'],
      place_id: IPARK, parking: true, parking_note: IPARKNOTE,
      description: '국내 최초 반프레스토 플래그십 스토어로, 용산 아이파크몰 리빙파크 3층 도파민스테이션 안에 있습니다. 원피스·은혼·장송의 프리렌·단다단 등 여러 작품의 반프레스토 피규어를 판매하고 월별 신상품이 입고됩니다.\n영업시간은 10:30~22:00입니다(공식 매장 안내).',
    },
    goods_types: ['figure-new'],
    works: [
      { tag_id: banpresto, evidence: '공식 매장명 "반프레스토 플래그십 스토어"(popcondplay ip/store/21) — 기존 작품 행 반프레스토 재사용', primary: true },
      bp(op, '「원피스 BATTLE RECORD COLLECTION」 골 D. 로저 & 몽키 D. 가프(05-14)'),
      bp(gintama, '「은혼 극장판 요시와라 염상편」 VIBRATION STARS 카구라&카무이(05-13)'),
      bp(frieren, '「장송의 프리렌 MAXIMATIC」 프리렌(05-11)'),
      bp(dandadan, '「단다단 Grandista」 오카룽(05-10)'),
      bp(hxh, '「헌터×헌터」 곤 프릭스(05-06)'),
    ],
    sources: [
      { url: 'https://www.popcondplay.com/ip/store/21', fields: ['name', 'addr', 'floor_info', 'phone', 'hours', 'cats'], checked_at: C, note: '대원 팝콘디플레이 반프레스토 "국내 최초 반프레스토 플래그십 스토어" 매장: "반프레스토 용산점 | 10:30~22:00 | 서울 용산구 한강대로23길 55 아이파크몰 리빙파크 3층 도파민스테이션 | 02-2012-3041"' },
      { url: BPNEWS, fields: ['works', 'goods_types', 'description'], checked_at: C, note: '반프레스토 공식 소식: 2026-05 "[반프레스토][추천상품] …반프레스토 플래그쉽 스토어에서 만나요" 원피스·은혼·프리렌·단다단·헌터×헌터 피규어, 05-08 "5월 신상 1차 라인업… 5월9일 입고". (08-21~09-10 치비구루미 팝업은 AK PLAZA 홍대 — 이 매장 아님, 연결 안 함)' },
      IPARKSRC,
    ],
    unconfirmed: ['closed_days', 'sns'], photo: 'needed',
    notes: '매장 전용 SNS 링크는 공식 페이지에 없음 → popcondplay 매장 페이지를 shop_link 로. 작품은 이 매장("플래그쉽 스토어") 추천상품 공지 기준',
  },
  {
    action: 'insert', key: 'marvel-collection-yongsan', brand: '마블컬렉션', brand_links: ['https://www.popcondplay.com/ip/store/20'],
    fields: {
      name: '마블컬렉션 용산점', addr: '서울 용산구 한강대로23길 55', floor_info: '아이파크몰 리빙파크 6층 팝콘D스퀘어', cats: ['굿즈샵', '피규어샵'], phone: '02-6373-3370',
      hours: { mon: H('10:30', '20:30'), tue: H('10:30', '20:30'), wed: H('10:30', '20:30'), thu: H('10:30', '20:30'), fri: H('10:30', '21:00'), sat: H('10:30', '21:00'), sun: H('10:30', '20:30') },
      shop_link: 'https://www.popcondplay.com/ip/store/20', sns_links: ['https://www.popcondplay.com/ip/store/20'],
      place_id: IPARK, parking: true, parking_note: IPARKNOTE,
      description: '공식 마블 전문샵으로, 핫토이를 포함한 스케일 피규어·완구·잡화 등 천여 개 이상의 마블 굿즈를 판매합니다. 용산 아이파크몰 리빙파크 6층 팝콘D스퀘어에 있습니다.\n영업시간은 평일·일요일 10:30~20:30, 금·토·공휴일 10:30~21:00입니다(공식 매장 안내).',
    },
    goods_types: ['figure-new'],
    works: [{ tag_id: marvel, evidence: '공식 마블 전문샵(단일 IP 브랜드 매장 — 브랜드 기준): "아시아 유일의 공식 마블 전문샵으로 핫토이를 포함하여 스케일 피규어/완구/잡화"', primary: true }],
    sources: [{ url: 'https://www.popcondplay.com/ip/store/20', fields: ['name', 'addr', 'floor_info', 'phone', 'hours', 'cats', 'works', 'goods_types', 'description'], checked_at: C, note: '대원 팝콘디플레이 마블컬렉션: "마블컬렉션 용산점 | 평일/일요일 10:30~20:30 금/토/공휴일 10:30~21:00 | 서울 용산구 한강대로23길 55 아이파크몰 리빙파크 6층 팝콘D스퀘어 | 02-6373-3370", 소개 "핫토이를 포함하여 스케일 피규어 / 완구 / 잡화"' }, IPARKSRC],
    unconfirmed: ['closed_days', 'sns'], photo: 'needed',
    notes: '공휴일 21:00 마감은 hours 에 표현 불가 → 설명에. 같은 팝콘D스퀘어의 도토리숲·가챠 스테이션과 다른 매장',
  },
  {
    action: 'insert', key: 'koriko-cafe-yeonnam', brand: '코리코카페', brand_links: ['https://www.instagram.com/cafe_koriko/', 'https://www.popcondplay.com/ip/store/12'],
    fields: {
      name: '코리코카페 연남점', addr: '서울 마포구 성미산로 165-7', cats: ['콜라보카페'], phone: '02-338-8865',
      hours: all('10:00', '19:00'), shop_link: 'https://www.instagram.com/cafe_koriko/',
      sns_links: ['https://www.instagram.com/cafe_koriko/', 'https://www.popcondplay.com/ip/store/12'],
      description: '스튜디오 지브리 공식 "마녀 배달부 키키" 카페입니다. 지지 아이스 아메리카노·키키 리본 무스 케이크 등 작품을 테마로 한 메뉴를 판매합니다. 홍대입구역 3번 출구에서 약 860m.\n영업시간은 10:00~19:00(라스트오더 18:30)입니다(공식 매장 안내).',
    },
    goods_types: [],
    works: [{ tag_id: kiki, evidence: '공식 소개 "스튜디오 지브리 공식 \'마녀배달부 키키\' 카페"(popcondplay ip/store/12)', primary: true }],
    sources: [
      { url: 'https://www.popcondplay.com/ip/store/12', fields: ['name', 'addr', 'phone', 'hours', 'cats', 'works', 'sns_links', 'description'], checked_at: C, note: '"코리코카페 연남점 | 10:00 - 19:00 / 18:30 라스트오더 | 서울 마포구 성미산로 165-7 | 02-338-8865 | 홍대입구역 3번 출구에서 860m", 메뉴 지지 아이스 아메리카노·브런치 파이 세트·키키 리본 무스 케이크, IG cafe_koriko' },
      { url: 'https://daewonmedia.com/board/news-event/138', fields: ['addr'], checked_at: '2026-09-23', note: '대원미디어 보도자료: 성미산로 165-7, 2022-10-14 오픈' },
    ],
    unconfirmed: ['closed_days', 'goods_types'], photo: 'needed',
    notes: '상설 캐릭터 카페(콜라보카페). 단독 건물 — place 없음. 굿즈 판매 여부 공식 텍스트 없음 → 분류 비움. 제주점(구좌읍 비자림로 1199, 09:00~18:00, 064-782-0143)은 다음 후보',
  },
]
writeFileSync(new URL('./2026-09-29-e.json', import.meta.url), JSON.stringify({ name: '2026-09-29-e', items }, null, 1))
console.log('written', items.length)
