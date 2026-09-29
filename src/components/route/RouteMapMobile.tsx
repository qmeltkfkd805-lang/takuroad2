'use client'
/* 모바일 전용 루트 지도 — 전체화면(지도 중심) + 컴팩트 앱바 + 드래그 하단 시트.
   데스크톱(RouteMapMode)과는 별개 컴포넌트이며 지도 데이터·세션 로직만 공유한다.
   전역 상단바/하단탭 위를 덮는 고정 레이어라, 기존 PC 레이아웃엔 영향 없음. */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getRouteByShareToken, toggleRouteSave, getMySavedRouteIds } from '@/services/routeService'
import { useCurrentLocation, formatDistance, calcDistance } from '@/hooks/useCurrentLocation'
import { shopRegion } from '@/lib/utils/region'
import { useRouteRun, type EndResult } from '@/lib/routeRun/useRouteRun'
import RouteMap, { type RouteMapRef } from './RouteMap'
import RouteSheet, { type SheetStop } from './run/RouteSheet'
import ArrivalToast from './run/ArrivalToast'
import RouteEndSheet, { type EndShop } from './run/RouteEndSheet'
import RouteRunComplete from './run/RouteRunComplete'
import { getVisitedShopIds, setShopVisited, recordRouteCompletion } from '@/services/routeVisitService'
import { createCheckIn } from '@/services/checkInService'
import styles from './RouteMapMobile.module.css'

function fmtDur(min: number | null | undefined): string | null {
  if (min == null) return null
  const h = Math.floor(min / 60), m = min % 60
  return h && m ? `약 ${h}시간 ${m}분` : h ? `약 ${h}시간` : `약 ${m}분`
}

export default function RouteMapMobile({ routeId }: { routeId: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuth()

  const [route, setRoute] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [path, setPath] = useState<{ status: string; geometry: [number, number][]; distance_m: number | null; duration_min: number | null } | null>(null)
  const [pathReload] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(params?.get('spotId') ?? null)
  const [sheetH, setSheetH] = useState(196)
  const [showEndSheet, setShowEndSheet] = useState(false)
  const [ending, setEnding] = useState(false)
  const [endResult, setEndResult] = useState<EndResult | null>(null)
  const [skippedShops, setSkippedShops] = useState<Set<string>>(new Set())
  // 루트 보기(따라가기 전) 방문 체크 = route_progress — 루트 상세 체크와 같은 값
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set())
  const [busyVisitId, setBusyVisitId] = useState<string | null>(null)

  const mapRef = useRef<RouteMapRef>(null)
  const fitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wantCenter = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const run = useRouteRun(route?.id ?? null, { autoStart: false, enabled: !!route?.id })
  const { location: idleLoc, requestLocation } = useCurrentLocation()
  const myLoc = run.location ?? idleLoc

  // 배경 스크롤 잠금(전체화면 지도)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    setLoading(true); setDenied(false)
    getRouteByShareToken(routeId)
      .then(r => {
        if (!r) { setDenied(true); setRoute(null); return }
        if (!r.is_shared && (!user || user.id !== r.user_id)) { setDenied(true); setRoute(null); return }
        setRoute(r)
      })
      .catch(() => setDenied(true))
      .finally(() => setLoading(false))
  }, [routeId, user])

  useEffect(() => {
    if (!user || !route) { setSaved(false); return }
    getMySavedRouteIds(user.id).then(ids => setSaved(ids.includes(route.id))).catch(() => {})
  }, [user, route])

  useEffect(() => {
    if (!user || !route?.id) { setVisitedIds(new Set()); return }
    getVisitedShopIds(route.id, user.id).then(ids => setVisitedIds(new Set(ids))).catch(() => {})
  }, [user, route?.id])

  useEffect(() => {
    if (!route?.id) { setPath(null); return }
    let cancelled = false
    setPath(null)
    fetch(`/api/route-path?routeId=${route.id}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setPath(d) })
      .catch(() => { if (!cancelled) setPath({ status: 'failed', geometry: [], distance_m: null, duration_min: null }) })
    return () => { cancelled = true }
  }, [route?.id, pathReload])

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t) }, [toast])
  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  const rawStops = useMemo(() => (route?.route_shops ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order), [route])
  const shopsWithCoords = useMemo(() => rawStops.map((rs: any) => rs.shops).filter((s: any) => s && s.lat && s.lng).map((s: any) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })), [rawStops])
  const region = useMemo(() => { for (const rs of rawStops) { const r = rs.shops ? shopRegion(rs.shops) : null; if (r && r !== '지역 미정') return r } return null }, [rawStops])

  const sheetStops: SheetStop[] = useMemo(() => rawStops.map((rs: any, i: number, arr: any[]) => {
    const s = rs.shops
    if (!s) return null
    const floor = s.floor_info || [s.floor, s.unit].filter(Boolean).join(' ') || null
    const next = arr[i + 1]
    return {
      id: s.id, slug: s.slug, order: i + 1, name: s.name, floor,
      cats: Array.isArray(s.cats) ? s.cats : [],
      thumb: s.shop_images?.[0]?.image_url ?? null,
      walkMin: rs.duration_from_prev_min ?? null, walkM: rs.distance_from_prev_m ?? null,
      toNextMin: next?.duration_from_prev_min ?? null, toNextM: next?.distance_from_prev_m ?? null,
      moveTip: rs.move_tip ?? null,
      // 따라가기 중엔 세션 확인(현장·직접), 그 밖엔 루트 방문 체크
      // 따라가는 중이거나 이어갈 세션이 남아 있으면 세션의 체크 기록을 보여준다(새로고침해도 17/18 유지)
      visited: (run.phase === 'running' || run.phase === 'paused' || run.hasExistingSession) ? run.confirmedShopIds.has(s.id) : visitedIds.has(s.id),
    } as SheetStop
  }).filter(Boolean) as SheetStop[], [rawStops, run.confirmedShopIds, run.phase, run.hasExistingSession, visitedIds])

  const endShops: EndShop[] = useMemo(() => sheetStops.map(s => ({ id: s.id, name: s.name, floor: s.floor })), [sheetStops])

  const coordIndexOf = (id: string | null) => (id ? shopsWithCoords.findIndex((s: any) => s.id === id) : -1)
  const selIdx = coordIndexOf(selectedId)

  const running = run.phase === 'running' || run.phase === 'paused'
  const runningRef = useRef(false)
  runningRef.current = running
  const visitedCount = sheetStops.filter(s => s.visited).length

  // 샵 좌표 맵(안내 커서 거리 계산용)
  const shopCoord = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>()
    for (const rs of rawStops) { const s = rs.shops; if (s && s.lat && s.lng) m.set(s.id, { lat: s.lat, lng: s.lng }) }
    return m
  }, [rawStops])

  // 다음 안내 = 전체 샵 순서에서 아직 안 지나갔고(도착/확인) 건너뛰지 않은 첫 샵
  const nextShop = sheetStops.find(s => !run.arrivedShopIds.has(s.id) && !s.visited && !skippedShops.has(s.id)) ?? null
  const nextLabel = nextShop ? `${nextShop.order}. ${nextShop.name}${nextShop.floor ? ` (${nextShop.floor})` : ''}` : null
  const nextCoord = nextShop ? shopCoord.get(nextShop.id) ?? null : null
  const nextDistanceM = myLoc && nextCoord ? Math.round(calcDistance(myLoc.lat, myLoc.lng, nextCoord.lat, nextCoord.lng)) : null

  /* 따라가는 중엔 전체 경로 대신 "이전 장소 → 다음 장소" 한 구간만 그린다 (12번을 방문했으면 12→13만).
     실제 도보 경로(ORS)가 있으면 그 중 두 장소 사이 부분만 잘라 쓰고, 없으면 두 점을 잇는다.
     첫 장소로 가는 중(이전 장소 없음)엔 선 없이 핀만. */
  const prevStop = useMemo(() => {
    if (!running || !nextShop) return null
    const idx = sheetStops.findIndex(s => s.id === nextShop.id)
    return idx > 0 ? sheetStops[idx - 1] : null
  }, [running, nextShop, sheetStops])
  const segmentLine = useMemo((): [number, number][] | null => {
    if (!running || !nextShop || !prevStop) return null
    const a = shopCoord.get(prevStop.id), b = shopCoord.get(nextShop.id)
    if (!a || !b) return null
    const geo = path && (path.status === 'ok' || path.status === 'partial') && path.geometry.length > 1 ? path.geometry : null
    if (geo) {
      const nearest = (p: { lat: number; lng: number }, from: number) => {
        let bi = from, bd = Infinity
        for (let i = from; i < geo.length; i++) { const d = (geo[i][0] - p.lng) ** 2 + (geo[i][1] - p.lat) ** 2; if (d < bd) { bd = d; bi = i } }
        return bi
      }
      const i0 = nearest(a, 0), i1 = nearest(b, i0)
      if (i1 > i0) return geo.slice(i0, i1 + 1)
    }
    return [[a.lng, a.lat], [b.lng, b.lat]]
  }, [running, nextShop, prevStop, shopCoord, path])

  // "다음" 장소가 바뀌면 그 구간(이전→다음)이 보이게 지도 확대 — "방문 완료" 표시(1.4초)가 끝난 뒤 넘어가게
  const prevNextRef = useRef<string | null>(null)
  useEffect(() => {
    const id = running ? nextShop?.id ?? null : null
    if (!id) { prevNextRef.current = null; return }
    if (prevNextRef.current === id) return
    const first = prevNextRef.current === null
    prevNextRef.current = id
    const c = shopCoord.get(id)
    if (!c) return
    const p = prevStop ? shopCoord.get(prevStop.id) : null
    const t = setTimeout(() => mapRef.current?.fitPoints(p ? [p, c] : [c], sheetH + 24), first ? 400 : 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, nextShop?.id, shopCoord])

  // 시트 높이 → 지도 아래 여백(bounds)로 반영 (드래그가 멈춘 뒤 재맞춤)
  const onHeight = useCallback((px: number) => {
    setSheetH(px)
    if (fitTimer.current) clearTimeout(fitTimer.current)
    // 따라가는 중엔 전체 루트로 다시 맞추지 않는다(지금 구간을 보고 있으므로)
    fitTimer.current = setTimeout(() => { if (coordIndexOf(selectedId) < 0 && !runningRef.current) mapRef.current?.fit(px + 24) }, 220)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // 현재 위치 버튼 → 위치 받으면 그쪽으로 이동
  useEffect(() => {
    if (wantCenter.current && myLoc) { mapRef.current?.panTo(myLoc.lat, myLoc.lng, 4); wantCenter.current = false }
  }, [myLoc?.lat, myLoc?.lng])

  const onLocBtn = () => {
    wantCenter.current = true
    if (running) run.requestLocationNow(); else requestLocation()
  }

  const selectSpot = useCallback((id: string | null) => {
    setSelectedId(id)
    const p = new URLSearchParams(params?.toString() ?? '')
    if (id) p.set('spotId', id); else p.delete('spotId')
    router.replace(`/map?${p.toString()}`, { scroll: false })
  }, [params, router])

  const resuming = run.hasExistingSession && !running
  function onStart() {
    run.requestLocationNow()   // 사용자 탭(제스처)에서 위치 권한 요청 → iOS 팝업 확실히
    if (resuming) run.resume(); else { setSkippedShops(new Set()); run.start() }
    setSelectedId(null)
  }
  const skipNext = () => { if (nextShop) setSkippedShops(prev => { const n = new Set(prev); n.add(nextShop.id); return n }) }
  async function handleRunEnd(mode: 'complete' | 'partial' | 'later', manualIds: string[]) {
    if (ending) return
    setEnding(true)
    const r = await run.end(mode, manualIds)
    setEnding(false)
    setShowEndSheet(false)
    if (!r) { setToast('종료 처리에 실패했어요. 잠시 후 다시 시도해 주세요.'); return }
    if (mode === 'later') { setToast('오늘까지 기록을 저장했어요.'); router.push(`/route/${routeId}`); return }
    setEndResult(r)
  }
  function closeRunComplete() { setEndResult(null); router.push(`/route/${routeId}`) }

  /* 스팟 방문 체크 (목록·선택 카드·"여기 방문했어요")
     - 따라가기 중: 세션에 '직접 기록' (종료할 때 진행·완주 반영). 직접 기록한 것만 다시 눌러 풀 수 있다
     - 그 밖: 루트 방문 체크. 전부 체크하면 완주 기록 + 축하 창(후기 남기기)
     - 체크하면 샵 방문 기록도 함께(하루 1번씩 +1). 체크를 풀어도 방문 기록은 남는다 */
  async function toggleVisit(shopId: string): Promise<boolean> {
    if (!user) { router.push('/login'); return false }
    if (!route || busyVisitId) return false
    const stop = sheetStops.find(s => s.id === shopId)
    const coord = shopCoord.get(shopId)
    const recordShopVisit = () => createCheckIn(user.id, shopId, coord?.lat ?? 0, coord?.lng ?? 0, stop?.name ?? '').catch(() => {})
    try { navigator.vibrate?.(12) } catch { /* noop */ }
    setBusyVisitId(shopId)
    try {
      if (running || run.hasExistingSession) {
        const key = `shop:${shopId}`
        if (run.confirmedShopIds.has(shopId)) {
          if (run.visitStatus.get(key) === 'manual_recorded') { await run.undo(key); setToast(`${stop?.order ?? ''}번 체크를 풀었어요`) }
          else setToast('현장에서 확인된 곳이에요')
          return false
        }
        if (await run.manual(shopId)) {
          recordShopVisit()
          setToast(`✓ ${stop?.order ?? ''}번 방문 (${visitedCount + 1}/${sheetStops.length})`)
          return true
        }
        setToast('기록하지 못했어요. 잠시 후 다시 시도해 주세요.')
        return false
      }
      const has = visitedIds.has(shopId)
      setVisitedIds(prev => { const n = new Set(prev); has ? n.delete(shopId) : n.add(shopId); return n })
      const ok = await setShopVisited(route.id, shopId, user.id, !has)
      if (!ok) {
        setVisitedIds(prev => { const n = new Set(prev); has ? n.add(shopId) : n.delete(shopId); return n })
        setToast('체크하지 못했어요. 잠시 후 다시 시도해 주세요.')
        return false
      }
      if (has) { setToast(`${stop?.order ?? ''}번 체크를 풀었어요`); return false }
      recordShopVisit()
      const next = new Set(visitedIds); next.add(shopId)
      const done = sheetStops.length > 0 && sheetStops.every(s => next.has(s.id))
      if (!done) { setToast(`✓ ${stop?.order ?? ''}번 방문 (${next.size}/${sheetStops.length})`); return true }
      await recordRouteCompletion(route.id, user.id)   // 서버가 체크를 다시 대조 · 하루 1번 완주 횟수
      setEndResult({ mode: 'complete', completed: true, visitedCount: sheetStops.length, fieldVerified: 0, totalCheckpoints: 0, manualCount: sheetStops.length, confidence: 'recorded', bonusGranted: false })
      return true
    } finally { setBusyVisitId(null) }
  }

  const navigateNext = () => {
    if (!nextShop || !nextCoord) return
    window.open(`https://map.kakao.com/link/to/${encodeURIComponent(nextShop.name)},${nextCoord.lat},${nextCoord.lng}`, '_blank', 'noopener')
  }
  const onPauseResume = () => { if (run.phase === 'paused') run.resume(); else run.pause() }

  async function onSave() {
    if (!user) { router.push('/login'); return }
    const was = saved; setSaved(!was)
    try { setSaved(await toggleRouteSave(route.id, user.id)) } catch { setSaved(was); setToast('저장에 실패했어요.') }
  }
  async function doShare() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/map?routeId=${routeId}` : ''
    if (typeof navigator !== 'undefined' && (navigator as any).share) { try { await navigator.share({ title: route.title, url }) } catch {} return }
    try { await navigator.clipboard.writeText(url); setToast('링크를 복사했어요') } catch { setToast('복사에 실패했어요') }
  }

  if (loading) return <div className={styles.wrap}><div className={styles.center}>불러오는 중…</div></div>
  if (denied || !route) return (
    <div className={styles.wrap}><div className={styles.center}><p>루트를 찾을 수 없어요.</p><button className={styles.back} onClick={() => router.back()}>← 뒤로</button></div></div>
  )

  const hasRealPath = path?.status === 'ok'
  const metaDist = (hasRealPath ? path!.distance_m : null) ?? route.total_distance_m
  const metaDur = (hasRealPath ? path!.duration_min : null) ?? route.total_duration_min
  const metaLine = [region, `${sheetStops.length}곳`, fmtDur(metaDur), metaDist ? `도보 ${formatDistance(metaDist)}` : null].filter(Boolean).join(' · ')
  const pathLine = path && (path.status === 'ok' || path.status === 'partial') && path.geometry.length ? path.geometry : null

  return (
    <div className={styles.wrap}>
      {/* 컴팩트 앱바 */}
      <div className={styles.appbar}>
        <button className={styles.iconBtn} onClick={() => router.back()} aria-label="뒤로">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className={styles.appTitle}>{route.title}</div>
        <button className={styles.iconBtn} onClick={doShare} aria-label="공유">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
        </button>
        <div className={styles.menuWrap} ref={menuRef}>
          <button className={styles.iconBtn} onClick={() => setMenuOpen(o => !o)} aria-label="더보기">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          </button>
          {menuOpen && (
            <div className={styles.menu}>
              <button onClick={() => { setMenuOpen(false); onSave() }}>{saved ? '저장됨 ✓' : '저장'}</button>
              <button onClick={() => { setMenuOpen(false); router.push(`/route/${routeId}`) }}>상세 페이지로</button>
            </div>
          )}
        </div>
      </div>

      {/* 지도 */}
      <div className={styles.map}>
        {shopsWithCoords.length > 0 ? (
          <RouteMap
            ref={mapRef}
            shops={shopsWithCoords}
            geometry={running ? segmentLine : pathLine}
            fitOnGeometryChange={!running}
            selectedIndex={selIdx >= 0 ? selIdx : null}
            onSelectIndex={(i: number) => selectSpot(shopsWithCoords[i]?.id ?? null)}
            myLocation={myLoc}
            bottomPadding={sheetH + 24}
          />
        ) : <div className={styles.center}>지도에 표시할 위치 정보가 없어요.</div>}
      </div>

      {/* 우측 플로팅 버튼 */}
      <div className={styles.fabs} style={{ bottom: sheetH + 70 }}>
        <button className={styles.fab} onClick={() => mapRef.current?.fit(sheetH + 24)} aria-label="전체 루트 맞추기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" /></svg>
        </button>
        <button className={styles.fab} onClick={onLocBtn} aria-label="현재 위치">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#338bff" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.2" fill="#338bff" stroke="none" /><line x1="12" y1="1.5" x2="12" y2="4.5" /><line x1="12" y1="19.5" x2="12" y2="22.5" /><line x1="1.5" y1="12" x2="4.5" y2="12" /><line x1="19.5" y1="12" x2="22.5" y2="12" /></svg>
        </button>
      </div>

      {run.geoDenied && running && (
        <div className={styles.geoWarn} style={{ bottom: sheetH + 70 }}>위치 권한이 꺼져 있어요. 종료 시 직접 확인할 수 있어요.</div>
      )}

      <RouteSheet
        onHeightChange={onHeight}
        title={route.title}
        metaLine={metaLine}
        stops={sheetStops}
        selectedId={selectedId}
        onSelect={selectSpot}
        onOpenDetail={(slug: string) => router.push(`/shop/${slug}`)}
        running={running}
        phase={run.phase}
        onStart={onStart}
        startLabel={resuming ? '이어서 따라가기' : '루트 시작하기'}
        starting={run.phase === 'loading'}
        visitedCount={visitedCount}
        totalStops={sheetStops.length}
        fieldVerified={run.verifiedCount}
        checkpointTotal={run.totalCheckpoints}
        nextLabel={nextLabel}
        nextDistanceM={nextDistanceM}
        onNavigate={navigateNext}
        onSkip={skipNext}
        onPauseResume={onPauseResume}
        onEnd={() => setShowEndSheet(true)}
        onToggleVisit={toggleVisit}
        busyVisitId={busyVisitId}
        showProgress={!!user}
        nextId={nextShop?.id ?? null}
      />

      {running && <ArrivalToast arrivals={run.arrivals} onUndo={run.undo} onDismiss={run.dismissArrival} />}
      {showEndSheet && (
        <RouteEndSheet
          shops={endShops}
          confirmedShopIds={run.confirmedShopIds}
          fieldVerifiedCount={run.verifiedCount}
          busy={ending}
          onEnd={handleRunEnd}
          onClose={() => setShowEndSheet(false)}
        />
      )}
      {endResult && <RouteRunComplete result={endResult} routeTitle={route.title} onClose={closeRunComplete}
        onReview={() => { setEndResult(null); router.push(`/route/${routeId}?review=1`) }} />}

      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </div>
  )
}
