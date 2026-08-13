'use client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import RouteDetailPage from './RouteDetailPage'

export default function RouteDetailGate({ route }: { route: any }) {
  const router = useRouter()
  const { user, loading } = useAuth()

  const isAuthor = !!user && user.id === route.user_id
  const viewable = !!route.is_shared || !!route.is_official

  // 비공개 루트인데 작성자도 아니면 접근 차단
  if (!viewable && !isAuthor) {
    if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--muted)', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
          <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>
        <p style={{ fontWeight: 700, marginBottom: 6 }}>비공개 루트예요</p>
        <p style={{ fontSize: 14 }}>작성자가 공개하면 볼 수 있어요.</p>
        <button onClick={() => router.push('/routes')} style={{ marginTop: 18, padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>다른 루트 둘러보기</button>
      </div>
    )
  }

  return <RouteDetailPage route={route} />
}
