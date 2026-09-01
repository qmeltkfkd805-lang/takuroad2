import { createClient } from '@/lib/supabase/client'

export interface AdminMember {
  id: string
  nickname: string
  avatar_url: string | null
  role: string
  created_at: string
}

export interface AdminMemberPage {
  members: AdminMember[]
  total: number
}

// 관리자 전용 회원 목록 (RLS 우회 RPC). 검색 + 페이지네이션.
export async function getAdminMembers(search: string, limit: number, offset: number): Promise<AdminMemberPage> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_admin_members', {
    search: search ?? '',
    page_limit: limit,
    page_offset: offset,
  })
  if (error || !data) {
    console.error('[회원 목록] rpc:', error)
    return { members: [], total: 0 }
  }
  const rows = data as any[]
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0
  const members: AdminMember[] = rows.map((r) => ({
    id: r.id,
    nickname: r.nickname,
    avatar_url: r.avatar_url,
    role: r.role,
    created_at: r.created_at,
  }))
  return { members, total }
}

export interface MemberActivity { type: string; created_at: string }
export interface MemberDetail {
  id: string; nickname: string; avatar_url: string | null; role: string; created_at: string; admin_note: string | null
  status: string; suspended_until: string | null; is_beta: boolean
  checkins: number; favorites: number; reviews: number; saved_shops: number; routes: number; route_completions: number
  total_exp: number; level: number; recent_activity: MemberActivity[]
}

export async function getMemberDetail(uid: string): Promise<MemberDetail | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_member_detail', { uid })
  if (error || !data) { console.error('[회원 상세] rpc:', error); return null }
  return data as MemberDetail
}

/* 가입 유입 경로 (관리자 전용). 기존 get_member_detail은 손대지 않고 별도 RPC로 읽는다. */
export interface MemberSignupSource {
  signup_channel: string | null
  signup_referrer: string | null
  signup_landing_path: string | null
  signup_utm_source: string | null
  signup_utm_medium: string | null
  signup_utm_campaign: string | null
}
export async function getMemberSignupSource(uid: string): Promise<MemberSignupSource | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_member_signup_source', { uid })
  if (error) {
    // PostgrestError는 그냥 찍으면 {}로 보인다 — 필드를 펼쳐서 남긴다
    console.error('[유입 경로] rpc 실패:', {
      message: (error as any)?.message, code: (error as any)?.code,
      details: (error as any)?.details, hint: (error as any)?.hint,
    })
    return null
  }
  const row = Array.isArray(data) ? data[0] : data
  return (row as MemberSignupSource) ?? null
}

/* 활동 타일 클릭 → 그 회원이 실제로 뭘 했는지 목록 (관리자 전용).
   여섯 종류를 한 가지 모양으로 돌려주므로 UI 하나로 렌더한다. */
export type MemberItemKind = 'checkins' | 'favorites' | 'reviews' | 'saved_shops' | 'routes' | 'route_completions'
export interface MemberItem {
  item_id: string
  title: string
  subtitle: string | null
  badge: string | null
  at: string | null
  href: string | null
}
export async function getMemberItems(uid: string, kind: MemberItemKind): Promise<MemberItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_member_items', { uid, kind, page_limit: 200 })
  if (error) {
    console.error('[회원 활동 목록] rpc 실패:', {
      message: (error as any)?.message, code: (error as any)?.code,
      details: (error as any)?.details, hint: (error as any)?.hint,
    })
    return []
  }
  return (data ?? []) as MemberItem[]
}

export async function grantExp(uid: string, amount: number, reason: string): Promise<{ total_exp: number; level: number } | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('admin_grant_exp', { uid, amount, reason })
  if (error || !data) { console.error('[EXP 지급] rpc:', error); return null }
  return data as { total_exp: number; level: number }
}
