// 2026-09-28 밤 — 포켓몬 카드샵 공식 목록(pokemonkorea.co.kr/pokemon_cardshop) 신규 5곳
import { writeFileSync } from 'node:fs'
const D = '2026-09-28'
const src = (url, fields) => ({ url, fields, checked_at: D })
const POKEMON = '6200fb96-d722-4cbf-b09c-d5967f598ee7'
const LIST = 'https://pokemonkorea.co.kr/pokemon_cardshop/menu809'
const h = (open, close) => ({ open, close })
const TAIL = '공식 대회·리그는 포켓몬 카드 게임 공식 예약 사이트에서 신청합니다.'
const mk = ({ key, menu, img, name, addr, floor, phone, hours, opened, hoursText }) => ({
  action: 'insert', key, brand: '포켓몬 카드샵', brand_links: [LIST],
  fields: {
    name, addr, floor_info: floor, cats: ['카드/TCG'], phone, hours,
    shop_link: `https://pokemonkorea.co.kr/pokemon_cardshop/${menu}`, sns_links: [],
    description: `포켓몬코리아 공식 인증 포켓몬 카드 게임 전문 매장 "POKÉMON CARD SHOP"으로, ${opened} 문을 열었습니다.\n${hoursText}(공식 안내). ${TAIL}`,
  },
  goods_types: ['card-new'],
  works: [{ tag_id: POKEMON, primary: true, evidence: `포켓몬코리아 공식 포켓몬 카드샵 매장 안내(${name}) — 포켓몬 카드 게임 전문 매장` }],
  sources: [src(`https://pokemonkorea.co.kr/pokemon_cardshop/${menu}`, ['name', 'addr', 'floor_info', 'hours', 'phone', 'works', 'goods_types']),
    src(`https://data1.pokemonkorea.co.kr/newdata/${img}`, ['name', 'addr', 'floor_info', 'hours', 'phone'])],
  unconfirmed: ['holiday_detail', 'parking'], photo: 'needed',
  notes: '공식 매장 안내는 이미지(오픈 안내) — 브라우저로 렌더해 옮김',
})
const items = [
  mk({ key: 'pokemon-cardshop-gangneung', menu: 'menu809', img: '2026/09/2026-09-04_14-01-49-56323-1788498109.jpg',
    name: '포켓몬 카드샵 카드웨이브 강릉', addr: '강원 강릉시 솔올로 40', floor: '3층', phone: '070-8680-8510',
    hours: { mon: null, tue: h('12:00', '19:00'), wed: h('12:00', '21:00'), thu: h('12:00', '19:00'), fri: h('12:00', '21:00'), sat: h('12:00', '19:00'), sun: h('12:00', '19:00') },
    opened: '강릉 솔올로 40 3층에 2026년 9월 12일', hoursText: '수·금 12:00~21:00, 화·목·토·일 12:00~19:00 영업하며 월요일은 휴무입니다' }),
  mk({ key: 'pokemon-cardshop-guri', menu: 'menu789', img: '2026/09/2026-09-21_17-40-18-20786-1789980018.jpg',
    name: '포켓몬 카드샵 TCG 라인 구리', addr: '경기 구리시 장자대로86번길 32', floor: '2층', phone: '031-558-3088',
    hours: { mon: h('12:00', '21:00'), tue: h('13:00', '22:00'), wed: h('12:00', '21:00'), thu: h('13:00', '22:00'), fri: h('12:00', '21:00'), sat: h('12:00', '21:00'), sun: h('12:00', '21:00') },
    opened: '구리 장자대로86번길 32 2층에 2026년 8월 22일', hoursText: '12:00~21:00 영업하며 화·목요일은 13:00~22:00입니다' }),
  mk({ key: 'pokemon-cardshop-cheonan', menu: 'menu776', img: '2026/07/2026-07-22_14-24-13-34101-1784697853.jpg',
    name: '포켓몬 카드샵 카드프라임 천안', addr: '충남 천안시 서북구 백석로 130', floor: '2층', phone: '070-8890-1110',
    hours: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => [d, h('13:00', '21:00')])),
    opened: '천안 백석로 130 2층에 2026년 7월 26일', hoursText: '평일·주말 모두 13:00~21:00 영업합니다' }),
  mk({ key: 'pokemon-cardshop-daejeon', menu: 'menu749', img: '2026/04/2026-04-21_18-29-48-74193-1776763788.jpg',
    name: '포켓몬 카드샵 카드롤 대전', addr: '대전 서구 둔산로 72', floor: '등오빌딩 5층', phone: '010-4849-7220',
    hours: { mon: h('14:00', '22:00'), tue: h('14:00', '22:00'), wed: h('14:00', '22:00'), thu: h('14:00', '22:00'), fri: h('14:00', '22:00'), sat: h('13:00', '21:00'), sun: h('13:00', '21:00') },
    opened: '대전 둔산로 72 등오빌딩 5층에 2026년 5월 2일', hoursText: '평일 14:00~22:00, 주말 13:00~21:00 영업합니다' }),
  mk({ key: 'pokemon-cardshop-busan', menu: 'menu661', img: '2025/11/2025-11-03_11-28-24-90751-1762136904.png',
    name: '포켓몬 카드샵 카드베이스 부산', addr: '부산 동래구 명륜로129번길 54', floor: '4층', phone: '010-9825-9697',
    hours: { mon: h('14:00', '22:00'), tue: h('14:00', '22:00'), wed: h('14:00', '22:00'), thu: h('14:00', '22:00'), fri: h('14:00', '22:00'), sat: h('13:00', '22:00'), sun: h('13:00', '22:00') },
    opened: '부산 동래구 명륜로129번길 54 4층에 2025년 9월 20일', hoursText: '평일 14:00~22:00, 주말 13:00~22:00 영업합니다' }),
]
writeFileSync('scripts/shops/plans/2026-09-28-h.json', JSON.stringify({ name: `${D}-h`, items }, null, 1))
console.log('items', items.length)
