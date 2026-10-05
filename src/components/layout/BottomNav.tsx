'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { EXPLORE, ExploreKey, exploreAreaOf, lastExploreUrl } from '@/lib/nav/explore'
import styles from './BottomNav.module.css'

/* 📱 하단바 — 홈 / 탐색 / 지도 / 커뮤니티 / 마이
   · 탐색 = 누르면 말풍선으로 샵·이벤트·루트·작품 (각각 마지막으로 보던 화면으로 → 검색어·필터 유지)
   · 지도 = 바로 지도 화면 (루트 목록은 탐색 > 루트. 지도에서 루트 따라가기(?routeId)는 지도 그대로)
   · 고른 칸만 핑크. 샵·이벤트·루트·작품 화면(상세 포함)에선 탐색이 켜진다 */

type TabKey = 'home' | 'explore' | 'map' | 'community' | 'my'
type Tab = { key: TabKey; label: string; href: string; icon: React.ReactNode }

const TABS: Tab[] = [
  { key: 'home', label: '홈', href: '/', icon: (<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>) },
  { key: 'explore', label: '탐색', href: '/shops', icon: (<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>) },
  { key: 'map', label: '지도', href: '/map', icon: (<svg viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>) },
  { key: 'community', label: '커뮤니티', href: '/community', icon: (<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5M20.5 20a5.5 5.5 0 0 0-4-5.3"/></svg>) },
  { key: 'my', label: '마이', href: '/profile', icon: (<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>) },
]

const under = (p: string, base: string) => p === base || p.startsWith(base + '/')

function activeTab(pathname: string): TabKey | null {
  if (pathname === '/') return 'home'
  if (under(pathname, '/map')) return 'map'
  if (exploreAreaOf(pathname)) return 'explore'
  if (under(pathname, '/community')) return 'community'
  if (under(pathname, '/profile')) return 'my'
  return null
}

export default function BottomNav() {
  const pathname = usePathname() ?? '/'
  const active = activeTab(pathname)
  const area = exploreAreaOf(pathname)
  const [open, setOpen] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  // 말풍선 메뉴 링크 = 각 메뉴에서 마지막으로 보던 주소 (서버 화면과 맞추려고 열 때 채운다)
  const [hrefs, setHrefs] = useState<Record<ExploreKey, string>>(
    () => Object.fromEntries(EXPLORE.map(e => [e.key, e.root])) as Record<ExploreKey, string>,
  )
  const toggle = () => {
    if (!open) setHrefs(Object.fromEntries(EXPLORE.map(e => [e.key, lastExploreUrl(e.key)])) as Record<ExploreKey, string>)
    setOpen(o => !o)
  }

  // 화면이 바뀌면 닫기
  useEffect(() => { setOpen(false) }, [pathname])
  // 바깥을 누르거나 Esc 면 닫기
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <nav className={styles.nav} aria-label="주요 메뉴">
      {TABS.map(tab => {
        const on = tab.key === 'explore' ? (open || active === 'explore') : (!open && active === tab.key)
        const cls = on ? styles.item + ' ' + styles.active : styles.item
        const inner = (
          <>
            <span className={styles.icon}>{tab.icon}</span>
            <span className={styles.label}>{tab.label}</span>
          </>
        )
        if (tab.key === 'explore') {
          return (
            <div key={tab.key} className={styles.exploreWrap}>
              <button
                ref={btnRef}
                type="button"
                className={cls}
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-current={active === 'explore' ? 'page' : undefined}
              >
                {inner}
              </button>
              {open && (
                <div ref={popRef} className={styles.pop} role="menu" aria-label="탐색">
                  {EXPLORE.map(e => (
                    <Link
                      key={e.key}
                      href={hrefs[e.key]}
                      role="menuitem"
                      className={area === e.key ? `${styles.popItem} ${styles.popOn}` : styles.popItem}
                      onClick={() => setOpen(false)}
                    >
                      <span className={styles.popIcon}>{e.icon}</span>
                      <span>{e.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        }
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cls}
            aria-current={active === tab.key ? 'page' : undefined}
          >
            {inner}
          </Link>
        )
      })}
    </nav>
  )
}
