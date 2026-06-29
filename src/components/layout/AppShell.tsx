'use client'

import { usePathname } from 'next/navigation'
import styles from './AppShell.module.css'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import Link from 'next/link'

const NO_SHELL = ['/login', '/admin', '/dev', '/test']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/'
  const bare = NO_SHELL.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (bare) return <>{children}</>

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          <img src="/brand/takuroad-logo.png" alt="TAKUROAD" />
          <span className={styles.logoText}>TAKUROAD</span>
        </Link>
        <div className={styles.headerBar}><TopBar /></div>
      </header>

      <div className={styles.body}>
        <aside className={styles.sidebar}><Sidebar /></aside>
        <main className={styles.main}>{children}</main>
      </div>

      <BottomNav />
    </div>
  )
}
