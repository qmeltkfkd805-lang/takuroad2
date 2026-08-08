'use client'
/* 『루트 방문하기』 클라이언트 훅.
   - 세션 시작/이어가기(서버가 체크포인트 동결), 포그라운드 위치 폴링 → ping,
     visibilitychange 로 화면 복귀 시 상태 새로고침, 일시중지/재개, 종료.
   - 자동 감지는 포그라운드에서만(백그라운드 추적 없음). 판정은 전부 서버가 수행.
   - GPS 권한 거부/오류는 완주를 막지 않음(자동확인만 안 됨). */
import { useState, useEffect, useRef, useCallback } from 'react'
import { calcDistance } from '@/hooks/useCurrentLocation'

const POLL_MS = 12000        // 위치 표본 주기(체류 판정용) — 서버 minDwell/minSamples와 맞물림
const VERIFIED = new Set(['proximity_verified', 'checkpoint_verified', 'qr_verified'])
const GEO_OPTS: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }

export interface RunCheckpoint {
  key: string
  kind: 'building' | 'shop'
  label?: string
  lat: number
  lng: number
  shopIds: string[]
}
export interface RunConfig { checkpointRadiusM: number; sessionTtlHours: number }
export type RunPhase = 'idle' | 'loading' | 'running' | 'paused' | 'ended' | 'error'
export interface RunLocation { lat: number; lng: number; accuracy: number }
export interface Arrival { id: string; key: string; label: string; distanceM: number }
export interface EndResult {
  mode: 'complete' | 'partial' | 'later'
  completed: boolean
  visitedCount: number
  fieldVerified: number
  totalCheckpoints: number
  manualCount: number
  confidence: 'high' | 'medium' | 'recorded'
  bonusGranted: boolean
}

interface Snapshot {
  session: { id: string; status: string } | null
  checkpoints: RunCheckpoint[]
  config: RunConfig | null
}

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

export function useRouteRun(routeId: string | null, opts: { autoStart: boolean; enabled: boolean }) {
  const { autoStart, enabled } = opts
  const [phase, setPhase] = useState<RunPhase>('idle')
  const [snap, setSnap] = useState<Snapshot>({ session: null, checkpoints: [], config: null })
  const [visitStatus, setVisitStatus] = useState<Map<string, string>>(new Map())
  const [location, setLocation] = useState<RunLocation | null>(null)
  const [geoDenied, setGeoDenied] = useState(false)
  const [arrivals, setArrivals] = useState<Arrival[]>([])

  const sessionRef = useRef<string | null>(null)
  const phaseRef = useRef<RunPhase>('idle')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedOnceRef = useRef(false)
  const checkpointsRef = useRef<RunCheckpoint[]>([])
  phaseRef.current = phase
  sessionRef.current = snap.session?.id ?? null
  checkpointsRef.current = snap.checkpoints

  const applyStart = useCallback((d: any) => {
    const vs = new Map<string, string>()
    ;(d.visits ?? []).forEach((v: any) => vs.set(v.checkpointKey, v.status))
    setVisitStatus(vs)
    setSnap({
      session: d.session ? { id: d.session.id, status: d.session.status } : null,
      checkpoints: d.checkpoints ?? [],
      config: d.config ?? null,
    })
  }, [])

  // 위치 표본 처리 → running이면 서버 ping까지
  const handlePosition = useCallback(async (pos: GeolocationPosition) => {
    const lat = pos.coords.latitude, lng = pos.coords.longitude
    const accuracy = pos.coords.accuracy ?? 9999
    setGeoDenied(false)
    setLocation({ lat, lng, accuracy })
    const sid = sessionRef.current
    if (!sid || phaseRef.current !== 'running') return
    const { ok, data } = await postJson('/api/route-session/ping', { sessionId: sid, lat, lng, accuracy })
    if (ok && Array.isArray(data.confirmed) && data.confirmed.length) {
      const cps = checkpointsRef.current
      setVisitStatus(vsPrev => {
        const m = new Map(vsPrev)
        for (const c of data.confirmed) {
          const cp = cps.find(x => x.key === c.key)
          m.set(c.key, cp?.kind === 'building' ? 'checkpoint_verified' : 'proximity_verified')
        }
        return m
      })
      setArrivals(prev => {
        const seen = new Set(prev.map(a => a.key))
        const add = data.confirmed
          .filter((c: any) => !seen.has(c.key))
          .map((c: any) => ({ id: `${c.key}:${pos.timestamp}`, key: c.key, label: c.label ?? '도착', distanceM: Math.round(c.distanceM ?? 0) }))
        return [...prev, ...add]
      })
    }
  }, [])

  const handleGeoError = useCallback((err: GeolocationPositionError) => {
    if (err && err.code === 1) setGeoDenied(true)   // 권한 거부만 안내(타임아웃 등은 무시)
  }, [])

  // 타이머(자동)에서의 위치 측정 — running일 때만
  const pingOnce = useCallback(() => {
    if (phaseRef.current !== 'running') return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(handlePosition, handleGeoError, GEO_OPTS)
  }, [handlePosition, handleGeoError])

  /** 사용자 탭에서 직접 호출 → iOS 사파리에서도 권한 팝업이 확실히 뜬다(타이머 호출은 조용히 무시됨). */
  const requestLocationNow = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(handlePosition, handleGeoError, GEO_OPTS)
  }, [handlePosition, handleGeoError])

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])
  const startPolling = useCallback(() => {
    stopPolling()
    pingOnce()
    pollRef.current = setInterval(pingOnce, POLL_MS)
  }, [pingOnce, stopPolling])

  // 활성 세션 새로고침(복귀 시 상태 재동기화)
  const refreshActive = useCallback(async () => {
    if (!routeId) return null
    const res = await fetch(`/api/route-session/active?routeId=${routeId}`, { credentials: 'same-origin' })
    const d = await res.json().catch(() => ({}))
    if (d.session) {
      applyStart({ session: d.session, checkpoints: d.checkpoints, visits: d.visits, config: snap.config })
      return d.session.status as string
    }
    return null
  }, [routeId, applyStart, snap.config])

  const start = useCallback(async () => {
    if (!routeId) return
    setPhase('loading')
    const { ok, data } = await postJson('/api/route-session/start', { routeId })
    if (!ok || !data.session) { setPhase('error'); return }
    applyStart(data)
    setPhase('running')
  }, [routeId, applyStart])

  const pause = useCallback(async () => {
    const sid = sessionRef.current
    setPhase('paused'); stopPolling()
    if (sid) await postJson('/api/route-session/pause', { sessionId: sid })
  }, [stopPolling])

  const resume = useCallback(async () => {
    const sid = sessionRef.current
    if (sid) await postJson('/api/route-session/resume', { sessionId: sid })
    setPhase('running')
  }, [])

  const undo = useCallback(async (key: string) => {
    const sid = sessionRef.current
    if (!sid) return
    setVisitStatus(prev => { const m = new Map(prev); m.set(key, 'pending'); return m })
    setArrivals(prev => prev.filter(a => a.key !== key))
    await postJson('/api/route-session/undo', { sessionId: sid, checkpointKey: key })
  }, [])

  const dismissArrival = useCallback((id: string) => {
    setArrivals(prev => prev.filter(a => a.id !== id))
  }, [])

  const end = useCallback(async (mode: 'complete' | 'partial' | 'later', manualShopIds: string[] = []): Promise<EndResult | null> => {
    const sid = sessionRef.current
    if (!sid) return null
    stopPolling()
    const { ok, data } = await postJson('/api/route-session/end', { sessionId: sid, mode, manualShopIds })
    if (!ok) { return null }
    if (mode !== 'later') setPhase('ended')
    else setPhase('paused')
    return data as EndResult
  }, [stopPolling])

  // 최초 진입: autoStart면 시작, 아니면 활성 세션만 확인해 이어가기 표시
  useEffect(() => {
    if (!enabled || !routeId || startedOnceRef.current) return
    startedOnceRef.current = true
    ;(async () => {
      const status = await refreshActive()
      if (status === 'active') setPhase('running')
      else if (status === 'paused') setPhase('paused')
      else if (autoStart) await start()
      else setPhase('idle')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, routeId])

  // 폴링 라이프사이클: running + 화면 보임일 때만
  useEffect(() => {
    if (phase === 'running' && (typeof document === 'undefined' || document.visibilityState === 'visible')) startPolling()
    else stopPolling()
    return stopPolling
  }, [phase, startPolling, stopPolling])

  // 화면 복귀 시 상태 새로고침 + 폴링 재개
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        if (phaseRef.current === 'running') { refreshActive(); startPolling() }
      } else stopPolling()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refreshActive, startPolling, stopPolling])

  // 파생값
  const totalCheckpoints = snap.checkpoints.length
  const verifiedCount = snap.checkpoints.filter(c => VERIFIED.has(visitStatus.get(c.key) ?? 'pending')).length

  // 다음 추천 체크포인트(순서상 첫 미확인) + 현재 위치까지 거리
  const nextCheckpoint = snap.checkpoints.find(c => !VERIFIED.has(visitStatus.get(c.key) ?? 'pending')) ?? null
  const nextDistanceM = nextCheckpoint && location
    ? Math.round(calcDistance(location.lat, location.lng, nextCheckpoint.lat, nextCheckpoint.lng))
    : null

  // 확인된 샵 집합(샵 체크포인트 확인 + 수동기록). 건물 도착만으론 내부 샵 확인 아님.
  const confirmedShopIds = new Set<string>()
  for (const c of snap.checkpoints) {
    const st = visitStatus.get(c.key) ?? 'pending'
    if (c.kind === 'shop' && VERIFIED.has(st)) c.shopIds.forEach(id => confirmedShopIds.add(id))
  }
  visitStatus.forEach((st, key) => {
    if (st === 'manual_recorded' && key.startsWith('shop:')) confirmedShopIds.add(key.slice(5))
  })

  return {
    phase,
    session: snap.session,
    checkpoints: snap.checkpoints,
    config: snap.config,
    visitStatus,
    location,
    hasFix: !!location,
    geoDenied,
    arrivals,
    requestLocationNow,
    totalCheckpoints,
    verifiedCount,
    nextCheckpoint,
    nextDistanceM,
    confirmedShopIds,
    start, pause, resume, undo, end, dismissArrival, refreshActive,
  }
}
