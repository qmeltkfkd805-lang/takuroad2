'use client'
/* 수정 화면에서 저장한 뒤 결과 페이지로 나가기.
   예전엔 router.push 로 샵 페이지를 새로 쌓아서, 거기서 뒤로가기를 누르면
   방금 저장한 수정 화면이 다시 나왔다.
   · 수정 화면 바로 전 페이지가 그 결과 페이지면(샵 상세 → 수정) → 뒤로 돌아가고 새 데이터로 다시 그린다
     → 기록: [이전 페이지, 샵] — 샵에서 뒤로가기 하면 '그 전에 있던 페이지'
   · 아니면(다른 곳에서 바로 수정으로 들어온 경우) → 수정 화면 기록을 결과 페이지로 바꿔치기(replace)
   '바로 전 페이지'는 AppShell 이 이 탭(sessionStorage)에 기록해 둔다(trackNav). */

const CUR = 'taku:nav:cur'
const PREV = 'taku:nav:prev'

/** AppShell 이 경로가 바뀔 때마다 부른다 */
export function trackNav(pathname: string) {
  try {
    const cur = sessionStorage.getItem(CUR)
    if (cur === pathname) return
    if (cur) sessionStorage.setItem(PREV, cur)
    sessionStorage.setItem(CUR, pathname)
  } catch { /* 저장소를 못 쓰면 replace 로만 동작 */ }
}

type Router = { back(): void; replace(href: string): void; refresh(): void }

export function leaveEditTo(router: Router, href: string) {
  let prev: string | null = null
  try { prev = sessionStorage.getItem(PREV) } catch { /* noop */ }
  if (prev === href && typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
    // 돌아간 페이지가 저장 전 화면으로 보이지 않게, 주소가 바뀌면 서버 데이터를 다시 받는다
    const t0 = Date.now()
    const tick = () => {
      if (window.location.pathname === href) router.refresh()
      else if (Date.now() - t0 < 3000) setTimeout(tick, 50)
      else router.replace(href)   // 뒤로가기가 안 먹었으면 그냥 이동
    }
    setTimeout(tick, 50)
    return
  }
  router.replace(href)
}
