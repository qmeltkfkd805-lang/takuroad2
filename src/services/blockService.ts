import { createClient } from '@/lib/supabase/client'

/* ============================================================
   차단 — public.user_blocks (blocker_id, blocked_id)
   ⭐ 생성/해제는 RPC 전용: block_user / unblock_user (SECURITY DEFINER, 트랜잭션).
      - block_user: 차단 insert(멱등) + 양방향 팔로우 해제를 한 트랜잭션으로.
      - unblock_user: 차단 해제(팔로우 자동복원 안 함).
      직접 insert/delete 는 DB에서 회수됨(우회 방지).
   조회는 select 유지(RLS: blocker_id=auth.uid() 만 보임 = '내가 차단한' 방향).
   ⚠️ '나를 차단한' 행은 클라가 못 읽음 → 양방향 숨김은 서버 함수/뷰가 처리.
   ============================================================ */

export interface BlockedUser {
  id: string
  nickname: string
  avatarUrl: string | null
  createdAt: string
}

/** 차단 (RPC). 차단 대상 id 만 전달 — 차단 주체는 서버에서 auth.uid() 사용. */
export async function blockUser(targetId: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('block_user', { target: targetId })
  if (error) {
    console.error('[차단 실패]', error.message)
    return { ok: false, message: '차단할 수 없어요.' }   // 자기차단 등도 일반 메시지
  }
  return { ok: true }
}

/** 차단 해제 (RPC). 팔로우는 자동 복원되지 않음. */
export async function unblockUser(targetId: string): Promise<{ ok: boolean }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('unblock_user', { target: targetId })
  if (error) { console.error('[차단 해제 실패]', error.message); return { ok: false } }
  return { ok: true }
}

/** 내가 차단한 사용자 목록 (프로필 포함, 최근순) */
export async function getBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as any[]
  const ids = rows.map(r => r.blocked_id).filter(Boolean)
  if (ids.length === 0) return []

  const { data: profs } = await supabase
    .from('profiles').select('id, nickname, avatar_url').in('id', ids)
  const byId = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]))

  return rows.map(r => {
    const p: any = byId.get(r.blocked_id)
    return {
      id: r.blocked_id,
      nickname: p?.nickname ?? '알 수 없음',
      avatarUrl: p?.avatar_url ?? null,
      createdAt: r.created_at,
    }
  })
}

/** 내가 차단한 id 집합 (목록/피드 제외 필터용 — 내 방향) */
export async function getBlockedIds(userId: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId)
  return (data ?? []).map((r: any) => r.blocked_id).filter(Boolean)
}

/** 특정 상대를 내가 차단했는지 */
export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle()
  return !!data
}
