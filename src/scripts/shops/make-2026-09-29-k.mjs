// 10차: 한국타미야 공식 매장 안내의 "타미야 대리점" 5곳 신규
import fs from 'fs'
const SRC = 'https://tamiya.co.kr/sub/find_store.php'
const h = (o, c) => ({ open: o, close: c })
const wk = (a, b) => ({ mon: a, tue: a, wed: a, thu: a, fri: b, sat: b, sun: b })
const SAM = '주차 가능(유료)\n30분 무료 후 10분당 1,000원\n구매금액 1만원/3만원/5만원/10만원/20만원 이상 시 각각 1/2/3/4/5시간 무료'
const stores = [
  { key: 'tamiya-hongdae', name: '타미야 홍대점', addr: '서울 마포구 양화로 176', floor: '홍대 YZ파크(와이즈파크) 지하 2층', phone: '02-362-2214',
    hours: wk(h('11:00', '21:00'), h('11:00', '21:00')), off: '홍대점 / 서울특별시 마포구 양화로 176 홍대 YZ파크 지하 2층 / t. 02-362-2214 / 월-일 11:00 - 21:00 (명절 당일 휴무)',
    place: '712cabdb-e95f-427a-9f3d-991fbcc9ca94', pname: '와이즈파크 홍대', note: null, purl: null,
    where: '홍대입구역 인근 홍대 YZ파크(와이즈파크) 지하 2층에 있습니다.', extra: '명절 당일은 휴무입니다.' },
  { key: 'tamiya-mario', name: '타미야 마리오점', addr: '서울 금천구 벚꽃로 266', floor: '마리오아울렛 3관 7층', phone: '02-2067-2256',
    hours: wk(h('10:30', '21:00'), h('10:30', '21:30')), off: '마리오점 / 서울특별시 금천구 벚꽃로 266 마리오아울렛 3관 7층 / t. 02-2067-2256 / 월-목 10:30 - 21:00, 금-일 / 공휴일 10:30 - 21:30',
    place: '4fbed161-7fd1-4653-aaa5-2df66033bb9d', pname: '마리오아울렛 3관', purl: 'https://www.mariooutlet.com/information/directions?Tab=3',
    note: '주차 가능(유료)\n입차 후 30분 무료, 이후 10분당 500원\n구매 시 무료: 5만원 미만 1시간 · 5만원 이상 2시간 · 10만원 이상 3시간 · 20만원 이상 4시간 · 30만원 이상 5시간 · 40만원 이상 6시간 · 50만원 이상 당일\n결제 시 차량번호 등록하면 자동 적용, 현금 결제 불가',
    where: '가산동 마리오아울렛 3관 7층에 있습니다.', extra: '공휴일은 21:30 까지 영업합니다.' },
  { key: 'tamiya-gwangbok', name: '타미야 부산 광복점', addr: '부산 중구 광복로39번길 6', floor: '와이즈파크 광복점 지하 1층', phone: '051-245-0142',
    hours: { mon: h('12:30', '20:00'), tue: h('12:30', '20:00'), wed: h('12:30', '20:00'), thu: h('12:30', '20:00'), fri: h('12:30', '22:00'), sat: h('11:00', '20:00'), sun: h('11:00', '20:00') },
    off: '부산 광복점 / 부산광역시 중구 광복로39번길 6 와이즈파크 광복점 지하 1층 / t. 010-9751-0142 / 051-245-0142 / 월-목 12:30 - 20:00, 금 12:30 - 22:00, 토/일/공휴일 11:00 - 20:00 (명절 전, 당일 휴무)',
    place: 'a2dacf35-884d-41cb-a1ed-4c3c69d74482', pname: '와이즈파크 광복점', note: null, purl: null,
    where: '광복로 와이즈파크 광복점 지하 1층에 있습니다.', extra: '공휴일은 11:00~20:00 영업하며, 명절 전날과 당일은 휴무입니다. 휴대전화 010-9751-0142 도 안내되어 있습니다.' },
  { key: 'tamiya-seomyeon', name: '타미야 부산 서면삼정타워점', addr: '부산 부산진구 중앙대로 672', floor: '삼정타워 7층', phone: '070-7776-1172',
    hours: { mon: h('11:00', '22:00'), tue: h('11:00', '22:00'), wed: h('11:00', '22:00'), thu: h('11:00', '22:00'), fri: h('11:00', '22:30'), sat: h('11:00', '22:30'), sun: h('11:00', '22:00') },
    off: '부산 서면삼정타워점 / 부산광역시 부산진구 중앙대로 672 삼정타워 7층 / t. 070-7776-1172 / 월-목 / 일 11:00-22:00, 금-토 11:00-22:30',
    place: '6a3e3e01-c868-4948-b8a6-942678852eeb', pname: '삼정타워', note: SAM, purl: 'places 6a3e3e01 기존 노트',
    where: '서면 삼정타워 7층에 있습니다.', extra: null },
  { key: 'tamiya-centum', name: '타미야 부산 센텀시티점', addr: '부산 해운대구 센텀남대로 59', floor: '롯데백화점 센텀시티점 6층', phone: '051-730-3653',
    hours: wk(h('10:30', '20:00'), h('10:30', '20:30')), off: '부산 센텀시티점 / 부산광역시 해운대구 센텀남대로 59 롯데백화점 센텀시티점 6층 / t. 051-730-3653 / 월-목 10:30 - 20:00, 금-일 / 공휴일 10:30 - 20:30',
    place: 'e94ac940-a18e-4f59-85b4-b33e43329760', pname: '롯데백화점 센텀시티점', purl: 'https://www.lotteshopping.com/store/main?cstrCd=0027',
    note: '주차 가능(유료)\n최초 30분 무료, 이후 10분당 500원\n구매 시 무료: 1만원 이상 1시간 · 3만원 이상 2시간 · 5만원 이상 3시간 · 10만원 이상 4시간 · 20만원 이상 5시간\n현금 결제 불가(카드만)',
    where: '롯데백화점 센텀시티점 6층에 있습니다(신세계 센텀시티와 다른 건물).', extra: '공휴일은 20:30 까지 영업합니다. 백화점 휴점일은 백화점 공지를 확인하세요.' },
]
const items = stores.map((s) => {
  const fields = {
    name: s.name, addr: s.addr, floor_info: s.floor, cats: ['프라모델'],
    shop_link: SRC, sns_links: ['https://tamiya.co.kr/'], phone: s.phone, hours: s.hours,
    place_id: s.place, parking: true,
    description: `한국타미야 공식 매장 안내에 "타미야 대리점"으로 소개된 타미야 프라모델·미니카 취급점으로, ${s.where}${s.extra ? '\n' + s.extra : ''}`,
  }
  if (s.note) fields.parking_note = s.note
  const sources = [{ url: SRC, fields: ['name', 'addr', 'floor_info', 'phone', 'hours', 'shop_link', 'goods_types', 'cats'], checked_at: '2026-09-29', note: `한국타미야 공식 매장 안내 "타미야 대리점" 목록: "${s.off}"` }]
  sources.push(s.note
    ? { url: s.purl, fields: ['place_id', 'parking', 'parking_note'], checked_at: '2026-09-29', note: `${s.pname} place(${s.place.slice(0, 8)}) 주차 노트 그대로 복사` }
    : { url: 'http://www.yzpark.kr/', fields: ['place_id', 'parking'], checked_at: '2026-09-29', note: `${s.pname} place(${s.place.slice(0, 8)}) — 공식 사이트 접속 불가(타임아웃), 카카오 부속 주차장 항목으로 주차장 존재만 확인. 요금 미확인` })
  return {
    action: 'insert', key: s.key, fields, goods_types: ['plamodel-new'], works: [], sources,
    unconfirmed: s.note ? ['closed_days', 'works'] : ['closed_days', 'works', 'parking_note'],
    photo: 'needed',
    notes: '분류 plamodel-new 는 한국타미야 공식 취급점 목록 기준(타미야 제품). 매장 자체 SNS 공식 표기 없음 — shop_link 는 공식 매장 안내 페이지',
  }
})
fs.writeFileSync('scripts/shops/plans/2026-09-29-k.json', JSON.stringify({ name: '2026-09-29-k', items }, null, 1))
console.log(items.length)
