'use client'
import { useEffect, useState } from 'react'
import { getCompletedRoutes, CompletedRoute } from '@/services/routeVisitService'
import RouteBrowser from './RouteBrowser'
import type { UIRoute } from './RouteCard'
import LogoLoader from '@/components/common/LogoLoader'

/** onCount — 마이페이지 '내 루트' 탭에 개수를 띄우려고 완주한 루트 수를 알려준다 (불러오기 실패면 부르지 않는다) */
export default function CompletedRoutesTab({ userId, onCount }: { userId: string; onCount?: (n: number) => void }) {
  const [routes, setRoutes] = useState<CompletedRoute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCompletedRoutes(userId).then((d) => { setRoutes(d); setLoading(false); onCount?.(d.length) }).catch(() => setLoading(false))
  }, [userId])

  if (loading) return <LogoLoader size="md" />
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
      // 완주 횟수(하루 1번씩)
      badgeFor={r => { const n = routes.find(x => x.id === r.id)?.runCount ?? 1; return { text: n > 1 ? `${n}번 완주` : '완주', bg: '#22c55e' } }}
    />
  )
}
