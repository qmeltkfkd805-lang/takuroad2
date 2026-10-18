'use client'
import { usePathname } from 'next/navigation'

/* 지금 주소 (2026-10-18)
   ⚠️ 홈(/)은 60초마다 서버에서 다시 만드는데(ISR), 그때 usePathname() 이 '/' 대신 '/index' 를 돌려준다.
      그래서 운영에서 홈을 바로 열면 폰 상단바(로고·검색창)가 숨겨지고 아래 메뉴의 '홈'도 꺼져 있었다
      (빌드 때 만든 첫 화면은 정상, 다시 만든 뒤부터 틀어짐. 브라우저는 서버가 그린 class 를 고치지 않는다).
   → 주소로 화면을 나누는 곳(상단바·아래 메뉴·사이드바·탐색 메뉴)은 이 함수를 쓴다. */
export function normalizePath(p: string | null | undefined): string {
  if (!p || p === '/index') return '/'
  return p
}

export function useAppPathname(): string {
  return normalizePath(usePathname())
}
