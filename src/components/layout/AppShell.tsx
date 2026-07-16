'use client'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import styles from './AppShell.module.css'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import Link from 'next/link'
import { getActiveWorks, ActiveWork } from '@/services/activeWorksService'
import { useAuth } from '@/components/layout/AuthProvider'
import { CosmeticProvider } from '@/components/cosmetic/CosmeticProvider'
import UnlockModal from '@/components/cosmetic/UnlockModal'
import { logVisit } from '@/services/trafficService'

const NO_SHELL = ['/login', '/admin', '/dev', '/test']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/'
  const bare = NO_SHELL.some(p => pathname === p || pathname.startsWith(p + '/'))
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

  if (bare) return <CosmeticProvider><UnlockModal />{children}</CosmeticProvider>

  return (
    <CosmeticProvider>
    <UnlockModal />
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          <img src="/brand/takuroad-logo.png" alt="TAKUROAD" />
        </Link>
        <div className={styles.headerBar}><TopBar trendingWorks={trending} /></div>
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar}><Sidebar /></aside>
        <main className={styles.main}>{children}</main>
      </div>
      <BottomNav />
    </div>
    </CosmeticProvider>
  )
}
