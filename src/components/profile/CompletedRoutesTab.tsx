'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCompletedRoutes, CompletedRoute } from '@/services/routeVisitService'

const DIFF: Record<number, { l: string; c: string }> = { 1: { l: '가볍게', c: '#22c55e' }, 2: { l: '반나절', c: '#eab308' }, 3: { l: '하루', c: '#ef4444' } }

export default function CompletedRoutesTab({ userId }: { userId: string }) {
  const [routes, setRoutes] = useState<CompletedRoute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCompletedRoutes(userId).then((d) => { setRoutes(d); setLoading(false) }).catch(() => setLoading(false))
  }, [userId])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  if (routes.length === 0) return <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>아직 완료한 루트가 없어요.<br />루트를 시작해서 모든 스팟을 방문해보세요!</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
      {routes.map((r) => {
        const d = r.difficulty ? DIFF[r.difficulty] : null
        return (
          <Link key={r.id} href={r.shareToken ? `/route/${r.shareToken}` : '#'} style={{ textDecoration: 'none', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', display: 'block' }}>
            <div style={{ position: 'relative', height: 110, backgroundImage: r.cover ? `url(${r.cover})` : 'linear-gradient(135deg, var(--accent), #ff9bb6)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
              <span style={{ position: 'absolute', top: 8, left: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: '#fff', background: 'var(--green)', padding: '3px 9px', borderRadius: 9999 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="m5 12 5 5L20 6" /></svg>완료
              </span>
            </div>
            <div style={{ padding: '10px 12px 12px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{r.total}곳{r.distance ? ` · ${(r.distance / 1000).toFixed(1)}km` : ''}{d ? ` · ` : ''}{d ? <span style={{ color: d.c, fontWeight: 700 }}>{d.l}</span> : null}</div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
