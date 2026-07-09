import { BusinessHours } from './database'

// ============================================================
// UI용 Shop 타입
// DB의 shops + shop_images + shop_categories JOIN 결과
// ============================================================
export interface Shop {
  id: string
  slug: string
  name: string
  description: string | null
  addr: string | null
  country: string
  region: string | null
  city: string | null
  district: string | null
  lat: number | null
  lng: number | null
  google_place_id: string | null

  // ── Place 연결 (2026-07 Place 리팩터링) ──
  // lat/lng 은 "저장 좌표"(실제 매장 위치). 절대 안 건드린다.
  // 지도는 아래 display 좌표를 쓴다: place 소속이면 place 좌표로 접힌다.
  place_id: string | null
  floor: string | null        // "3F"
  unit: string | null         // "305호"
  place_name: string | null   // 소속 장소 이름 (표시용)
  place_slug: string | null   // 소속 장소 slug (상세 링크용)
  displayLat: number | null   // place_id 있으면 place 좌표, 없으면 shop 좌표
  displayLng: number | null

  // shop_categories JOIN → 첫 번째가 대표 카테고리 (마커 색상용)
  cat: string
  cats: string[]

  // shop_images JOIN → is_cover=true 우선, 없으면 sort_order 순
  images: string[]

  hours: BusinessHours | null
  parking: boolean | null
  parking_note: string | null
  shop_link: string | null
  sns_links: string[]
  phone: string | null
  floor_info: string | null

  start_date: string | null
  end_date: string | null
  event_info: string | null

  rating_avg: number
  rating_count: number
  visit_count: number
  bookmark_count: number

  is_verified: boolean
  is_claimed: boolean
  status: string
  added_by: string | null
  owner_id: string | null

  created_at: string
  updated_at: string

  // UI 전용 계산값 — DB 저장 안 함
  distance?: number       // 현재 위치 기준 거리(m) — useCurrentLocation에서 계산
  isSaved?: boolean       // 찜 여부 — Step 09에서 활성화
}

// 샵 등록/수정 폼
export interface ShopFormData {
  name: string
  slug: string
  description: string
  addr: string
  lat: number | null
  lng: number | null
  cats: string[]
  hours: BusinessHours | null
  parking: boolean | null
  parking_note: string
  shop_link: string
  sns_links: string[]
  phone: string
  floor_info: string
  start_date: string
  end_date: string
  event_info: string
}

// 지도 마커용 최소 타입 (전체 Shop보다 가볍게)
export interface ShopMarker {
  id: string
  slug: string
  name: string
  lat: number
  lng: number
  cat: string
  images: string[]
}