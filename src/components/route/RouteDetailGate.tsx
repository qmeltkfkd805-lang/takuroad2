'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { toggleRouteShare } from '@/services/routeService'
import RouteDetailPage from './RouteDetailPage'

export default function RouteDetailGate({ route }: { route: any }) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [shared, setShared] = useState(!!route.is_shared)
  const [busy, setBusy] = useState(false)

  const isAuthor = !!user && user.id === route.user_id
  const isOfficial = !!route.is_official

  // 비공개 루트인데 작성자도 아니면 접근 차단
  if (!shared && !isAuthor) {
    if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--muted)', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <p style={{ fontWeight: 700, marginBottom: 6 }}>비공개 루트예요</p>
        <p style={{ fontSize: 14 }}>작성자가 공개하면 볼 수 있어요.</p>
        <button onClick={() => router.push('/routes')} style={{ marginTop: 18, padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>다른 루트 둘러보기</button>
      </div>
    )
  }

  async function togglePublish() {
    if (!user || busy) return
    setBusy(true)
    const next = !shared
    const ok = await toggleRouteShare(route.id, user.id, next)
    setBusy(false)
    if (ok) setShared(next)
  }

  return (
    <div>
      {isAuthor && (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: isOfficial ? '#f59e0b' : shared ? 'var(--green)' : 'var(--muted)' }}>
            {isOfficial ? '⭐ 공식 루트' : shared ? '🟢 공개됨' : '🟡 작성중 (나만 보임)'}
          </span>
          {!isOfficial && (
            <button onClick={togglePublish} disabled={busy} style={{ padding: '8px 16px', borderRadius: 9999, background: shared ? 'var(--surface)' : 'var(--accent)', color: shared ? 'var(--text)' : '#fff', border: shared ? '1px solid var(--border)' : 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }as React.CSSProperties}>
              {busy ? '처리 중...' : shared ? '비공개로 전환' : '공개하기'}
            </button>
          )}
        </div>
      )}
      <RouteDetailPage route={route} />
    </div>
  )
}
