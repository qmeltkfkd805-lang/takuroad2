// 2026-09-28 국제전자센터 2차 등록 (사용자 요청 "계속") — node scripts/shops/plans/make-2026-09-28-kukje-c.mjs
// 발견: 가챠맵 국전 목록(research/kukje-gachamap-2026-09-28.md) → 확인: 각 매장 공식 IG/X (research/kukje-2026-09-28-{E,F}.md)
import { writeFileSync } from 'node:fs'
const D = '2026-09-28'
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const all = (open, close) => Object.fromEntries(DAYS.map((d) => [d, { open, close }]))
const wdwe = (wd, we) => Object.fromEntries(DAYS.map((d) => [d, ['sat', 'sun'].includes(d) ? we : wd]))
const src = (url, fields) => ({ url, fields, checked_at: D })
const KEC = '1fee0987-c92d-4bdd-8273-dc4c01207c89'
const PARK = '주차 가능(유료)\n최초 40분 무료, 이후 10분당 1,000원'
const PARK_SRC = src('http://www.kecday.co.kr/bbs/board.php?bo_table=sisul', ['place_id', 'parking', 'parking_note'])
const BLD = ' 국제전자센터 상가는 매월 첫째·셋째 일요일 휴무이니 방문 전 확인해 주세요.'
const base = (f) => ({ addr: '서울 서초구 효령로 304', place_id: KEC, parking: true, parking_note: PARK, sns_links: [], phone: null, hours: null, ...f })
const T = {
  haikyu: '2a88af81-4e08-446f-befa-312110884a20', pokemon: '6200fb96-d722-4cbf-b09c-d5967f598ee7', gintama: 'cdc27204-c7f8-4f28-a4a7-fb7e8b7fc1b7',
  conan: 'a48e942e-23f9-4900-ad93-adedb29d92ce', aot: '46d1cc6a-f88b-46e2-b4ec-d70dcf0be740', sanrio: 'f6dff3d1-5a30-409d-849c-9a34d111b1be',
  sakamoto: '3ebaa72f-8569-4efe-ae20-35b05f1cdb0b', miffy: '286467d0-d6fd-433f-b655-e35e029fe3ce', chiikawa: 'b507243e-1408-47a1-9aeb-f4245127d3dc',
  csm: 'b4f20ef8-6f3b-438e-8efb-91ccfca790ac', bleach: '1027065f-cc43-424a-bc69-471cc38df7fd', mha: 'b6a65af7-85e0-4390-9986-6057487c19d1',
  keion: '65510a89-9bec-4b5c-8216-dc24c8ce230b', bisque: 'e5e3810f-0e71-46c2-afb5-99f80b228541', miku: '94dea875-614e-4e2d-ba30-ea509385603b',
  kimetsu: 'e3f9dbfd-e491-4433-9af1-6c0b146f5746', jojo: '5cda9087-caa0-4010-8e9d-bb5d577e995b', kitty: '483b0cad-f3f2-466c-881c-e5cacc05912f',
  acnh: '7e5ef00d-897e-4259-b449-264d374deca6', hxh: 'c0abe340-8f54-4c4d-b9e5-13dbb1ed7a47',
}
const works = (keys, evidence) => keys.map((k) => ({ tag_id: T[k], primary: false, evidence }))
const ANILABS_LINKS = ['https://www.instagram.com/ani_labs_official/', 'https://x.com/ani__labs', 'https://www.threads.com/@ani_labs_official', 'https://band.us/@anilabs', 'https://litt.ly/anilabs', 'https://anilabs.kr/']
const ANILABS_HOURS = wdwe({ open: '13:00', close: '20:00' }, { open: '11:00', close: '20:00' })

const items = [
  {
    action: 'insert', key: 'kukje-anilabs-5f', brand_links: ANILABS_LINKS,
    fields: base({
      name: '애니랩스 국제전자센터점', floor_info: '국제전자센터 5층', cats: ['굿즈샵', '쿠지'], hours: ANILABS_HOURS,
      shop_link: 'https://anilabs.kr/', sns_links: ['https://www.instagram.com/ani_labs_official/', 'https://x.com/ani__labs', 'https://band.us/@anilabs'],
      description: '피규어·쿠지(자체 쿠지 포함)·굿즈를 파는 애니랩스(ANILABS)의 국제전자센터 5층 매장입니다. 같은 건물 3층에 가챠 매장(애니랩스 가챠점)이 있습니다. 평일 13:00~20:00, 주말 11:00~20:00 영업하며 매월 첫째·셋째 일요일은 휴무입니다(공식 인스타그램 안내).',
    }),
    goods_types: ['figure-new', 'self-kuji', 'ichiban-kuji'],
    sources: [src('https://anilabs.kr/', ['name', 'floor_info', 'description', 'goods_types']), src('https://www.instagram.com/ani_labs_official/', ['hours', 'sns_links']), PARK_SRC],
    unconfirmed: ['unit', 'phone', 'works'], photo: 'needed',
    notes: '공식 소개 "국제전자센터 5층/3층/8층" — 8층은 매장명·취급 근거 없어 보류. 신도림점(테크노마트 B1)은 별도 후보',
  },
  {
    action: 'insert', key: 'kukje-anilabs-3f', brand_links: ANILABS_LINKS,
    fields: base({
      name: '애니랩스 가챠점', floor_info: '국제전자센터 3층', cats: ['가챠'], hours: ANILABS_HOURS,
      shop_link: 'https://www.instagram.com/ani_labs_official/', sns_links: ['https://www.instagram.com/ani_labs_official/', 'https://x.com/ani__labs'],
      description: '애니랩스(ANILABS)의 가챠(캡슐토이) 매장으로, 국제전자센터 3층에 있습니다. 피규어·쿠지 매장은 같은 건물 5층입니다. 평일 13:00~20:00, 주말 11:00~20:00 영업하며 매월 첫째·셋째 일요일은 휴무입니다(공식 인스타그램 안내).',
    }),
    goods_types: ['gacha-new'],
    works: works(['haikyu', 'pokemon', 'gintama', 'conan', 'aot', 'sanrio', 'sakamoto', 'miffy'], '공식 인스타그램 "국제전자센터 3층 애니랩스가챠점" 가챠 입고(2026-08-20·28)'),
    sources: [src('https://www.instagram.com/p/DcnJZLGCQW7/', ['name', 'floor_info', 'works']), src('https://www.instagram.com/p/DcQkuPLCRlB/', ['works']), src('https://www.instagram.com/ani_labs_official/', ['hours']), PARK_SRC],
    unconfirmed: ['unit', 'phone'], photo: 'needed',
  },
  {
    action: 'insert', key: 'kukje-moeda',
    fields: base({
      name: '모에다', floor_info: '국제전자센터 3층 151호', cats: ['굿즈샵'], hours: all('10:00', '20:00'),
      shop_link: 'https://www.instagram.com/moeda_151/', sns_links: ['https://www.instagram.com/moeda_151/'],
      description: '인형·피규어·캐릭터 굿즈와 점프샵 제품을 파는 굿즈샵으로, 국제전자센터 3층 151호에 있습니다. 10:00~20:00 영업하며 매월 첫째·셋째 일요일은 휴무입니다(공식 인스타그램 안내). 9층 토이스카이와 같은 계정으로 소식을 올립니다.',
    }),
    goods_types: ['plushie-new', 'figure-new'],
    works: works(['chiikawa', 'csm', 'bleach', 'mha'], '공식 인스타그램 모에다 입고 게시물(2026-08~09)'),
    sources: [src('https://www.instagram.com/moeda_151/', ['name', 'floor_info', 'hours', 'description']), src('https://www.instagram.com/p/DdaPwFnEvM_/', ['works']), src('https://www.instagram.com/p/DcC5gYhyP5n/', ['works']),
      src('https://www.instagram.com/p/DbkDk3uklUq/', ['works']), src('https://www.instagram.com/p/DbkDNGlkjbk/', ['works']), PARK_SRC],
    unconfirmed: ['phone'], photo: 'needed',
  },
  {
    action: 'insert', key: 'kukje-nizigen',
    fields: base({
      name: '니지겐상회', floor_info: '국제전자센터 8층 8031호', cats: ['쿠지', '굿즈샵', '가챠'], hours: wdwe({ open: '12:00', close: '20:00' }, { open: '11:00', close: '20:00' }),
      shop_link: 'https://www.instagram.com/nizigen_store/', sns_links: ['https://www.instagram.com/nizigen_store/', 'https://band.us/band/101694114'],
      description: '쿠지·경품 피규어(반프레스토·세가·후류·타이토)·굿즈·가챠를 파는 매장으로, 국제전자센터 8층 8031호에 있습니다. 평일 12:00~20:00, 주말 11:00~20:00 영업하며 매월 첫째·셋째 일요일은 휴무입니다(공식 인스타그램 안내). 인스타그램 DM으로 택배 주문을 받습니다.',
    }),
    goods_types: ['ichiban-kuji', 'figure-new', 'gacha-new', 'plushie-new'],
    works: works(['chiikawa', 'mha', 'keion', 'bisque', 'miku', 'csm', 'kimetsu'], '공식 인스타그램 입고 게시물(2026-09-18~23)'),
    sources: [src('https://www.instagram.com/nizigen_store/', ['name', 'floor_info', 'hours', 'description']), src('https://www.instagram.com/p/DXEV2CqD92a/', ['floor_info', 'hours']),
      src('https://www.instagram.com/p/DdnxWWXPIKp/', ['works']), src('https://www.instagram.com/p/DdnWsLuT_DN/', ['works']), src('https://www.instagram.com/p/DdiayTqD1D_/', ['works']),
      src('https://www.instagram.com/p/DdiXJV-Puu9/', ['works']), src('https://www.instagram.com/p/Ddc8B00zqSt/', ['works']), PARK_SRC],
    unconfirmed: ['phone'], photo: 'needed',
  },
  {
    action: 'insert', key: 'kukje-otakusarangbang',
    fields: base({
      name: '오타쿠사랑방', floor_info: '국제전자센터 6층 45·46호', cats: ['중고샵', '굿즈샵'],
      shop_link: 'https://m.smartstore.naver.com/otakusarangbang', sns_links: ['https://www.instagram.com/otaku_sarangbang/'],
      description: '중고 피규어·굿즈와 제일복권 경품을 파는 중고 굿즈 매장으로, 국제전자센터 6층 45·46호에 있습니다. 죠죠의 기묘한 모험 상품을 특히 많이 다룹니다. 영업시간은 공식 안내가 없어 비워 두었습니다.' + BLD,
    }),
    goods_types: ['figure-new', 'acrylic-stand', 'keyring'],
    works: [{ tag_id: T.jojo, primary: true, evidence: '공식 인스타그램 죠죠 제일복권·굿즈 입고 다수(2026-09-10~23)' }, ...works(['mha', 'miku', 'keion'], '공식 인스타그램 입고 게시물(2026-08-15·09-03)')],
    sources: [src('https://www.instagram.com/otaku_sarangbang/', ['name', 'floor_info', 'shop_link']), src('https://www.instagram.com/p/DcP9FHuk-D8/', ['description']),
      src('https://www.instagram.com/p/DdnnQbwE4Dk/', ['works']), src('https://www.instagram.com/p/Dc0JnseE_qh/', ['works']), src('https://www.instagram.com/p/DcDDXqBk1oW/', ['works']), PARK_SRC],
    unconfirmed: ['hours', 'phone'], photo: 'needed',
  },
  {
    action: 'insert', key: 'kukje-kaguteng',
    fields: base({
      name: '카구탱', floor_info: '국제전자센터 7층 45호', cats: ['굿즈샵', '가챠'],
      hours: { ...all('11:00', '20:00'), tue: null },
      shop_link: 'https://smartstore.naver.com/kaguteng', sns_links: ['https://www.instagram.com/kaguteng.club/', 'https://linktr.ee/kagutengclub'],
      description: '치이카와·산리오 등 일본 정품 캐릭터 굿즈를 소량 입고하는 셀렉샵 카구탱(Kaguteng Club)으로, 국제전자센터 7층 45호에 있습니다(2026년 6월 오픈). 피규어·가챠·마스코트 키링도 있습니다. 11:00~20:00 영업하며 매주 화요일과 매월 첫째·셋째 일요일은 휴무입니다(공식 인스타그램 안내).',
    }),
    goods_types: ['plushie-new', 'keyring', 'gacha-new', 'figure-new'],
    works: works(['chiikawa', 'sanrio', 'kitty', 'acnh'], '공식 인스타그램 입고 게시물(2026-08)'),
    sources: [src('https://www.instagram.com/kaguteng.club/', ['name', 'floor_info', 'hours', 'description']), src('https://linktr.ee/kagutengclub', ['shop_link', 'sns_links']),
      src('https://www.instagram.com/p/Dcm-3KCE9A-/', ['works']), src('https://www.instagram.com/p/DcU9I9hEwDO/', ['works']), src('https://www.instagram.com/p/DcKvBOvEwL3/', ['works']), PARK_SRC],
    unconfirmed: ['phone'], photo: 'needed',
  },
  {
    action: 'insert', key: 'kukje-toysky',
    fields: base({
      name: '토이스카이', floor_info: '국제전자센터 9층 110호', cats: ['굿즈샵'],
      shop_link: 'https://x.com/toysky9110_', sns_links: ['https://x.com/toysky9110_', 'https://www.instagram.com/kimhyun6283/'],
      description: '핫토이·반다이 피규어와 굿즈, 제일복권을 파는 매장으로, 국제전자센터 9층 110호에 있습니다(3층 스카이토이와 다른 매장). 구매 문의는 공식 계정 DM으로 받습니다. 영업시간은 공식 안내가 없어 비워 두었습니다.' + BLD,
    }),
    goods_types: ['figure-new', 'ichiban-kuji'],
    works: works(['hxh', 'mha'], '공식 인스타그램 입고 게시물(2026-07-14·16)'),
    sources: [src('https://x.com/toysky9110_', ['name', 'floor_info', 'description']), src('https://www.instagram.com/kimhyun6283/', ['sns_links']),
      src('https://www.instagram.com/kimhyun6283/p/Da2aPrsyeVL/', ['works']), src('https://www.instagram.com/kimhyun6283/p/DazBQ5cyb-y/', ['works']), PARK_SRC],
    unconfirmed: ['hours', 'phone', 'second_unit'], photo: 'needed', notes: '모에다 계정에 "토이스카이 1·2호점", "9층 45호" 표기 — 2호점 위치 확인 필요',
  },
  {
    action: 'update', key: 'kukje-figurepresso-ig', shop_id: '1bdef20f-f701-41d0-bab8-ccfc66c03d85', expect_updated_at: '2026-09-28T04:17:49.030303+00:00',
    fields: { sns_links: ['https://x.com/figurepresso', 'https://www.instagram.com/figurepresso_official/'] },
    overwrite: ['sns_links'], reason: '공식 인스타그램(피규어프레소 서초 1호점) 추가 — 소개에 서초점 X 연결',
    sources: [src('https://www.instagram.com/figurepresso_official/', ['sns_links'])],
  },
]
writeFileSync('scripts/shops/plans/2026-09-28-kukje-c.json', JSON.stringify({ name: `${D}-kukje-c`, items }, null, 1))
console.log('items', items.length)
