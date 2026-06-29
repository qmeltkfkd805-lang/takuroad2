'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './BottomNav.module.css'

type Tab = { label: string; href: string | null; icon: React.ReactNode }

const TABS: Tab[] = [
  { label: '홈', href: '/', icon: (<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>) },
  { label: '지도', href: '/map', icon: (<svg viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>) },
  { label: '커뮤니티', href: null, icon: (<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5M20.5 20a5.5 5.5 0 0 0-4-5.3"/></svg>) },
  { label: '작품', href: '/my-works', icon: (<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>) },
  { label: '마이', href: '/profile', icon: (<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>) },
]

export default function BottomNav() {
  const pathname = usePathname() ?? '/'
  return (
    <nav className={styles.nav}>
      {TABS.map(tab => {
        if (!tab.href) {
          return (
            <span key={tab.label} className={styles.item + ' ' + styles.disabled}>
              <span className={styles.icon}>{tab.icon}</span>
              <span className={styles.label}>{tab.label}</span>
            </span>
          )
        }
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
        return (
          <Link key={tab.label} href={tab.href} className={active ? styles.item + ' ' + styles.active : styles.item}>
            <span className={styles.icon}>{tab.icon}</span>
            <span className={styles.label}>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
