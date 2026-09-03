import { createClient } from '@/lib/supabase/client'

/* 샵 신고 — 저장소는 shop_suggestions 테이블이다(전용 신고 테이블이 없다).

   컬럼(2026-09-03 확인):
     id, shop_id, user_id, suggestion_type, payload, image_url,
     status, reviewed_by, reviewed_at, created_at
   처리 메모(admin_note) 컬럼은 없다 — 화면에 메모 입력창을 만들지 않는다.
   image_url 은 있지만 reportShopIssue 가 쓰지 않아 실제로는 항상 null 이다.

   status: pending / approved / rejected
   RLS: SELECT는 전체 공개(true), UPDATE는 관리자만, INSERT는 user_id = auth.uid() */

export interface ShopReportShop {
  id: string
  name: string | null
  slug: string | null
  addr: string | null
  region: string | null
  city: string | null
  district: string | null
  status: string | null
  phone: string | null
  info_last_confirmed_at: string | null
  shop_images: { image_url: string | null; is_cover: boolean | null; sort_order: number | null }[] | null
}

export interface ShopReportRow {
  id: string
  shop_id: string
  user_id: string
  payload: { type?: string; reason?: string } | null
  image_url: string | null
  status: string
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  shops: ShopReportShop | null
  profiles: { id: string; nickname: string | null } | null
}

/* 관리자 화면이 실제로 쓰는 컬럼만. 신고자는 닉네임만 가져온다.
   대상 샵 정보는 신고 내용과 현재 값을 나란히 놓기 위해 필요한 것만 붙였다. */
const REPORT_SELECT = `
  id, shop_id, user_id, payload, image_url,
  status, created_at, reviewed_at, reviewed_by,
  shops (
    id, name, slug, addr, region, city, district, status, phone, info_last_confirmed_at,
    shop_images ( image_url, is_cover, sort_order )
  ),
  profiles!shop_suggestions_user_id_fkey ( id, nickname )
`

// 샵 정보 신고 (간단 버전 — shop_suggestions 활용). 사용자 사이트에서 쓴다.
export async function reportShopIssue(shopId: string, userId: string, reason: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_suggestions')
    .insert({
      shop_id: shopId,
      user_id: userId,
      suggestion_type: 'general_edit',
      payload: { type: 'report', reason },
      status: 'pending',
    })
  return !error
}

/** 미처리 신고 전체. 화면에서 shop_id 로 묶는다(여기서 묶지 않는다 — 원본을 그대로 넘긴다). */
export async function getPendingShopReports(): Promise<ShopReportRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shop_suggestions')
    .select(REPORT_SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  // 오류를 빈 배열로 바꾸지 않는다 — 조회 실패와 "신고 0건"은 다른 상태다
  if (error) throw error
  return (data ?? []) as unknown as ShopReportRow[]
}

/** 처리 완료(승인·반려). 목록 탭을 처음 열 때만 부른다. */
export async function getCompletedShopReports(): Promise<ShopReportRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shop_suggestions')
    .select(REPORT_SELECT)
    .in('status', ['approved', 'rejected'])
    .order('reviewed_at', { ascending: false })
    .limit(200)

  if (error) throw error
  return (data ?? []) as unknown as ShopReportRow[]
}

/** 신고 한 건 처리. approved = 처리 완료, rejected = 반려. 한 건씩만 부른다. */
export async function resolveSuggestion(
  suggestionId: string,
  status: 'approved' | 'rejected',
  adminId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_suggestions')
    .update({ status, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq('id', suggestionId)
    .eq('status', 'pending')   // 이미 처리된 건을 덮어쓰지 않는다
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/* 샵 상태 변경 — 반드시 서버 API 경유. 클라이언트에서 shops.status 를 직접 바꾸지 않는다.
   (2026-09-03 이후로는 authenticated 에 status UPDATE 권한 자체가 컬럼 단위로 제한돼 있고,
    일반 사용자 전이는 트리거가 막는다. 관리자 작업은 service_role 인 이 경로로만 통과한다) */
export async function changeShopStatus(
  shopId: string,
  status: 'active' | 'temporary_closed' | 'closed' | 'deleted',
  adminId: string,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/shop-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId, status, reason }),
    })
    const json: { error?: string } | null = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: json?.error ?? '상태 변경에 실패했어요' }
    return { ok: true }
  } catch {
    return { ok: false, error: '네트워크 오류로 상태를 바꾸지 못했어요' }
  }
}
