'use client'

import { useState, useEffect } from 'react'
import { getSavedRoutes, toggleRouteSave } from '@/services/routeService'
import { EmptyState, LoadingState } from './SavedShopsTab'
import { routeRegions } from './RouteRegionFilter'
import RouteBrowser from './RouteBrowser'
import type { UIRoute } from './RouteCard'

function stopsOf(r: any): { lat: number; lng: number }[] {
  return [...(r.route_shops ?? [])]
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((rs: any) => ({ lat: rs.shops?.lat, lng: rs.shops?.lng }))
    .filter((s: any) => typeof s.lat === 'number' && typeof s.lng === 'number')
}

/** onCount — 저장함 탭에 개수를 띄우려고 지금 목록 수를 알려준다 (불러오기 실패면 부르지 않는다, 저장 해제하면 다시 알려준다) */
export default function SavedRoutesTab({ userId, onCount }: { userId: string; onCount?: (n: number) => void }) {
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getSavedRoutes(userId).then((d) => { setRoutes(d); setLoading(false); setLoaded(true) }).catch(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (loaded) onCount?.(routes.length)
  }, [loaded, routes.length])

  async function unsave(route: any) {
    if (!confirm('저장을 해제할까요?')) return
    setRoutes((prev) => prev.filter((r) => r.id !== route.id))
    await toggleRouteSave(route.id, userId).catch(() => {})
  }

  if (loading) return <LoadingState />
  if (routes.length === 0) return <EmptyState icon="heart" text="저장한 루트가 없어요" />

  const ui: UIRoute[] = routes.map((r: any) => {
    const regions = routeRegions(r)
    return {
      id: r.id,
      title: r.title,
      shareToken: r.share_token,
      regions,
      regionLabel: regions[0] ?? null,
      stopCount: r.route_shops?.length ?? 0,
      durationMin: r.total_duration_min ?? null,
      isShared: !!r.is_shared,
      stops: stopsOf(r),
    }
  })

  return (
    <RouteBrowser
      routes={ui}
      emptyText="저장한 루트가 없어요"
      menuFor={(r) => [{ label: '저장 해제', danger: true, onClick: () => unsave(routes.find(x => x.id === r.id)) }]}
    />
  )
}
