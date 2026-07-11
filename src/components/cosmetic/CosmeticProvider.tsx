'use client'

import { createContext, useContext, useCallback, useEffect, useRef, useState, ReactNode } from 'react'
import { getWornBatch, WornSet } from '@/services/cosmeticService'

/* 코스메틱 배치 로더

   ⭐ 문제: 커뮤니티 글 20개 = 작성자 20명. 컴포넌트마다 따로 물어보면 쿼리 20번.
   ⭐ 해결: 요청을 모았다가(같은 tick) 한 번에 물어보고, 캐시에 넣는다.
      화면 어디서든 useWorn(userId)만 부르면 된다. 쓰는 쪽은 배치를 몰라도 된다. */

interface Ctx {
  get: (userId: string) => WornSet | undefined
  request: (userId: string) => void
}

const CosmeticCtx = createContext<Ctx | null>(null)

export function CosmeticProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Map<string, WornSet>>(new Map())
  const pending = useRef<Set<string>>(new Set())
  const asked = useRef<Set<string>>(new Set())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(async () => {
    const ids = [...pending.current]
    pending.current.clear()
    if (ids.length === 0) return
    try {
      const res = await getWornBatch(ids)
      setCache(prev => {
        const next = new Map(prev)
        for (const id of ids) next.set(id, res.get(id) ?? {})
        return next
      })
    } catch {
      setCache(prev => {
        const next = new Map(prev)
        for (const id of ids) next.set(id, {})
        return next
      })
    }
  }, [])

  const request = useCallback((userId: string) => {
    if (!userId || asked.current.has(userId)) return
    asked.current.add(userId)
    pending.current.add(userId)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 30)
  }, [flush])

  const get = useCallback((userId: string) => cache.get(userId), [cache])

  return (
    <CosmeticCtx.Provider value={{ get, request }}>
      {children}
    </CosmeticCtx.Provider>
  )
}

/** 이 사람이 지금 걸치고 있는 것. Provider 밖이면 조용히 빈 값. */
export function useWorn(userId?: string | null): WornSet {
  const ctx = useContext(CosmeticCtx)
  useEffect(() => {
    if (ctx && userId) ctx.request(userId)
  }, [ctx, userId])
  if (!ctx || !userId) return {}
  return ctx.get(userId) ?? {}
}
