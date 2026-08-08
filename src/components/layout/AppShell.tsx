'use client'
import { useState, useEffect, useRef } from 'react'
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

const NO_SHELL = ['/login', '/admin', '/dev', '/test']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/'
  const bare = NO_SHELL.some(p => pathname === p || pathname.startsWith(p + '/'))
  // 루트 만들기/수정: 작성 전용 화면 (/route/new, /route/[token]/edit)
  const isRouteBuilder = pathname === '/route/new' || (pathname.startsWith('/route/') && pathname.endsWith('/edit'))
  const hideBottomNav = pathname === '/community/write' || isRouteBuilder   // 글쓰기·루트작성: 하단 네비 숨김
  // 모바일 전역 상단바: 홈·지도·커뮤니티·작품에서만 노출, 그 외 화면은 모두 숨김
  const showHeaderMobile = pathname === '/' || pathname === '/map'
    || pathname === '/community' || pathname.startsWith('/community/')
    || pathname === '/my-works' || pathname.startsWith('/my-works/')
  const hideHeaderMobile = !showHeaderMobile
  const { user } = useAuth()
  const evalOnceRef = useRef(false)
  useEffect(() => {
    if (bare) return
    logVisit(pathname, user?.id ?? null).catch(() => {}).then(() => {
      if (!user || evalOnceRef.current) return
      evalOnceRef.current = true
      ;(async () => {
        const [{ evaluateBadgeTiersForUser }, { announceUnlock }] = await Promise.all([
          import('@/services/badgeService'),
          import('@/services/unlockService'),
        ])
        const newTiers = await evaluateBadgeTiersForUser(user.id)
        if (newTiers.length > 0) announceUnlock(newTiers)
      })()
    })
  }, [pathname, bare, user])

  const [trending, setTrending] = useState<ActiveWork[]>([])
  useEffect(() => {
    getActiveWorks(10).then(setTrending).catch(() => setTrending([]))
  }, [])

  if (bare) return <CosmeticProvider><UnlockModal /><LevelUpModal />{children}</CosmeticProvider>

  return (
    <CosmeticProvider>
    <UnlockModal />
    <LevelUpModal />
    <div className={styles.shell}>
      <header className={`${styles.header}${hideHeaderMobile ? ' ' + styles.headerHiddenMobile : ''}`}>
        <Link href="/" className={styles.logo}>
          <img src="/brand/takuroad-logo.png" alt="TAKUROAD" />
        </Link>
        <div className={styles.headerBar}><TopBar trendingWorks={trending} /></div>
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar}><Sidebar /></aside>
        <main className={styles.main}>{children}</main>
      </div>
      {!hideBottomNav && <BottomNav />}
    </div>
    </CosmeticProvider>
  )
}
