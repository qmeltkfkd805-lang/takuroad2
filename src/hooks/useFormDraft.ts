'use client'
/* 작성 중 자동 임시저장 — 다른 화면에 다녀오거나 새로고침해도 쓰던 내용이 그대로 남게.
   - 이 브라우저(localStorage)에 저장. 입력이 멈추고 0.4초 뒤, 그리고 페이지를 떠나거나 숨길 때 바로 저장
   - 다시 들어오면 자동으로 채워 넣고 restored=true (화면에서 "불러왔어요 · 새로 쓰기" 안내)
   - 등록이 끝나면 clear() → 저장본 삭제 + 이후 자동 저장 멈춤
   - discard() → "새로 쓰기": 저장본만 지우고 자동 저장은 계속
   key 가 null 이면(로그인 확인 전·수정 모드 등) 아무것도 하지 않는다. */
import { useCallback, useEffect, useRef, useState } from 'react'

export function useFormDraft<T>(key: string | null, data: T, apply: (d: T) => void, isEmpty: (d: T) => boolean) {
  const [restored, setRestored] = useState(false)
  const loadedKey = useRef<string | null>(null)
  const blocked = useRef(false)
  const latest = useRef(data)
  latest.current = data
  const emptyRef = useRef(isEmpty)
  emptyRef.current = isEmpty
  const applyRef = useRef(apply)
  applyRef.current = apply

  const write = useCallback(() => {
    if (!key || blocked.current || loadedKey.current !== key) return
    try {
      if (emptyRef.current(latest.current)) localStorage.removeItem(key)
      else localStorage.setItem(key, JSON.stringify({ data: latest.current, savedAt: Date.now() }))
    } catch { /* 저장 공간이 없거나 막힌 브라우저 — 무시 */ }
  }, [key])

  // 들어올 때 한 번: 저장본이 있으면 채워 넣기
  useEffect(() => {
    if (!key || loadedKey.current === key) return
    try {
      const raw = localStorage.getItem(key)
      const d = raw ? JSON.parse(raw) : null
      if (d && d.data !== undefined) { applyRef.current(d.data as T); setRestored(true) }
    } catch { /* 깨진 저장본은 무시 */ }
    loadedKey.current = key
  }, [key])

  // 입력이 바뀌면 잠깐 뒤 저장
  useEffect(() => {
    if (!key || loadedKey.current !== key) return
    const t = setTimeout(write, 400)
    return () => clearTimeout(t)
  }, [key, data, write])

  // 페이지를 떠나거나(새로고침 포함) 숨길 때, 다른 화면으로 이동할 때(언마운트) 바로 저장
  useEffect(() => {
    if (!key) return
    const onHide = () => { if (document.visibilityState === 'hidden') write() }
    window.addEventListener('pagehide', write)
    document.addEventListener('visibilitychange', onHide)
    return () => { window.removeEventListener('pagehide', write); document.removeEventListener('visibilitychange', onHide); write() }
  }, [key, write])

  const clear = useCallback(() => {
    blocked.current = true
    try { if (key) localStorage.removeItem(key) } catch { /* noop */ }
    setRestored(false)
  }, [key])
  const discard = useCallback(() => {
    try { if (key) localStorage.removeItem(key) } catch { /* noop */ }
    setRestored(false)
  }, [key])

  return { restored, clear, discard, dismiss: () => setRestored(false) }
}
