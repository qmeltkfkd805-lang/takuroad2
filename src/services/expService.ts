import { createClient } from '@/lib/supabase/client'

export interface LevelInfo {
  level: number
  title: string
  totalExp: number
  nextLevelExp: number | null
}

// EXP 지급 (모든 EXP 발생은 이 함수를 통해서만)
export async function addExp(
  userId: string,
  amount: number,
  reason: string,
  relatedType?: string,
  relatedId?: string
): Promise<void> {
  const supabase = createClient()

  // EXP 로그 기록
  await supabase
    .from('exp_logs')
    .insert({
      user_id: userId,
      amount,
      reason,
      related_type: relatedType ?? null,
      related_id: relatedId ?? null,
    } as any)

  // user_exp 갱신 (없으면 생성)
  const { data: existing } = await supabase
    .from('user_exp')
    .select('total_exp')
    .eq('user_id', userId)
    .maybeSingle()

  const newTotal = (existing?.total_exp ?? 0) + amount
  const newLevel = await calculateLevel(newTotal)

  await supabase
    .from('user_exp')
    .upsert({ user_id: userId, total_exp: newTotal, level: newLevel } as any, { onConflict: 'user_id' })
}

// 누적 EXP로 레벨 계산
async function calculateLevel(totalExp: number): Promise<number> {
  const supabase = createClient()
  const { data } = await supabase
    .from('level_thresholds')
    .select('level, min_exp')
    .lte('min_exp', totalExp)
    .order('level', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.level ?? 1
}

// 내 레벨 정보 조회 (다음 등급까지 얼마인지 포함)
export async function getMyLevelInfo(userId: string): Promise<LevelInfo> {
  const supabase = createClient()

  const { data: exp } = await supabase
    .from('user_exp')
    .select('total_exp, level')
    .eq('user_id', userId)
    .maybeSingle()

  const totalExp = exp?.total_exp ?? 0
  const level = exp?.level ?? 1

  const { data: currentTier } = await supabase
    .from('level_thresholds')
    .select('title')
    .lte('level', level)
    .order('level', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: nextTier } = await supabase
    .from('level_thresholds')
    .select('min_exp')
    .gt('min_exp', totalExp)
    .order('min_exp', { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    level,
    title: currentTier?.title ?? '애니 입문자',
    totalExp,
    nextLevelExp: nextTier ? nextTier.min_exp - totalExp : null,
  }
}

// EXP 로그 히스토리 (내 활동 페이지용)
export async function getExpLogs(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('exp_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}