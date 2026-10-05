'use client'
import { useCallback, useEffect, useState } from 'react'

/* useState 와 같지만 값을 이 탭(sessionStorage)에 기억한다.
   📱 탐색에서 샵 ↔ 이벤트 ↔ 루트 ↔ 작품을 오가거나 상세에 다녀와도
   검색어·필터가 처음으로 돌아가지 않게. 탭(창)을 닫으면 지워진다.
   · 서버 화면과 맞추려고 처음엔 기본값으로 그리고, 마운트 뒤에 기억한 값을 넣는다.
   · 저장은 값을 바꿀 때만 한다 (마운트 때 기본값으로 덮어쓰지 않게). */
export function useSessionState<T>(key: string, initial: T) {
  const [value, setValueState] = useState<T>(initial)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (raw != null) setValueState(JSON.parse(raw) as T)
    } catch { /* 저장소를 못 쓰면 기본값 그대로 */ }
  }, [key])

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    setValueState(prev => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      try { sessionStorage.setItem(key, JSON.stringify(v)) } catch { /* noop */ }
      return v
    })
  }, [key])

  return [value, setValue] as const
}
