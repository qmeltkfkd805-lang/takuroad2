'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSavedRoutes, toggleRouteSave } from '@/services/routeService'
import { EmptyState, LoadingState } from './SavedShopsTab'

const DIFF: Record<number, { l: string; c: string }> = { 1: { l: '가볍게', c: '#22c55e' }, 2: { l: '반나절', c: '#eab308' }, 3: { l: '하루', c: '#ef4444' } }

export default function SavedRoutesTab({ userId }: { userId: string }) {
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSavedRoutes(userId).then((d) => { setRoutes(d); setLoading(false) }).catch(() => setLoading(false))
  }, [userId])

  async function unsave(e: React.MouseEvent, routeId: string) {
    e.preventDefault(); e.stopPropagation()
    setRoutes((prev) => prev.filter((r) => r.id !== routeId))
    await toggleRouteSave(routeId, userId).catch(() => {})
  }

  if (loading) return <LoadingState />
  if (routes.length === 0) return <EmptyState icon="❤️" text="저장한 루트가 없어요" />

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
      {routes.map((route) => {
        const d = route.official_difficulty ? DIFF[route.official_difficulty] : null
        return (
          <Link key={route.id} href={route.share_token ? `/route/${route.share_token}` : '#'} style={{ textDecoration: 'none', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', display: 'block' }}>
            <div style={{ position: 'relative', height: 110, backgroundImage: route.cover_image_url ? `url(${route.cover_image_url})` : 'linear-gradient(135deg, var(--accent), #ff9bb6)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
              {d && <span style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(255,255,255,.92)', color: d.c, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 9999 }}>{d.l}</span>}
              <button onClick={(e) => unsave(e, route.id)} aria-label="저장 해제" style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 9999, background: 'rgba(0,0,0,.4)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" strokeWidth="2"><path d="M12 21s-7-4.35-9.5-8.5C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 7C19 16.65 12 21 12 21z" /></svg>
              </button>
            </div>
            <div style={{ padding: '10px 12px 12px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{route.title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{route.route_shops?.length ?? 0}곳{route.total_distance_m ? ` · ${(route.total_distance_m / 1000).toFixed(1)}km` : ''}{d ? ` · ` : ''}{d ? <span style={{ color: d.c, fontWeight: 700 }}>{d.l}</span> : null}</div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
