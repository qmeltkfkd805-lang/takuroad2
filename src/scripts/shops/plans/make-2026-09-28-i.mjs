// 2026-09-28 밤 — 순환 점검(TCG-Station 용산·이치방쿠지 잠실직영점)
import { writeFileSync } from 'node:fs'
const D = '2026-09-28'
const src = (url, fields) => ({ url, fields, checked_at: D })
const KJ = 'https://x.com/ICHIBAN_KUJI_JS'
const items = [
  {
    action: 'update', key: 'tcg-station-yongsan', shop_id: 'd2d9693d-7907-491e-af91-9c5df03c15de', expect_updated_at: '2026-09-23T06:13:17.634766+00:00',
    fields: { floor_info: '아이파크몰 6층 1-1호' },
    reason: '유희왕 공식(대원미디어) 공인점포·무인매장 목록 "아이파크몰 6층 1-1"',
    works: [{ tag_id: '3d64da18-2032-46a2-9a39-729f5d94c58d', evidence: '유희왕 공식 사이트 공인점포 목록에 용산 TCG STATION 등재' }],
    sources: [src('https://www.yugioh.co.kr/site/event_store.php?code=store', ['floor_info', 'works'])],
    unconfirmed: ['hours', 'phone', 'official_channel', 'operating_2026'],
    notes: '아이파크몰 공식 층별 안내에는 없음. 공식 목록상 무인매장. 기존 영업시간(몰 시간)은 그대로 둠',
  },
  {
    action: 'update', key: 'ichibankuji-jamsil', shop_id: 'c6eb6620-b968-42e0-a256-fd4a49dfe4a0', expect_updated_at: '2026-09-23T06:13:12.835263+00:00',
    fields: { floor_info: '롯데월드 쇼핑몰동 지하 1층 29호' },
    overwrite: ['floor_info'],
    reason: '이치방쿠지 코리아 공식 매장 목록 "올림픽로 240 롯데월드 쇼핑몰동 B1층 29호", 10:00~21:00(기존 값 일치)',
    works: [
      { tag_id: '1a97869d-63fb-4d86-a098-2551356d835b', evidence: '공식 X 2026-09-23 신상품(에반게리온 신극장판: 서) 잠실점 샘플 전시' },
      { tag_id: 'cdc27204-c7f8-4f28-a4a7-fb7e8b7fc1b7', evidence: '공식 X 2026-09-23 신상품(은혼 -은혼전- PART2) 잠실점' },
      { tag_id: 'c7c8efb0-41d2-4935-b0e6-5f9f59b2bc9e', evidence: '공식 X 2026-09-23 신상품(드래곤볼 GT) 잠실점' },
      { tag_id: '2a88af81-4e08-446f-befa-312110884a20', evidence: '공식 X 2026-09-23 신상품(하이큐!! -카라스노의 미래-) 잠실점' },
      { tag_id: 'c80c180f-4b11-4a6b-8a7f-ec4b412ecf42', evidence: '공식 X 2026-06-16 원피스 몽키 D. 루피 입고 예정 공지' },
    ],
    goods_types: ['ichiban-kuji'],
    sources: [src('https://ichibankuji.kr/shop', ['floor_info', 'hours']), src(KJ, ['floor_info', 'hours']),
      src(`${KJ}/status/2102577841036722673`, ['works']), src(`${KJ}/status/2102579537817276766`, ['works']),
      src(`${KJ}/status/2102638265664995554`, ['works']), src(`${KJ}/status/2102661968134013262`, ['works']),
      src(`${KJ}/status/2066761555082170737`, ['works'])],
    unconfirmed: ['phone'],
    notes: '공식 매장 목록 전화 "x"(DB 02-2143-1573 유지 — 삭제 안 함). 09-25 글(#롯데시네마건대점)·08-05 무신사 팝업 글은 잠실점 아님 → 제외',
  },
]
writeFileSync('scripts/shops/plans/2026-09-28-i.json', JSON.stringify({ name: `${D}-i`, items }, null, 1))
console.log('items', items.length)
