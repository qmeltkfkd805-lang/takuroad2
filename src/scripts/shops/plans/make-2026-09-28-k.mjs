import { writeFileSync } from 'node:fs'
const D = '2026-09-28'
const PK = '6200fb96-d722-4cbf-b09c-d5967f598ee7'
const LIST = 'https://pokemonkorea.co.kr/pokemon_cardshop/menu809'
const KUJI = 'https://ichibankuji.kr/shop'
const all = (o, c, extra = {}) => Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(d => [d, { open: o, close: c }])).constructor === Object ? { ...Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(d => [d, { open: o, close: c }])), ...extra } : null
const pk = (key, name, addr, floor, phone, menu, img, opened) => ({
  action: 'insert', key, brand: '포켓몬 카드샵', brand_links: [LIST],
  fields: { name, addr, floor_info: floor, cats: ['카드/TCG'], phone, hours: null,
    shop_link: `https://pokemonkorea.co.kr/pokemon_cardshop/${menu}`, sns_links: [],
    description: `포켓몬코리아 공식 인증 포켓몬 카드 게임 전문 매장 "POKÉMON CARD SHOP"으로, ${addr.replace(/^[^ ]+ /, '')} ${floor}에 ${opened} 문을 열었습니다.\n영업시간은 공식 안내 이미지가 오픈 당시 기준이라 비워 두었습니다. 방문 전 매장에 확인해 주세요. 공식 대회·리그는 포켓몬 카드 게임 공식 예약 사이트에서 신청합니다.` },
  goods_types: ['card-new'],
  works: [{ tag_id: PK, primary: true, evidence: `포켓몬코리아 공식 포켓몬 카드샵 매장 안내(${name}) — 포켓몬 카드 게임 전문 매장` }],
  sources: [
    { url: `https://pokemonkorea.co.kr/pokemon_cardshop/${menu}`, fields: ['name','addr','floor_info','phone','works','goods_types'], checked_at: D },
    { url: img, fields: ['name','addr','floor_info','phone'], checked_at: D },
  ],
  unconfirmed: ['hours', 'holiday_detail', 'parking', 'sns'], photo: 'needed',
  notes: '공식 매장 안내는 오픈 안내 이미지(브라우저 렌더 확인). 이미지 속 시간은 게시 당시 기준이라 넣지 않음',
})
const items = [
  pk('pokemon-cardshop-pyeongtaek', '포켓몬 카드샵 카드홀릭 평택', '경기 평택시 평택2로 16', '3층', '010-2712-8884', 'menu214',
    'https://data1.pokemonkorea.co.kr/newdata/2022/10/2022-10-27_18-27-59-93487-1666862879.png', '2022년 10월 29일'),
  pk('pokemon-cardshop-ulsan', '포켓몬 카드샵 TCG 팩토리 울산', '울산 중구 번영로 454-1', '1층', '052-710-4083', 'menu226',
    'https://data1.pokemonkorea.co.kr/newdata/2022/12/2022-12-01_14-56-22-91756-1669874182.png', '2022년 12월 3일'),
  pk('pokemon-cardshop-daegu', '포켓몬 카드샵 트레이너 스쿨 대구', '대구 달서구 야외음악당로 50', '2층', '010-4836-2223', 'menu246',
    'https://data1.pokemonkorea.co.kr/newdata/2023/01/2023-01-11_17-10-59-44419-1673424659.png', '2023년 1월 14일'),
]
items[2].notes += '. 공식 표기 주소는 지번 "대구 달서구 성당동 488-1" → 카카오 주소 검색 도로명(야외음악당로 50)'
items[2].fields.description = items[2].fields.description.replace('야외음악당로 50 2층', '야외음악당로 50(성당동 488-1) 2층')

const kujiDesc = (loc, extra) => `반다이 남코의 캐릭터 경품 복권 "이치방쿠지" 공식 매장(ICHIBANKUJI OFFICIAL SHOP)으로, ${loc}에 있습니다.${extra}\n국내 이치방쿠지 판매처 안내(대원미디어 이치방쿠지 더블찬스 매장정보)에 등록된 매장입니다.`
const kuji = (key, name, addr, floor, place, parking_note, hours, desc, src) => ({
  action: 'insert', key, brand: '이치방쿠지', brand_links: [KUJI],
  fields: { name, addr, floor_info: floor, cats: ['쿠지'], hours, shop_link: KUJI, sns_links: [],
    place_id: place, parking: true, parking_note, description: desc },
  goods_types: ['ichiban-kuji'], works: [],
  sources: [{ url: KUJI, fields: ['name','addr','floor_info','hours','goods_types'], checked_at: D, note: src }],
  unconfirmed: ['phone', 'sns', 'works'], photo: 'needed',
  notes: '대원미디어 이치방쿠지 공식 매장정보 API(/api/shop/page) 브라우저 조회. 전화 "x"(미표기). 지점 취급 작품 공식 안내 없음 → 작품 연결 안 함',
})
const IPARK = '045ed3e4-9d81-4f68-a4c7-e6815f0ccadc', AKH = '6c9bad49-7a5b-43d3-b2df-405a2e5df390', CENTUM = '3a89dba6-6afb-40fa-9a42-9d20aeecafd1'
const PN = {
  ipark: '주차 가능(유료)\n기본요금 10분당 1,500원\n무료 회차 없음\n당일 영수증 할인은 최대 5시간까지 적용',
  akh: '주차 가능(유료)\n최초 30분 2,000원\n이후 10분당 1,000원\n1만원 구매 시 1시간 무료\n3만원 구매 시 2시간 무료\n5만원 구매 시 3시간 무료',
  centum: '주차 가능(유료)\n최초 30분 무료, 이후 10분당 1,000원\n구매 시 무료: 1만원 이상 1시간 · 3만원 이상 2시간 · 5만원 이상 3시간 · 10만원 이상 4시간 · 20만원 이상 5시간\n식당가 이용 시 2시간 무료\n센텀시티몰(센텀4로 15) 포함 같은 주차 기준',
}
items.push(
  kuji('ichibankuji-yongsan', '이치방쿠지 용산점', '서울 용산구 한강대로23길 55', '아이파크몰 3층 도파민 스테이션', IPARK, PN.ipark,
    all('10:30', '20:30'), kujiDesc('용산 아이파크몰 3층 도파민 스테이션 안', ' 영업시간은 매일 10:30~20:30입니다(공식 매장정보).'), '"【ICHIBANKUJI OFFICIAL SHOP】 용산점 「 아이파크몰 3F 도파민 스테이션 」 10:30~20:30"'),
  kuji('ichibankuji-hongdae', '이치방쿠지 홍대점', '서울 마포구 양화로 188', 'AK플라자 홍대 5층', AKH, PN.akh,
    all('11:00', '22:00'), kujiDesc('AK플라자 홍대(AK&홍대) 5층', ' 영업시간은 매일 11:00~22:00입니다(공식 매장정보). 같은 층 애니메이트 홍대점과는 다른 매장입니다.'), '"【ICHIBANKUJI OFFICIAL SHOP】 홍대점 「AK PLAZA 5F」 11:00~22:00"'),
  kuji('ichibankuji-haeundae', '이치방쿠지 해운대점', '부산 해운대구 센텀남대로 35', '신세계백화점 센텀시티 지하 2층', CENTUM, PN.centum,
    { ...all('10:30', '20:30'), fri: { open: '10:30', close: '21:00' }, sat: { open: '10:30', close: '21:00' }, sun: { open: '10:30', close: '21:00' } },
    kujiDesc('부산 신세계백화점 센텀시티 지하 2층', ' 영업시간은 월~목 10:30~20:30, 금~일 10:30~21:00입니다(공식 매장정보). 백화점 휴점일은 백화점 안내를 확인해 주세요.'), '"【ICHIBANKUJI OFFICIAL SHOP】 해운대점 「부산 센텀시티 신세계 백화점 B2F」 월~목: 10:30~20:30 금~일: 10:30~21:00"'),
)
writeFileSync('plans/2026-09-28-k.json', JSON.stringify({ name: '2026-09-28-k', items }, null, 1))
console.log(items.length)

// 국전 재점검 2곳 — 이치방쿠지 공식 매장정보(대원미디어)의 매장 등록 정보로 시간·전화 보완
const off13 = { monthlyOff: { days: ['sun'], weeks: [1, 3] } }
const upd = [
  { action: 'update', key: 'kujibang-kukje-hours', shop_id: '2fd0ee28-33db-465c-9670-988ef7e67977', expect_updated_at: '2026-09-28T05:33:34.129666+00:00',
    fields: { hours: all('11:00', '20:00', off13), phone: '070-4130-5574',
      description: '정식판 이치방쿠지와 자체 쿠지, 경품 피규어를 파는 쿠지 전문점 쿠지방의 국제전자센터점으로, 8층 8123호에 있습니다. 실시간 온라인 쿠지 뽑기와 스마트스토어도 운영합니다(공식 계정 안내).\n영업시간은 11:00~20:00이며 매월 첫째·셋째 일요일에 쉽니다(국제전자센터 상가 휴무일과 같음).' },
    overwrite: ['description'], reason: '이치방쿠지 공식 매장정보 "쿠지방 국전점 8층 8123호, 070-4130-5574, AM11:00~PM08:00, 매주 첫째주 셋째주 일요일 휴무"',
    sources: [{ url: KUJI, fields: ['hours', 'phone', 'floor_info'], checked_at: D, note: '쿠지방 국전점 — 서울 서초구 효령로 304 8층 8123호 / 070-4130-5574 / AM11:00~PM08:00, 매주 첫째주 셋째주 일요일 휴무' }],
    unconfirmed: [] },
  { action: 'update', key: 'cutepeople-kukje-hours', shop_id: '4cf43796-d919-4a34-97e4-4cfcd4096a96', expect_updated_at: '2026-09-28T05:33:34.506094+00:00',
    fields: { hours: all('12:00', '20:00', off13), phone: '0507-1403-6024',
      description: '이치방쿠지·가챠·피규어·누이·리멘트·블라인드 굿즈를 파는 매장으로, 국제전자센터 8층 115·116호에 있습니다. 온라인 스마트스토어도 함께 운영합니다.\n영업시간은 매일 12:00~20:00이며 매월 첫째·셋째 일요일은 정기 휴무입니다.' },
    overwrite: ['description'], reason: '이치방쿠지 공식 매장정보 "큐트피플컴퍼니 8층 115호,116호, 0507-1403-6024, 월-일 12:00~20:00 / 매달 1, 3번째 일요일 정기 휴무"',
    sources: [{ url: KUJI, fields: ['hours', 'phone', 'floor_info'], checked_at: D, note: '큐트피플컴퍼니 — 효령로 304 8층 115호,116호 / 0507-1403-6024 / 월-일 12:00~20:00 / 매달 1, 3번째 일요일 정기 휴무' }],
    unconfirmed: [] },
]
items.push(...upd)
writeFileSync('plans/2026-09-28-k.json', JSON.stringify({ name: '2026-09-28-k', items }, null, 1))
console.log('with updates', items.length)
