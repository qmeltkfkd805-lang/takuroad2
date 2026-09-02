'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getMyRoutes, deleteRoute, toggleRouteShare } from '@/services/routeService'
import { LoadingState } from './SavedShopsTab'
import { routeRegions } from './RouteRegionFilter'
import RouteBrowser from './RouteBrowser'
import type { UIRoute } from './RouteCard'

function stopsOf(r: any): { lat: number; lng: number }[] {
  return [...(r.route_shops ?? [])]
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((rs: any) => ({ lat: rs.shops?.lat, lng: rs.shops?.lng }))
    .filter((s: any) => typeof s.lat === 'number' && typeof s.lng === 'number')
}

export default function MyRoutesTab({ userId, readOnly }: { userId: string; readOnly?: boolean }) {
  const router = useRouter()
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [userId])
  async function load() {
    const data = await getMyRoutes(userId)
    setRoutes(readOnly ? (data ?? []).filter((r: any) => r.is_shared || r.is_official) : (data ?? []))
    setLoading(false)
  }

  async function handleDelete(routeId: string) {
    if (!confirm('이 루트를 삭제할까요?')) return
    await deleteRoute(routeId, userId)
    setRoutes(prev => prev.filter(r => r.id !== routeId))
  }
  async function copyShare(route: any) {
    const token = route.share_token
    if (!route.is_shared && !route.is_official) {
      await toggleRouteShare(route.id, userId, true)
      setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, is_shared: true } : r))
    }
    if (token) {
      navigator.clipboard?.writeText(window.location.origin + '/route/' + token)
      alert('공유 링크가 복사됐어요!')
    }
  }
  async function toggleVisibility(route: any) {
    const next = !(route.is_shared || route.is_official)
    await toggleRouteShare(route.id, userId, next)
    setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, is_shared: next } : r))
  }

  if (loading) return <LoadingState />

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
      isShared: !!(r.is_shared || r.is_official),
      stops: stopsOf(r),
    }
  })

  return (
    <RouteBrowser
      routes={ui}
      emptyText={readOnly ? '공개한 루트가 없어요' : '아직 만든 루트가 없어요'}
      badgeFor={r => r.isShared ? { text: '공개', bg: '#22c55e' } : { text: '비공개', bg: '#9aa1ab' }}
      menuFor={readOnly ? undefined : (r) => {
        const raw = routes.find(x => x.id === r.id)
        if (!raw) return null
        return [
          { label: '공유하기', onClick: () => copyShare(raw) },
          { label: '수정하기', onClick: () => raw.share_token && router.push('/route/' + raw.share_token + '/edit') },
          { label: r.isShared ? '비공개로 전환' : '공개로 전환', onClick: () => toggleVisibility(raw) },
          { label: '삭제하기', danger: true, onClick: () => handleDelete(r.id) },
        ]
      }}
    />
  )
}
