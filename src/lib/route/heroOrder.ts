/* 루트 탐색(/routes) 히어로에 무엇이 어떤 순서로 나가는지 — 여기 한 곳에서만 정한다.
   사용자 화면과 관리자 미리보기가 같은 결과를 내야 해서 모았다.
   supabase 의존이 없는 순수 로직이라 서버·클라이언트 어디서든 쓸 수 있다. */
import { mergeToMax } from '@/lib/home/heroSelect'

export const ROUTE_HERO_MAX = 5

/** 히어로 정렬에 필요한 최소 형태. 실제 행에는 이보다 많은 필드가 들어 있다. */
export interface HeroRouteLike {
  id: string
  likes?: number | null
  is_official?: boolean | null
  route_shops?: unknown[] | null
  route_tips?: { count: number }[] | null
}

/** 좋아요가 같을 때의 보조 지표 — 담긴 장소 수 + 팁 수.
    route_tips를 조회하지 않은 호출부에서는 장소 수만으로 계산된다. */
export function routeInfoScore(r: HeroRouteLike): number {
  return (r.route_shops?.length ?? 0) + (r.route_tips?.[0]?.count ?? 0)
}

/** 인기순: 좋아요 내림차순 → 동률이면 정보 충실도 내림차순 */
export function byRoutePopularity(a: HeroRouteLike, b: HeroRouteLike): number {
  return ((b.likes ?? 0) - (a.likes ?? 0)) || (routeInfoScore(b) - routeInfoScore(a))
}

/**
 * 히어로 목록 = 추천 루트 먼저, 남는 자리는 인기순으로.
 * id 중복은 제거하고 최대 max개까지. (홈 히어로의 mergeToMax와 같은 병합 방식)
 */
export function buildRouteHero<T extends HeroRouteLike>(routes: T[], max = ROUTE_HERO_MAX): T[] {
  const popular: T[] = [...routes].sort(byRoutePopularity)
  const official: T[] = popular.filter((r) => r.is_official)
  // mergeToMax의 제네릭을 T로 못박는다. 안 그러면 keyOf에서 { id: string }으로 좁혀져
  // 호출부에서 title 같은 다른 필드가 사라진다.
  return mergeToMax<T>(official, popular, (r) => r.id, max)
}
