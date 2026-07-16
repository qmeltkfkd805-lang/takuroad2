import { createClient } from '@/lib/supabase/client'
import { Cosmetic, getCosmeticById } from '@/services/cosmeticService'
import { Challenge, getGrowthChallenges } from '@/services/growthService'

/* 해금 알림 — "보상을 받는 경험"

   ⭐⭐ 배지를 보여주는 모달이 아니다. 새로운 꾸미기 아이템을 획득한 순간이다.
      배지는 영수증이고, 코스메틱이 물건이다. 그래서 코스메틱이 주인공.

   ⭐ 서비스(createActivity) 안쪽에서 배지를 따는데, UI로 흘려보낼 통로가 없다.
      전역 이벤트로 쏘아올린다 — 서비스는 React를 몰라도 되고,
      어느 화면에서 땄든 모달이 뜬다.

   ⭐ 모달의 우선순위: 축하 → 새로 열린 코스메틱(가장 크게) → 바로 착용 → 다음 목표
      기쁨에서 끝내지 않고 "하나만 더 해볼까"로 이어준다. */

export const UNLOCK_EVENT = 'takuroad:unlock'

export interface UnlockedTier {
  tierId: string
  tierName: string
  badgeName: string
  rarity: string
  iconUrl: string | null
  cosmetic: Cosmetic | null
}

export interface UnlockPayload {
  tiers: UnlockedTier[]
  /** 이 기쁨 다음에 갈 곳 */
  next: Challenge | null
}

/** 서비스에서 부른다 — 새로 딴 티어 id들을 UI로 쏘아올린다 */
export function announceUnlock(tierIds: string[]) {
  if (typeof window === 'undefined' || tierIds.length === 0) return
  window.dispatchEvent(new CustomEvent(UNLOCK_EVENT, { detail: tierIds }))
}

/** 모달이 부른다 — id만 받았으니 살을 붙인다 */
export async function loadUnlock(userId: string, tierIds: string[]): Promise<UnlockPayload> {
  const supabase = createClient()

  const { data } = await supabase
    .from('badge_tiers')
    .select('id, name, rarity, icon_url, reward_cosmetic_id, badges ( name, icon_url )')
    .in('id', tierIds)

  const rows = (data ?? []) as any[]

  const tiers: UnlockedTier[] = await Promise.all(
    rows.map(async r => ({
      tierId: r.id,
      tierName: r.name ?? '',
      badgeName: r.badges?.name ?? '',
      rarity: r.rarity ?? 'common',
      iconUrl: r.icon_url ?? r.badges?.icon_url ?? null,
      cosmetic: r.reward_cosmetic_id ? await getCosmeticById(r.reward_cosmetic_id) : null,
    })),
  )

  // 다음 목표 — 방금 딴 것 말고, 지금 가장 가까운 것
  let next: Challenge | null = null
  try {
    const challenges = await getGrowthChallenges(userId)
    next = challenges[0] ?? null
  } catch {}

  return { tiers, next }
}
