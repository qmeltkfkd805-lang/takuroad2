'use client'

import { usePathname } from 'next/navigation'
import styles from './AppShell.module.css'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'

const NO_SHELL = ['/login', '/admin', '/dev', '/test']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/'
  const bare = NO_SHELL.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (bare) return <>{children}</>

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}><Sidebar /></aside>
      <div className={styles.right}>
        <header className={styles.topbar}><TopBar /></header>
        <main className={styles.main}>{children}</main>
      </div>
      <BottomNav />
    </div>
  )
}
