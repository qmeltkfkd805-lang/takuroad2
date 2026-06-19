'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getMyRoutes, deleteRoute, toggleRouteShare } from '@/services/routeService'
import { EmptyState, LoadingState } from './SavedShopsTab'

export default function MyRoutesTab({ userId }: { userId: string }) {
  const router = useRouter()
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [shareMenuId, setShareMenuId] = useState<string | null>(null)

  useEffect(() => {
    loadRoutes()
  }, [userId])

  async function loadRoutes() {
    const data = await getMyRoutes(userId)
    setRoutes(data)
    setLoading(false)
  }

  async function handleDelete(routeId: string) {
    if (!confirm('이 루트를 삭제할까요?')) return
    await deleteRoute(routeId, userId)
    setRoutes(prev => prev.filter(r => r.id !== routeId))
  }

  async function handleToggleShare(routeId: string, current: boolean) {
    await toggleRouteShare(routeId, userId, !current)
    setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, is_shared: !current } : r))
    // 공개로 바꾸자마자 공유 메뉴 자동으로 열어주기
    if (!current) setShareMenuId(routeId)
  }

  function getShareUrl(token: string) {
    return `${window.location.origin}/route/${token}`
  }

  function shareKakao(route: any) {
    const url = getShareUrl(route.share_token)
    if (typeof window !== 'undefined' && (window as any).Kakao) {
      const Kakao = (window as any).Kakao
      if (!Kakao.isInitialized()) return alert('카카오 공유 초기화가 필요해요')
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: route.title,
          description: `${route.route_shops?.length ?? 0}개의 성지를 도는 루트 · 도보 ${route.total_duration_min}분`,
          imageUrl: route.cover_image_url || `${window.location.origin}/icon-512.png`,
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [{ title: '루트 보기', link: { mobileWebUrl: url, webUrl: url } }],
      })
    } else {
      alert('카카오톡 공유를 사용할 수 없어요. 링크를 복사해주세요.')
    }
  }

  function shareTwitter(route: any) {
    const url = getShareUrl(route.share_token)
    const text = `${route.title} - 타쿠로드 성지순례 루트`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank')
  }

  function shareNaverBlog(route: any) {
    const url = getShareUrl(route.share_token)
    const title = route.title
    window.open(`https://share.naver.com/web/shareView?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`, '_blank')
  }

  function copyShareLink(token: string) {
    navigator.clipboard.writeText(getShareUrl(token))
    alert('공유 링크가 복사됐어요!')
    setShareMenuId(null)
  }

  async function nativeShare(route: any) {
    const url = getShareUrl(route.share_token)
    if (navigator.share) {
      try {
        await navigator.share({ title: route.title, text: `타쿠로드 루트: ${route.title}`, url })
      } catch {}
    } else {
      copyShareLink(route.share_token)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div style={{ padding: '16px' }}>
      <button
        onClick={() => router.push('/route/new')}
        style={{
          width: '100%', padding: '12px', borderRadius: '10px', marginBottom: '16px',
          background: 'var(--accent)', color: '#fff', border: 'none',
          fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        + 새 루트 만들기
      </button>

      {routes.length === 0 ? (
        <EmptyState icon="🗺️" text="만든 루트가 없어요" />
      ) : (
        routes.map(route => (
          <div key={route.id} style={{
            border: '1.5px solid var(--border)', borderRadius: '12px',
            padding: '14px', marginBottom: '12px', position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 900 }}>{route.title}</h3>
              <button
                onClick={() => handleDelete(route.id)}
                style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }}
              >삭제</button>
            </div>

            {route.description && (
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>{route.description}</p>
            )}

            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
              <span>📍 {route.route_shops?.length ?? 0}곳</span>
              <span>🚶 {route.total_duration_min}분</span>
              <span>📏 {route.total_distance_m >= 1000 ? `${(route.total_distance_m / 1000).toFixed(1)}km` : `${route.total_distance_m}m`}</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
              {(route.route_shops ?? [])
                .sort((a: any, b: any) => a.sort_order - b.sort_order)
                .map((rs: any, i: number) => (
                  <span key={rs.id} style={{
                    fontSize: '11px', background: 'var(--surface2)',
                    borderRadius: '10px', padding: '3px 8px',
                  }}>
                    {i + 1}. {rs.shops?.name}
                  </span>
                ))}
            </div>

            {/* 안내 문구 */}
            {!route.is_shared && (
              <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>
                💡 비공개 상태예요. 공유하려면 먼저 &quot;공개하기&quot;를 눌러주세요.
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px', marginBottom: shareMenuId === route.id ? '10px' : 0 }}>
              <button
                onClick={() => handleToggleShare(route.id, route.is_shared)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px',
                  border: `1px solid ${route.is_shared ? 'var(--green)' : 'var(--accent)'}`,
                  background: route.is_shared ? 'var(--green)15' : 'var(--surface)',
                  color: route.is_shared ? 'var(--green)' : 'var(--accent)',
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {route.is_shared ? '✓ 공개중 (누르면 비공개)' : '공개하기'}
              </button>
              {route.is_shared && (
                <button
                  onClick={() => setShareMenuId(shareMenuId === route.id ? null : route.id)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--text)', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  🔗 공유하기
                </button>
              )}
            </div>

            {shareMenuId === route.id && route.is_shared && (
              <div style={{
                display: 'flex', gap: '8px', flexWrap: 'wrap',
                padding: '10px', background: 'var(--surface2)', borderRadius: '10px',
              }}>
                <ShareIconButton onClick={() => shareKakao(route)} color="#FEE500" label="카톡">💬</ShareIconButton>
                <ShareIconButton onClick={() => shareTwitter(route)} color="#000" textColor="#fff" label="X">𝕏</ShareIconButton>
                <ShareIconButton onClick={() => shareNaverBlog(route)} color="#03C75A" textColor="#fff" label="네이버">N</ShareIconButton>
                <ShareIconButton onClick={() => nativeShare(route)} color="var(--surface)" label="더보기">⋯</ShareIconButton>
                <ShareIconButton onClick={() => copyShareLink(route.share_token)} color="var(--surface)" label="복사">🔗</ShareIconButton>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function ShareIconButton({ onClick, color, textColor = '#000', label, children }: {
  onClick: () => void
  color: string
  textColor?: string
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%',
        background: color, color: textColor,
        border: color === 'var(--surface)' ? '1.5px solid var(--border)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '16px', fontWeight: 700,
      }}>
        {children}
      </div>
      <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{label}</span>
    </button>
  )
}