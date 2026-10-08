/* 목록용 샵 — 캐시 API(/api/shops/all, /api/shops/home-items)가 내려주기 전에 목록 화면에서 안 쓰는 칸을 뺀다.
   지도·샵 홈·샵 전체보기·루트 만들기·저장한 샵 카드는 이 칸들을 읽지 않는다(상세·수정 화면은 자기 조회를 따로 한다).
   샵 1,000곳 기준으로 소개글·SNS·주차 안내·등록자 등만 약 470KB(전체의 약 27%)였다. */
const LIST_UNUSED = [
  'description', 'sns_links', 'parking', 'parking_note', 'shop_link', 'phone',
  'event_info', 'google_place_id', 'added_by', 'owner_id', 'updated_at',
  'temporary_holiday_message', 'reservation_url', 'reservation_required',
] as const

export function slimShopForList<T extends object>(shop: T): T {
  const out: Record<string, unknown> = { ...(shop as Record<string, unknown>) }
  for (const k of LIST_UNUSED) delete out[k]
  return out as T
}
