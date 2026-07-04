'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSavedRoutes, toggleRouteSave } from '@/services/routeService'
import { EmptyState, LoadingState } from './SavedShopsTab'

const DIFF: Record<number, { l: string; c: string }> = { 1: { l: '가별게', c: '#22c55e' }, 2: { l: '반나절', c: '#eab308' }, 3: { l: '하루', c: '#ef4444' } }

export default function SavedRoutesTab({ userId }: { userId: string }) {
  const router = useRouter()
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSavedRoutes(userId).then((d) => { setRoutes(d); setLoading(false) }).catch(() => setLoading(false))
  }, [userId])

  async function unsave(routeId: string) {
    setRoutes((prev) => prev.filter((r) => r.id !== routeId))
    await toggleRouteSave(routeId, userId).catch(() => {})
  }

  if (loading) return <LoadingState />
  if (routes.length === 0) return <EmptyState icon="❤️" text="저장한 루트가 없어요" />

  return (
    <div style={{ padding: '16px' }}>
      {routes.map((route) => {
        const d = route.official_difficulty ? DIFF[route.official_difficulty] : null
        return (
          <div key={route.id} style={{ border: '1.5px solid var(--border)', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden' }}>
            <button
              onClick={() => route.share_token && router.push(`/route/${route.share_token}`)}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
            >
              <div style={{ height: 100, backgroundImage: route.cover_image_url ? `url(${route.cover_image_url})` : 'linear-gradient(135deg, var(--accent), #ff8fb1)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'flex-end', padding: 10, position: 'relative' }}>
                {d && <span style={{ background: 'rgba(255,255,255,.9)', color: d.c, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 9999 }}>{d.l}</span>}
                <span onClick={(e) => { e.stopPropagation(); unsave(route.id) }} style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 9999, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, cursor: 'pointer' }}>❤️</span>
              </div>
              <div style={{ padding: '12px 14px 14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: 6 }}>{route.title}</h3>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--muted)' }}>
                  <span>📍 {route.route_shops?.length ?? 0}곳</span>
                  <span>🚺 {route.total_duration_min}분</span>
                  <span>❤️ {route.likes ?? 0}</span>
                </div>
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}