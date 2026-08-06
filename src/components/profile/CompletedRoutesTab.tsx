'use client'
import { useEffect, useState } from 'react'
import { getCompletedRoutes, CompletedRoute } from '@/services/routeVisitService'
import RouteBrowser from './RouteBrowser'
import type { UIRoute } from './RouteCard'

export default function CompletedRoutesTab({ userId }: { userId: string }) {
  const [routes, setRoutes] = useState<CompletedRoute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCompletedRoutes(userId).then((d) => { setRoutes(d); setLoading(false) }).catch(() => setLoading(false))
  }, [userId])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  if (routes.length === 0) return <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>아직 완료한 루트가 없어요.<br />루트를 시작해서 모든 스팟을 방문해보세요!</div>

  const ui: UIRoute[] = routes.map((r) => ({
    id: r.id,
    title: r.title,
    shareToken: r.shareToken,
    regions: r.regions,
    regionLabel: r.regions[0] ?? null,
    stopCount: r.total,
    durationMin: r.durationMin,
    isShared: false,
    stops: r.stops,
  }))

  return (
    <RouteBrowser
      routes={ui}
      emptyText="완주한 루트가 없어요"
      badgeFor={() => ({ text: '완료', bg: '#22c55e' })}
    />
  )
}
