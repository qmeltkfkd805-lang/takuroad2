'use client'
/* 📱 모바일 '탐색' — 샵 / 이벤트 / 루트 / 작품 네 기능을 한 묶음으로.
   새 페이지를 만들지 않고 기존 화면(/shops, /events, /routes, /my-works 와 그 하위 목록)을 그대로 쓴다.
   · 각 메뉴의 "마지막으로 보던 주소"(검색어·필터가 담긴 ?쿼리 포함)를 이 탭(sessionStorage)에 기억해서
     메뉴를 오가도 보던 화면으로 돌아간다.
   · 하단바 '탐색'은 마지막으로 보던 탐색 화면으로, 처음이면 샵으로 간다. */

export type ExploreKey = 'shops' | 'events' | 'routes' | 'works'

export interface ExploreItem {
  key: ExploreKey
  label: string
  root: string
  icon: React.ReactNode
}

const svg = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
)

// 아이콘은 PC 사이드바와 같은 그림
export const EXPLORE: ExploreItem[] = [
  { key: 'shops', label: '샵', root: '/shops', icon: svg(<><path d="M4 9.5V20h16V9.5" /><path d="M3 9.5 5 4h14l2 5.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" /><path d="M9.5 20v-5.5h5V20" /></>) },
  { key: 'events', label: '이벤트', root: '/events', icon: svg(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>) },
  { key: 'routes', label: '루트', root: '/routes', icon: svg(<><circle cx="6" cy="19" r="2.4" /><circle cx="18" cy="5" r="2.4" /><path d="M8.4 19H14a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h5.6" /></>) },
  { key: 'works', label: '작품', root: '/my-works', icon: svg(<path d="M6 3h12v18l-6-4-6 4z" />) },
]

const under = (p: string, base: string) => p === base || p.startsWith(base + '/')

/** 탐색 목록 화면이면 그 메뉴 (상단 네 메뉴를 보여줄 화면) */
export function exploreListOf(pathname: string): ExploreKey | null {
  if (under(pathname, '/shops')) return 'shops'
  if (under(pathname, '/events')) return 'events'
  if (under(pathname, '/routes')) return 'routes'
  if (under(pathname, '/my-works')) return 'works'
  return null
}

/** 탐색에서 들어가는 상세 화면까지 포함 — 하단바 '탐색' 활성 표시용 */
export function exploreAreaOf(pathname: string): ExploreKey | null {
  const list = exploreListOf(pathname)
  if (list) return list
  if (pathname.startsWith('/shop/') || pathname.startsWith('/place/')) return 'shops'
  if (pathname.startsWith('/event/')) return 'events'
  if (pathname.startsWith('/route/')) return 'routes'
  if (pathname.startsWith('/work/')) return 'works'
  return null
}

const LAST = 'taku:explore:last'

/** 탐색 목록 화면을 볼 때마다 그 주소를 기억 */
export function rememberExploreUrl(key: ExploreKey, url: string) {
  try {
    sessionStorage.setItem(`${LAST}:${key}`, url)
    sessionStorage.setItem(LAST, url)
  } catch { /* 저장소를 못 쓰면 각 메뉴 첫 화면으로 */ }
}

/** 그 메뉴에서 마지막으로 보던 주소 (없으면 첫 화면). key 를 빼면 탐색 전체에서 마지막 주소 */
export function lastExploreUrl(key?: ExploreKey): string {
  const fallback = key ? EXPLORE.find(e => e.key === key)!.root : '/shops'
  try {
    const v = sessionStorage.getItem(key ? `${LAST}:${key}` : LAST)
    return v && v.startsWith('/') && !v.startsWith('//') ? v : fallback
  } catch { return fallback }
}
