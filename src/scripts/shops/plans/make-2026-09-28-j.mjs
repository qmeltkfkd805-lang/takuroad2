// 2026-09-28 추가 실행 — 포켓몬 카드샵 공식 목록(pokemonkorea.co.kr/pokemon_cardshop) 남은 매장 중 5곳
// 공식 오픈 안내 이미지가 2022~2024 게시라 영업시간은 비움(최근 언급과 불일치 — 매장 공식 SNS 대조 전)
import { writeFileSync } from 'node:fs'
const D = '2026-09-28'
const src = (url, fields) => ({ url, fields, checked_at: D })
const POKEMON = '6200fb96-d722-4cbf-b09c-d5967f598ee7'
const LIST = 'https://pokemonkorea.co.kr/pokemon_cardshop/menu809'
const TAIL = '영업시간은 매장 공식 SNS에서 확인해 주세요. 공식 대회·리그는 포켓몬 카드 게임 공식 예약 사이트에서 신청합니다.'
const mk = ({ key, menu, img, name, addr, floor, phone, opened, sns = [], extra = '' }) => ({
  action: 'insert', key, brand: '포켓몬 카드샵', brand_links: [LIST],
  fields: {
    name, addr, floor_info: floor, cats: ['카드/TCG'], phone, hours: null,
    shop_link: `https://pokemonkorea.co.kr/pokemon_cardshop/${menu}`, sns_links: sns,
    description: `포켓몬코리아 공식 인증 포켓몬 카드 게임 전문 매장 "POKÉMON CARD SHOP"으로, ${opened} 문을 열었습니다.${extra}\n${TAIL}`,
  },
  goods_types: ['card-new'],
  works: [{ tag_id: POKEMON, primary: true, evidence: `포켓몬코리아 공식 포켓몬 카드샵 매장 안내(${name}) — 포켓몬 카드 게임 전문 매장` }],
  sources: [src(`https://pokemonkorea.co.kr/pokemon_cardshop/${menu}`, ['name', 'addr', 'floor_info', 'phone', 'works', 'goods_types']),
    src(`https://data1.pokemonkorea.co.kr/newdata/${img}`, ['name', 'addr', 'floor_info', 'phone'])],
  unconfirmed: ['hours', 'holiday_detail', 'parking', 'sns_official_check'], photo: 'needed',
  notes: '공식 매장 안내는 오픈 안내 이미지(브라우저 렌더 확인). 이미지 속 시간은 게시 당시 기준이라 넣지 않음. sns_links 는 검색으로 찾은 매장 계정(이름 일치) — 순환 점검 때 계정 소개로 대조',
})
const items = [
  mk({ key: 'pokemon-cardshop-yeoksam', menu: 'menu178', img: '2024/07/2024-07-23_09-18-17-31576-1721693897.png',
    name: '포켓몬 카드샵 카드냥 역삼', addr: '서울 강남구 논현로77길 9', floor: '태원빌딩 4층', phone: '02-568-3778',
    opened: '서울 강남구 논현로77길 9 태원빌딩 4층에 2022년 7월 23일', sns: ['https://x.com/cardnyang_tcg', 'https://cardnyang.com/'] }),
  mk({ key: 'pokemon-cardshop-suwon', menu: 'menu193', img: '2022/08/2022-08-18_17-30-25-58702-1660811425.png',
    name: '포켓몬 카드샵 카드플래닛 수원', addr: '경기 수원시 영통구 청명로 73-1', floor: '2층', phone: '070-8777-4264',
    opened: '수원 영통구 청명로 73-1 2층에 2022년 8월 20일', sns: ['https://x.com/cardplanet_kr'] }),
  mk({ key: 'pokemon-cardshop-wonju', menu: 'menu202', img: '2022/09/2022-09-15_19-02-03-99440-1663236123.png',
    name: '포켓몬 카드샵 카드스페이스 원주', addr: '강원 원주시 능라동길 42', floor: '602호', phone: '033-745-1444',
    opened: '원주 능라동길 42 602호에 2022년 9월 17일', sns: ['https://x.com/wonjucardspace'] }),
  mk({ key: 'pokemon-cardshop-incheon', menu: 'menu211', img: '2022/09/2022-09-28_15-25-48-89727-1664346348.png',
    name: '포켓몬 카드샵 카드팝 인천', addr: '인천 부평구 부평문화로66번길 21', floor: '4층', phone: '032-221-8502',
    opened: '인천 부평구(부평동 201-117) 4층에 2022년 10월 1일', sns: ['https://x.com/Card_Pop_TCG'] }),
  mk({ key: 'pokemon-cardshop-gwangju', menu: 'menu213', img: '2022/10/2022-10-12_17-28-06-77001-1665563286.png',
    name: '포켓몬 카드샵 화성스토어TCG 광주', addr: '광주 동구 중앙로160번길 22', floor: '2층', phone: '010-3083-9697',
    opened: '광주 동구 중앙로160번길 22 2층에 2022년 10월 15일', sns: ['https://www.instagram.com/hs_storetcg/'] }),
]
writeFileSync('scripts/shops/plans/2026-09-28-j.json', JSON.stringify({ name: `${D}-j`, items }, null, 1))
console.log('items', items.length)
