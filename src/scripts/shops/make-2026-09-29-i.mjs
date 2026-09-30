// 8차: PLAY IN THE BOX 공식 매장 목록 5곳 신규
import fs from 'fs'
const OFF = 'https://playinthebox.co.kr/ko/about'
const IG = 'https://www.instagram.com/playinthebox_official/'
const stores = [
  { key: 'pitb-thehyundai', name: 'PLAY IN THE BOX 더현대 서울점', addr: '서울 영등포구 여의대로 108', floor: '더현대 서울 5층', offTxt: '더현대 서울점 — 서울특별시 영등포구 여의대로 108 더현대서울 5F',
    place: '055b4bb1-d3ab-4177-8cd3-e774c1f43bb1', pname: '더현대 서울', purl: 'https://www.ehyundai.com/newPortal/DP/FG/FG000000_V.do?branchCd=B00140000',
    note: '주차 가능(유료)\n최초 30분 무료, 초과 시 10분당 2,000원\n5만원 이상 구매 시 1시간, 10만원 이상 2시간, 15만원 이상 3시간 무료', where: '더현대 서울 5층에 있습니다.' },
  { key: 'pitb-megabox-coex', name: 'PLAY IN THE BOX 메가박스 코엑스점', addr: '서울 강남구 영동대로 513', floor: '코엑스몰 지하 2층 메가박스 코엑스', offTxt: '메가박스 코엑스점 — 서울특별시 강남구 영동대로 513 코엑스 B2F',
    place: '86c742e0-a1fa-42b7-8ee0-0de38b8bdb39', pname: '스타필드 코엑스몰', purl: 'https://www.starfield.co.kr/coexmall/about/parkingInfo.do',
    note: '주차 가능(유료)\n입차 후 20분 이내 출차 시 무료, 15분당 1,500원(1일 최대 60,000원)\n코엑스몰 구매 시: 5만원 이상 1시간 · 10만원 이상 2시간 · 15만원 이상 3시간 무료(일부 매장 제외)\n카카오T 주차 모바일 결제 시 20% 할인', where: '코엑스 지하 2층 메가박스 코엑스에 있습니다.' },
  { key: 'pitb-ipark-yongsan', name: 'PLAY IN THE BOX 용산 아이파크몰점', addr: '서울 용산구 한강대로23길 55', floor: '아이파크몰 리빙파크 3층 도파민스테이션', offTxt: '아이파크몰 용산점 — 서울특별시 용산구 한강대로23길 55 도파민스테이션 3F',
    place: '045ed3e4-9d81-4f68-a4c7-e6815f0ccadc', pname: '아이파크몰 용산점', purl: 'https://www.iparkmall.co.kr/main/parking.do',
    note: '주차 가능(유료)\n기본요금 10분당 1,500원\n무료 회차 없음\n당일 영수증 할인은 최대 5시간까지 적용', where: '용산 아이파크몰 3층 도파민스테이션에 있습니다.' },
  { key: 'pitb-songdo', name: 'PLAY IN THE BOX 현대프리미엄아울렛 송도점', addr: '인천 연수구 송도국제대로 123', floor: '현대프리미엄아울렛 송도점 지하 1층', offTxt: '현대프리미엄아울렛 송도점 — 인천광역시 연수구 송도국제대로 123 현대프리미엄아울렛 송도점 B1F',
    place: '4958a1f1-12c9-46b3-8d86-bd18a0026e82', pname: '현대프리미엄아울렛 송도점', purl: 'https://www.ehyundai.com',
    note: '주차 가능\n평일(주중) 무료 개방\n주말·공휴일 구매 시 무료: 1만원 이상 3시간 · 10만원 이상 5시간\n무료 시간 이후 10분당 1,000원', where: '현대프리미엄아울렛 송도점 지하 1층에 있습니다.' },
  { key: 'pitb-centum', name: 'PLAY IN THE BOX 신세계 센텀시티점', addr: '부산 해운대구 센텀남대로 35', floor: '신세계백화점 센텀시티 7층', offTxt: '신세계센텀 시티점 — 부산광역시 해운대구 센텀남대로 35 7F',
    place: '3a89dba6-6afb-40fa-9a42-9d20aeecafd1', pname: '신세계백화점 센텀시티점', purl: 'https://www.shinsegae.com/store/main.do?storeCd=SC00008',
    note: '주차 가능(유료)\n최초 30분 무료, 이후 10분당 1,000원\n구매 시 무료: 1만원 이상 1시간 · 3만원 이상 2시간 · 5만원 이상 3시간 · 10만원 이상 4시간 · 20만원 이상 5시간\n식당가 이용 시 2시간 무료\n센텀시티몰(센텀4로 15) 포함 같은 주차 기준', where: '신세계백화점 센텀시티 7층에 있습니다.' },
]
const items = stores.map((s) => ({
  action: 'insert', key: s.key, brand: 'PLAY IN THE BOX', brand_links: ['https://playinthebox.co.kr/ko', IG],
  fields: {
    name: s.name, addr: s.addr, floor_info: s.floor, cats: ['굿즈샵', '가챠', '피규어샵'],
    shop_link: 'https://playinthebox.co.kr/ko', sns_links: [IG, 'https://playinthebox.co.kr/ko'],
    place_id: s.place, parking: true, parking_note: s.note,
    description: `캐릭터 굿즈·피규어·캡슐토이를 모아 파는 캐릭터 편집숍 PLAY IN THE BOX(플레이인더박스)의 매장으로, ${s.where}\n영업시간·전화는 공식 안내에 표기되어 있지 않아 비워 두었습니다. 방문 전 입점 건물 영업시간과 공식 SNS 공지를 확인하세요.`,
  },
  goods_types: ['figure-new', 'gacha-new'],
  works: [],
  sources: [
    { url: OFF, fields: ['name', 'addr', 'floor_info', 'shop_link', 'sns_links', 'goods_types', 'cats'], checked_at: '2026-09-29',
      note: `공식 사이트 오프라인 매장 목록(9곳 + 무인사진관 2곳) "${s.offTxt}". 소개 "한국 최대 피규어 성지 · 최신 유행 굿즈 · 캡슐토이, DIY" — 매장 공통 소개라 분류는 피규어·가챠만(브랜드 기준). 영업시간·전화 표기 없음` },
    { url: s.purl, fields: ['place_id', 'parking', 'parking_note'], checked_at: '2026-09-29', note: `${s.pname} place(${s.place.slice(0, 8)}) 공식 주차 노트 그대로 복사` },
  ],
  unconfirmed: ['hours', 'phone', 'works'],
  photo: 'needed',
  notes: '분류 figure-new·gacha-new 는 브랜드 공식 소개(오프라인 매장 공통) 기준. 지점 취급 작품은 공식 확인 전 비움. 전화는 검색 요약에만 있어 넣지 않음',
}))
fs.writeFileSync('scripts/shops/plans/2026-09-29-i.json', JSON.stringify({ name: '2026-09-29-i', items }, null, 1))
