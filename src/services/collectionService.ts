import { createClient } from '@/lib/supabase/client'
import { getMyTagCollections, getMyCollectedTagIds } from '@/services/tagCollectionService'
import { getMyRouteProgress } from '@/services/routeService'
import { AxisKey, AxisProgress, NextGoal, getWorkProgress } from '@/lib/work/workProgress'

/* 컬렉션 홈 — 실제 데이터만 집계. 없는 항목(기념품·지역률·추천)은 페이지에서 목업.

   ⭐ 작품 진행률을 여기서 계산하지 않는다. 정책(lib/work/workProgress)에 물어본다.
      그래야 연대기 Story 하이라이트와 같은 숫자가 나온다.
      (전에는 여기서 "샵만" 따로 세서 화면마다 다른 %를 말했다) */

export interface WorkCollection {
  id: string
  name: string
  slug: string
  /** 종합 탐험도 — 0인 축 제외 + 가중치 재정규화 */
  overall: number
  /** 축별 진행률 (샵·이벤트·카페·루트) */
  axes: Record<AxisKey, AxisProgress>
  /** 가장 가까운 미완료 축에서 고른 다음 목표 */
  next: NextGoal | null
}

export interface RouteProgress {
  id: string
  title: string
  shareToken: string | null
  cover: string | null
  visited: number
  total: number
  pct: number
}

export interface CollectionSummary {
  collectedWorks: number
  totalWorks: number
  visitedShops: number
  savedShops: number
  activeRoutes: number
}

export interface CollectionHome {
  summary: CollectionSummary
  works: WorkCollection[]
  routesInProgress: RouteProgress[]
}

/** 로그인 유저의 컬렉션 홈 데이터 (실데이터만) */
export async function getCollectionHome(userId: string): Promise<CollectionHome> {
  const supabase = createClient()

  const [tagCols, collectedIds, routeProg, savedRes, checkInRes] = await Promise.all([
    getMyTagCollections(userId),
    getMyCollectedTagIds(userId),
    getMyRouteProgress(userId),
    supabase.from('saved_shops').select('shop_id', { count: 'exact', head: true }).eq('user_id', userId),
    // 방문한 샵 = check_ins. (전에는 user_tag_collections로 셌는데, 그건 방문 후
    //  작품 선택 모달을 건너뛰면 안 잡힌다 — "방문했어요"를 눌렀는데 0곳이 되는 버그)
    supabase.from('check_ins').select('shop_id').eq('user_id', userId),
  ])

  const visitedShopSet = new Set((checkInRes.data ?? []).map((r: any) => r.shop_id).filter(Boolean))

  // ⭐ 4축 진행률 — 정책 한 곳에서 배치로 계산
  const progress = await getWorkProgress(userId, collectedIds)
  const metaById = new Map(tagCols.map((t: any) => [t.id, { name: t.name, slug: t.slug }]))

  const works: WorkCollection[] = collectedIds
    .map(tid => {
      const p = progress.get(tid)
      const meta = metaById.get(tid)
      if (!p) return null
      return {
        id: tid,
        name: meta?.name ?? '작품',
        slug: meta?.slug ?? '',
        overall: p.overall,
        axes: p.axes,
        next: p.next,
      }
    })
    .filter((w): w is WorkCollection => w !== null)
    .sort((a, b) => b.overall - a.overall)

  const summary: CollectionSummary = {
    collectedWorks: collectedIds.length,
    totalWorks: tagCols.length,
    visitedShops: visitedShopSet.size,
    savedShops: savedRes.count ?? 0,
    activeRoutes: routeProg.length,
  }

  return { summary, works, routesInProgress: routeProg as RouteProgress[] }
}
