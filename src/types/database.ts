// ============================================================
// Supabase DB 타입
// Database = any 로 단순화 — 실제 쿼리 결과는
// services/ 에서 UI 타입(shop.ts 등)으로 변환해서 사용
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface BusinessHours {
  mon?: { open: string; close: string } | null
  tue?: { open: string; close: string } | null
  wed?: { open: string; close: string } | null
  thu?: { open: string; close: string } | null
  fri?: { open: string; close: string } | null
  sat?: { open: string; close: string } | null
  sun?: { open: string; close: string } | null
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
