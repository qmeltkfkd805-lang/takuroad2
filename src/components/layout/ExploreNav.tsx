'use client'
/* 📱 탐색 기억 — 샵 / 이벤트 / 루트 / 작품 목록 화면에서 "보던 주소와 위치"를 기억한다. (화면에 그리는 건 없음)
   AppShell 이 탐색 목록 화면(/shops·/events·/routes·/my-works 와 하위 목록)에서만 붙인다.
   · 지금 주소(검색어·필터 ?쿼리 포함)를 그 메뉴의 '마지막 주소'로 저장
     → 하단바 '탐색' 말풍선·홈 바로가기가 그 주소로 보내서 검색어·필터가 유지된다
   · 스크롤 위치를 주소별로 저장했다가, 다시 오면(메뉴 전환·상세에서 뒤로) 그 자리로 */
import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { ExploreKey, exploreListOf, rememberExploreUrl } from '@/lib/nav/explore'

const SCROLL = 'taku:scroll:'

export default function ExploreNav() {
  const pathname = usePathname() ?? '/'
  const current = exploreListOf(pathname)
  if (!current) return null
  // useSearchParams 는 Suspense 안에서만
  return <Suspense fallback={null}><ExploreMemory current={current} /></Suspense>
}

function ExploreMemory({ current }: { current: ExploreKey }) {
  const pathname = usePathname() ?? '/'
  const params = useSearchParams()
  const qs = params?.toString() ?? ''
  const url = qs ? `${pathname}?${qs}` : pathname

  useEffect(() => { rememberExploreUrl(current, url) }, [current, url])

  // 스크롤 위치 — 주소별로 저장하고, 다시 오면 내용이 그만큼 그려질 때까지 기다렸다가 복원
  useEffect(() => {
    const key = SCROLL + url
    let saved = 0
    try { saved = Number(sessionStorage.getItem(key)) || 0 } catch { /* noop */ }

    let cancelled = false
    const stop = () => { cancelled = true }
    // 사용자가 먼저 움직이면 복원을 멈춘다
    window.addEventListener('touchstart', stop, { passive: true, once: true })
    window.addEventListener('wheel', stop, { passive: true, once: true })
    let tries = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const restore = () => {
      if (cancelled || saved <= 0) return
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max >= saved - 4 || tries >= 40) { window.scrollTo(0, Math.min(saved, Math.max(0, max))); return }
      tries++
      timer = setTimeout(restore, 60)
    }
    timer = setTimeout(restore, 30)

    // 저장은 '지금 주소가 이 화면일 때만' — 다른 메뉴·상세로 넘어가는 순간 Next 가 맨 위로 올리는
    // 스크롤(0)이 이전 화면 자리를 덮어쓰지 않게
    const here = () => {
      const s = new URLSearchParams(window.location.search).toString()
      return s ? `${window.location.pathname}?${s}` : window.location.pathname
    }
    let saveTimer: ReturnType<typeof setTimeout> | 0 = 0
    const onScroll = () => {
      if (saveTimer) return
      saveTimer = setTimeout(() => {
        saveTimer = 0
        if (here() !== url) return
        try { sessionStorage.setItem(key, String(Math.round(window.scrollY))) } catch { /* noop */ }
      }, 120)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (saveTimer) clearTimeout(saveTimer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('wheel', stop)
    }
  }, [url])

  return null
}
