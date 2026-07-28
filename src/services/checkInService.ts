import { createClient } from '@/lib/supabase/client'
import { recordShopVisitActivity } from './activityService'
import { geekAreaFromAddr } from '@/lib/utils/geekArea'
import { evaluateBadgeTiersForUser } from './badgeService'

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
  userLat?: number | null,
  userLng?: number | null,
  shopSlug?: string
): Promise<CheckInResult> {
  const supabase = createClient()

  // 방문 기록 방식 — GPS 검증 없음. 갔다 와서 눌러도 됨.
  // 좌표가 넘어오면 참고로 저장하지만, 없어도 정상 기록.
  const hasCoords = typeof userLat === 'number' && typeof userLng === 'number'

  // 중복 방지: 같은 샵을 이미 방문 기록했으면 막지 않고 조용히 성공 처리
  const { data: existing } = await supabase
    .from('check_ins')
    .select('id')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .maybeSingle()

  if (existing) {
    return { success: true, expEarned: 0 }   // 이미 방문한 곳 — 재기록 안 함
  }

  const { error } = await supabase
    .from('check_ins')
    .insert({
      user_id: userId,
      shop_id: shopId,
      lat: hasCoords ? userLat : null,
      lng: hasCoords ? userLng : null,
      distance_m: null,
      exp_earned: CHECK_IN_EXP,
      check_in_date: new Date().toISOString().slice(0, 10),   // 방문 기록일
    } as any)

  if (error) {
    if (error.code === '23505') {
      return { success: true, expEarned: 0 }   // 이미 방문
    }
    return { success: false, error: '방문 기록에 실패했어요' }
  }

  // XP는 아래 recordShopVisitActivity → createActivity 훅에서 shop_visit(5XP)로 지급된다 (중복 방지 포함)

  // 샵 정보 조회 (slug = 링크용, addr → 덕질 지역 = Activity 스냅샷용)
  let slug = shopSlug
  let geekArea: string | null = null
  let placeName: string | null = null
  const { data: shopData } = await supabase
    .from('shops')
    .select('slug, region, addr, places ( name, slug )')
    .eq('id', shopId)
    .maybeSingle()
  if (shopData) {
    const sd = shopData as any
    slug = slug ?? sd.slug
    // ⭐ 덕질 지역 — "마포구"가 아니라 "홍대". DB region이 비어도 주소에서 뽑는다
    geekArea = sd.region?.trim() || geekAreaFromAddr(sd.addr)
    placeName = sd.places?.name ?? null   // 소속 장소(스타필드 등) — Story에서 한 번 더 묶임
  }

  // ⭐ Activity 시스템 — 스냅샷 방식으로 방문 기록.
  // snapshot에 "그때의 샵 이름"을 박아둔다 (나중에 샵 이름이 바뀌어도 연대기는 그때 이름 그대로)
  await recordShopVisitActivity({
    userId,
    shopId,
    shopName,
    shopSlug: slug ?? null,
    region: geekArea,      // 덕질 지역 (홍대·수원…)
    placeName,             // 소속 장소 (스타필드 수원…) — Story 내 그룹핑용
  })

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
  // 방문 기록 방식: 하루 단위가 아니라 "한 번이라도 방문했나"
  const { data } = await supabase
    .from('check_ins')
    .select('id')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .maybeSingle()
  return { checkedInToday: !!data }   // 필드명은 호환 유지 (= 이미 방문함)
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