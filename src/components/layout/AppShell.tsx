'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { usePathname } from 'next/navigation'
import styles from './AppShell.module.css'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import Footer from './Footer'
import Link from 'next/link'
import { getActiveWorks, ActiveWork } from '@/services/activeWorksService'
import { useAuth } from '@/components/layout/AuthProvider'
import { CosmeticProvider } from '@/components/cosmetic/CosmeticProvider'
import UnlockModal from '@/components/cosmetic/UnlockModal'
import LevelUpModal from '@/components/growth/LevelUpModal'
import { logVisit } from '@/services/trafficService'
import { captureFirstTouch } from '@/lib/utils/firstTouch'
import { trackNav } from '@/lib/nav/leaveEdit'
import { exploreListOf } from '@/lib/nav/explore'
import ExploreNav from './ExploreNav'
import dynamic from 'next/dynamic'

// 🔎 화면 진단 패널 — 주소에 ?diag=1 이 있을 때만 불러온다
const DiagOverlay = dynamic(() => import('@/components/debug/DiagOverlay'), { ssr: false })

const NO_SHELL = ['/login', '/admin', '/dev', '/test']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/'
  const bare = NO_SHELL.some(p => pathname === p || pathname.startsWith(p + '/'))
  // 루트 만들기/수정: 작성 전용 화면 (/route/new, /route/[token]/edit)
  const isRouteBuilder = pathname === '/route/new' || (pathname.startsWith('/route/') && pathname.endsWith('/edit'))
  // 굿즈 등록/편집 폼: 집중용 전용 화면(사이드바 없음). 굿즈 목록·컬렉션은 사이드바 유지(기본 셸).
  const isGoodsForm = pathname === '/profile/goods/new' || (pathname.startsWith('/profile/goods/') && pathname.endsWith('/edit'))
  // 계정 설정 전용 레이아웃: 전역 헤더·좌측 사이드바 없이 자체 헤더만.
  // /profile/activity(내 활동 기록), /profile/report/*(연간 리포트), 굿즈 등록/편집 폼이 이 레이아웃을 쓴다.
  const isBareProfile = pathname === '/profile/activity'
    || pathname.startsWith('/profile/report/')
    || isGoodsForm
  const isSettings = pathname === '/profile/settings' || pathname.startsWith('/profile/settings/') || isBareProfile
  // 글쓰기·루트작성·프로필 편집·내 활동 기록: 하단 네비 숨김
  const isProfileEdit = pathname === '/profile/settings/profile'
  const hideBottomNav = pathname === '/community/write' || isRouteBuilder || isProfileEdit || isBareProfile
  // 모바일 전역 상단바: 홈·지도에서만 노출, 그 외 화면은 모두 숨김
  // (커뮤니티는 자체 헤더+검색이 있어 전역 상단바 제외. 작품은 탐색 화면이라 위에 탐색 메뉴가 붙는다)
  const showHeaderMobile = pathname === '/' || pathname === '/map'
  // 📱 탐색 목록 화면(샵·이벤트·루트·작품) — 본문 위에 탐색 네 메뉴 (PC에선 CSS로 숨김)
  const exploreList = exploreListOf(pathname)
  const hideHeaderMobile = !showHeaderMobile
  const { user } = useAuth()
  const evalOnceRef = useRef(false)
  // 유입 경로는 랜딩 순간에 한 번만 — /login 같은 bare 화면에서도 잡아야 하므로 bare 체크 위에서 실행
  useEffect(() => { captureFirstTouch() }, [])
  // 바로 전 페이지 기록 — 수정 화면에서 저장 후 나갈 때(leaveEditTo) 뒤로가기 기록을 정리하는 데 쓴다
  useEffect(() => { trackNav(pathname) }, [pathname])
  useEffect(() => {
    if (bare) return
    logVisit(pathname, user?.id ?? null).catch(() => {}).then(() => {
      if (!user || evalOnceRef.current) return
      evalOnceRef.current = true
      ;(async () => {
        const [{ requestBadgeEvaluation }, { announceUnlock }] = await Promise.all([
          import('@/services/badgeService'),
          import('@/services/unlockService'),
        ])
        const newTiers = await requestBadgeEvaluation()
        if (newTiers.length > 0) announceUnlock(newTiers)
      })()
    })
  }, [pathname, bare, user])

  const [diag, setDiag] = useState(false)
  useEffect(() => { setDiag(new URLSearchParams(window.location.search).get('diag') === '1') }, [pathname])

  const [trending, setTrending] = useState<ActiveWork[]>([])
  useEffect(() => {
    getActiveWorks(10).then(setTrending).catch(() => setTrending([]))
  }, [])

  if (bare) return <CosmeticProvider><UnlockModal /><LevelUpModal />{children}</CosmeticProvider>

  // 설정 전용: 전역 헤더·사이드바 없이 children만. 모바일 하단 네비는 그대로 유지(데스크톱에선 CSS로 숨겨짐).
  if (isSettings) return (
    <CosmeticProvider>
      <UnlockModal />
      <LevelUpModal />
      {children}
      {!hideBottomNav && <BottomNav />}
    </CosmeticProvider>
  )

  return (
    <CosmeticProvider>
    <UnlockModal />
    <LevelUpModal />
    <div className={styles.shell}>
      {diag && <DiagOverlay />}
      <header data-diag="header" className={`${styles.header}${hideHeaderMobile ? ' ' + styles.headerHiddenMobile : ''}${pathname === '/map' ? ' ' + styles.headerMap : ''}`}>
        <Link href="/" className={styles.logo}>
          <img src="/brand/takuroad-logo.png" alt="TAKUROAD" />
        </Link>
        <div className={styles.headerBar}><TopBar trendingWorks={trending} /></div>
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar}><Sidebar /></aside>
        <main className={styles.main}>
          {exploreList && <Suspense fallback={null}><ExploreNav /></Suspense>}
          {children}
        </main>
      </div>
      {!hideBottomNav && <BottomNav />}
    </div>
    </CosmeticProvider>
  )
}
