'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyLevelInfo, LevelInfo } from '@/services/expService'
import styles from './Sidebar.module.css'

type NavItem = { label: string; href: string | null; icon: React.ReactNode }

const NAV: NavItem[] = [
  { label: '홈', href: '/', icon: (<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>) },
  { label: '지도', href: '/map', icon: (<svg viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>) },
  { label: '작품', href: '/my-works', icon: (<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>) },
  { label: '이벤트', href: null, icon: (<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>) },
  { label: '샵', href: null, icon: (<svg viewBox="0 0 24 24"><path d="M4 9l1-5h14l1 5"/><path d="M5 9v11h14V9"/></svg>) },
  { label: '루트', href: '/routes', icon: (<svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M7.6 16.4 16.4 7.6"/></svg>) },
  { label: '컬렉션', href: null, icon: (<svg viewBox="0 0 24 24"><path d="M12 4l2.3 5.3 5.7.5-4.3 3.8 1.3 5.6L12 16.9 7 19.2l1.3-5.6L4 9.6l5.7-.5z"/></svg>) },
  { label: '커뮤니티', href: '/community', icon: (<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5M20.5 20a5.5 5.5 0 0 0-4-5.3"/></svg>) },
  { label: '마이페이지', href: '/profile', icon: (<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>) },
]

export default function Sidebar() {
  const pathname = usePathname() ?? '/'
  const { user } = useAuth()
  const [info, setInfo] = useState<LevelInfo | null>(null)

  useEffect(() => {
    if (!user) { setInfo(null); return }
    getMyLevelInfo(user.id).then(setInfo)
  }, [user])

  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        {NAV.map(item => {
          if (!item.href) {
            return (
              <span key={item.label} className={styles.navItem + ' ' + styles.disabled}>
                <span className={styles.icon}>{item.icon}</span>{item.label}
              </span>
            )
          }
          const active = item.href === pathname
          return (
            <Link key={item.label} href={item.href} className={active ? styles.navItem + ' ' + styles.active : styles.navItem}>
              <span className={styles.icon}>{item.icon}</span>{item.label}
            </Link>
          )
        })}
      </nav>

      {user && info && <div className={styles.divider} />}
      {user && info && <LvCard info={info} />}
    </div>
  )
}
function LvCard({ info }: { info: LevelInfo }) {
  const floor = info.currentLevelExp
  const ceil = info.nextLevelThreshold
  const earned = info.totalExp - floor
  const span = ceil != null ? ceil - floor : 0
  const pct = span > 0 ? Math.min(100, Math.round((earned / span) * 100)) : 100
  return (
    <div className={styles.lv}>
      <span className={styles.lvIconBox}>
        <img src={info.icon} alt="" className={styles.lvIcon} />
      </span>
      <div className={styles.lvBody}>
        <div className={styles.lvTop}>
          <span className={styles.lvLevel}>Lv.{info.level}</span>
          <span className={styles.lvTitle}>{info.title}</span>
        </div>
        <div className={styles.bar}><div className={styles.barFill} style={{ width: pct + '%' }} /></div>
        <div className={styles.lvExp}>
          {ceil != null ? earned.toLocaleString() + ' / ' + span.toLocaleString() + ' EXP' : '최고 등급'}
        </div>
      </div>
    </div>
  )
}