import { createClient } from '@/lib/supabase/client'
import { getMyTagCollections, getMyCollectedTagIds } from '@/services/tagCollectionService'
import { getMyRouteProgress } from '@/services/routeService'

/* 컬렉션 홈 — 실제 데이터만 집계. 없는 항목(기념품·지역률·추천)은 페이지에서 목업. */

export interface WorkCollection {
  id: string
  name: string
  slug: string
  collected: number      // 이 작품을 취급하는 방문한 샵 수 (수집 진행)
  total: number          // 이 작품을 취급하는 전체 샵 수
  pct: number
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
  collectedWorks: number     // 수집한(방문으로 얻은) 작품 수
  totalWorks: number         // 전체 작품 수
  visitedShops: number       // 방문한 샵 수
  savedShops: number
  activeRoutes: number       // 진행중 루트
}

export interface CollectionHome {
  summary: CollectionSummary
  works: WorkCollection[]        // 수집한 작품 위주, 진행률
  routesInProgress: RouteProgress[]
}

/** 로그인 유저의 컬렉션 홈 데이터 (실데이터만) */
export async function getCollectionHome(userId: string): Promise<CollectionHome> {
  const supabase = createClient()

  const [tagCols, collectedIds, routeProg, savedRes, visitedRes] = await Promise.all([
    getMyTagCollections(userId),
    getMyCollectedTagIds(userId),
    getMyRouteProgress(userId),
    supabase.from('saved_shops').select('shop_id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_tag_collections').select('shop_id').eq('user_id', userId),
  ])

  // 방문한 샵 수 (체크인으로 작품을 수집한 고유 샵)
  const visitedShopSet = new Set((visitedRes.data ?? []).map((r: any) => r.shop_id).filter(Boolean))

  // 작품별 진행률 — 수집한 작품에 대해, 그 작품 취급 샵 중 몇 곳 방문했나
  // (취급 샵 총계는 shop_tags에서)
  const collectedTagIds = collectedIds
  let works: WorkCollection[] = []

  if (collectedTagIds.length > 0) {
    // 이 작품들을 취급하는 전체 샵 수
    const { data: tagShopRows } = await supabase
      .from('shop_tags')
      .select('tag_id, shop_id')
      .in('tag_id', collectedTagIds)

    const totalByTag = new Map<string, Set<string>>()
    for (const r of (tagShopRows ?? []) as any[]) {
      ;(totalByTag.get(r.tag_id) ?? totalByTag.set(r.tag_id, new Set()).get(r.tag_id)!).add(r.shop_id)
    }

    // 방문한 샵 중 이 작품 취급하는 곳 (= 수집 진행)
    const collectedByTag = new Map<string, Set<string>>()
    for (const r of (tagShopRows ?? []) as any[]) {
      if (visitedShopSet.has(r.shop_id)) {
        ;(collectedByTag.get(r.tag_id) ?? collectedByTag.set(r.tag_id, new Set()).get(r.tag_id)!).add(r.shop_id)
      }
    }

    const nameById = new Map(tagCols.map((t: any) => [t.id, { name: t.name, slug: t.slug }]))
    works = collectedTagIds.map(tid => {
      const total = totalByTag.get(tid)?.size ?? 0
      const collected = collectedByTag.get(tid)?.size ?? 0
      const meta = nameById.get(tid)
      return {
        id: tid,
        name: meta?.name ?? '작품',
        slug: meta?.slug ?? '',
        collected,
        total,
        pct: total ? Math.round((collected / total) * 100) : 0,
      }
    }).sort((a, b) => b.pct - a.pct)
  }

  const summary: CollectionSummary = {
    collectedWorks: collectedTagIds.length,
    totalWorks: tagCols.length,
    visitedShops: visitedShopSet.size,
    savedShops: savedRes.count ?? 0,
    activeRoutes: routeProg.length,
  }

  return {
    summary,
    works,
    routesInProgress: routeProg as RouteProgress[],
  }
}
