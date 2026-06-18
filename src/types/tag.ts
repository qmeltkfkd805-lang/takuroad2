// ============================================================
// UI용 Tag 타입
// ============================================================
export interface Tag {
  id: string
  name: string
  slug: string
  created_at: string
}

// 샵에 연결된 태그 (shop_tags JOIN)
export interface ShopTag extends Tag {
  shop_id: string
}
