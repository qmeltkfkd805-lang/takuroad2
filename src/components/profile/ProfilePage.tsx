'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { ROUTES } from '@/lib/constants/routes'
import { getMyPassport, OtakuPassport } from '@/services/passportService'
import { getMyLevelInfo, LevelInfo } from '@/services/expService'
import { RARITY_COLOR, getNextVisitBadge, getMyEarnedBadges } from '@/services/badgeService'
import { getMyRoutes, getSavedRoutes } from '@/services/routeService'
import { Icon } from '@/components/tds'
import { useWorn } from '@/components/cosmetic/CosmeticProvider'
import { bgStyle, fxClass } from '@/lib/cosmetics/style'
import PassportCard from '@/components/passport/PassportCard'
import ActivityFeed from '@/components/passport/ActivityFeed'
import TitleBadgeSelector from '@/components/passport/TitleBadgeSelector'
import ChronicleTimeline from '@/components/passport/ChronicleTimeline'
import SavedShopsTab from './SavedShopsTab'
import VisitedShopsTab from './VisitedShopsTab'
import MyRoutesTab from './MyRoutesTab'
import SavedRoutesTab from './SavedRoutesTab'
import CompletedRoutesTab from './CompletedRoutesTab'
import MyReviewsTab from './MyReviewsTab'
import MyCommentsTab from './MyCommentsTab'
import MyPostsTab from './MyPostsTab'
import MyShopsTab from './MyShopsTab'
import VerifyStatusTab from './VerifyStatusTab'
import AccountSettingsTab from './AccountSettingsTab'
import BadgesTab from './BadgesTab'
import CollectionTab from './CollectionTab'
import ChroniclePage from '@/components/collection/ChroniclePage'
import GrowthPage from '@/components/growth/GrowthPage'
import CosmeticPage from '@/components/cosmetic/CosmeticPage'
import ProfileDesktop from './ProfileDesktop'
import { useSearchParams } from 'next/navigation'
import AppIcon from '@/components/tds/AppIcon'

type Tab = 'overview' | 'passport' | 'customize' | 'chronicle' | 'growth' | 'visited' | 'saved' | 'routes' | 'savedroutes' | 'completed' | 'posts' | 'reviews' | 'comments' | 'shops' | 'verify' | 'badges' | 'collection' | 'settings'

// 상세 탭 → 소속 카테고리(상단 카테고리 탭 하이라이트용)
// 상세 탭 제목 (개요에서 진입 시 헤더)
const TAB_TITLE: Record<string, string> = {
  passport: '여권', customize: '프로필 꾸미기', chronicle: '연대기', growth: '성장센터', badges: '배지',
  visited: '최근 방문', saved: '저장한 샵', routes: '내 루트', savedroutes: '저장한 루트', completed: '완주한 루트',
  posts: '작성 글', comments: '내 댓글', reviews: '내 후기', shops: '등록한 샵', verify: '인증 현황',
  collection: '컬렉션', settings: '설정',
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, loading, signOut } = useAuth()
  const initialTab = (useSearchParams().get('tab') as Tab) ?? 'overview'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [passport, setPassport] = useState<OtakuPassport | null>(null)
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null)
  const [nextBadge, setNextBadge] = useState<{ name: string; current: number; target: number; remaining: number; done: boolean } | null>(null)
  const [earnedBadges, setEarnedBadges] = useState<{ name: string; rarity: string; iconUrl: string | null }[]>([])
  const [routeCounts, setRouteCounts] = useState<{ made: number; saved: number; completed: number }>({ made: 0, saved: 0, completed: 0 })
  const [routeSub, setRouteSub] = useState<'made' | 'saved' | 'completed'>('made')
  const worn = useWorn(user?.id)   // 프로필 꾸미기에서 착용한 배경/효과 (여권 칸에 반영)
  const isDesktop = useIsDesktop()

  // 개요에서 상세 탭으로 이동
  const goTab = (t: Tab) => setTab(t)

  useEffect(() => {
    if (!loading && !user) {
      router.push(ROUTES.login)
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user) loadPassport()
  }, [user])

  useEffect(() => {
    if (!user) return
    getMyLevelInfo(user.id).then(setLevelInfo).catch(() => {})
    getNextVisitBadge(user.id).then(setNextBadge).catch(() => {})
    getMyEarnedBadges(user.id).then(setEarnedBadges).catch(() => {})
    Promise.all([getMyRoutes(user.id), getSavedRoutes(user.id)])
      .then(([made, saved]) => setRouteCounts({ made: (made as any[])?.length ?? 0, saved: (saved as any[])?.length ?? 0, completed: 0 }))
      .catch(() => {})
  }, [user])

  // 완주한 루트 수는 여권 데이터에서 (route_completions 카운트)
  useEffect(() => {
    if (passport) setRouteCounts(c => ({ ...c, completed: passport.pilgrimageCount }))
  }, [passport])

  async function loadPassport() {
    if (!user) return
    const data = await getMyPassport(user.id)
    setPassport(data)
  }

  if (loading || !user || !profile) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
        불러오는 중...
      </div>
    )
  }

  if (isDesktop) {
    return (
      <ProfileDesktop passport={passport} userId={user.id} />
    )
  }

  const roleLabel = profile.role === 'admin' ? '관리자' : profile.role === 'manager' ? '매니저' : '일반 회원'

  // ───────────── 📱 마이페이지 개요(홈) ─────────────
  if (tab === 'overview') {
    const cur = levelInfo?.currentLevelExp ?? 0
    const total = levelInfo?.totalExp ?? 0
    const nextTh = levelInfo?.nextLevelThreshold ?? null
    const inTier = Math.max(0, total - cur)
    const tierSpan = nextTh != null ? Math.max(1, nextTh - cur) : null
    // 진행 바: 방문 배지 진행을 우선 표시("다음 배지까지 N곳"), 없으면 레벨 XP로 대체
    const bp = nextBadge
    const badgePct = bp && bp.target > 0 ? Math.min(100, Math.round((bp.current / bp.target) * 100)) : null
    const pct = badgePct != null ? badgePct : (tierSpan ? Math.min(100, Math.round((inTier / tierSpan) * 100)) : 100)
    const pcSubText = bp
      ? (bp.done ? '방문 배지를 모두 모았어요' : `다음 배지까지 ${bp.remaining}곳 남음`)
      : (tierSpan ? `다음 레벨까지 ${levelInfo?.nextLevelExp ?? 0} XP` : '최고 레벨 달성')
    const pcRightText = bp ? `${bp.current} / ${bp.target}` : (tierSpan ? `${inTier} / ${tierSpan} XP` : 'MAX')

    const stats: { icon: string; label: string; value: number; go: Tab; sub?: 'made' | 'saved' | 'completed' }[] = [
      { icon: 'colorshop', label: '방문한 샵', value: passport?.visitedShopCount ?? 0, go: 'visited' },
      { icon: 'colorstar', label: '작성한 리뷰', value: passport?.reviewCount ?? 0, go: 'reviews' },
      { icon: 'colorcollection', label: '획득 배지', value: passport?.totalBadgeCount ?? 0, go: 'badges' },
      { icon: 'colorroute', label: '완주한 루트', value: passport?.pilgrimageCount ?? 0, go: 'routes', sub: 'completed' },
    ]
    // 대표 배지: 골라둔 showcase가 있으면 그것, 없으면 실제 획득 배지 — 획득 1 + 잠금 1 형태
    const featured = (passport?.featuredBadges?.length ? passport.featuredBadges : earnedBadges)
    const badgeCards = featured.slice(0, 1)
    const lockedCount = Math.max(1, 2 - badgeCards.length)

    // 여권 칸 — 프로필 꾸미기에서 고른 배경/효과 반영
    const skin = bgStyle(worn.background?.slug, worn.background?.assetUrl)
    const dressed = Boolean(worn.background)
    const onDark = !dressed || (skin as any).color === '#fff'   // 밝은 배경이면 어두운 글자
    const pcBg = dressed ? skin : { background: '#2c2c34' }
    const pcText = onDark ? '#fff' : 'var(--text)'
    const pcSub = onDark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.6)'
    const pcTrack = onDark ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.12)'

    return (
      <div style={{ width: '100%', minHeight: '100dvh', background: 'var(--surface)' }}>
        {/* 헤더 */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}>
          <button onClick={() => router.push('/')} aria-label="뒤로" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text)' }}>
            <AppIcon name="arrow-left" size={22} />
          </button>
          <div style={{ fontWeight: 900, fontSize: 17 }}>마이페이지</div>
          <button onClick={() => goTab('settings')} aria-label="설정" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text)' }}>
            <AppIcon name="gear" size={22} />
          </button>
        </div>

        <div style={{ padding: '18px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 프로필 행 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 900, overflow: 'hidden', flexShrink: 0 }}>
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile.nickname[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 22, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.nickname}</div>
              <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 3 }}>여행자 · {roleLabel}</div>
            </div>
            <button onClick={() => goTab('customize')} style={{ flexShrink: 0, alignSelf: 'flex-start', border: '1.5px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', fontWeight: 800, fontSize: 13.5, padding: '9px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>프로필 편집</button>
          </div>

          {/* 통계 4칸 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 8px' }}>
            {stats.map((s, i) => (
              <button key={s.label} onClick={() => { if (s.sub) setRouteSub(s.sub); goTab(s.go) }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0', minHeight: 44, borderLeft: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <Icon name={s.icon} size={30} />
                <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>{s.value}</span>
              </button>
            ))}
          </div>

          {/* 여권 레벨 카드 — 축소 · 프로필 꾸미기 배경 반영 */}
          <button onClick={() => goTab('passport')} style={{ position: 'relative', textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: pcText, borderRadius: 16, padding: '16px 18px', overflow: 'hidden', ...pcBg }}>
            {/* 착용 효과 레이어 */}
            {worn.effect?.slug && <div className={fxClass(worn.effect.slug)} aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none' }} />}
            {/* 우표 일러스트 */}
            <svg width="86" height="86" viewBox="0 0 120 120" style={{ position: 'absolute', right: 10, top: 8, opacity: 0.13 }} fill="none" stroke={pcText} strokeWidth="2">
              <rect x="18" y="18" width="84" height="84" rx="4" strokeDasharray="4 4" />
              <circle cx="52" cy="58" r="9" /><path d="M40 84c0-10 7-16 12-16s12 6 12 16" /><circle cx="74" cy="66" r="6" /><path d="M66 84c0-7 4-11 8-11s8 4 8 11" />
            </svg>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, opacity: 0.55 }}>TAKUROAD PASSPORT</span>
            </div>
            <div style={{ position: 'relative', fontSize: 26, fontWeight: 900, color: 'var(--accent)', marginTop: 3, lineHeight: 1 }}>Lv. {levelInfo?.level ?? 1}</div>
            <div style={{ position: 'relative', fontSize: 13, color: pcSub, marginTop: 8 }}>{pcSubText}</div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, marginTop: 7 }}>
              <div style={{ flex: 1, height: 8, borderRadius: 999, background: pcTrack, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: pcText, flexShrink: 0 }}>{pcRightText}</span>
            </div>
          </button>

          {/* 성장센터 배너 (작게) */}
          <button onClick={() => goTab('growth')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 14, padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Icon name="colorstar" size={22} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>성장센터</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>다음 목표와 성장 현황 보기</span>
            </span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>

          {/* 대표 배지 */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 900 }}>대표 배지</span>
              <button onClick={() => goTab('badges')} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>
                전체 보기 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {badgeCards.map((b, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'var(--accent-l, rgba(232,0,111,.07))', borderRadius: 14, padding: '20px 12px 16px' }}>
                  <span style={{ width: 68, height: 68, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${RARITY_COLOR[b.rarity as keyof typeof RARITY_COLOR] ?? 'var(--accent)'}`, overflow: 'hidden', background: 'var(--surface)' }}>
                    {b.iconUrl ? <img src={b.iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="colorcollection" size={34} />}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 800, textAlign: 'center', color: 'var(--text)' }}>{b.name}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--accent)', background: 'var(--surface)', padding: '3px 12px', borderRadius: 999 }}>획득</span>
                </div>
              ))}
              {Array.from({ length: lockedCount }).map((_, i) => (
                <button key={`lock-${i}`} onClick={() => goTab('badges')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'var(--surface2)', border: 'none', borderRadius: 14, padding: '20px 12px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ width: 68, height: 68, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border)', color: 'var(--muted)', background: 'var(--surface)' }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 800, textAlign: 'center', color: 'var(--muted)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextBadge?.name ?? '다음 배지'}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--muted)', background: 'var(--surface)', padding: '3px 12px', borderRadius: 999 }}>잠금</span>
                </button>
              ))}
            </div>
          </div>

          {/* 나의 여행 */}
          <MenuSection title="나의 여행">
            <MenuRow label="최근 방문" value={passport?.visitedShopCount} onClick={() => goTab('visited')} />
            <MenuRow label="저장한 샵" onClick={() => goTab('saved')} last />
          </MenuSection>

          {/* 루트 — 한 행 + 요약, 상세에서 만든/저장/완주 탭 */}
          <MenuSection title="루트">
            <button onClick={() => { setRouteSub('made'); goTab('routes') }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '14px 16px', minHeight: 44 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>내 루트</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>만든 {routeCounts.made} · 저장 {routeCounts.saved} · 완주 {routeCounts.completed}</span>
              </span>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </MenuSection>

          {/* 나의 활동 */}
          <MenuSection title="나의 활동">
            <MenuRow label="작성 글" onClick={() => goTab('posts')} />
            <MenuRow label="내 댓글" onClick={() => goTab('comments')} />
            <MenuRow label="연대기" onClick={() => goTab('chronicle')} last />
          </MenuSection>

          {/* 로그아웃 — 맨 아래 */}
          <button onClick={async () => { await signOut(); router.push('/') }} style={{ width: '100%', minHeight: 48, marginTop: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>로그아웃</button>
        </div>
      </div>
    )
  }

  // ───────────── 📱 상세 화면 (개요에서 진입) ─────────────
  const detailTitle = TAB_TITLE[tab] ?? '마이페이지'
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: 'var(--surface)' }}>
      {/* 상세 헤더 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
        <button onClick={() => goTab('overview')} aria-label="뒤로" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text)', minWidth: 44, minHeight: 44, alignItems: 'center', marginLeft: -10 }}>
          <AppIcon name="arrow-left" size={22} />
        </button>
        <div style={{ flex: 1, fontWeight: 900, fontSize: 17 }}>{detailTitle}</div>
        {tab === 'settings' && profile.role === 'admin' && (
          <Link href="/admin" style={{ fontSize: 12, color: 'var(--accent)', background: 'var(--accent-l)', border: '1px solid var(--accent)', borderRadius: 8, padding: '7px 10px', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
            <AppIcon name="gear" size={14} style={{ marginRight: 5 }} />관리자
          </Link>
        )}
        {tab === 'routes' && (
          <button onClick={() => router.push('/route/new')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 40, padding: '0 12px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> 만들기
          </button>
        )}
      </div>

      {/* 루트 허브 — 만든/저장/완주 세그먼트(개수 표시), 밑줄형 */}
      {tab === 'routes' && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 8px' }}>
          {([['made', '만든 루트', routeCounts.made], ['saved', '저장한 루트', routeCounts.saved], ['completed', '완주한 루트', routeCounts.completed]] as const).map(([k, lbl, n]) => (
            <button key={k} onClick={() => setRouteSub(k)} style={{ flex: 1, minHeight: 46, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: routeSub === k ? 800 : 600, fontSize: 13.5, color: routeSub === k ? 'var(--accent)' : 'var(--muted)', borderBottom: `2px solid ${routeSub === k ? 'var(--accent)' : 'transparent'}`, whiteSpace: 'nowrap' }}>{lbl} {n}</button>
          ))}
        </div>
      )}

      <div>
        {tab === 'passport' && (
          passport ? (
            <PassportCard passport={passport} isOwner hideRecentVisits onCustomizeClick={() => goTab('customize')} />
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
          )
        )}
        {tab === 'customize' && <CosmeticPage />}
        {tab === 'growth' && <GrowthPage />}
        {tab === 'visited' && <VisitedShopsTab userId={user.id} />}
        {tab === 'chronicle' && <ChroniclePage />}
        {tab === 'saved' && <SavedShopsTab userId={user.id} />}
        {tab === 'routes' && routeSub === 'made' && <MyRoutesTab userId={user.id} />}
        {tab === 'routes' && routeSub === 'saved' && <SavedRoutesTab userId={user.id} />}
        {tab === 'routes' && routeSub === 'completed' && <CompletedRoutesTab userId={user.id} />}
        {tab === 'posts' && <MyPostsTab userId={user.id} />}
        {tab === 'reviews' && <MyReviewsTab userId={user.id} />}
        {tab === 'comments' && <MyCommentsTab userId={user.id} />}
        {tab === 'shops' && <MyShopsTab userId={user.id} />}
        {tab === 'verify' && <VerifyStatusTab userId={user.id} />}
        {tab === 'badges' && <BadgesTab userId={user.id} />}
        {tab === 'collection' && <CollectionTab userId={user.id} />}
        {tab === 'settings' && <AccountSettingsTab />}
      </div>
    </div>
  )
}

// 개요 메뉴 섹션 (제목 + 카드)
function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', margin: '2px 4px 8px' }}>{title}</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>{children}</div>
    </div>
  )
}
// 개요 메뉴 행
function MenuRow({ label, value, onClick, last }: { label: string; value?: number; onClick: () => void; last?: boolean }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '0 16px', minHeight: 52, borderBottom: last ? 'none' : '1px solid var(--border)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {value != null && <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)' }}>{value}</span>}
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6" /></svg>
    </button>
  )
}

function useIsDesktop() {
  const [d, setD] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px)')
    const on = () => setD(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return d
}