// ============================================================
// Supabase DB 타입
// Database = any 로 단순화 — 실제 쿼리 결과는
// services/ 에서 UI 타입(shop.ts 등)으로 변환해서 사용
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

/** 하루 영업시간. breakStart/breakEnd는 휴게시간(있는 매장만). 없으면 필드 자체가 없음 */
export interface DayHours {
  open: string
  close: string
  breakStart?: string | null
  breakEnd?: string | null
}

export interface BusinessHours {
  mon?: DayHours | null
  tue?: DayHours | null
  wed?: DayHours | null
  thu?: DayHours | null
  fri?: DayHours | null
  sat?: DayHours | null
  sun?: DayHours | null
}

export type ShopStatus =
  | 'pending'
  | 'active'
  | 'hidden'
  | 'closed'
  | 'temporary_closed'
  | 'deleted'

export type UserRole = 'user' | 'manager' | 'admin'

// Supabase 클라이언트 제네릭 타입
// any 기반으로 단순화 → 타입 에러 없이 쿼리 가능
export type Database = any

// UI에서 직접 쓰는 Profile 타입
export interface Profile {
  id: string
  nickname: string
  avatar_url: string | null
  bio: string | null
  role: UserRole
  created_at: string
  updated_at: string
}
