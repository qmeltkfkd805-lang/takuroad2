'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
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

/** onCount — 마이페이지 '내 루트' 탭에 개수를 띄우려고 지금 목록 수를 알려준다 (삭제하면 다시 알려준다) */
export default function MyRoutesTab({ userId, readOnly, onCount }: { userId: string; readOnly?: boolean; onCount?: (n: number) => void }) {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!loading) onCount?.(routes.length)
  }, [loading, routes.length])

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
    if (token) {
      navigator.clipboard?.writeText(window.location.origin + '/route/' + token)
      alert('공유 링크가 복사됐어요!')
    }
  }
  /* 루트는 공개가 기본 — 임시 저장 루트만 "공개하기"로 공개할 수 있고, 공개 → 비공개는 없다 */
  async function publish(route: any) {
    const ok = await toggleRouteShare(route.id, userId, true)
    if (ok) setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, is_shared: true } : r))
    else alert('공개하지 못했어요. 다시 시도해 주세요.')
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
      badgeFor={r => r.isShared ? null : { text: '임시 저장', bg: '#9aa1ab' }}
      // 임시 저장 루트는 눌러서 바로 이어 만들기 → "저장하기"를 누르면 공개
      hrefFor={readOnly ? undefined : r => (!r.isShared && r.shareToken ? '/route/' + r.shareToken + '/edit' : null)}
      menuFor={readOnly ? undefined : (r) => {
        const raw = routes.find(x => x.id === r.id)
        if (!raw) return null
        const isDraft = !(raw.is_shared || raw.is_official)
        return [
          ...(isDraft ? [{ label: '공개하기', onClick: () => publish(raw) }] : [{ label: '공유하기', onClick: () => copyShare(raw) }]),
          // 추천(공식) 루트는 관리자만 수정
          ...(!raw.is_official || isAdmin ? [{ label: '수정하기', onClick: () => raw.share_token && router.push('/route/' + raw.share_token + '/edit') }] : []),
          { label: '삭제하기', danger: true, onClick: () => handleDelete(r.id) },
        ]
      }}
    />
  )
}
