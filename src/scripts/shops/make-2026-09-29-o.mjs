// 2026-09-29 14차 plan 생성 — node scripts/shops/make-2026-09-29-o.mjs
import { writeFile } from 'fs/promises'
const D = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const same = (open, close, extra = {}) => ({ ...Object.fromEntries(D.map((d) => [d, { open, close }])), ...extra })
const IPARK = '045ed3e4-9d81-4f68-a4c7-e6815f0ccadc'
const IPARK_PK = '주차 가능(유료)\n기본요금 10분당 1,500원\n무료 회차 없음\n당일 영수증 할인은 최대 5시간까지 적용'
const SPARK = 'bd1a6fc0-7c55-4768-aca0-6e29f27a3dbf'
const SPARK_PK = '주차 가능(유료)\n기본 30분 2,400원, 이후 10분당 1,000원\n스파크몰 입점 매장 구매 시: 5만원 이상 1시간 무료 · 10만원 이상 2시간\n테마파크 이용·매장 구매 합산 하루 최대 3시간'
const SAMJUNG = '6a3e3e01-c868-4948-b8a6-942678852eeb'
const SAMJUNG_PK = '30분 무료 후 10분당 1,000원\n구매금액 1만원/3만원/5만원/10만원/20만원 이상 시 각각 1/2/3/4/5시간 무료'
const T = {
  oshinoko: '89409350-b9db-4d7d-9e10-c08cbf681f37', yugioh: '3d64da18-2032-46a2-9a39-729f5d94c58d', uma: '4c29cc2f-ff8a-4d40-8298-2d23ea2bbe62',
  sakura: '06c370c8-8630-4370-8db4-7691f6172d6e', jjk: '7fc6cb70-c059-40e3-86a4-39dc28b6b32c', bluearchive: '32995c8f-a09f-4a45-8efc-47a5e3b51e8a',
  berserk: '28713373-b99a-41f5-9f62-19a7bdff99a6', gfl2: '33e038e2-c5f5-4f52-be77-a19f94e16b42', dragonball: 'c7c8efb0-41d2-4935-b0e6-5f9f59b2bc9e',
  kimetsu: 'e3f9dbfd-e491-4433-9af1-6c0b146f5746', stitch: '0b4eaebb-74b7-49f8-b914-5d914c7e16d9', genshin: '49f4d824-0ef6-4926-80ea-8dd5f930000e',
  nikke: '63f2a778-7dca-469d-a2c1-8b139d82637f', haikyu: '2a88af81-4e08-446f-befa-312110884a20',
}
const C = '2026-09-29'
const items = [
  {
    action: 'insert', key: 'kotobukiya-yongsan', photo: 'needed', brand: '코토부키야', brand_links: ['https://x.com/Kotobukiya_BH'],
    fields: {
      name: '코토부키야 아이파크몰 용산', addr: '서울 용산구 한강대로23길 55', floor_info: '아이파크몰 리빙파크 3층 도파민스테이션',
      cats: ['피규어샵', '프라모델', '굿즈샵'], shop_link: 'https://x.com/KOTOBUKIYA_YS', sns_links: ['https://x.com/KOTOBUKIYA_YS', 'https://x.com/Kotobukiya_BH'],
      phone: '02-2012-1316', hours: same('10:30', '22:00'), place_id: IPARK, parking: true, parking_note: IPARK_PK,
      description: '일본 피규어·프라모델 브랜드 코토부키야의 국내 첫 공식 오프라인 매장입니다(2025년 8월 오픈, 정식 수입원 베스트하비 운영). 코토부키야 프라모델·스케일 피규어를 전시·판매합니다.\n매일 10:30~22:00(공식 X 안내). 입고 상품은 공식 X 와 베스트하비 네이버 카페 입고 안내로 공지됩니다.\n아이파크몰 리빙파크 3층 도파민스테이션, 이치방쿠지 매장 옆.',
    },
    goods_types: ['figure-new', 'plamodel-new'],
    works: [
      { tag_id: T.oshinoko, evidence: '공식 X 2026-09-29 매장 추천 상품 PV438 아리마 카나' },
      { tag_id: T.yugioh, evidence: '공식 X 2026-09-29 매장 추천 상품 오시웍스 이시즈 이슈타르' },
      { tag_id: T.uma, evidence: '공식 X 2026-09-28 매장 추천 상품 PV322 토카이 테이오' },
    ],
    link_events: [],
    sources: [
      { url: 'https://x.com/KOTOBUKIYA_YS', fields: ['name', 'floor_info', 'hours', 'phone', 'sns_links', 'works'], checked_at: C, note: '공식 X 프로필(브라우저 비로그인): "아이파크몰 용산점 리빙파크 3F 도파민 스테이션 / 영업시간 : 10:30~22:00 / 문의 : 02-2012-1316", 2026-09-28·29 매장 추천 상품 게시(아리마 카나·이시즈 이슈타르·토카이 테이오·ARTFX 조커)' },
      { url: 'https://www.sisadays.co.kr/news/414001', fields: ['description'], checked_at: C, note: '보도: (주)베스트하비 코토부키야 국내 첫 공식 매장 2025-08-01 오픈, 리빙파크 3층' },
      { url: 'place 045ed3e4 아이파크몰 용산점', fields: ['parking_note'], checked_at: C, note: '기존 place 노트 복사' },
    ],
    unconfirmed: [], notes: '배트맨(ARTFX 조커) 작품 행 없음 — 연결 안 함',
  },
  {
    action: 'insert', key: 'goodsmile-yongsan', photo: 'needed', brand: '굿스마일컴퍼니', brand_links: ['https://x.com/goodsmileinfoBH', 'https://x.com/GoodSmile_KR'],
    fields: {
      name: '굿스마일스토어BH 용산 아이파크몰점', addr: '서울 용산구 한강대로23길 55', floor_info: '아이파크몰 리빙파크 3층 도파민스테이션',
      cats: ['피규어샵', '굿즈샵'], shop_link: 'https://x.com/GoodSmile_YS', sns_links: ['https://x.com/GoodSmile_YS', 'https://x.com/goodsmileinfoBH'],
      phone: '02-2012-1318', hours: same('10:30', '22:00'), place_id: IPARK, parking: true, parking_note: IPARK_PK,
      description: '굿스마일컴퍼니 상품을 판매하는 국내 첫 오프라인 매장입니다(2026년 2월 오픈, 베스트하비 운영). 넨도로이드·MODEROID·스케일 피규어 등을 전시·판매합니다.\n매일 10:30~22:00(공식 X 안내). 인기 상품 입고일에는 아이파크몰 입장 대기줄을 운영하니 공식 X 공지를 확인하세요.\n아이파크몰 리빙파크 3층 도파민스테이션.',
    },
    goods_types: ['figure-new', 'plamodel-new'],
    works: [
      { tag_id: T.jjk, evidence: '공식 X 2026-09-12 매장 입고: 넨도로이드 고죠 사토루·게토 스구루 고전 버전, 주술회전 러버 마스코트' },
      { tag_id: T.bluearchive, evidence: '공식 X 2026-09-12 매장 입고: 넨도로이드 하야세 유우카' },
      { tag_id: T.sakura, evidence: '공식 X 2026-09-19 매장 입고: 넨도로이드 서프라이즈 키노모토 사쿠라 컬렉션' },
    ],
    link_events: [],
    sources: [
      { url: 'https://x.com/GoodSmile_YS', fields: ['name', 'floor_info', 'hours', 'phone', 'sns_links', 'works'], checked_at: C, note: '공식 X 프로필: "아이파크몰 용산점 리빙파크 3F 도파민 스테이션 / 영업시간 : 10:30~22:00 / 문의 : 02-2012-1318", 게시 09-10 대기줄 안내·09-12·09-19 매장 입고(넨도로이드 고죠/게토/유우카/사쿠라, vivit 히이라기 카가미·츠카사)' },
      { url: 'https://m.news.nate.com/view/20260223n31880', fields: ['description'], checked_at: C, note: '보도 2026-02-23: 도파민 스테이션에 굿스마일컴퍼니 국내 첫 정규 매장, 넨도로이드·MODEROID·스케일 피규어' },
      { url: 'place 045ed3e4 아이파크몰 용산점', fields: ['parking_note'], checked_at: C, note: '기존 place 노트 복사' },
    ],
    unconfirmed: [], notes: '러키☆스타(vivit 히이라기 자매) 작품 행 없음 — 연결 안 함',
  },
  {
    action: 'insert', key: 'smg-daegu', photo: 'needed', brand: 'SMG', brand_links: ['https://x.com/smgstore_kr'],
    fields: {
      name: 'SMG굿즈스토어 대구 동성로스파크점', addr: '대구 중구 동성로6길 61', floor_info: '동성로 스파크 3층',
      cats: ['굿즈샵', '쿠지', '피규어샵'], shop_link: 'https://x.com/SMGoods_Daegu', sns_links: ['https://x.com/SMGoods_Daegu'],
      hours: { mon: { open: '12:00', close: '21:00' }, tue: { open: '12:00', close: '21:00' }, wed: { open: '12:00', close: '21:00' }, thu: { open: '12:00', close: '21:00' }, fri: { open: '12:00', close: '21:00' }, sat: { open: '11:00', close: '22:00' }, sun: { open: '11:00', close: '22:00' } },
      place_id: SPARK, parking: true, parking_note: SPARK_PK,
      description: '게임·애니메이션 굿즈 전문점 SMG굿즈스토어의 대구 매장입니다. 신상품과 이치방쿠지(제일복권) 입고 소식을 공식 X 로 알립니다.\n평일 12:00~21:00, 주말·공휴일 11:00~22:00(공식 X 안내). 공휴일이 평일이어도 주말 시간으로 운영합니다.\n동성로 스파크 3층.',
    },
    goods_types: ['figure-new', 'ichiban-kuji', 'can-badge-new', 'keyring'],
    works: [
      { tag_id: T.berserk, evidence: '공식 X 2026-09-29 입고: SD피규어 조드·아크릴 디오라마 가츠&캐스커' },
      { tag_id: T.gfl2, evidence: '공식 X 2026-09-20 입고: 소녀전선2 망명 협동 전투 보급 시리즈(메탈 키캡·캔뱃지·키링 등)' },
      { tag_id: T.dragonball, evidence: '공식 X 2026-08-29 쿠지 입고: 드래곤볼 EX VS 레드 리본 군' },
      { tag_id: T.stitch, evidence: '공식 X 2026-08-29 쿠지 입고: 스티치 Every day with you!' },
      { tag_id: T.kimetsu, evidence: '공식 X 2026-08-28 입고: 오챠토모 시리즈 귀멸의 칼날' },
    ],
    link_events: [],
    sources: [
      { url: 'https://x.com/SMGoods_Daegu', fields: ['name', 'addr', 'floor_info', 'hours', 'sns_links', 'works', 'goods_types'], checked_at: C, note: '공식 X 프로필: "SMG굿즈스토어 대구 동성로 스파크랜드점 / 평일 12:00~21:00 / 주말 및 공휴일 11:00~22:00 / 중구 동성로6길 61 동성로 스파크랜드 3층", 게시 2026-08-28~09-29 입고' },
      { url: 'place bd1a6fc0 동성로 스파크', fields: ['parking_note'], checked_at: C, note: '기존 place 노트 복사(2026-09-28 공식 대조분)' },
    ],
    unconfirmed: ['phone'], notes: '전화 공식 미표기',
  },
  {
    action: 'insert', key: 'smg-busan', photo: 'needed', brand: 'SMG', brand_links: ['https://x.com/smgstore_kr'],
    fields: {
      name: 'SMG굿즈스토어 부산 삼정타워점', addr: '부산 부산진구 중앙대로 672', floor_info: '삼정타워 9층',
      cats: ['굿즈샵'], shop_link: 'https://x.com/SMGoods_Busan', sns_links: ['https://x.com/SMGoods_Busan'],
      hours: same('11:00', '22:00', { fri: { open: '11:00', close: '22:30' }, sat: { open: '11:00', close: '22:30' } }),
      place_id: SAMJUNG, parking: true, parking_note: SAMJUNG_PK,
      description: '게임·애니메이션 굿즈 전문점 SMG굿즈스토어의 부산 매장입니다. 원신·니케·하이큐!!·귀멸의 칼날·베르세르크·드래곤볼 등의 굿즈를 취급합니다(공식 X 소개).\n매일 11:00~22:00, 금·토 22:30까지(공식 X 안내).\n서면 삼정타워 9층.',
    },
    goods_types: ['can-badge-new', 'keyring'],
    works: [
      { tag_id: T.genshin, evidence: '공식 X 프로필 취급 작품 목록' },
      { tag_id: T.nikke, evidence: '공식 X 프로필 취급 작품 목록' },
      { tag_id: T.haikyu, evidence: '공식 X 프로필 취급 작품 목록' },
      { tag_id: T.kimetsu, evidence: '공식 X 프로필 취급 작품 목록' },
      { tag_id: T.berserk, evidence: '공식 X 프로필 취급 작품 목록' },
      { tag_id: T.dragonball, evidence: '공식 X 프로필 취급 작품 목록' },
      { tag_id: T.gfl2, evidence: '공식 X 2026-09-16 입고: 소녀전선2 망명 캔배지·키캡·군번줄 키링 등' },
    ],
    link_events: [],
    sources: [
      { url: 'https://x.com/SMGoods_Busan', fields: ['name', 'addr', 'floor_info', 'hours', 'sns_links', 'works', 'goods_types'], checked_at: C, note: '공식 X 프로필: "SMG굿즈스토어 부산 삼정타워점 / 원신/ 니케/ 하이큐/ 귀멸의 칼날/ 베르세르크/드래곤볼 등 / 영업시간 11:00~22:00(금,토 ~ 22:30) / 부전동 227-2 삼정타워 9층", 2026-09-16 입고 게시(검색 요약의 2층은 프로필과 달라 안 씀)' },
      { url: 'place 6a3e3e01 삼정타워', fields: ['parking_note'], checked_at: C, note: '기존 place 노트 복사' },
    ],
    unconfirmed: ['phone'], notes: '전화 공식 미표기',
  },
  {
    action: 'insert', key: 'asemhobby-electroland', photo: 'needed', brand: '아셈하비',
    fields: {
      name: '아셈하비 전자랜드점', addr: '서울 용산구 청파로 74', floor_info: '용산 전자랜드 본관 4층 A-1호',
      cats: ['프라모델'], shop_link: 'https://www.asemhobby.co.kr/', sns_links: ['https://www.asemhobby.co.kr/', 'https://www.facebook.com/asem.hobby/'],
      phone: '02-701-4293', hours: same('10:00', '19:00', { yearRound: true }), parking: true,
      parking_note: '주차 가능(유료)\n기본 30분 2,500원, 이후 10분당 1,000원\n전자랜드 매장 이용 시 매장에서 주차우대권 수령 — 최대 3시간 무료\n본관 주차장 08:00~22:00(이후 출차만)',
      description: '아카데미과학 용산 총판을 겸하는 프라모델 전문점(아셈하비 더하비샵)의 오프라인 매장입니다. 밀리터리·SF·캐릭터 프라모델과 도료·공구 등 모형 재료를 판매합니다.\n매장 영업 10:00~19:00 연중무휴(공식 사이트 안내, 명절·휴가 휴무는 공지).\n용산 전자랜드 본관 4층.',
    },
    goods_types: ['plamodel-new'], add_custom_goods: ['모형 도료·공구'],
    works: [], link_events: [],
    sources: [
      { url: 'https://www.asemhobby.co.kr/', fields: ['name', 'addr', 'floor_info', 'phone', 'hours', 'goods_types', 'description'], checked_at: C, note: '공식 사이트 하단: "서울시 용산구 청파로 74 전자랜드 본관 4층 A-1호 용산아카데미과학" / "전자랜드점 매장영업 ☎02-701-4293 AM 10:00 - PM 07:00 (연중무휴)", 상품 분류 SF/캐릭터·공구/재료·도료, 공지 2025-07 전자랜드점 휴가 휴무·2026-07 신제품 안내' },
      { url: 'https://www.i-etland.co.kr/store/parking.php', fields: ['parking', 'parking_note'], checked_at: C, note: '용산 전자랜드 공식 주차 안내(브라우저): 기본 2,500원/30분(이후 10분당 1,000원), 매장 이용 고객 주차우대권 최대 3시간 무료, 본관 자주식 08:00~22:00' },
    ],
    unconfirmed: ['place_id'], notes: '카카오에 용산 전자랜드 본관 건물 자체 항목 없음(주차장·입점 매장·신관 빌딩만) → place 미생성, 샵에 건물 공식 주차 노트 직접',
  },
]
await writeFile('scripts/shops/plans/2026-09-29-o.json', JSON.stringify({ name: '2026-09-29-o', items }, null, 1))
console.log('ok', items.length)
