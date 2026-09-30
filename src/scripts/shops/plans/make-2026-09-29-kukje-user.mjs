// 2026-09-29 사용자 제공 국전 매장 목록 중 미등록 5곳 — node scripts/shops/plans/make-2026-09-29-kukje-user.mjs
import { writeFileSync } from 'fs'
const C = '2026-09-29'
const D = { open: '10:00', close: '20:00' }
const HOURS = { mon: D, tue: D, wed: D, thu: D, fri: D, sat: D, sun: D, monthlyOff: { weeks: [1, 3], days: ['sun'] } }
const base = {
  addr: '서울 서초구 효령로 304', place_id: '1fee0987-c92d-4bdd-8273-dc4c01207c89',
  parking: true, parking_note: '주차 가능(유료)\n최초 40분 무료, 이후 10분당 1,000원',
  phone: null, hours: HOURS,
}
const USER = { url: 'user-provided:2026-09-29 국전 매장 목록(매장명·종류·위치·인스타그램)', fields: ['name', 'floor_info', 'cats', 'sns_links'], checked_at: C }
const KEC = { url: 'http://www.kecday.co.kr/bbs/board.php?bo_table=sisul', fields: ['place_id', 'parking', 'parking_note', 'hours'], checked_at: C, note: '건물 운영 10:00~20:00, 첫째·셋째 일요일 휴무 — 사용자 지시로 매장 시간 대신 적용' }
const TAIL = '영업시간은 국제전자센터 운영시간(10:00~20:00) 기준이며, 매월 첫째·셋째 일요일은 휴무입니다.'
const mk = (key, name, floor, room, cats, goods, items, desc, sns = [], extra = {}) => ({
  action: 'insert', key,
  fields: { ...base, name, floor_info: `국제전자센터 ${floor}${room ? ' ' + room : ''}`, cats, sns_links: sns, shop_link: sns[0] ?? null,
    branches: [{ floor, name: '매장', ...(room ? { room } : {}), items }], description: `${desc}\n${TAIL}` },
  goods_types: goods, ...extra,
  sources: [USER, KEC], unconfirmed: ['official_hours', 'phone'], photo: 'needed',
  notes: '사용자 제공 목록으로 등록(2026-09-29). 영업시간은 건물 운영시간 적용 — 매장 공식 시간 확인 시 교체',
})
const items = [
  mk('kukje-loginsoft', '로그인소프트', '9층', '109호', ['굿즈샵'], [], ['굿즈'], '국제전자센터 9층 109호에 있는 굿즈 매장 로그인소프트입니다.'),
  mk('kukje-capsule-impact', '캡슐임팩트', '9층', '32호', ['가챠'], ['gacha-new'], ['가챠'], '국제전자센터 9층 32호에 있는 가챠샵 캡슐임팩트입니다.'),
  mk('kukje-korokoro-gacha', '코로코로 가챠', '5층', '', ['가챠'], ['gacha-new'], ['가챠'], '국제전자센터 5층에 있는 가챠샵 코로코로 가챠입니다.'),
  mk('kukje-tobito', '토비토', '8층', '70호', ['굿즈샵'], [], ['말랑이'], '말랑이를 파는 매장 토비토로, 국제전자센터 8층 70호에 있습니다.', ['https://www.instagram.com/tobito_lab/'], { add_custom_goods: ['말랑이'] }),
  mk('kukje-pc-repair-gacha', 'PC조립수리', '8층', '122호', ['가챠'], ['gacha-new'], ['가챠'], '국제전자센터 8층 122호의 PC 조립·수리 매장으로, 가챠 기계를 함께 운영합니다.'),
]
writeFileSync(new URL('./2026-09-29-kukje-user.json', import.meta.url), JSON.stringify({ name: '2026-09-29-kukje-user', items }, null, 1))
console.log('written', items.length)
