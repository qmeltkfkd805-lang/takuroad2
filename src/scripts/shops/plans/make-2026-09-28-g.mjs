// 2026-09-28 저녁 — 순환 점검(수원 4곳, ledger 최오래). 조사: 공식 사이트·공식 IG 소개(에이전트 조사, research 없음 — runs 에 요약)
import { writeFileSync } from 'node:fs'
const D = '2026-09-28'
const src = (url, fields) => ({ url, fields, checked_at: D })
const items = [
  {
    action: 'update', key: 'tamiya-suwon', shop_id: '0c9666e5-9c1a-4c65-9856-93ef9fa210d0', expect_updated_at: '2026-09-15T06:43:38.251802+00:00',
    fields: { phone: '031-240-2277' }, overwrite: ['phone'],
    reason: '공식 사이트(yshobby 푸터)·한국타미야 매장 목록 모두 031-240-2277 — 기존 0507 번호는 공식 미표기',
    sources: [src('https://www.yshobby.co.kr/', ['phone', 'floor_info', 'hours']), src('https://tamiya.co.kr/sub/find_store.php', ['name', 'phone', 'floor_info', 'hours'])],
    unconfirmed: [], notes: '5층·10:30~22:00 공식 일치. AK 5층 IP존 "팝토피아"(2026-08-27) 입점 유지(보도)',
  },
  {
    action: 'update', key: 'smg-suwon', shop_id: '1fcd053a-42a9-4a38-9d5d-89022c3add4b', expect_updated_at: '2026-09-23T06:03:14.626976+00:00',
    fields: {},
    sources: [src('https://x.com/limition_pick/status/2090257514642182262', ['floor_info', 'works']), src('https://www.instagram.com/p/DamEbUCk4k_/', ['floor_info', 'works']), src('https://m.akplaza.com/store/introduce?store=02', ['hours'])],
    unconfirmed: ['phone'], notes: '5층 SMG STORE 확인(이누야샤 09-01~09-22·은혼 요시와라 08-04~08-30 팝업 — 이미 연결됨). 전화 공식 미확인. 몰 시간 10:30~22:00 공식(매월 25일 휴점 표기 — 매장 적용 미확인)',
  },
  {
    action: 'update', key: 'brothergoods-suwon', shop_id: 'f24cb094-56ec-4f22-9618-864551058904', expect_updated_at: '2026-09-23T06:13:11.15037+00:00',
    fields: { addr: '경기 수원시 팔달구 향교로 8-2', lat: 37.2674982138756, lng: 127.0021093839 }, overwrite: ['addr', 'lat', 'lng'],
    reason: '공식 IG 소개 "경기도 수원시 팔달구 향교로 8-2 1층 브라더굿즈" — 기존 8-1 오기(연결 이벤트 0)',
    sources: [src('https://www.instagram.com/brother.goods.suwon/', ['addr', 'floor_info', 'hours'])],
    unconfirmed: ['hours_weekend'], notes: '소개 "평일/공휴일 12:00~22:00" — 주말 시간 명시 없음(기존 연중 12~22 유지)',
  },
  {
    action: 'update', key: 'thegoods-suwon', shop_id: '76994976-bf17-45c4-a8a2-efe1a3715a2e', expect_updated_at: '2026-09-28T05:33:40.079891+00:00',
    fields: { hours: { mon: { open: '12:00', close: '21:00' }, tue: { open: '12:00', close: '21:00' }, wed: { open: '12:00', close: '21:00' }, thu: { open: '12:00', close: '21:00' }, fri: { open: '12:00', close: '22:00' }, sat: { open: '12:00', close: '22:00' }, sun: { open: '12:00', close: '22:00' } } },
    overwrite: ['hours'],
    reason: '공식 IG 소개 "월~목 12:00-21:00, 금토일/공휴일 12:00-22:00" — 금요일 21→22시',
    sources: [src('https://www.instagram.com/thegoods_suwon/', ['hours', 'parking_note'])],
    unconfirmed: ['name', 'addr', 'phone'], notes: '이름·주소 충돌: X 표시명 검색 결과 "더굿즈 수원인계점"·효원로265번길 46 3층(스니펫) ↔ 09-28 오전 조사 "수원역점, 갓매산로 51 3층". X 402 로 직접 확인 못 함 → 변경 안 함, pending',
  },
]
writeFileSync('scripts/shops/plans/2026-09-28-g.json', JSON.stringify({ name: `${D}-g`, items }, null, 1))
console.log('items', items.length)
