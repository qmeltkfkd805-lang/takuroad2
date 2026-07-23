'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getMyRoutes, deleteRoute, toggleRouteShare } from '@/services/routeService'
import { EmptyState, LoadingState } from './SavedShopsTab'
import AppIcon from '@/components/tds/AppIcon'

const DIFF: Record<number, { l: string; c: string }> = {
  1: { l: '가볍게', c: '#22c55e' }, 2: { l: '반나절', c: '#ea9f0a' }, 3: { l: '하루', c: '#ef4444' },
}

export default function MyRoutesTab({ userId }: { userId: string }) {
  const router = useRouter()
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [userId])
  async function load() {
    const data = await getMyRoutes(userId)
    setRoutes(data)
    setLoading(false)
  }

  async function handleDelete(e: React.MouseEvent, routeId: string) {
    e.stopPropagation()
    if (!confirm('이 루트를 삭제할까요?')) return
    await deleteRoute(routeId, userId)
    setRoutes(prev => prev.filter(r => r.id !== routeId))
  }

  async function handleShare(e: React.MouseEvent, route: any) {
    e.stopPropagation()
    if (!route.is_shared && !route.is_official) {
      await toggleRouteShare(route.id, userId, true)
      setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, is_shared: true } : r))
    }
    const token = route.share_token
    if (token) {
      navigator.clipboard.writeText(window.location.origin + '/route/' + token)
      alert('공유 링크가 복사됐어요!')
    }
  }

  if (loading) return <LoadingState />

  return (
    <div style={{ padding: '16px' }}>
      <button
        onClick={() => router.push('/route/new')}
        style={{ width: '100%', padding: '12px', borderRadius: '10px', marginBottom: '20px', background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}
      >+ 새 루트 만들기</button>

      {routes.length === 0 ? (
        <EmptyState icon="map" text="만든 루트가 없어요" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {routes.map(r => {
            const d = r.official_difficulty ? DIFF[r.official_difficulty] : null
            return (
              <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
                <button
                  onClick={() => r.share_token ? router.push('/route/' + r.share_token) : undefined}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: r.share_token ? 'pointer' : 'default', fontFamily: 'inherit', background: 'none', padding: 0 }}
                >
                  <div style={{ height: 90, backgroundImage: r.cover_image_url ? 'url(' + r.cover_image_url + ')' : 'linear-gradient(135deg, var(--accent), #ff8fb1)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'flex-end', padding: 10, position: 'relative' }}>
                    {d && <span style={{ background: 'rgba(255,255,255,.9)', color: d.c, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 9999 }}>{d.l}</span>}
                    {r.is_shared && <span style={{ position: 'absolute', top: 8, right: 8, background: '#22c55e', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 9999 }}>공개</span>}
                  </div>
                  <div style={{ padding: '10px 12px 8px' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AppIcon name="pin" size={12} />{r.route_shops?.length ?? 0}곳</span>
                      {r.total_duration_min ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AppIcon name="clock" size={12} />{r.total_duration_min}분</span> : null}
                    </div>
                  </div>
                </button>
                <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                  <button onClick={(e) => handleShare(e, r)} style={{ flex: 1, padding: '8px', border: 'none', background: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><AppIcon name="link" size={12} style={{ marginRight: 4 }} />공유</button>
                  <button onClick={(e) => handleDelete(e, r.id)} style={{ flex: 1, padding: '8px', border: 'none', borderLeft: '1px solid var(--border)', background: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><AppIcon name="trash" size={12} style={{ marginRight: 4 }} />삭제</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}