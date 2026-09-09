import { createClient } from '@/lib/supabase/client'

/* ============================================================
   관리자 회원 관리 서비스

   ⭐ 조회 실패를 빈 배열이나 0으로 뭉개지 않는다.
      예전 getAdminMembers 는 catch 에서 { members: [], total: 0 } 을 돌려줘서
      조회 오류가 화면에 "회원 0명"으로 보였다. 관리자가 오판한다.
      이제는 throw 하고, 화면이 오류 상태와 빈 상태를 따로 그린다.

   ⭐ 역할 변경은 admin_set_member_role RPC 로만 한다.
      예전에는 /api/admin/upsert 로 profiles.role 을 직접 UPDATE 했는데
      자기 강등도 마지막 관리자 강등도 막는 것이 없었다.
      RPC 안에서 advisory lock 으로 동시 강등까지 직렬화한다.
      (REST 는 트랜잭션이 없어 API 라우트로는 경쟁 조건을 막을 수 없다)
   ============================================================ */

export type MemberRole = 'user' | 'admin'
export type MemberSort = 'recent' | 'oldest' | 'nickname'
export type MemberRoleFilter = MemberRole | null
export type MemberStatusFilter = 'active' | 'suspended' | null

export const ROLE_LABEL: Record<string, string> = { user: '일반 회원', admin: '관리자' }

export interface AdminMember {
  id: string
  nickname: string
  avatar_url: string | null
  role: string
  created_at: string
  status: string
  suspended_until: string | null
}

export interface AdminMemberPage {
  members: AdminMember[]
  total: number
}

/* RPC 반환 행. Database 타입이 any 라 RPC 응답에 타입이 붙지 않아 여기서 정의한다. */
interface RawMemberRow {
  id: string
  nickname: string
  avatar_url: string | null
  role: string
  created_at: string
  status: string | null
  suspended_until: string | null
  total_count: number | string
}

export interface AdminMemberQuery {
  search?: string
  limit?: number
  offset?: number
  roleFilter?: MemberRoleFilter
  statusFilter?: MemberStatusFilter
  sort?: MemberSort
}

/* 관리자 전용 회원 목록. 검색·필터·정렬·페이지네이션 모두 서버에서 한다.
   total 은 필터를 적용한 뒤의 전체 건수다(RPC 의 count(*) over()).

   ⚠️ 행이 0건이면 total_count 를 담아 올 행 자체가 없다. 그래서 0 으로 본다.
      "조건에 맞는 회원 0명"이라는 뜻이고, 조회 실패와는 다르다(그건 throw 된다). */
export async function getAdminMembers(q: AdminMemberQuery = {}): Promise<AdminMemberPage> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_admin_members', {
    search: q.search ?? '',
    page_limit: q.limit ?? 20,
    page_offset: q.offset ?? 0,
    role_filter: q.roleFilter ?? null,
    status_filter: q.statusFilter ?? null,
    sort: q.sort ?? 'recent',
  })
  if (error) throw error

  const rows = (data ?? []) as RawMemberRow[]
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0
  const members: AdminMember[] = rows.map((r) => ({
    id: r.id,
    nickname: r.nickname,
    avatar_url: r.avatar_url,
    role: r.role,
    created_at: r.created_at,
    status: r.status ?? 'active',
    suspended_until: r.suspended_until ?? null,
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

export async function getMemberDetail(uid: string): Promise<MemberDetail> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_member_detail', { uid })
  if (error) throw error
  if (!data) throw new Error('회원 정보를 찾을 수 없어요')
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
    // PostgrestError 는 그냥 찍으면 {}로 보인다 — 필드를 펼쳐서 남긴다
    console.error('[유입 경로] rpc 실패:', {
      message: error.message, code: error.code,
      details: error.details, hint: error.hint,
    })
    return null
  }
  const row = Array.isArray(data) ? data[0] : data
  return (row as MemberSignupSource) ?? null
}

/* 활동 타일 클릭 → 그 회원이 실제로 뭘 했는지 목록 (관리자 전용).
   여섯 종류를 한 가지 모양으로 돌려주므로 UI 하나로 렌더한다.
   상세를 열 때 한꺼번에 다 가져오지 않는다 — 누른 종류만 그때 조회한다. */
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
  if (error) throw error
  return (data ?? []) as MemberItem[]
}

/* ── 보유 배지 ──────────────────────────────────────────────
   user_badge_tiers 는 select 정책이 공개(using=true)라 별도 RPC 가 필요 없다.
   권한을 새로 넓히지 않는다. 개인정보도 아니다(프로필에 그대로 보이는 값이다). */
export interface MemberBadge { tierId: string; name: string; earnedAt: string | null }

interface RawBadgeTier { name: string }
interface RawBadgeRow {
  badge_tier_id: string
  earned_at: string | null
  badge_tiers: RawBadgeTier | RawBadgeTier[] | null
}

export async function getMemberBadges(uid: string): Promise<MemberBadge[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_badge_tiers')
    .select('badge_tier_id, earned_at, badge_tiers ( name )')
    .eq('user_id', uid)
    .order('earned_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as RawBadgeRow[]).map((r) => {
    // 조인 결과는 객체 또는 1개짜리 배열로 온다
    const tier = Array.isArray(r.badge_tiers) ? r.badge_tiers[0] : r.badge_tiers
    return {
      tierId: r.badge_tier_id,
      name: tier?.name ?? '배지',
      earnedAt: r.earned_at ?? null,
    }
  })
}

/* ── 역할 변경 ──────────────────────────────────────────────
   서버(RPC)가 전부 다시 검증한다. 클라이언트가 보내는 현재 역할이나
   관리자 수는 아무것도 신뢰하지 않는다.
     - actor 가 관리자인지
     - 자기 자신인지
     - next_role 이 user/admin 인지
     - 강등 후에도 관리자가 남는지 (advisory lock 으로 동시 강등 직렬화) */
export interface RoleChangeResult { changed: boolean; before: string; after: string }

export async function setMemberRole(targetId: string, nextRole: MemberRole): Promise<RoleChangeResult> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('admin_set_member_role', {
    target_id: targetId,
    next_role: nextRole,
  })
  if (error) throw error
  return data as RoleChangeResult
}

/* ── 관리자 메모 ────────────────────────────────────────────
   역할과 분리해서 저장한다. 메모만 고치는 요청에 role 을 절대 싣지 않는다.
   admin_note 는 profiles 의 authenticated SELECT 목록에 없어서
   일반 조회로는 읽히지 않는다. 읽기는 get_member_detail(definer)로만 한다. */
export async function saveAdminNote(uid: string, note: string): Promise<void> {
  const res = await fetch('/api/admin/upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table: 'profiles', id: uid, action: 'update',
      fields: { admin_note: note.trim() || null },
    }),
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(json.error ?? `저장 실패 (HTTP ${res.status})`)
}

/* ── 베타테스터 ─────────────────────────────────────────────
   profiles.is_beta 플래그만 바꾼다. 이 값을 읽는 코드는 아직 관리자 화면뿐이다. */
export async function setBetaTester(uid: string, on: boolean): Promise<void> {
  const res = await fetch('/api/admin/upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table: 'profiles', id: uid, action: 'update', fields: { is_beta: on },
    }),
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(json.error ?? `저장 실패 (HTTP ${res.status})`)
}

/* ── 배지 지급 ──────────────────────────────────────────────
   중복은 서버가 409 로 막는다. 클라이언트에서도 보유 목록으로 미리 걸러준다. */
export async function grantBadge(uid: string, tierId: string): Promise<void> {
  const res = await fetch('/api/admin/grant-badge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: uid, tierId }),
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(json.error ?? `지급 실패 (HTTP ${res.status})`)
}

/* ── EXP 지급 ───────────────────────────────────────────────
   증가 전용이다. 서버가 양의 정수·회원 존재·int4 오버플로를 검증한다.
   차감이 필요하면 지급과 분리된 기능으로 따로 설계한다. */
export async function grantExp(uid: string, amount: number, reason: string): Promise<{ total_exp: number; level: number }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('admin_grant_exp', { uid, amount, reason })
  if (error) throw error
  return data as { total_exp: number; level: number }
}

/* 수동 지급 대상 배지 목록 (badge_tiers 는 공개 카탈로그다) */
export interface ManualBadge { id: string; name: string }
export async function getManualBadges(): Promise<ManualBadge[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('badge_tiers')
    .select('id, name')
    .eq('award_type', 'manual')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return ((data ?? []) as ManualBadge[]).map((b) => ({ id: b.id, name: b.name }))
}
