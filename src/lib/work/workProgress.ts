import { createClient } from '@/lib/supabase/client'

/* ============================================================
   작품 탐험도 — 4축 진행률 정책

   ⭐ "정책은 한 곳" — 진행률을 계산하는 규칙은 전부 여기 있다.
      Story 하이라이트·컬렉션 홈·작품홈이 전부 이 함수를 쓴다.
      화면은 계산하지 않는다 (후보 → 정책 → 멍청한 UI).

   규칙:
   - 축은 4개: 샵(기본 뼈대) · 이벤트(특별한 경험) · 카페(특별한 경험) · 루트(큰 성취)
   - 축별 진행률은 각각 그대로 보여준다 (하나의 %로 뭉개지 않는다)
   - 종합 탐험도 = 가중 평균
   - ⭐⭐ 해당 작품에 전체 수가 0인 축은 계산에서 빼고, 남은 축의 가중치를 100%로 재정규화.
     콜라보 카페가 없는 작품 때문에 사용자가 영원히 100%를 못 찍는 일이 없어야 한다.
   ============================================================ */

export type AxisKey = 'shop' | 'event' | 'cafe' | 'route'

export const AXIS_KEYS: AxisKey[] = ['shop', 'event', 'cafe', 'route']

/** 루트는 완주라는 행동의 무게가 커서 카페보다 높다 */
export const AXIS_WEIGHT: Record<AxisKey, number> = {
  shop: 40,
  event: 25,
  cafe: 15,
  route: 20,
}

export const AXIS_LABEL: Record<AxisKey, string> = {
  shop: '샵', event: '이벤트', cafe: '카페', route: '루트',
}

/** 축마다 행동의 이름이 다르다 — "루트를 방문한다"고 하지 않는다 */
export const AXIS_VERB: Record<AxisKey, string> = {
  shop: '방문', event: '참여', cafe: '방문', route: '완주',
}

/**
 * 축별 아이콘 — public/icons/{name}.png 파일명.
 * ⭐ 새로 그리지 않고 이미 있는 자산을 쓴다. UI는 MaskIcon으로 색만 입힌다.
 */
export const AXIS_ICON: Record<AxisKey, string> = {
  shop: 'shop', event: 'popup', cafe: 'cafe', route: 'route',
}

export interface AxisProgress {
  done: number
  total: number
  pct: number
}

/** 다음 목표 — 가장 가까운 미완료 축에서 하나 집는다 */
export interface NextGoal {
  axis: AxisKey
  name: string            // 안서당 / 원피스 팝업
  href: string | null     // 지금 그 대상으로
  /** "이벤트 3 / 5" — 이걸 하면 그 축이 어떻게 되는지 */
  after: string
}

export interface WorkProgress {
  workId: string
  axes: Record<AxisKey, AxisProgress>
  /** 종합 탐험도 (0인 축 제외 + 가중치 재정규화) */
  overall: number
  next: NextGoal | null
}

const empty = (): AxisProgress => ({ done: 0, total: 0, pct: 0 })
const mk = (done: number, total: number): AxisProgress => ({
  done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0,
})

/**
 * 종합 탐험도 = 가중 평균.
 * 전체가 0인 축은 분모에서 통째로 빠지고, 남은 축의 가중치가 100%로 재정규화된다.
 *
 * 예) 카페가 없는 작품 → 샵 40 + 이벤트 25 + 루트 20 = 85 를 100으로 환산.
 *     카페가 없다는 이유로 감점되지 않는다.
 */
export function overallPct(axes: Record<AxisKey, AxisProgress>): number {
  let weightSum = 0
  let acc = 0
  for (const k of AXIS_KEYS) {
    if (axes[k].total === 0) continue      // 존재하지 않는 축은 제외
    weightSum += AXIS_WEIGHT[k]
    acc += axes[k].pct * AXIS_WEIGHT[k]
  }
  if (weightSum === 0) return 0
  return Math.round(acc / weightSum)       // 남은 가중치를 100%로 재정규화
}

/**
 * "가장 가까운 미완료 축" — 완성에 제일 근접한 축을 다음 목표로 삼는다.
 * 동점이면 가중치가 큰 축(= 종합에 더 크게 기여하는 축)을 고른다.
 */
function pickNextAxis(axes: Record<AxisKey, AxisProgress>): AxisKey | null {
  const open = AXIS_KEYS.filter(k => axes[k].total > 0 && axes[k].done < axes[k].total)
  if (open.length === 0) return null
  return open.sort((a, b) => (axes[b].pct - axes[a].pct) || (AXIS_WEIGHT[b] - AXIS_WEIGHT[a]))[0]
}

/**
 * 작품들의 4축 진행률을 한 번에 계산한다.
 * (Story 여러 개가 각자 대표 작품을 가지므로 배치로 받는다)
 */
export async function getWorkProgress(
  userId: string,
  workIds: string[],
): Promise<Map<string, WorkProgress>> {
  const result = new Map<string, WorkProgress>()
  const ids = [...new Set(workIds.filter(Boolean))]
  if (ids.length === 0) return result

  const supabase = createClient()

  // ---- 분모: 작품별 전체 대상 --------------------------------
  const [{ data: shopTags }, { data: events }, { data: routes }] = await Promise.all([
    supabase.from('shop_tags').select('tag_id, shop_id, shops ( slug, name, status )').in('tag_id', ids),
    supabase.from('events').select('id, tag_id, type, title').in('tag_id', ids),
    supabase.from('routes').select('id, primary_tag_id, title, share_token').in('primary_tag_id', ids).eq('is_shared', true),
  ])

  // ---- 분자: 내가 한 것 --------------------------------------
  const [{ data: myVisits }, { data: myEventVisits }, { data: myCompletions }] = await Promise.all([
    supabase.from('check_ins').select('shop_id').eq('user_id', userId),
    supabase.from('event_visits').select('event_id').eq('user_id', userId),
    supabase.from('route_completions').select('route_id').eq('user_id', userId),
  ])

  const visitedShops = new Set((myVisits ?? []).map((r: any) => r.shop_id))
  const visitedEvents = new Set((myEventVisits ?? []).map((r: any) => r.event_id))
  const doneRoutes = new Set((myCompletions ?? []).map((r: any) => r.route_id))

  // 작품별 후보 모으기
  type Cand = { id: string; name: string; href: string | null; done: boolean }
  const byWork = new Map<string, Record<AxisKey, Cand[]>>()
  const bucket = (w: string): Record<AxisKey, Cand[]> => {
    if (!byWork.has(w)) byWork.set(w, { shop: [], event: [], cafe: [], route: [] })
    return byWork.get(w)!
  }

  for (const r of (shopTags ?? []) as any[]) {
    const s = r.shops
    if (!s || s.status !== 'active') continue     // 닫힌 샵은 분모에서 뺀다
    bucket(r.tag_id).shop.push({
      id: r.shop_id,
      name: s.name,
      href: s.slug ? `/shop/${s.slug}` : null,
      done: visitedShops.has(r.shop_id),
    })
  }

  for (const e of (events ?? []) as any[]) {
    // ⭐ 콜라보 카페는 events의 한 종류지만, 탐험도에서는 별개의 축이다
    const axis: AxisKey = e.type === 'collab_cafe' ? 'cafe' : 'event'
    bucket(e.tag_id)[axis].push({
      id: e.id,
      name: e.title,
      href: `/event/${e.id}`,                     // 이벤트 상세는 id로 연다
      done: visitedEvents.has(e.id),
    })
  }

  for (const rt of (routes ?? []) as any[]) {
    bucket(rt.primary_tag_id).route.push({
      id: rt.id,
      name: rt.title,
      href: rt.share_token ? `/route/${rt.share_token}` : null,   // 루트 상세는 token으로 연다
      done: doneRoutes.has(rt.id),
    })
  }

  // ---- 조립 --------------------------------------------------
  for (const workId of ids) {
    const b = byWork.get(workId) ?? { shop: [], event: [], cafe: [], route: [] }

    const axes: Record<AxisKey, AxisProgress> = {
      shop: empty(), event: empty(), cafe: empty(), route: empty(),
    }
    for (const k of AXIS_KEYS) {
      axes[k] = mk(b[k].filter(c => c.done).length, b[k].length)
    }

    const nextAxis = pickNextAxis(axes)
    let next: NextGoal | null = null
    if (nextAxis) {
      const cand = b[nextAxis].find(c => !c.done)
      if (cand) {
        const a = axes[nextAxis]
        next = {
          axis: nextAxis,
          name: cand.name,
          href: cand.href,
          after: `${AXIS_LABEL[nextAxis]} ${a.done + 1} / ${a.total}`,
        }
      }
    }

    result.set(workId, { workId, axes, overall: overallPct(axes), next })
  }

  return result
}
