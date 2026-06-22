import { createClient } from '@/lib/supabase/client'
import { calcDistance } from '@/hooks/useCurrentLocation'
import { addExp } from './expService'
import { evaluateBadgeTiersForUser } from './badgeService'

const CHECK_IN_MAX_DISTANCE_M = 100 // ⚠️ 테스트 전용 임시값 — 운영 전 100으로 반드시 되돌릴 것!
const RECHECK_IN_COOLDOWN_MIN = 30
const CHECK_IN_EXP = 5

export interface CheckInResult {
  success: boolean
  error?: string
  expEarned?: number
  newTierIds?: string[]
  completedRouteIds?: string[]
}

export async function logActivity(
  userId: string,
  type: string,
  title: string,
  link?: string,
  relatedType?: string,
  relatedId?: string
): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('activity_logs')
    .insert({
      user_id: userId,
      type,
      title,
      link: link ?? null,
      related_type: relatedType ?? null,
      related_id: relatedId ?? null,
    } as any)
}

export async function createCheckIn(
  userId: string,
  shopId: string,
  shopLat: number,
  shopLng: number,
  shopName: string,
  userLat: number,
  userLng: number,
  shopSlug?: string
): Promise<CheckInResult> {
  const supabase = createClient()

  const distance = Math.round(calcDistance(userLat, userLng, shopLat, shopLng))
  if (distance > CHECK_IN_MAX_DISTANCE_M) {
    return { success: false, error: `샵과 거리가 너무 멀어요 (${distance}m)` }
  }

  const cooldownTime = new Date(Date.now() - RECHECK_IN_COOLDOWN_MIN * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('check_ins')
    .select('id')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .gte('created_at', cooldownTime)
    .maybeSingle()

  if (recent) {
    return { success: false, error: '잠시 후 다시 시도해주세요' }
  }

  const { error } = await supabase
    .from('check_ins')
    .insert({
      user_id: userId,
      shop_id: shopId,
      lat: userLat,
      lng: userLng,
      distance_m: distance,
      exp_earned: CHECK_IN_EXP,
    } as any)

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: '오늘 이미 체크인했어요' }
    }
    return { success: false, error: '체크인에 실패했어요' }
  }

  await addExp(userId, CHECK_IN_EXP, 'check_in', 'shop', shopId)

  // slug가 없으면 직접 조회해서 link 정확하게 생성
  let slug = shopSlug
  if (!slug) {
    const { data: shopData } = await supabase.from('shops').select('slug').eq('id', shopId).maybeSingle()
    slug = shopData?.slug
  }
  await logActivity(userId, 'check_in', `${shopName} 체크인`, slug ? `/shop/${slug}` : undefined)

  await (supabase as any).rpc('increment_visit_count', { p_shop_id: shopId })

  const newTierIds = await evaluateBadgeTiersForUser(userId)

  const { recordRouteProgressOnCheckIn } = await import('./routeProgressService')
  const completedRouteIds = await recordRouteProgressOnCheckIn(userId, shopId)

  return { success: true, expEarned: CHECK_IN_EXP, newTierIds, completedRouteIds }
}

export async function getMyCheckIns(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('check_ins')
    .select('id, shop_id, distance_m, created_at, shops ( name, slug, addr )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getMyCheckInStatus(userId: string, shopId: string) {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('check_ins')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .gte('created_at', `${today}T00:00:00`)
    .maybeSingle()
  return { checkedInToday: !!data }
}

export async function getShopCheckInCount(shopId: string): Promise<number> {
  const supabase = createClient()
  const { count } = await supabase
    .from('check_ins')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
  return count ?? 0
}

export async function getFirstAndLatestCheckIn(userId: string) {
  const supabase = createClient()

  const { data: first } = await supabase
    .from('check_ins')
    .select('created_at, shops ( name )')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: latest } = await supabase
    .from('check_ins')
    .select('created_at, shops ( name )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { first, latest }
}