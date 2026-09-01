/* 이벤트 import 스크립트용 — 이벤트가 열리는 샵을 찾아 events.shop_id를 채우기 위한 헬퍼.
 *
 * 왜 필요한가: events.shop_id가 비어 있으면 샵 상세의 "진행중인 이벤트"에 안 나온다.
 * 장소(place_name/place_addr)만 넣으면 주소가 같아도 자동으로 이어지지 않는다.
 *
 * 안전장치: 후보가 "정확히 1곳"일 때만 id를 돌려준다.
 * 같은 건물에 샵이 여러 개면(롯데월드몰 등) null을 돌려주고, 사람이
 * 샵 수정 3단계의 "이 샵에서 열리는 이벤트"에서 직접 고르게 남겨둔다.
 *
 * 사용법:
 *   import { findShopId } from './lib/findShopId.mjs'
 *   event.shop_id = await findShopId(db, {
 *     placeId: event.place_id,
 *     addr: event.place_addr,
 *     nameHint: event.place_detail || event.place_name,
 *   })
 */

const norm = (s) => (s ?? '').replace(/\s+/g, '').toLowerCase()

export async function findShopId(db, { placeId = null, addr = null, nameHint = null } = {}) {
  let rows = []

  // 1) 같은 장소(건물)에 속한 샵
  if (placeId) {
    const r = await db.from('shops').select('id, name, addr').eq('place_id', placeId).eq('status', 'active')
    rows = r.data ?? []
  }

  // 2) 없으면 주소 앞부분이 같은 샵 (상세주소 차이는 무시)
  if (rows.length === 0 && addr) {
    const r = await db.from('shops').select('id, name, addr').ilike('addr', `${addr}%`).eq('status', 'active')
    rows = r.data ?? []
  }

  // 3) 여러 곳이면 이름으로 좁힌다 (예: "3층 애니메이트 카페" → 애니메이트 카페 잠실점)
  if (rows.length > 1 && nameHint) {
    const n = norm(nameHint)
    const narrowed = rows.filter((s) => {
      const sn = norm(s.name)
      return sn.length > 1 && (n.includes(sn) || sn.includes(n))
    })
    if (narrowed.length === 1) rows = narrowed
  }

  if (rows.length === 1) {
    console.log(`  ↳ 샵 연결: ${rows[0].name} (${rows[0].id})`)
    return rows[0].id
  }
  console.log(`  ↳ 샵 연결 안 함 (후보 ${rows.length}곳) — 샵 수정 화면에서 직접 연결하세요`)
  return null
}
