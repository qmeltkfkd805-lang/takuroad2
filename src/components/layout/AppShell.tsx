'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './AppShell.module.css'

// 셸을 적용하지 않을 경로(전체화면 페이지). 이 접두사면 셸 없이 페이지만 렌더.
const NO_SHELL = ['/login', '/admin', '/dev', '/test']

// 사이드바 네비 — 라우트 있는 것만 링크, 없는 건 Step 1에서 확정(지금은 비활성 자리표시)
const NAV: { label: string; href: string | null }[] = [
  { label: '홈', href: '/' },
  { label: '지도', href: '/map' },
  { label: '작품', href: '/my-works' },
  { label: '이벤트', href: null },
  { label: '샵', href: null },
  { label: '루트', href: '/routes' },
  { label: '컬렉션', href: null },
  { label: '커뮤니티', href: null },
  { label: '마이페이지', href: '/profile' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/'
  const bare = NO_SHELL.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (bare) return <>{children}</>

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>TAKUROAD</div>
        <nav className={styles.nav}>
          {NAV.map(item => {
            if (!item.href) {
              return <span key={item.label} className={styles.navItem + ' ' + styles.navDisabled}>{item.label}</span>
            }
            const active = item.href === pathname
            return (
              <Link key={item.label} href={item.href} className={styles.navItem + (active ? ' ' + styles.navActive : '')}>
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className={styles.stub}>Sidebar · Step 1</div>
      </aside>

      <div className={styles.right}>
        <header className={styles.topbar}>
          <span className={styles.topbarStub}>TopBar · Step 2</span>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  )
}
