import { createClient } from '@/lib/supabase/client'

/* 기능 제안 — feature_suggestions
   본인: 작성·본인 것 조회 / 관리자: 전체 조회 + 상태·메모 수정 (RLS로 강제) */

export interface FeatureSuggestion {
  id: string
  user_id: string | null
  title: string
  content: string
  status: string
  admin_note: string | null
  reply: string | null
  reward_exp: number
  created_at: string
}

export const SUGGESTION_STATUS: { key: string; label: string }[] = [
  { key: 'new', label: '새 제안' },
  { key: 'reviewing', label: '검토중' },
  { key: 'planned', label: '반영예정' },
  { key: 'done', label: '완료' },
  { key: 'rejected', label: '반려' },
]

/** 제안 작성 (로그인 필요, 본인 명의) */
export async function createSuggestion(title: string, content: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요' }
  const { data, error } = await supabase
    .from('feature_suggestions')
    .insert({ user_id: user.id, title: title.trim(), content: content.trim() } as any)
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: (data as any)?.id }
}

/** 내 제안 목록 */
export async function getMySuggestions(userId: string): Promise<FeatureSuggestion[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('feature_suggestions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []) as FeatureSuggestion[]
}

/** 관리자: 전체 제안 (status 필터) + 제안자 닉네임 */
export async function getAllSuggestions(status?: string): Promise<any[]> {
  const supabase = createClient()
  let q = supabase.from('feature_suggestions').select('*').order('created_at', { ascending: false })
  if (status && status !== 'all') q = q.eq('status', status)
  const { data } = await q
  const rows = (data ?? []) as any[]

  const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
  let byId = new Map<string, any>()
  if (ids.length) {
    const { data: profs } = await supabase.from('profiles').select('id, nickname').in('id', ids)
    byId = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]))
  }
  return rows.map(r => ({ ...r, nickname: byId.get(r.user_id)?.nickname ?? null }))
}

/** 관리자: 상태·메모 수정 */
export async function updateSuggestion(id: string, patch: { status?: string; adminNote?: string; reply?: string }): Promise<{ ok: boolean }> {
  const supabase = createClient()
  const upd: any = {}
  if (patch.status !== undefined) upd.status = patch.status
  if (patch.adminNote !== undefined) upd.admin_note = patch.adminNote
  if (patch.reply !== undefined) upd.reply = patch.reply
  const { error } = await supabase.from('feature_suggestions').update(upd).eq('id', id)
  if (error) console.error('[제안 수정 실패]', error.message)
  return { ok: !error }
}

/** 관리자: 제안 채택 보상으로 경험치 지급 (+ 누적 reward_exp 기록).
   기존 관리자 경험치 RPC(admin_grant_exp) 사용. 지급자에겐 레벨업/알림이 기존대로 처리됨. */
export async function rewardSuggestionExp(
  suggestionId: string, userId: string, amount: number, currentRewardExp: number,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('admin_grant_exp', { uid: userId, amount, reason: '제안 채택' })
  if (error) { console.error('[제안 보상 EXP 실패]', error.message); return { ok: false, message: error.message } }
  await supabase.from('feature_suggestions')
    .update({ reward_exp: (currentRewardExp || 0) + amount } as any)
    .eq('id', suggestionId)
  return { ok: true }
}
