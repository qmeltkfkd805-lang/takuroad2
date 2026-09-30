// 2026-09-28 국제전자센터 4차 — 공식 계정은 있는데 층이 없던 곳을 방문 후기로 층 확인(사용자 지시, 지침 3-5 의 2-1)
// + 같은 건물·같은 이름은 한 행(사용자 지시): 토이스카이 2호점은 기존 토이스카이 행 설명에 층·호점별로
// 조사 기록: research/kukje-2026-09-28-H.md
import { writeFileSync } from 'node:fs'
const D = '2026-09-28'
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const all = (open, close) => Object.fromEntries(DAYS.map((d) => [d, { open, close }]))
const src = (url, fields) => ({ url, fields, checked_at: D })
const KEC = '1fee0987-c92d-4bdd-8273-dc4c01207c89'
const PARK = '주차 가능(유료)\n최초 40분 무료, 이후 10분당 1,000원'
const PARK_SRC = src('http://www.kecday.co.kr/bbs/board.php?bo_table=sisul', ['place_id', 'parking', 'parking_note'])
const BLD = '국제전자센터 상가는 매월 첫째·셋째 일요일 휴무이니 방문 전 확인해 주세요.'
const base = (f) => ({ addr: '서울 서초구 효령로 304', place_id: KEC, parking: true, parking_note: PARK, sns_links: [], phone: null, hours: null, ...f })

const items = [
  {
    action: 'insert', key: 'kukje-thegoods', brand_links: ['https://x.com/thegoods_suwon', 'https://www.instagram.com/thegoods_suwon/'],
    fields: base({
      name: '더굿즈 국전점', floor_info: '국제전자센터 5층', cats: ['쿠지'],
      shop_link: 'https://www.instagram.com/thegoods_kookjeon/', sns_links: ['https://www.instagram.com/thegoods_kookjeon/'],
      description: `프리미엄 가챠샵 더굿즈의 국제전자센터 매장으로, 5층에서 자체 쿠지를 판매합니다. 영업시간은 공식 안내가 없어 비워 두었습니다.\n${BLD}`,
    }),
    goods_types: ['self-kuji'],
    sources: [src('https://www.instagram.com/thegoods_suwon/p/DdlcTalGmXJ/', ['name', 'sns_links']), src('https://www.instagram.com/thegoods_kookjeon/', ['shop_link']),
      src('https://www.instagram.com/p/DbkzOk5Exj3/', ['floor_info', 'goods_types']), src('https://www.youtube.com/watch?v=qn9cMjfdltQ', ['floor_info']), src('https://www.instagram.com/p/DdRHgUVk6fB/', ['floor_info']), PARK_SRC],
    unconfirmed: ['unit', 'hours', 'phone', 'floor_6f'], photo: 'needed',
    notes: '층: 방문 후기 3건(2026-08~09) 5층 일치. 6층 매장은 2026-04 영상뿐 → 미확인. 수원 더굿즈와 같은 체인(공식 게시물)',
  },
  {
    action: 'insert', key: 'kukje-marogoods',
    fields: base({
      name: '마로굿즈', floor_info: '국제전자센터 5층', cats: ['가챠'],
      shop_link: 'https://www.instagram.com/maro_goods/', sns_links: ['https://www.instagram.com/maro_goods/'],
      description: `국제전자센터의 가챠샵 마로굿즈입니다. 영업시간은 공식 안내가 없어 비워 두었습니다.\n${BLD}`,
    }),
    goods_types: ['gacha-new'],
    sources: [src('https://www.instagram.com/maro_goods/', ['name', 'description']), src('https://www.instagram.com/p/DdRHgUVk6fB/', ['floor_info']), PARK_SRC],
    unconfirmed: ['floor_review_1', 'unit', 'hours', 'phone'], photo: 'needed',
    notes: '층: 방문 후기 1건(2026-09-14 지도) — 지침 2-1 에 따라 "층 후기 1건". 가챠맵의 4층은 후기 근거 없음',
  },
  {
    action: 'insert', key: 'kukje-noriter',
    fields: base({
      name: '놀이터 가챠', floor_info: '국제전자센터 9층', cats: ['가챠', '게임샵'],
      shop_link: 'https://www.instagram.com/noritergacha/', sns_links: ['https://www.instagram.com/noritergacha/'],
      description: `국제전자센터 9층의 게임 매장 놀이터가 운영하는 가챠샵입니다. 공식 인스타그램에 새로 들어온 가챠를 올립니다. 영업시간은 공식 안내가 없어 비워 두었습니다.\n${BLD}`,
    }),
    goods_types: ['gacha-new'],
    sources: [src('https://www.instagram.com/noritergacha/', ['name', 'description']), src('https://www.instagram.com/p/Dbp_LDhk_hu/', ['floor_info']),
      src('http://www.kecday.co.kr/bbs/board.php?bo_table=maejang10', ['floor_info', 'cats']), PARK_SRC],
    unconfirmed: ['unit', 'hours', 'phone'], photo: 'needed',
    notes: '층: 방문 후기(2026-08-05 "9층 놀이터 88호") + 건물 옛 매장안내(9-88호, 게임기) 일치. 호수는 후기라 넣지 않음',
  },
  {
    action: 'insert', key: 'kukje-adeco',
    fields: base({
      name: '아데꼬 국제전자센터점', floor_info: '국제전자센터 4층 · 8층', cats: ['가챠'], hours: all('10:00', '20:00'),
      shop_link: 'https://www.instagram.com/funcity_adeco_official/', sns_links: ['https://www.instagram.com/funcity_adeco_official/'],
      description: '가챠샵 아데꼬의 국제전자센터점으로, 같은 건물에 두 곳이 있습니다.\n· 4층: 가챠\n· 8층: 가챠\n10:00~20:00 영업하며 매월 첫째·셋째 일요일은 정기휴무입니다(공식 인스타그램 안내).',
    }),
    goods_types: ['gacha-new'],
    sources: [src('https://www.instagram.com/reel/DZagkNjTuqR/', ['name', 'floor_info', 'hours', 'description']), src('https://www.instagram.com/p/DbkzOk5Exj3/', ['floor_info']), PARK_SRC],
    unconfirmed: ['unit', 'phone'], photo: 'needed',
    notes: '공식 IG(funcity_adeco_official) 2026-06-10 "국제전자센터점 4층, 8층 10:00-20:00 (첫째주, 셋째주 일요일 정기휴무)". 가챠맵의 @adeco_ana 는 조회 불가',
  },
  {
    action: 'update', key: 'kukje-toysky-2', shop_id: 'eeaaec9c-9297-45c1-aa41-358cb03234ff', expect_updated_at: '2026-09-28T05:33:43.412045+00:00',
    fields: {
      floor_info: '국제전자센터 9층 110호(1호점) · 45호(2호점)',
      sns_links: ['https://x.com/toysky9110_', 'https://www.instagram.com/kimhyun6283/', 'https://www.instagram.com/toysky.9110/'],
      description: `핫토이·반다이 피규어와 굿즈, 제일복권을 파는 토이스카이의 국제전자센터 매장으로, 9층에 두 곳이 있습니다(3층 스카이토이와 다른 매장).\n· 9층 110호 1호점: 핫토이·반다이 피규어, 굿즈\n· 9층 45호 2호점: 이치방쿠지 중심(2026년 9월 12일 오픈, 1호점 맞은편 하늘색 바닥 매장)\n구매 문의는 공식 계정 DM으로 받습니다. 영업시간은 공식 안내가 없어 비워 두었습니다.\n${BLD}`,
    },
    overwrite: ['floor_info', 'sns_links', 'description'], reason: '공식 IG(toysky.9110) 2호점 오픈 공지 — 같은 건물·같은 이름은 한 행(사용자 지시), 설명에 호점별 안내',
    goods_types: ['ichiban-kuji'],
    sources: [src('https://www.instagram.com/toysky.9110/', ['floor_info', 'description', 'sns_links'])],
  },
]
writeFileSync('scripts/shops/plans/2026-09-28-kukje-e.json', JSON.stringify({ name: `${D}-kukje-e`, items }, null, 1))
console.log('items', items.length)
