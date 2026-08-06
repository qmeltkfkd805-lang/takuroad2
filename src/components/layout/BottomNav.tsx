'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './BottomNav.module.css'

type Tab = { label: string; href: string | null; icon: React.ReactNode; menu?: boolean }

const MapIcon = (<svg viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>)
const RouteIcon = (<svg viewBox="0 0 24 24"><circle cx="6" cy="19" r="2.4"/><circle cx="18" cy="5" r="2.4"/><path d="M8.4 19H14a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h5.6"/></svg>)

const TABS: Tab[] = [
  { label: '홈', href: '/', icon: (<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>) },
  { label: '지도', href: null, menu: true, icon: MapIcon },
  { label: '커뮤니티', href: '/community', icon: (<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5M20.5 20a5.5 5.5 0 0 0-4-5.3"/></svg>) },
  { label: '작품', href: '/my-works', icon: (<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>) },
  { label: '마이', href: '/profile', icon: (<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>) },
]

export default function BottomNav() {
  const pathname = usePathname() ?? '/'
  const [mapMenu, setMapMenu] = useState(false)

  // 라우트 이동하면 시트 닫기
  useEffect(() => { setMapMenu(false) }, [pathname])

  const sheet = mapMenu && typeof document !== 'undefined' ? createPortal(
    <div className={styles.overlay} onClick={() => setMapMenu(false)}>
      <div className={styles.popover} onClick={e => e.stopPropagation()}>
        <Link href="/map" className={styles.popItem} onClick={() => setMapMenu(false)}>
          <span className={styles.popIcon}>{MapIcon}</span>
          덕질지도
        </Link>
        <div className={styles.popDivider} />
        <Link href="/routes" className={styles.popItem} onClick={() => setMapMenu(false)}>
          <span className={styles.popIcon}>{RouteIcon}</span>
          루트
        </Link>
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <>
    <nav className={styles.nav}>
      {TABS.map(tab => {
        // 지도 = 바로 이동 대신 덕질지도/루트 선택 시트
        if (tab.menu) {
          const active = pathname.startsWith('/map') || pathname.startsWith('/route')
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => setMapMenu(true)}
              className={active ? styles.item + ' ' + styles.active : styles.item}
            >
              <span className={styles.icon}>{tab.icon}</span>
              <span className={styles.label}>{tab.label}</span>
            </button>
          )
        }
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
    {sheet}
    </>
  )
}
