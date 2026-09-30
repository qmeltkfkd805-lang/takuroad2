// 2026-09-28 국제전자센터 3차 (조사 G) — node scripts/shops/plans/make-2026-09-28-kukje-d.mjs
// 확인 기록: research/kukje-2026-09-28-G.md
import { writeFileSync } from 'node:fs'
const D = '2026-09-28'
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const all = (open, close) => Object.fromEntries(DAYS.map((d) => [d, { open, close }]))
const src = (url, fields) => ({ url, fields, checked_at: D })
const KEC = '1fee0987-c92d-4bdd-8273-dc4c01207c89'
const PARK = '주차 가능(유료)\n최초 40분 무료, 이후 10분당 1,000원'
const PARK_SRC = src('http://www.kecday.co.kr/bbs/board.php?bo_table=sisul', ['place_id', 'parking', 'parking_note'])
const BLD = ' 국제전자센터 상가는 매월 첫째·셋째 일요일 휴무이니 방문 전 확인해 주세요.'
const base = (f) => ({ addr: '서울 서초구 효령로 304', place_id: KEC, parking: true, parking_note: PARK, sns_links: [], phone: null, hours: null, ...f })
const T = {
  persona5: '63b5e319-e35d-4f05-bc99-3bec3c85cf29', dragonball: 'c7c8efb0-41d2-4935-b0e6-5f9f59b2bc9e', natsume: '69f68ebd-7061-4b7f-96c2-022dcf228edf',
  oshinoko: '89409350-b9db-4d7d-9e10-c08cbf681f37', shinchan: '5c4e930c-a5f4-4e5e-a9f0-93b3d705aae7', chiikawa: 'b507243e-1408-47a1-9aeb-f4245127d3dc',
  rilakkuma: '5018bb5f-1019-4ac2-825d-b98610269f81', bocchi: 'b351c970-1944-4128-9cd3-de89bb826ff3', gintama: 'cdc27204-c7f8-4f28-a4a7-fb7e8b7fc1b7',
  eva: '1a97869d-63fb-4d86-a098-2551356d835b', aot: '46d1cc6a-f88b-46e2-b4ec-d70dcf0be740', nikke: '63f2a778-7dca-469d-a2c1-8b139d82637f',
}
const works = (keys, evidence) => keys.map((k) => ({ tag_id: T[k], primary: false, evidence }))
const KYOUMA_LINKS = ['https://x.com/kyouma_gacha', 'https://x.com/kyoumashop', 'https://www.instagram.com/kyouma_official/', 'https://litt.ly/kyouma']
const KYOUMA_KUJI = works(['persona5', 'dragonball', 'natsume', 'oshinoko', 'shinchan'], '공식 제일복권 게시물 "국제전자센터 2층 본점, 9층 1, 2호점 판매 중"(2026-03-12·04-09·04-10)')
const KYOUMA_SRC = [src('https://www.instagram.com/kyouma_official/p/DVz9Gqpk-tg/', ['works']), src('https://x.com/kyoumashop/status/2042160712404045977', ['works']),
  src('https://x.com/kyoumashop/status/2042460510491459966', ['works']), src('https://x.com/kyoumashop/status/2042460639583748342', ['works'])]

const items = [
  {
    action: 'insert', key: 'kukje-kyouma-9f-2', brand_links: KYOUMA_LINKS,
    fields: base({
      name: '쿄우마샵 카드가챠 2호점', floor_info: '국제전자센터 9층', cats: ['가챠', '쿠지'],
      shop_link: 'https://litt.ly/kyouma', sns_links: ['https://x.com/kyouma_gacha', 'https://www.instagram.com/kyouma_official/'],
      description: '쿄우마샵의 9층 2호점으로, 가챠·카드가챠와 제일복권을 판매합니다. 본점은 같은 건물 2층, 1호점도 9층에 있습니다. 영업시간은 공식 안내가 없어 비워 두었습니다.' + BLD,
    }),
    goods_types: ['gacha-new', 'card-new', 'ichiban-kuji'],
    works: KYOUMA_KUJI,
    sources: [src('https://www.instagram.com/kyouma_official/', ['name', 'floor_info']), src('https://x.com/kyouma_gacha/status/1969260362764570764', ['name']), ...KYOUMA_SRC, PARK_SRC],
    unconfirmed: ['unit', 'hours', 'phone'], photo: 'needed', notes: '공식 IG 소개 "9F 1호점 · 2호점" (3호점은 2025-06 이후 공식 언급 없음 → 보류)',
  },
  {
    action: 'update', key: 'kukje-kyouma-main-unit', shop_id: 'fb2ed90d-e09e-4810-bd87-a941252e17db', expect_updated_at: '2026-09-28T04:17:45.443749+00:00',
    fields: { floor_info: '국제전자센터 2층 136호', sns_links: ['https://x.com/kyoumashop', 'https://x.com/kyouma_gacha', 'https://www.instagram.com/kyouma_official/', 'https://litt.ly/kyouma'] },
    overwrite: ['floor_info', 'sns_links'], reason: '공식 링크 모음(litt.ly/kyouma) 본점 주소 "2층 136호" — 호수 보완, 공식 링크 모음 추가',
    works: KYOUMA_KUJI,
    sources: [src('https://litt.ly/kyouma', ['floor_info', 'sns_links']), ...KYOUMA_SRC],
  },
  {
    action: 'update', key: 'kukje-kyouma-9f-1-works', shop_id: 'f6a9f356-69eb-45f2-b794-f91d4192a042', expect_updated_at: '2026-09-28T04:18:23.352847+00:00',
    fields: { sns_links: ['https://x.com/kyouma_gacha', 'https://x.com/kyoumashop', 'https://www.instagram.com/kyouma_official/'] },
    overwrite: ['sns_links'], reason: '공식 인스타그램 추가(소개에 9F 1호점 표기), 1·2호점 공통 제일복권 작품 보강',
    works: KYOUMA_KUJI,
    sources: [src('https://www.instagram.com/kyouma_official/', ['sns_links']), ...KYOUMA_SRC],
  },
  {
    action: 'insert', key: 'kukje-thekuhouse',
    fields: base({
      name: '더쿠하우스 국제전자센터점', floor_info: '국제전자센터 3층 3009호', cats: ['쿠지', '굿즈샵'],
      shop_link: 'https://band.us/@thekuhouse', sns_links: ['https://www.instagram.com/thekuhouse/', 'https://band.us/@thekuhouse'],
      description: '제일복권(이치방쿠지)·자체 쿠지와 일본·중국 피규어·굿즈, 블라인드 박스를 파는 더쿠하우스의 2호점으로, 국제전자센터 3층 3009호에 있습니다(1호점은 화성). 영업시간은 공식 안내가 지점별로 달라 비워 두었습니다.' + BLD,
    }),
    goods_types: ['ichiban-kuji', 'self-kuji', 'figure-new'],
    sources: [src('https://www.band.us/band/96787337/intro', ['name', 'floor_info', 'description']), src('https://www.instagram.com/thekuhouse/', ['floor_info', 'sns_links']), PARK_SRC],
    unconfirmed: ['hours', 'phone', 'works'], photo: 'needed',
    notes: 'Band 소개 시간 "화~일 13:00~22:00·월 휴무"는 건물 영업(20시)과 맞지 않고 1호점 게시물과도 달라 비움. 입고 게시물이 지점 구분 없어 작품 연결 안 함. 수원 "더쿠"와 다른 브랜드',
  },
  {
    action: 'insert', key: 'kukje-itstoy',
    fields: base({
      name: '잇츠토이', floor_info: '국제전자센터 3층 132호 (에스컬레이터 앞)', cats: ['가챠', '굿즈샵'],
      shop_link: 'https://www.instagram.com/itstoy88/', sns_links: ['https://www.instagram.com/itstoy88/'],
      description: '가챠(빅캡슐 포함)와 캐릭터 인형을 파는 매장 잇츠토이(It\'s toy)로, 국제전자센터 3층 에스컬레이터 앞 132호에 있습니다. 영업시간은 공식 안내가 없어 비워 두었습니다.' + BLD,
    }),
    goods_types: ['gacha-new', 'plushie-new', 'figure-new'],
    works: works(['chiikawa', 'shinchan', 'rilakkuma', 'bocchi'], '공식 인스타그램 입고·재입고 게시물(2026-09-09·27)'),
    sources: [src('https://www.instagram.com/itstoy88/', ['name', 'floor_info', 'description']), src('https://www.instagram.com/itstoy88/p/Dd0MRAHB3fd/', ['works']),
      src('https://www.instagram.com/itstoy88/p/DdzzfkegY5s/', ['works']), src('https://www.instagram.com/itstoy88/p/DdzzOUIAT6F/', ['works']), src('https://www.instagram.com/p/DdD3xGpgb5Z/', ['works']), PARK_SRC],
    unconfirmed: ['hours', 'phone'], photo: 'needed', notes: '팬 지도의 8층 위탁 "It\'s toy" 는 공식 근거 없음',
  },
  {
    action: 'insert', key: 'kukje-kujirun',
    fields: base({
      name: '쿠지런', floor_info: '국제전자센터 6층', cats: ['쿠지'], hours: all('12:00', '20:00'),
      shop_link: 'https://band.us/@kujirun', sns_links: ['https://www.instagram.com/kuji_run/', 'https://band.us/@kujirun'],
      description: '이치방쿠지(제일복권)와 피규어·애니 굿즈를 파는 쿠지 전문점 쿠지런(KujiRun)으로, 국제전자센터 6층에 있습니다. 12:00~20:00 영업하며 매월 첫째·셋째 일요일은 휴무입니다(공식 인스타그램 안내).',
    }),
    goods_types: ['ichiban-kuji', 'figure-new'],
    works: works(['gintama', 'eva', 'dragonball', 'aot', 'nikke'], '공식 인스타그램 매장 판매 쿠지 게시물(2026-08-28·09-26)'),
    sources: [src('https://www.instagram.com/kuji_run/', ['name', 'floor_info', 'hours', 'description']), src('https://www.instagram.com/kuji_run/p/DdxuSWsT5uj/', ['works']),
      src('https://www.instagram.com/kuji_run/p/DcnHlUACX0J/', ['works']), src('https://www.instagram.com/kuji_run/p/Dcm-dsLCcoD/', ['works']), PARK_SRC],
    unconfirmed: ['unit', 'phone'], photo: 'needed',
  },
]
writeFileSync('scripts/shops/plans/2026-09-28-kukje-d.json', JSON.stringify({ name: `${D}-kukje-d`, items }, null, 1))
console.log('items', items.length)
