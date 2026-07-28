'use client'

import { useState, useEffect } from 'react'

/**
 * PC(마우스 기기)면 데스크톱, 터치기기(폰)면 모바일 레이아웃.
 *
 * ⭐ 화면 '폭'이 아니라 '기기 종류' 기준이다.
 *    - PC: 창을 아무리 줄여도 데스크톱 유지 (예전처럼 좁아지면 모바일로 안 바뀜)
 *    - 폰: 항상 모바일 레이아웃 (모바일 화면에 맞게)
 *    AppShell/BottomNav의 CSS 미디어쿼리(hover/pointer)와 같은 기준이라 셸·콘텐츠가 일치한다.
 *
 * SSR/첫 렌더는 데스크톱으로 두고, 마운트 후 기기에 맞게 보정한다.
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isDesktop
}
