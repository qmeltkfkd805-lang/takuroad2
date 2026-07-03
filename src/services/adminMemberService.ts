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

export interface MemberDetail {
  id: string; nickname: string; avatar_url: string | null; role: string; created_at: string; admin_note: string | null
  checkins: number; favorites: number; reviews: number; saved_shops: number; routes: number; route_completions: number
  total_exp: number; level: number
}

export async function getMemberDetail(uid: string): Promise<MemberDetail | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_member_detail', { uid })
  if (error || !data) { console.error('[회원 상세] rpc:', error); return null }
  return data as MemberDetail
}
