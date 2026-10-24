'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { fetchRouteDetail } from '@/lib/route/routeDetailQuery'
import RouteDetailPage from './RouteDetailPage'
import LogoLoader from '@/components/common/LogoLoader'

/* 루트 상세 문지기 (2026-10-24 — 페이지 캐시 전환)
   서버는 비로그인 권한으로 공개·공식 루트만 넘긴다(route). 못 읽은 루트(null)는 비공개이거나 없는 루트라,
   로그인한 사람이면 여기서 그 사람 세션으로 다시 읽는다 → routes RLS 상 작성자 본인 것만 읽힌다.
   차단 관계(보는 사람 ↔ 작성자)도 여기서 확인해 작성자 닉네임을 '사용자'로 가린다. */
export default function RouteDetailGate({ route: initialRoute, token }: { route: any | null; token: string }) {
  const router = useRouter()
  const { user, loading } = useAuth()

  // 서버가 못 읽은 루트 — 로그인 세션으로 다시 읽은 결과 (token 별로 기억)
  const [loaded, setLoaded] = useState<{ token: string; route: any | null } | null>(null)
  useEffect(() => {
    if (initialRoute || loading || !user) return
    let alive = true
    fetchRouteDetail(createClient(), token)
      .then(r => { if (alive) setLoaded({ token, route: r }) })
      .catch(() => { if (alive) setLoaded({ token, route: null }) })
    return () => { alive = false }
  }, [initialRoute, loading, user, token])

  const route = initialRoute ?? (loaded?.token === token ? loaded.route : null)
  const fetching = !initialRoute && (loading || (!!user && loaded?.token !== token))
  const isAuthor = !!user && !!route && user.id === route.user_id

  // 비공개 루트는 서버가 제목을 몰라서 탭 제목이 '덕질 루트'로 나간다 — 작성자에게는 루트 이름으로 바꿔 준다
  useEffect(() => {
    if (!initialRoute && route?.title) document.title = `${route.title} · 덕질 루트 | 타쿠로드`
  }, [initialRoute, route?.title])

  // 차단 관계 확인 — 확인되면 작성자 정보를 지운다 (is_blocked_between 은 방향을 드러내지 않는 대칭 boolean)
  const blockKey = user && route?.user_id && !isAuthor ? `${user.id}:${route.user_id}` : ''
  const [block, setBlock] = useState<{ key: string; blocked: boolean } | null>(null)
  useEffect(() => {
    if (!blockKey || !route?.user_id) return
    let alive = true
    createClient().rpc('is_blocked_between', { target: route.user_id })
      .then(({ data }) => { if (alive) setBlock({ key: blockKey, blocked: data === true }) })
    return () => { alive = false }
  }, [blockKey, route?.user_id])
  const blocked = !!blockKey && block?.key === blockKey && block.blocked

  const shown = useMemo(
    () => (route && blocked ? { ...route, profiles: null, author_blocked: true } : route),
    [route, blocked],
  )

  if (fetching) return <LogoLoader size="md" />

  // 없는 루트이거나, 남의 비공개 루트(RLS 때문에 아예 안 읽힌다)
  if (!shown) return <GateMessage title="루트를 볼 수 없어요" body="비공개로 바뀌었거나 없는 루트예요." onBack={() => router.push('/routes')} />

  // 자격검사: 공유(is_shared)·공식(is_official) 루트이거나 본인 것만. (비공개/공유해제 → 차단)
  const viewable = !!shown.is_shared || !!shown.is_official
  if (!viewable && !isAuthor) return <GateMessage title="비공개 루트예요" body="작성자가 공개하면 볼 수 있어요." onBack={() => router.push('/routes')} />

  return <RouteDetailPage route={shown} />
}

function GateMessage({ title, body, onBack }: { title: string; body: string; onBack: () => void }) {
  return (
    <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--muted)', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
        <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </div>
      <p style={{ fontWeight: 700, marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 14 }}>{body}</p>
      <button onClick={onBack} style={{ marginTop: 18, padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>다른 루트 둘러보기</button>
    </div>
  )
}
