// 2026-09-28 국제전자센터 굿즈샵 일괄 등록 (사용자 지시) — node scripts/shops/plans/make-2026-09-28-kukje.mjs
// 조사 기록: scripts/shops/research/kukje-2026-09-28-{A,C,D}.md (+ 9F B 는 runs/2026-09-28.md)
import { writeFileSync } from 'node:fs'
const D = '2026-09-28'
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const all = (open, close) => Object.fromEntries(DAYS.map((d) => [d, { open, close }]))
const src = (url, fields) => ({ url, fields, checked_at: D })
const ADDR = '서울 서초구 효령로 304'
const KEC = '1fee0987-c92d-4bdd-8273-dc4c01207c89'
const PARK = '주차 가능(유료)\n최초 40분 무료, 이후 10분당 1,000원'
const PARK_SRC = src('http://www.kecday.co.kr/bbs/board.php?bo_table=sisul', ['place_id', 'parking', 'parking_note'])
const BLD = ' 국제전자센터 상가는 매월 첫째·셋째 일요일 휴무이니 방문 전 확인해 주세요.'
const base = (f) => ({ addr: ADDR, place_id: KEC, parking: true, parking_note: PARK, sns_links: [], phone: null, hours: null, ...f })
const T = {
  naruto: '0ec61572-9a5b-47a6-9567-7d15a8433dd3', dragonball: 'c7c8efb0-41d2-4935-b0e6-5f9f59b2bc9e', shinchan: '5c4e930c-a5f4-4e5e-a9f0-93b3d705aae7',
  mha: 'b6a65af7-85e0-4390-9986-6057487c19d1', apothecary: '70ec9dbc-8eb6-41fd-bef2-9139a228fa86', kirby: '70c1ecc7-412d-4708-bdb8-5352d0017cc5',
  hokuto: '6853e38b-5ef6-4a33-912d-c693150aa4ab', bleach: '1027065f-cc43-424a-bc69-471cc38df7fd', onepiece: 'c80c180f-4b11-4a6b-8a7f-ec4b412ecf42',
  hxh: 'c0abe340-8f54-4c4d-b9e5-13dbb1ed7a47', nikke: '63f2a778-7dca-469d-a2c1-8b139d82637f', bluelock: '77a9bc04-00de-4071-baf2-571f4fcef31d',
  haikyu: '2a88af81-4e08-446f-befa-312110884a20', kimetsu: 'e3f9dbfd-e491-4433-9af1-6c0b146f5746', acnh: '7e5ef00d-897e-4259-b449-264d374deca6',
  digimon: '4b229a09-369d-4607-9d3b-04aa3f128c2c', chiikawa: 'b507243e-1408-47a1-9aeb-f4245127d3dc', sanrio: 'f6dff3d1-5a30-409d-849c-9a34d111b1be',
  kitty: '483b0cad-f3f2-466c-881c-e5cacc05912f', frieren: 'fb8c03af-9bdc-4fb2-8fef-8d9a7792873c', deathnote: 'ed0008f9-e8c2-45b0-b98c-a2058c4ee70c',
  tamagotchi: '2622be14-383e-4fef-af44-d863989a9a2e', keroro: '41e73c70-0c1c-4950-9a01-4c0fd75820c5', eva: '1a97869d-63fb-4d86-a098-2551356d835b',
  ultraman: '5fc0d2c0-661c-46ac-be2b-bc926492e272', ccs: '06c370c8-8630-4370-8db4-7691f6172d6e', hololive: 'ac52f935-18c9-4f95-b87a-bece558a74fe',
  jjk: '7fc6cb70-c059-40e3-86a4-39dc28b6b32c', csm: 'b4f20ef8-6f3b-438e-8efb-91ccfca790ac', gintama: 'cdc27204-c7f8-4f28-a4a7-fb7e8b7fc1b7',
  minecraft: '190cf353-e6f2-40ff-a66b-d7664555a949', pikmin: '105ebe04-c0db-4dcb-933e-c23a0c46e1e3', zzz: 'a6be5443-1fa4-460b-b408-fe9a72a505d9',
  miku: '94dea875-614e-4e2d-ba30-ea509385603b', inuyasha: 'a44bc564-3245-452b-b4d0-20848daadbc0', free: '8f6a0e89-6094-45d0-a11c-ab7306e8a024',
  railgun: 'db725d92-babb-40e0-ba6d-2cdbeec1298e', durarara: '50c28999-a2df-4e14-99bf-98bba5bc65db', danganronpa: '78defc03-2cc1-4c05-824f-543ead1c0e53',
  keion: '65510a89-9bec-4b5c-8216-dc24c8ce230b', bisque: 'e5e3810f-0e71-46c2-afb5-99f80b228541', aikatsu: 'b63d916c-7f00-4e5a-901c-acde7a88e9e8',
  edgerunners: '764e4601-6fdc-4074-a963-f069afa6384b', dorohedoro: '7c878f58-4f62-43b9-8c3a-fa1aabcc897f', saiki: 'd257e15e-f28c-4a88-82a6-c970af0cfd45',
  nijisanji: '63d2954e-2390-42ed-ad2c-af42c2a4b49c', sekai: 'f2658c7d-a3d0-4343-9b21-d0cab3d59ab8', geass: '2713b3f7-0a8b-4027-af94-cb7a8d2b65d0',
  aooni: '2ec35ee0-324f-4349-882b-ffda72a45ee7', rilakkuma: '5018bb5f-1019-4ac2-825d-b98610269f81',
}
const works = (keys, evidence) => keys.map((k) => ({ tag_id: T[k], primary: false, evidence }))

const items = [
  {
    action: 'insert', key: 'kukje-ichibankuji-seocho', brand: '이치방쿠지',
    fields: base({
      name: '제일복권(이치방쿠지) 서초점', floor_info: '국제전자센터 8층', cats: ['쿠지'], hours: all('11:00', '20:00'),
      shop_link: 'https://x.com/ICHIBANKUJI_fp', sns_links: ['https://x.com/ICHIBANKUJI_fp'],
      description: '반프레스토 제일복권(이치방쿠지) 공식 판매 매장으로, 국제전자센터 8층에 있습니다(운영 피규어프레소). 매일 11:00~20:00 영업하며 19:45에 결제를 마감합니다(공식 계정 안내). 문의는 공식 X DM으로 받습니다.' + BLD,
    }),
    goods_types: ['ichiban-kuji'],
    works: works(['naruto', 'dragonball', 'shinchan', 'mha', 'apothecary', 'kirby', 'hokuto', 'bleach', 'onepiece', 'hxh', 'nikke'], '공식 X 서초점 제일복권 입고 게시물(2026-06~07)'),
    sources: [src('https://x.com/ICHIBANKUJI_fp', ['name', 'floor_info', 'hours', 'description']), src('https://x.com/ICHIBANKUJI_fp/status/2078429500237619405', ['works']), src('https://x.com/ICHIBANKUJI_fp/status/2075422633013977339', ['works']), PARK_SRC],
    unconfirmed: ['unit', 'phone'], photo: 'needed',
  },
  {
    action: 'insert', key: 'kukje-kujibang', brand: '쿠지방',
    fields: base({
      name: '쿠지방 국제전자센터점', floor_info: '국제전자센터 8층 8123호', cats: ['쿠지'],
      shop_link: 'https://smartstore.naver.com/kujibang', sns_links: ['https://x.com/kujibang'],
      description: '정식판 이치방쿠지와 자체 쿠지, 경품 피규어를 파는 쿠지 전문점 쿠지방의 국제전자센터점으로, 8층 8123호에 있습니다. 실시간 온라인 쿠지 뽑기와 스마트스토어도 운영합니다(공식 계정 안내). 영업시간은 공식 안내가 없어 비워 두었습니다.' + BLD,
    }),
    goods_types: ['ichiban-kuji', 'self-kuji', 'figure-new'],
    works: works(['bluelock', 'dragonball'], '공식 X 정식판 쿠지 입고(2026-06-03)'),
    sources: [src('https://x.com/kujibang', ['name', 'floor_info', 'shop_link', 'description']), src('https://x.com/kujibang/status/2062008244521009591', ['works']), PARK_SRC],
    unconfirmed: ['hours', 'phone', 'second_unit'], photo: 'needed',
    notes: '게시물 제목 "국전 1호점" — 2호점 호수 공식 미확인',
  },
  {
    action: 'insert', key: 'kukje-cutepeople', brand: '큐트피플컴퍼니',
    fields: base({
      name: '큐트피플컴퍼니', floor_info: '국제전자센터 8층 115·116호', cats: ['가챠', '쿠지', '굿즈샵'],
      shop_link: 'https://smartstore.naver.com/cutepeopleco', sns_links: ['https://x.com/cutepeopleco', 'https://www.instagram.com/cutepeopleco', 'https://linktr.ee/cutepeopleco'],
      description: '이치방쿠지·가챠·피규어·누이·리멘트·블라인드 굿즈를 파는 매장으로, 국제전자센터 8층 115·116호에 있습니다. 온라인 스마트스토어도 함께 운영합니다. 영업시간은 공식 계정이 네이버 스마트플레이스로 안내합니다.' + BLD,
    }),
    goods_types: ['ichiban-kuji', 'gacha-new', 'figure-new', 'plushie-new'],
    works: works(['haikyu', 'kimetsu', 'acnh', 'hxh', 'digimon', 'chiikawa', 'kitty', 'frieren', 'deathnote', 'tamagotchi', 'keroro', 'eva'], '공식 X 매장 입고 게시물(2026-07~09)'),
    sources: [src('https://x.com/cutepeopleco', ['name', 'floor_info', 'description']), src('https://linktr.ee/cutepeopleco', ['shop_link', 'sns_links']),
      src('https://x.com/cutepeopleco/status/2104075333205151792', ['works']), src('https://x.com/cutepeopleco/status/2090739719265235292', ['works']),
      src('https://x.com/cutepeopleco/status/2080940250432672113', ['works']), src('https://x.com/cutepeopleco/status/2075857817018503464', ['works']), PARK_SRC],
    unconfirmed: ['hours', 'phone'], photo: 'needed',
  },
  {
    action: 'insert', key: 'kukje-kkuing', brand: '꾸잉양판점',
    fields: base({
      name: '꾸잉양판점 국전점', floor_info: '국제전자센터 8층 80·87호', cats: ['굿즈샵'],
      shop_link: 'https://www.instagram.com/kkuing_shop2/', sns_links: ['https://www.instagram.com/kkuing_shop2/', 'https://smartstore.naver.com/kkuing_shop'],
      description: '애니메이션 캐릭터 굿즈를 파는 꾸잉양판점의 2호점(국전점)으로, 국제전자센터 8층 80·87호에 있습니다. 본점은 홍대에 있습니다. 운영 시간은 공식 인스타그램 안내를 확인해 주세요.' + BLD,
    }),
    goods_types: ['keyring', 'acrylic-stand', 'figure-new'],
    works: works(['hxh', 'keroro'], '공식 인스타그램 국전점 입고 게시물(2026-03·09)'),
    sources: [src('https://www.instagram.com/kkuing_shop2/', ['name', 'floor_info', 'description']), src('https://www.instagram.com/kkuing_shop2/p/Ddx-I2TEqt4/', ['works']), src('https://www.instagram.com/kkuing_shop2/p/DVp6L87kZi3/', ['works']), PARK_SRC],
    unconfirmed: ['hours', 'phone'], photo: 'needed', notes: '소개 "운영 시간 14:00-19:00" 문구가 DM 문의 시간과 섞여 모호 → hours 비움. 한 게시물은 8087호 표기',
  },
  {
    action: 'insert', key: 'kukje-topiko', brand: '토피코',
    fields: base({
      name: '토피코 국제전자센터점', floor_info: '국제전자센터 3층', cats: ['가챠', '쿠지'], phone: '0507-1449-0992', hours: all('10:00', '20:00'),
      shop_link: 'https://app.topiko.me/store/173347407214417161', sns_links: ['https://www.instagram.com/topiko.official'],
      description: '캡슐토이(가챠)·쿠지 전문 체인 토피코(TOPIKO)의 국제전자센터점으로, 3층에 있습니다. 매일 10:00~20:00 영업하며 격주 일요일 휴무입니다(공식 매장 안내). 가챠 자판기는 카드 결제가 됩니다.',
    }),
    goods_types: ['gacha-new', 'ichiban-kuji'],
    works: works(['ultraman', 'ccs', 'sanrio', 'hololive', 'mha', 'tamagotchi', 'keroro', 'jjk', 'csm', 'kimetsu', 'gintama', 'minecraft', 'pikmin', 'onepiece', 'nikke'], '토피코 공식 앱 국제전자센터점 입고 소식(2026-09-10·09-18)·진행 쿠지'),
    sources: [src('https://app.topiko.me/store/173347407214417161', ['name', 'floor_info', 'hours', 'phone', 'sns_links', 'works', 'description']), PARK_SRC],
    unconfirmed: ['unit'], photo: 'needed', notes: '공식 목록에 국전점 1곳 — 팬 지도의 두 번째 구역은 같은 매장으로 봄',
  },
  {
    action: 'insert', key: 'kukje-funhave', brand: '펀해브',
    fields: base({
      name: '펀해브', floor_info: '국제전자센터 3층 3호 (전망 엘리베이터 앞)', cats: ['굿즈샵'],
      shop_link: 'https://x.com/Yuzuriha_krUni', sns_links: ['https://x.com/Yuzuriha_krUni'],
      description: '서브컬처 모바일 게임 굿즈(현지 콜라보 상품 위주)와 하츠네 미쿠 인형·굿즈를 주로 다루는 굿즈샵으로, 국제전자센터 3층 전망 엘리베이터 앞에 있습니다(2026년 2월 오픈). 문의는 카카오톡 오픈채팅으로 받습니다.' + BLD,
    }),
    goods_types: ['plushie-new', 'keyring', 'ichiban-kuji'],
    works: [{ tag_id: T.miku, primary: true, evidence: '공식 X 소개 "미쿠 인형 및 굿즈 위주" + 2026-09-19 입고' }, ...works(['zzz'], '공식 X 입고 게시물(2026-09-19·21)')],
    sources: [src('https://x.com/Yuzuriha_krUni', ['name', 'floor_info', 'description', 'works']), src('https://x.com/Yuzuriha_krUni/status/2019736275746726187', ['description']), src('https://x.com/Yuzuriha_krUni/status/2101198549577077087', ['works']), PARK_SRC],
    unconfirmed: ['hours', 'phone'], photo: 'needed',
  },
  {
    action: 'insert', key: 'kukje-ggcomic', brand: '지지코믹마켓',
    fields: base({
      name: '지지코믹마켓 국전점', floor_info: '국제전자센터 3·6·7·9층', cats: ['쿠지', '굿즈샵', '가챠'], hours: all('11:00', '20:00'),
      shop_link: 'https://band.us/@ggcomic', sns_links: ['https://x.com/GG_comic_market', 'https://www.instagram.com/gg_comic_market/', 'https://band.us/@ggcomic'],
      description: '자체 쿠지와 제일복권, 피규어·가챠·굿즈를 파는 지지코믹마켓의 국전점으로, 국제전자센터 3·6·7·9층에 매장이 나뉘어 있습니다. 3층은 하위상 교환·피규어 매입, 6층은 방문 수령, 7층은 고객센터를 맡습니다. 매일 11:00~20:00 영업합니다(공식 이용 안내).' + BLD,
    }),
    goods_types: ['self-kuji', 'ichiban-kuji', 'figure-new', 'gacha-new'],
    works: works(['inuyasha'], '공식 X 전 지점(국전 포함) 이누야샤 천장쿠지(2026-08-29)'),
    sources: [src('https://band.us/band/93816819/post/17264', ['name', 'floor_info', 'hours', 'description']), src('https://x.com/GG_comic_market', ['sns_links']), src('https://x.com/GG_comic_market/status/2093547466649927704', ['works']), PARK_SRC],
    unconfirmed: ['unit', 'phone'], photo: 'needed',
  },
  {
    action: 'insert', key: 'kukje-conbiniani', brand: '콘비니애니',
    fields: base({
      name: '콘비니애니', floor_info: '국제전자센터 7층 7122호', cats: ['굿즈샵'],
      hours: { mon: { open: '13:00', close: '19:00' }, tue: { open: '13:00', close: '19:00' }, wed: { open: '13:00', close: '19:00' }, thu: { open: '13:00', close: '19:00' }, fri: { open: '13:00', close: '19:00' }, sat: { open: '13:00', close: '19:00' }, sun: { open: '13:00', close: '19:00' } },
      shop_link: 'https://www.instagram.com/conbiniani/', sns_links: ['https://www.instagram.com/conbiniani/', 'https://x.com/conbiniani', 'https://m.smartstore.naver.com/conbiniani'],
      description: '추억의 애니메이션 굿즈와 피규어를 주로 다루는 굿즈샵 CONBINI ANI(콘비니애니)로, 국제전자센터 7층 7122호에 있습니다. 13:00~19:00 영업하며 매월 첫째·셋째 일요일 휴무입니다(2025년 5월 공식 안내). 매주 인스타그램에 오프라인 입고 소식을 올립니다.',
    }),
    goods_types: ['figure-new', 'acrylic-stand'],
    works: works(['gintama', 'miku', 'free', 'railgun', 'eva', 'durarara', 'danganronpa', 'hxh', 'keion', 'bisque'], '공식 인스타그램 [오프라인 입고] 게시물(2026-09-16·22)'),
    sources: [src('https://www.instagram.com/p/DKJ0iGZxLXV/', ['floor_info', 'hours']), src('https://www.instagram.com/conbiniani/', ['name', 'sns_links', 'description']),
      src('https://www.instagram.com/p/DdlpRbNINul/', ['works']), src('https://www.instagram.com/p/DdWaIGhE51G/', ['works']), PARK_SRC],
    unconfirmed: ['phone', 'hours_recency'], photo: 'needed', notes: '1·3주 일요일 휴무는 hours 구조로 표현 불가 → description',
  },
  {
    action: 'insert', key: 'kukje-nonno21', brand: '논노21',
    fields: base({
      name: '논노21', floor_info: '국제전자센터 9층', cats: ['굿즈샵'], phone: '02-3465-0094',
      shop_link: 'https://www.nonno21.com/',
      description: '애니메이션 캐릭터 피규어를 파는 논노21의 오프라인 매장으로, 국제전자센터 9층에 있습니다. 온라인 피규어몰도 함께 운영하며, 휴무는 국제전자센터 상가 휴무를 따릅니다(공식 공지). 영업시간은 공식 안내가 없어 비워 두었습니다.',
    }),
    goods_types: ['figure-new'],
    sources: [src('https://www.nonno21.com/', ['name', 'phone', 'floor_info', 'shop_link']), src('https://www.nonno21.com/board/board.html?code=nonno21_board14&page=1&type=v&num1=999801&num2=00000&lock=N', ['description']), PARK_SRC],
    unconfirmed: ['hours', 'unit'], photo: 'needed', notes: '공식 푸터 "9층 9078호" — 건물 옛 목록 9-21호와 달라 호수 비움',
  },
  {
    action: 'insert', key: 'kukje-denden', brand: '덴덴샵&피규어버블',
    fields: base({
      name: '덴덴샵&피규어버블 본점', floor_info: '국제전자센터 9층 26호', cats: ['쿠지', '굿즈샵', '가챠'],
      shop_link: 'https://x.com/figurebubble', sns_links: ['https://x.com/figurebubble', 'https://www.instagram.com/denden_official__'],
      description: '이치방쿠지·애니 굿즈·피규어·가챠를 파는 덴덴샵&피규어버블의 본점으로, 국제전자센터 9층 26호에 있습니다(남양주점은 별도). 영업시간은 공식 계정 소개에 없어 비워 두었습니다.' + BLD,
    }),
    goods_types: ['ichiban-kuji', 'figure-new', 'gacha-new'],
    works: works(['mha'], '공식 X 본점 한정 이치방쿠지(2026-06-26)'),
    sources: [src('https://x.com/figurebubble', ['name', 'floor_info', 'sns_links']), src('https://x.com/figurebubble/status/2070403774359708140', ['works', 'description']), PARK_SRC],
    unconfirmed: ['hours', 'phone'], photo: 'needed',
  },
  {
    action: 'insert', key: 'kukje-kyouma-main', brand: '쿄우마샵',
    fields: base({
      name: '쿄우마샵 본점', floor_info: '국제전자센터 2층', cats: ['가챠', '굿즈샵', '쿠지'],
      shop_link: 'https://m.smartstore.naver.com/kyouma', sns_links: ['https://x.com/kyoumashop', 'https://x.com/kyouma_gacha', 'https://www.instagram.com/kyouma_official/'],
      description: '서브컬처 피규어·가챠·굿즈 전문점 쿄우마샵의 본점으로, 국제전자센터 2층에 있습니다. 제일복권과 공식 MD도 판매하며, 같은 건물 9층에 카드가챠 매장이 있습니다. 영업시간은 공식 안내가 없어 비워 두었습니다.' + BLD,
    }),
    goods_types: ['gacha-new', 'figure-new', 'ichiban-kuji', 'acrylic-stand'],
    works: works(['csm'], '공식 X 극장판 체인소 맨 레제편 제일복권 — 2층 본점·9층 1·2호점(2025-10-02)'),
    sources: [src('https://x.com/kyoumashop', ['name', 'sns_links']), src('https://x.com/kyoumashop/status/2097178380471050649', ['floor_info', 'description']), src('https://x.com/kyoumashop/status/1973656044372136155', ['works']), PARK_SRC],
    unconfirmed: ['unit', 'hours', 'phone'], photo: 'needed', notes: 'kyoumashop.com 만료(2026-08-07) — 링크로 쓰지 않음. 소개에 3F 도 있으나 지점명 미확인',
  },
  {
    action: 'insert', key: 'kukje-kyouma-9f-1', brand: '쿄우마샵',
    fields: base({
      name: '쿄우마샵 카드가챠 1호점', floor_info: '국제전자센터 9층', cats: ['가챠'],
      shop_link: 'https://x.com/kyouma_gacha', sns_links: ['https://x.com/kyouma_gacha', 'https://x.com/kyoumashop'],
      description: '쿄우마샵의 가챠·카드가챠 매장(1호점)으로, 국제전자센터 9층에 있습니다. 본점은 같은 건물 2층입니다. 영업시간은 공식 안내가 없어 비워 두었습니다.' + BLD,
    }),
    goods_types: ['gacha-new', 'card-new'],
    works: works(['aikatsu'], '공식 X "국제전자센터 9층 카드가챠 1호점에서 판매 중" 아이엠스타(아이카츠!) 가챠(2026-04-09)'),
    sources: [src('https://x.com/kyouma_gacha/status/2042162279970750965', ['name', 'floor_info', 'works']), PARK_SRC],
    unconfirmed: ['unit', 'hours', 'phone'], photo: 'needed',
  },
  {
    action: 'insert', key: 'kukje-ilovetoyz', brand: '아이러브토이즈',
    fields: base({
      name: '아이러브토이즈 국전점', floor_info: '국제전자센터 9층 97호', cats: ['굿즈샵'], phone: '02-3465-0880',
      shop_link: 'https://ilovetoyz.co.kr/', sns_links: ['https://x.com/ilovetoyzobitsu'],
      description: '정품 애니 굿즈·이치방쿠지·피규어를 파는 아이러브토이즈(오비츠 공식 파트너)의 국제전자센터점으로, 9층 97호에 있습니다. 평일 11:00~20:00 영업합니다(공식 안내, 주말 시간은 공식 표기 없음).' + BLD,
    }),
    goods_types: ['figure-new', 'ichiban-kuji', 'plushie-new'],
    works: works(['edgerunners'], '공식 X "홍대점&국전점 입고" 사이버펑크 엣지러너 이치방쿠지(2025-12-09)'),
    sources: [src('https://ilovetoyz.co.kr/', ['name', 'floor_info', 'phone', 'hours', 'description']), src('https://x.com/ilovetoyzobitsu', ['sns_links']), src('https://x.com/ilovetoyzobitsu/status/1998234443849617452', ['works']), PARK_SRC],
    unconfirmed: ['hours_weekend'], photo: 'needed', notes: '평일 시간만 공식 → hours 구조 비우고 description',
  },
  {
    action: 'insert', key: 'kukje-itemleo', brand: '아이템레오',
    fields: base({
      name: '아이템레오', floor_info: '국제전자센터 9층 42·44호', cats: ['굿즈샵'],
      shop_link: 'https://smartstore.naver.com/itemleo', sns_links: ['https://x.com/item_leo', 'https://pf.kakao.com/_zllsxj'],
      description: '일본 애니메이션·만화 공식 굿즈와 피규어(경품·넨도로이드·스케일 피규어 등), 제일복권을 파는 매장으로, 국제전자센터 9층 42·44호(연결)에 있습니다. 스케일 피규어 예약 판매도 합니다. 문의는 카카오톡 채널로 받습니다.' + BLD,
    }),
    goods_types: ['figure-new', 'can-badge-new', 'acrylic-stand', 'keyring', 'plushie-new', 'ichiban-kuji'],
    works: works(['dorohedoro', 'keroro', 'saiki', 'naruto', 'haikyu', 'nijisanji', 'csm', 'sekai', 'sanrio', 'jjk', 'mha', 'apothecary', 'keion'], '공식 X 입고 게시물(2026-09-18~21)'),
    sources: [src('https://x.com/item_leo', ['name', 'floor_info', 'shop_link', 'sns_links', 'description']),
      src('https://x.com/item_leo/status/2101974589421367734', ['works']), src('https://x.com/item_leo/status/2101216628499525693', ['works']), src('https://x.com/item_leo/status/2101185938236014998', ['works']),
      src('https://x.com/item_leo/status/2100891925985550518', ['works']), src('https://x.com/item_leo/status/2100891135678038278', ['works']), PARK_SRC],
    unconfirmed: ['hours', 'phone'], photo: 'needed',
  },
  {
    action: 'insert', key: 'kukje-kujimania', brand: '쿠지매니아',
    fields: base({
      name: '쿠지매니아 국전점', floor_info: '국제전자센터 9층 중앙 에스컬레이터 앞', cats: ['쿠지'], hours: all('11:00', '20:00'),
      shop_link: 'https://x.com/kuji_mania', sns_links: ['https://x.com/kuji_mania', 'https://pf.kakao.com/_exfXkn/chat'],
      description: '자체 복권(쿠지)·대리 쿠지와 엽서·클리어 카드·미니 피규어를 파는 쿠지 전문점으로, 국제전자센터 9층 중앙 에스컬레이터 쪽에 있습니다. 11:00~20:00 영업합니다(공식 계정 안내). 중고 굿즈 매입은 예약제입니다(금요일 제외).' + BLD,
    }),
    goods_types: ['self-kuji', 'figure-new', 'card-new'],
    works: works(['geass', 'hxh', 'aooni', 'rilakkuma'], '공식 X 입고 게시물(2026-09-23)'),
    sources: [src('https://x.com/kuji_mania', ['name', 'floor_info', 'hours', 'description']), src('https://x.com/kuji_mania/status/2042493742129823912', ['description']),
      src('https://x.com/kuji_mania/status/2102670519485222989', ['works']), src('https://x.com/kuji_mania/status/2102665115015459088', ['works']), src('https://x.com/kuji_mania/status/2102664639159128108', ['works']), src('https://x.com/kuji_mania/status/2102580732296360285', ['works']), PARK_SRC],
    unconfirmed: ['unit', 'phone', 'branches'], photo: 'needed', notes: '팬 지도의 1·3호점/2호점 구분은 공식 근거 없음 → 한 행',
  },
  {
    action: 'insert', key: 'kukje-hobbypark', brand: '하비파크',
    fields: base({
      name: '하비파크 국제전자점', floor_info: '국제전자센터 9층 34호', cats: ['프라모델'], phone: '02-574-1901', hours: all('10:30', '19:00'),
      shop_link: 'https://www.hobbypark.co.kr/',
      description: '건담 프라모델(HG·RG·MG·PG)과 전차·비행기·함선 프라모델, 넨도로이드·figma 등 완성품 피규어, 도료·공구, 철도모형을 파는 하비파크(동보하비파크)의 국제전자점으로, 9층 34호에 있습니다. 매일 10:30~19:00 영업하며 매월 첫째·셋째 일요일은 휴무입니다(공식 안내).',
    }),
    goods_types: ['plamodel-new', 'figure-new'],
    sources: [src('https://www.hobbypark.co.kr/', ['name', 'floor_info', 'phone', 'hours', 'description']), src('https://www.hobbypark.co.kr/bbs/board.php?bo_table=notice&wr_id=48', ['description']), PARK_SRC],
    unconfirmed: [], photo: 'needed', notes: '본점은 신월본점(국전 외). 지점 취급 작품 공식 표기 없음',
  },
]

// 기존 국전 10곳 — 주차 안내를 건물 공식 값으로 교체 (방문 글 기준 문구 제거)
const OLD = [
  ['15c0501e-486c-42e5-965e-ff2dc2400bf1', '2026-09-26T14:18:03.537379+00:00'], ['1868a417-7312-4991-8d7a-6373c648f31f', '2026-09-26T14:18:04.503157+00:00'],
  ['1bdef20f-f701-41d0-bab8-ccfc66c03d85', '2026-09-26T14:18:01.992635+00:00'], ['2f1321e8-39a4-4f29-8f50-6ee8a82c6e66', '2026-09-26T14:18:04.015448+00:00'],
  ['42123449-2741-4314-8156-0689aff00bf0', '2026-09-26T14:18:06.566384+00:00'], ['94f6d97c-e40c-45b6-8c42-9cb878897482', '2026-09-26T14:18:03.054043+00:00'],
  ['abfc89ce-5a75-4e84-b945-58df332651ce', '2026-09-26T14:18:06.096185+00:00'], ['cb797d3d-4529-49d6-a889-36faf49d5654', '2026-09-26T14:18:05.473486+00:00'],
  ['da4b3714-9c6f-490d-ba29-f8e6810d205f', '2026-09-26T14:18:02.569856+00:00'], ['fcd66bed-838b-4de2-93f9-633a41e38600', '2026-09-26T14:18:04.97245+00:00'],
]
for (const [shop_id, expect_updated_at] of OLD) {
  items.push({
    action: 'update', key: `kukje-parking-${shop_id.slice(0, 8)}`, shop_id, expect_updated_at,
    fields: { parking_note: PARK }, overwrite: ['parking_note'],
    reason: '국제전자센터 공식 시설안내(kecday.co.kr) 주차 요금으로 교체 — 2026-01 방문 글 기준 할인 문구·"방문 기준" 표기 제거',
    sources: [PARK_SRC],
  })
}
writeFileSync('scripts/shops/plans/2026-09-28-kukje.json', JSON.stringify({ name: `${D}-kukje`, items }, null, 1))
console.log('items', items.length)
