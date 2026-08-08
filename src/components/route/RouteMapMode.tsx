'use client'
/* 타쿠로드 내부 지도의 '루트 보기 모드' — /map?routeId={share_token}
   좌측 루트 패널(정보+방문 코스) + 우측 인터랙티브 지도(RouteMap) 연동.
   실제 경로 데이터가 없으므로 지도 연결선은 점선(단순 연결)으로 표기한다. */
import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getRouteByShareToken, toggleRouteSave, getMySavedRouteIds } from '@/services/routeService'
import { getVisitedShopIds, setShopVisited, isRouteCompleted, recordRouteCompletion, resetRouteProgress } from '@/services/routeVisitService'
import { addExpOnce, XP_RULES } from '@/services/expService'
import { evaluateBadgeTiersForUser } from '@/services/badgeService'
import { formatDistance } from '@/hooks/useCurrentLocation'
import { shopRegion } from '@/lib/utils/region'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import MapControls from './map/MapControls'
import MapLegend from './map/MapLegend'
import SpotPreviewCard from './map/SpotPreviewCard'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { useRouteRun, type EndResult } from '@/lib/routeRun/useRouteRun'
import RouteRunSheet from './run/RouteRunSheet'
import ArrivalToast from './run/ArrivalToast'
import RouteEndSheet, { type EndShop } from './run/RouteEndSheet'
import RouteRunComplete from './run/RouteRunComplete'
import RouteMap from './RouteMap'
import styles from './RouteMapMode.module.css'

function fmtDur(min: number | null | undefined): string | null {
  if (min == null) return null
  const h = Math.floor(min / 60), m = min % 60
  return h && m ? `약 ${h}시간 ${m}분` : h ? `약 ${h}시간` : `약 ${m}분`
}

export default function RouteMapMode({ routeId }: { routeId: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuth()

  const [route, setRoute] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedShopId, setSelectedShopId] = useState<string | null>(params?.get('spotId') ?? null)
  const [fitKey, setFitKey] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [path, setPath] = useState<{ status: string; geometry: [number, number][]; distance_m: number | null; duration_min: number | null } | null>(null)
  const [pathReload, setPathReload] = useState(0)
  const [hasReturn, setHasReturn] = useState(false)
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set())
  const [showComplete, setShowComplete] = useState(false)
  const [showRetry, setShowRetry] = useState(false)
  const [completing, setCompleting] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)

  // 『루트 방문하기』 진행 모드 — 모바일(터치기기)에서만 동작, 데스크톱 레이아웃은 그대로.
  const isDesktop = useIsDesktop()
  const runEnabled = !isDesktop
  const wantRun = params?.get('run') === '1'
  const [showEndSheet, setShowEndSheet] = useState(false)
  const [ending, setEnding] = useState(false)
  const [endResult, setEndResult] = useState<EndResult | null>(null)
  const run = useRouteRun(route?.id ?? null, { autoStart: runEnabled && wantRun, enabled: runEnabled && !!route?.id })

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

  // 방문 체크 상태 로드
  useEffect(() => {
    if (!user || !route?.id) { setVisitedIds(new Set()); return }
    getVisitedShopIds(route.id, user.id).then(ids => setVisitedIds(new Set(ids))).catch(() => {})
  }, [user, route])

  // 실제 도보 경로(ORS) 로드
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

  const stops = useMemo(() => (route?.route_shops ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order), [route])
  const shopsWithCoords = useMemo(() => stops.map((rs: any) => rs.shops).filter((s: any) => s && s.lat && s.lng).map((s: any) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })), [stops])
  const region = useMemo(() => { for (const rs of stops) { const r = rs.shops ? shopRegion(rs.shops) : null; if (r && r !== '지역 미정') return r } return null }, [stops])
  const author = route?.profiles?.nickname
  const spotCount = stops.length
  const missingCoords = stops.filter((rs: any) => rs.shops && (!rs.shops.lat || !rs.shops.lng)).length

  const endShops: EndShop[] = useMemo(() => stops
    .map((rs: any) => rs.shops).filter((s: any) => s && s.id)
    .map((s: any) => ({ id: s.id, name: s.name, floor: s.floor_info || [s.floor, s.unit].filter(Boolean).join(' ') || null })), [stops])

  const runActive = runEnabled && (run.phase === 'running' || run.phase === 'paused')

  async function handleRunEnd(mode: 'complete' | 'partial' | 'later', manualIds: string[]) {
    if (ending) return
    setEnding(true)
    const r = await run.end(mode, manualIds)
    setEnding(false)
    setShowEndSheet(false)
    if (!r) { setToast('종료 처리에 실패했어요. 잠시 후 다시 시도해 주세요.'); return }
    if (mode === 'later') { setToast('오늘까지 기록을 저장했어요. 이어서 따라올 수 있어요.'); router.push(`/route/${routeId}`); return }
    setEndResult(r)
  }
  function closeRunComplete() { setEndResult(null); router.push(`/route/${routeId}`) }

  const coordIndexOf = (id: string | null) => (id ? shopsWithCoords.findIndex((s: any) => s.id === id) : -1)
  const selectSpot = (id: string | null) => {
    setSelectedShopId(id)
    const p = new URLSearchParams(params?.toString() ?? '')
    if (id) p.set('spotId', id); else p.delete('spotId')
    router.replace(`/map?${p.toString()}`, { scroll: false })
  }
  const back = () => router.back()
  const openDetail = () => router.push(`/route/${routeId}`)
  async function onSave() {
    if (!user) { router.push('/login'); return }
    const was = saved; setSaved(!was)
    try { setSaved(await toggleRouteSave(route.id, user.id)) } catch { setSaved(was); setToast('저장에 실패했어요.') }
  }
  async function completeRoute() {
    if (!user) { setToast('로그인 후 완주할 수 있어요'); return }
    if (completing) return
    setCompleting(true)
    try {
      // 이미 완주한 루트면 '다시 도전?' 모달
      const already = await isRouteCompleted(route.id, user.id)
      if (already) { setShowRetry(true); return }
      const allIds = stops.map((rs: any) => rs.shops?.id).filter(Boolean)
      if (allIds.length === 0) return
      const toAdd = allIds.filter((id: string) => !visitedIds.has(id))
      setVisitedIds(new Set(allIds))
      await Promise.all(toAdd.map((id: string) => setShopVisited(route.id, id, user.id, true).catch(() => {})))
      // 첫 완주만 기록 + 경험치/배찌(딱 한 번)
      const { firstTime } = await recordRouteCompletion(route.id, user.id)
      if (firstTime) {
        try { await addExpOnce(user.id, XP_RULES.route_completed.baseXp, 'route_completed', 'route', route.id) } catch { /* noop */ }
        try { await evaluateBadgeTiersForUser(user.id) } catch { /* noop */ }
      }
      setShowComplete(true)
    } finally { setCompleting(false) }
  }
  async function retryRoute() {
    if (!user) return
    setShowRetry(false)
    await resetRouteProgress(route.id, user.id).catch(() => {})
    setVisitedIds(new Set())
    setToast('방문 기록을 초기화했어요. 다시 도전해보세요!')
  }
  async function doShare() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/map?routeId=${routeId}` : ''
    if (typeof navigator !== 'undefined' && (navigator as any).share) { try { await navigator.share({ title: route.title, url }) } catch {} return }
    try { await navigator.clipboard.writeText(url); setToast('링크를 복사했어요') } catch { setToast('복사에 실패했어요') }
  }
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t) }, [toast])
  useEffect(() => {
    if (!selectedShopId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-spot="${selectedShopId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedShopId])

  if (loading) {
    return <div className={styles.wrap}><aside className={styles.panel}><div className={styles.skeleton} /></aside><div className={styles.map} /></div>
  }
  if (denied || !route) {
    return (
      <div className={styles.wrap}>
        <aside className={styles.panel}><div className={styles.empty}><p>루트를 찾을 수 없어요.</p><button onClick={back}>← 뒤로</button></div></aside>
        <div className={styles.map} />
      </div>
    )
  }

  const hasRealPath = path?.status === 'ok'
  const realDist = hasRealPath ? path!.distance_m : null
  const realDur = hasRealPath ? path!.duration_min : null
  const metaDist = realDist ?? route.total_distance_m
  const metaLine = [region, `${spotCount}곳`, fmtDur(realDur ?? route.total_duration_min), metaDist ? `도보 ${formatDistance(metaDist)}` : null].filter(Boolean).join(' · ')
  const pathLine = path && (path.status === 'ok' || path.status === 'partial') && path.geometry.length ? path.geometry : null
  const pathFailed = !!path && (path.status === 'failed' || path.status === 'insufficient')
  const selIdx = coordIndexOf(selectedShopId)
  const selectedShop = selectedShopId ? stops.find((rs: any) => rs.shops?.id === selectedShopId)?.shops ?? null : null

  return (
    <div className={styles.wrap}>
      <aside className={styles.panel}>
        <div className={styles.panelScroll}>
          <button className={styles.backBtn} onClick={back}>← 뒤로</button>
          <span className={styles.modeLabel}>루트 보기</span>
          <h1 className={styles.title}>{route.title}</h1>
          {author && <div className={styles.author}>{author}의 루트</div>}
          {metaLine && <div className={styles.meta}>{metaLine}</div>}
          <div className={styles.actions}>
            <button className={styles.actBtn} onClick={doShare}>공유</button>
            <button className={`${styles.actBtn} ${saved ? styles.actBtnOn : ''}`} onClick={onSave} aria-pressed={saved}>{saved ? '저장됨' : '저장'}</button>
          </div>
          {missingCoords > 0 && <div className={styles.warn}>지도에 표시할 수 없는 장소가 {missingCoords}곳 있어요.</div>}

          <ol className={styles.spots} ref={listRef}>
            {stops.map((rs: any, i: number) => {
              const shop = rs.shops
              if (!shop) return null
              const sel = selectedShopId === shop.id
              const noCoord = !shop.lat || !shop.lng
              const cats: string[] = Array.isArray(shop.cats) ? shop.cats : []
              const walkMin = rs.duration_from_prev_min, walkM = rs.distance_from_prev_m
              return (
                <li key={rs.id}>
                  {i > 0 && (walkMin != null || walkM != null) && (
                    <div className={styles.travel}>도보{walkMin != null ? ` ${walkMin}분` : ''}{walkM != null ? ` · ${formatDistance(walkM)}` : ''}</div>
                  )}
                  {i > 0 && stops[i - 1]?.move_tip && (
                    <div className={styles.travelTip}>{stops[i - 1].move_tip}</div>
                  )}
                  <div data-spot={shop.id} className={`${styles.spot} ${sel ? styles.spotSel : ''}`} role="button" tabIndex={0}
                    onClick={() => selectSpot(sel ? null : shop.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSpot(sel ? null : shop.id) } }}
                    aria-label={`${i + 1}번 장소: ${shop.name}`}>
                    <span className={`${styles.num} ${runActive && run.confirmedShopIds.has(shop.id) ? styles.numDone : ''}`}>{runActive && run.confirmedShopIds.has(shop.id) ? '✓' : i + 1}</span>
                    <div className={styles.thumb}>{shop.shop_images?.[0]?.image_url ? <img src={shop.shop_images[0].image_url} alt="" loading="lazy" /> : <span className={styles.noImg} />}</div>
                    <div className={styles.spotBody}>
                      <span className={styles.spotName}>{shop.name}</span>
                      {(() => { const fl = shop.floor_info || [shop.floor, shop.unit].filter(Boolean).join(' '); return fl ? <div className={styles.spotFloor}>{fl}</div> : null })()}
                      {shop.addr && <div className={styles.spotAddr}>{shop.addr}</div>}
                      {shop.places?.access_note && <div className={styles.accessNote}>가는 길 · {shop.places.access_note}</div>}
                      {cats.length > 0 && <div className={styles.spotTags}>{cats.slice(0, 2).map(c => { const cc = (CATEGORY_NAME_MAP as any)[c]; return <span key={c} className={styles.spotTag} style={cc ? { color: cc.color, background: cc.bgColor, border: 'none' } : undefined}>{c}</span> })}</div>}
                      {noCoord && <div className={styles.noCoord}>지도 위치 없음</div>}
                    </div>
                    <Link href={`/shop/${shop.slug}`} className={styles.detailLink} onClick={e => e.stopPropagation()}>상세 ›</Link>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
        {!runActive && (
          <div className={styles.footer}>
            {runEnabled
              ? <button className={styles.startBtn} disabled={run.phase === 'loading'} onClick={() => run.start()}>{run.phase === 'loading' ? '준비 중…' : '루트 시작하기'}</button>
              : <button className={styles.startBtn} onClick={completeRoute}>루트 완주</button>}
            <button className={styles.detailBtn} onClick={openDetail}>상세 페이지로</button>
          </div>
        )}
      </aside>

      <div className={styles.map}>
        {shopsWithCoords.length > 0 ? (
          <>
            <RouteMap key={fitKey} shops={shopsWithCoords} geometry={pathLine} selectedIndex={selIdx >= 0 ? selIdx : null} onSelectIndex={(i: number) => selectSpot(shopsWithCoords[i]?.id ?? null)} onHasReturn={setHasReturn} />
            <MapControls onFit={() => setFitKey(k => k + 1)} />
            {pathFailed && (
              <div className={styles.pathWarn} role="status">
                도보 경로를 불러오지 못했어요
                <button onClick={() => setPathReload(k => k + 1)}>다시 시도</button>
              </div>
            )}
            {path?.status === 'partial' && <div className={styles.pathWarn} role="status">일부 구간의 도보 경로를 불러오지 못했어요<button onClick={() => setPathReload(k => k + 1)}>다시 시도</button></div>}
            <MapLegend hasReturn={hasReturn} />
            {selectedShop && (
              <SpotPreviewCard shop={selectedShop} order={selIdx >= 0 ? selIdx + 1 : null} onClose={() => selectSpot(null)} />
            )}
          </>
        ) : (
          <div className={styles.mapEmpty}>지도에 표시할 위치 정보가 없어요.</div>
        )}
      </div>
      {toast && <div className={styles.toast} role="status">{toast}</div>}

      {runActive && (
        <>
          <ArrivalToast arrivals={run.arrivals} onUndo={run.undo} onDismiss={run.dismissArrival} />
          <RouteRunSheet
            phase={run.phase}
            verifiedCount={run.verifiedCount}
            totalCheckpoints={run.totalCheckpoints}
            nextCheckpoint={run.nextCheckpoint}
            nextDistanceM={run.nextDistanceM}
            geoDenied={run.geoDenied}
            hasFix={run.hasFix}
            onRequestLocation={run.requestLocationNow}
            onPause={run.pause}
            onResume={run.resume}
            onEnd={() => setShowEndSheet(true)}
          />
        </>
      )}
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
      {endResult && <RouteRunComplete result={endResult} routeTitle={route.title} onClose={closeRunComplete} />}

      {showComplete && (
        <div className={styles.completeOverlay} role="dialog" aria-modal="true" onClick={() => setShowComplete(false)}>
          <div className={styles.completeCard} onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/taku/taku-checkin.png" alt="" className={styles.completeChar} />
            <div className={styles.completeSub}>루트 완주</div>
            <div className={styles.completeTitle}>{route.title}</div>
            <p className={styles.completeMsg}>완주를 축하합니다!<br />{spotCount}곳을 모두 둘러봤어요.</p>
            <button className={styles.completeClose} onClick={() => setShowComplete(false)}>확인</button>
          </div>
        </div>
      )}

      {showRetry && (
        <div className={styles.completeOverlay} role="dialog" aria-modal="true" onClick={() => setShowRetry(false)}>
          <div className={styles.completeCard} onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/taku/taku-run.png" alt="" className={styles.completeChar} />
            <div className={styles.completeSub}>이미 완주한 루트</div>
            <div className={styles.completeTitle}>{route.title}</div>
            <p className={styles.completeMsg}>이미 완주한 루트예요.<br />나중에 다시 도전하시겠어요?</p>
            <div className={styles.retryBtns}>
              <button className={styles.retryNo} onClick={() => setShowRetry(false)}>아니오</button>
              <button className={styles.retryYes} onClick={retryRoute}>네, 다시 도전</button>
            </div>
            <p className={styles.retryNote}>완주 기록과 배지는 그대로 유지돼요.</p>
          </div>
        </div>
      )}
    </div>
  )
}
