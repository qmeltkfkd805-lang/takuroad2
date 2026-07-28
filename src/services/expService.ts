import { createClient } from '@/lib/supabase/client'

export interface LevelInfo {
  level: number
  title: string
  icon: string
  totalExp: number
  nextLevelExp: number | null
  currentLevelExp: number
  nextLevelThreshold: number | null
}

// 레벨 티어별 칭호 + 아이콘 (10레벨 단위) — 기존 체계 그대로 유지
const LEVEL_TIERS: { min: number; title: string }[] = [
  { min: 100, title: '십타쿠' }, { min: 90, title: '구타쿠' }, { min: 80, title: '팔타쿠' },
  { min: 70, title: '칠타쿠' }, { min: 60, title: '육타쿠' }, { min: 50, title: '오타쿠' },
  { min: 40, title: '사타쿠' }, { min: 30, title: '삼타쿠' }, { min: 20, title: '이타쿠' },
  { min: 10, title: '일타쿠' },
]
export function levelTier(level: number): { title: string; icon: string } {
  const t = LEVEL_TIERS.find(x => level >= x.min)
  if (!t) return { title: '입문 타쿠', icon: '/icons/level/10lv.png' }
  return { title: t.title, icon: `/icons/level/${t.min}lv.png` }
}

/* ============================================================
   XP 엔진 (레벨 시스템 v1.5)

   ⭐ 모든 XP는 addExp 하나를 통해서만 지급된다.
   ⭐ 실제 쓰기는 SECURITY DEFINER RPC `grant_exp`가 한다 (exp_logs/user_exp는
      RLS로 클라이언트 직접 쓰기가 막혀 있음). addExp는 배율을 곱해 RPC에 넘긴다.
   ⭐ 멱등/일일상한은 RPC 안에서 처리(exp_logs 근거).
   ============================================================ */

// XP 배율 — 현재 항상 1.0. 나중에 팬아트 주간·이벤트 2배 등을 여기서만 켠다.
export const XP_MULTIPLIER = 1.0

// 레벨업 전역 이벤트 (LevelUpModal이 듣는다)
export const LEVELUP_EVENT = 'takuroad:levelup'

export interface XpRule {
  baseXp: number
  once?: boolean
  category?: 'explore' | 'community' | 'creative' | 'contribute'
  visible?: boolean
}

export const XP_RULES: Record<string, XpRule> = {
  shop_visit:      { baseXp: 5,  once: true, category: 'explore',    visible: true },
  event_visit:     { baseXp: 10, once: true, category: 'explore',    visible: true },
  route_completed: { baseXp: 15, once: true, category: 'explore',    visible: true },
  review:          { baseXp: 10, once: true, category: 'contribute', visible: true },
  photo_upload:    { baseXp: 3,  once: true, category: 'contribute', visible: true },
  shop_register:   { baseXp: 15, once: true, category: 'contribute', visible: true },
  event_submit:    { baseXp: 15, once: true, category: 'contribute', visible: true },
  route_created:   { baseXp: 15, once: true, category: 'creative',   visible: true },
  work_register:   { baseXp: 10, once: true, category: 'contribute', visible: true },
  work_progress:   { baseXp: 0,  once: false, category: 'explore',   visible: true }, // 값=WORK_PROGRESS_XP, 업스트림 마일스톤 1회
  fanart:          { baseXp: 10, once: true, category: 'creative',   visible: true },
  featured_fanart: { baseXp: 50, once: true, category: 'creative',   visible: true },
  badge:           { baseXp: 0,  once: true, category: 'contribute', visible: true }, // 값=BADGE_XP_BY_RARITY / reward_exp
  daily_goal:      { baseXp: 5,  once: true, category: 'explore',    visible: false },
}

export const WORK_PROGRESS_XP: Record<number, number> = { 25: 10, 50: 20, 75: 30, 100: 50 }

export const BADGE_XP_BY_RARITY: Record<string, number> = {
  common: 15, rare: 30, epic: 60, legendary: 120,
}

export const REASON_LABEL: Record<string, string> = {
  shop_visit: '샵 방문', event_visit: '이벤트 참여', route_completed: '루트 완주',
  review: '리뷰 작성', photo_upload: '사진 등록', shop_register: '샵 등록',
  event_submit: '이벤트 제보 채택', route_created: '루트 제작', work_register: '작품 등록',
  work_progress: '작품 진행률', fanart: '팬아트 업로드', featured_fanart: '대표 팬아트 선정',
  badge: '배지 획득', daily_goal: '일일 목표 달성',
  quest_attendance: '출석', quest_comment: '댓글 미션', quest_like: '좋아요 미션', quest_post: '게시글 미션',
  quest_all: '일일 미션 올클리어',
}

export const DAILY_GOAL_XP = 50
export const DAILY_GOAL_EXCLUDE = ['badge', 'featured_fanart', 'daily_goal']

export interface AddExpResult {
  from: number
  to: number
  leveledUp: boolean
  gained: number
  totalExp: number
}

interface GrantOpts { once?: boolean; dailyCap?: number }

// EXP 지급 — 유일한 진입점. 배율 적용 후 grant_exp RPC로 위임.
export async function addExp(
  userId: string,
  amount: number,
  reason: string,
  relatedType?: string,
  relatedId?: string,
  opts?: GrantOpts,
): Promise<AddExpResult | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('grant_exp', {
    p_user_id: userId,
    p_amount: Math.round(amount * XP_MULTIPLIER),
    p_reason: reason,
    p_related_type: relatedType ?? null,
    p_related_id: relatedId ?? null,
    p_once: opts?.once ?? false,
    p_daily_cap: opts?.dailyCap ?? null,
  } as any)

  if (error) { console.error('[grant_exp 실패]', error.message); return null }
  const row: any = Array.isArray(data) ? data[0] : data
  if (!row) return null
  const result: AddExpResult = {
    from: row.from_level,
    to: row.to_level,
    leveledUp: row.to_level > row.from_level,
    gained: row.gained,
    totalExp: row.total_exp,
  }
  // 레벨업 → 전역 이벤트 (본인 것만 뜨도록 userId 포함) + 그 사이 레벨의 보상
  if (result.leveledUp && typeof window !== 'undefined') {
    const rewards = await getLevelRewards(result.from, result.to)
    window.dispatchEvent(new CustomEvent(LEVELUP_EVENT, { detail: { ...result, userId, rewards } }))
  }
  return result
}

/** 일회성 XP — 같은 (user, reason, related_id) 있으면 지급 안 함 (RPC에서 멱등 처리). */
export async function addExpOnce(
  userId: string, amount: number, reason: string, relatedType?: string, relatedId?: string,
): Promise<AddExpResult | null> {
  return addExp(userId, amount, reason, relatedType, relatedId, { once: true })
}

/** 일일 상한 XP — 오늘 그 reason 합이 상한 미만일 때만 (RPC에서 처리). */
export async function addExpDailyCapped(
  userId: string, amount: number, reason: string, perDay: number,
): Promise<AddExpResult | null> {
  return addExp(userId, amount, reason, undefined, undefined, { dailyCap: perDay })
}

export interface LevelReward {
  id: string; type: string; slug: string; name: string; rarity: string; assetUrl: string | null
}

/** 레벨 구간(from < lv <= to)의 보상 코스메틱 — 레벨업 축하 🎁용. */
export async function getLevelRewards(fromLevel: number, toLevel: number): Promise<LevelReward[]> {
  const supabase = createClient()
  const { data: rows } = await supabase
    .from('level_rewards').select('reward_id')
    .eq('reward_type', 'cosmetic').gt('level', fromLevel).lte('level', toLevel)
  const ids = (rows ?? []).map((r: any) => r.reward_id)
  if (ids.length === 0) return []
  const { data: cos } = await supabase
    .from('cosmetics').select('id, type, slug, name, rarity, asset_url').in('id', ids)
  return (cos ?? []).map((c: any) => ({
    id: c.id, type: c.type, slug: c.slug, name: c.name, rarity: c.rarity ?? 'common', assetUrl: c.asset_url ?? null,
  }))
}

/** 내 레벨보다 높은 가장 가까운 레벨 보상 (다음 목표 표시용). */
export async function getNextReward(myLevel: number): Promise<{ level: number; reward: LevelReward } | null> {
  const supabase = createClient()
  const { data: rows } = await supabase
    .from('level_rewards').select('level, reward_id')
    .eq('reward_type', 'cosmetic').gt('level', myLevel).order('level').limit(1)
  const row: any = (rows ?? [])[0]
  if (!row) return null
  const { data: c } = await supabase
    .from('cosmetics').select('id, type, slug, name, rarity, asset_url').eq('id', row.reward_id).maybeSingle()
  if (!c) return null
  const cc: any = c
  return { level: row.level, reward: { id: cc.id, type: cc.type, slug: cc.slug, name: cc.name, rarity: cc.rarity ?? 'common', assetUrl: cc.asset_url ?? null } }
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
    .select('title, min_exp')
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
    title: levelTier(level).title,
    icon: levelTier(level).icon,
    totalExp,
    nextLevelExp: nextTier ? nextTier.min_exp - totalExp : null,
    currentLevelExp: currentTier?.min_exp ?? 0,
    nextLevelThreshold: nextTier?.min_exp ?? null,
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
