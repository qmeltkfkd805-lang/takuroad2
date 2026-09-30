// 2026-09-28 국제전자센터 5차 — 공식 채널은 없지만 2026 방문 후기 여러 건이 층을 같게 말하는 곳 (사용자 승인: "후기가 그렇게 겹치면 그곳이 맞을 것")
// 지침 3-5 의 2-2. 호수·영업시간·전화는 후기로 채우지 않는다. 조사 기록: research/kukje-2026-09-28-H.md
import { writeFileSync } from 'node:fs'
const D = '2026-09-28'
const src = (url, fields) => ({ url, fields, checked_at: D })
const KEC = '1fee0987-c92d-4bdd-8273-dc4c01207c89'
const PARK = '주차 가능(유료)\n최초 40분 무료, 이후 10분당 1,000원'
const PARK_SRC = src('http://www.kecday.co.kr/bbs/board.php?bo_table=sisul', ['place_id', 'parking', 'parking_note'])
const TAIL = '공식 채널이 없어 방문 후기 기준으로 등록했으며, 영업시간은 비워 두었습니다. 국제전자센터 상가는 매월 첫째·셋째 일요일 휴무이니 방문 전 확인해 주세요.'
const base = (f) => ({ addr: '서울 서초구 효령로 304', place_id: KEC, parking: true, parking_note: PARK, sns_links: [], phone: null, hours: null, shop_link: null, ...f })
const SIDO_27 = 'https://www.instagram.com/p/DbkzOk5Exj3/' // 방문자 층별 안내 2~7층 2026-08-03
const SIDO_89 = 'https://www.instagram.com/p/Dbp_LDhk_hu/' // 방문자 층별 안내 8~9층 2026-08-05
const HAZZI = 'https://www.instagram.com/p/DdRHgUVk6fB/' // 방문자 지도 2026-09-14
const YT = 'https://www.youtube.com/watch?v=ArMgTLq-d24' // 방문 영상 2026-04-01 층별 챕터

const items = [
  {
    action: 'insert', key: 'kukje-necoco',
    fields: base({
      name: '네코코(NECOCO)', floor_info: '국제전자센터 5층', cats: ['가챠'],
      description: `캡슐토이(가챠) 매장 네코코(NECOCO)로, 국제전자센터 5층에 있습니다.\n${TAIL}`,
    }),
    goods_types: ['gacha-new'],
    sources: [src(SIDO_27, ['name', 'floor_info']), src(HAZZI, ['floor_info']), src('https://www.instagram.com/p/DciSm2jTsvF/', ['floor_info']), src(YT, ['floor_info']), PARK_SRC],
    unconfirmed: ['official_channel', 'unit', 'hours', 'phone', 'other_floors'], photo: 'needed',
    notes: '공식 채널 없음(가챠맵 IG @qwer7717_ 삭제). 5층: 방문 후기 4건(2026-04~09) 일치. 8층 8150호(07-05 1건)·3층(05-31 1건)은 후기 1건씩 → 설명에 넣지 않고 pending',
  },
  {
    action: 'insert', key: 'kukje-gachanomori',
    fields: base({
      name: '가챠노모리', floor_info: '국제전자센터 3층', cats: ['가챠'],
      description: `한쪽 벽을 가챠 기계로 가득 채운 가챠샵 가챠노모리로, 국제전자센터 3층에 있습니다.\n${TAIL}`,
    }),
    goods_types: ['gacha-new'],
    sources: [src(SIDO_27, ['name', 'floor_info', 'description']), src(HAZZI, ['floor_info']), src(YT, ['floor_info']), PARK_SRC],
    unconfirmed: ['official_channel', 'unit', 'hours', 'phone'], photo: 'needed',
    notes: '공식 채널 없음(일본 ガチャガチャの森·gachanomori.com 과 무관). 3층: 방문 후기 3건 일치(sido "149호"는 후기라 호수 비움)',
  },
  {
    action: 'insert', key: 'kukje-gachamaeul',
    fields: base({
      name: '가챠마을', floor_info: '국제전자센터 9층', cats: ['가챠'],
      description: `9층 게임 매장 CD마을이 운영하는 가챠 매장 가챠마을로, 국제전자센터 9층에 있습니다.\n${TAIL}`,
    }),
    goods_types: ['gacha-new'],
    sources: [src(SIDO_89, ['name', 'floor_info']), src(HAZZI, ['floor_info']), src('https://www.instagram.com/p/Dcx52zZE_i0/', ['floor_info']), src(YT, ['floor_info']),
      src('http://www.kecday.co.kr/bbs/board.php?bo_table=maejang10', ['description']), PARK_SRC],
    unconfirmed: ['official_channel', 'unit', 'hours', 'phone'], photo: 'needed',
    notes: '9층: 방문 후기 4건 일치. 호수 후기 "103" ↔ 옛 CD마을 목록 9-95호 불일치 → 비움',
  },
  {
    action: 'insert', key: 'kukje-unotech',
    fields: base({
      name: '우노테크', floor_info: '국제전자센터 9층', cats: ['게임샵', '가챠'],
      description: `닌텐도 스위치·플레이스테이션 등 중고 게임과 가챠를 함께 파는 게임 매장 우노테크(게이머몰)로, 국제전자센터 9층에 있습니다.\n${TAIL}`,
    }),
    goods_types: ['gacha-new'],
    sources: [src(SIDO_89, ['floor_info', 'description']), src('http://www.kecday.co.kr/bbs/board.php?bo_table=maejang10&wr_id=13', ['name', 'floor_info']), PARK_SRC],
    unconfirmed: ['official_channel', 'unit', 'hours', 'phone'], photo: 'needed',
    notes: '9층: 방문 후기(2026-08-05) + 건물 옛 매장안내(9-80호 우노테크(게이머몰)) + 지마켓 판매자 주소(국전 9층) 일치',
  },
  {
    action: 'insert', key: 'kukje-famicom',
    fields: base({
      name: '패미컴', floor_info: '국제전자센터 9층', cats: ['게임샵', '가챠'],
      description: `비디오 게임과 가챠를 파는 게임 매장 패미컴으로, 국제전자센터 9층에 있습니다.\n${TAIL}`,
    }),
    goods_types: ['gacha-new'],
    sources: [src(SIDO_89, ['name', 'floor_info']), src('http://www.kecday.co.kr/bbs/board.php?bo_table=maejang10&wr_id=6', ['name', 'floor_info']), PARK_SRC],
    unconfirmed: ['official_channel', 'unit', 'hours', 'phone'], photo: 'needed',
    notes: '9층: 방문 후기(2026-08-05 "107~108호") + 2024 블로그(9-108호) + 건물 옛 매장안내(9-108호) 일치. 호수는 후기라 비움',
  },
]
writeFileSync('scripts/shops/plans/2026-09-28-kukje-f.json', JSON.stringify({ name: `${D}-kukje-f`, items }, null, 1))
console.log('items', items.length)
