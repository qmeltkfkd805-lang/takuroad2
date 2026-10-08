'use client'
import AppIcon from '@/components/tds/AppIcon'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useShops } from '@/hooks/useShops'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { useAuth } from '@/components/layout/AuthProvider'
import { useSaved } from '@/hooks/useSaved'
import KakaoMap, { KakaoMapRef } from './KakaoMap'
import CategoryFilter from './CategoryFilter'
import BottomSheet from '@/components/bottom-sheet/BottomSheet'
import { Shop } from '@/types/shop'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { shopRegion, shopDistrict } from '@/lib/utils/region'
import styles from './MapPage.module.css'
import fab from './MapFab.module.css'
import { CATEGORY_NAME_MAP, CATEGORIES, catInfoOf } from '@/lib/constants/categories'
import MapBottomSheet from './MapBottomSheet'
import MapShopBubble from './MapShopBubble'
import MapEventBubble from './MapEventBubble'
import { eventSpotKey } from '@/lib/map/eventSpot'
import { getOngoingMapEvents, MapEvent } from '@/services/mapEventService'
import RouteMapMode from '@/components/route/RouteMapMode'
import RouteMapMobile from '@/components/route/RouteMapMobile'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { imagesFirst } from '@/lib/utils/shopOrder'

// Place 소속 샵은 place 좌표로 접어서 표시한다 (저장 좌표 lat/lng 은 안 건드림)
const dispLat = (s: any) => s.displayLat ?? s.lat
const dispLng = (s: any) => s.displayLng ?? s.lng

const EMPTY_SHOPS: Shop[] = []
const EMPTY_EVENTS: MapEvent[] = []

// 이벤트 type → 샵 카테고리 이름 (카테고리 필터 매칭용)
const EV_CAT_NAME: Record<string, string> = { popup: '팝업스토어', collab_cafe: '콜라보카페', exhibition: '전시', official_event: '행사' }


// 지도에 보이는 종류 — 전체 / 샵만 / 이벤트만
type Layer = 'all' | 'shop' | 'event'
const LAYERS: { v: Layer; label: string }[] = [
  { v: 'all', label: '전체' },
  { v: 'shop', label: '샵만' },
  { v: 'event', label: '이벤트만' },
]

// URL 의 카테고리 값 → 카테고리 이름 (이름이나 slug 둘 다 받음)
function catNameOf(v: string | null | undefined): string | null {
  if (!v) return null
  const c = CATEGORIES.find(c => c.name === v) ?? CATEGORIES.find(c => c.slug === v)
  return c ? c.name : null
}

// 샵들이 퍼져 있는 정도에 맞춰 카카오 지도 레벨을 고름 (작을수록 확대)
function levelForSpan(span: number) {
  if (span < 0.01) return 4
  if (span < 0.03) return 5
  if (span < 0.06) return 6
  if (span < 0.12) return 7
  if (span < 0.25) return 8
  return 9
}

export default function MapPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const router = useRouter()
  const { isSaved, toggleSave } = useSaved()
  const {
    shops, filtered, mapShops, loading, regions, districtsByRegion,
    selectedCat, setSelectedCat,
    selectedRegion, setSelectedRegion,
    selectedDistrict, setSelectedDistrict,
    selectedShop, setSelectedShop,
  } = useShops()

  const { location, requestLocation } = useCurrentLocation()
  const isDesktop = useIsDesktop()
  const [groupShops, setGroupShops] = useState<Shop[] | null>(null)
  const mapRef = useRef<KakaoMapRef>(null)
  const [locToast, setLocToast] = useState(false)
  const [sheetState, setSheetState] = useState<'closed' | 'peek' | 'expanded'>('peek')
  const [mapEvents, setMapEvents] = useState<MapEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null)
  const [layer, setLayer] = useState<Layer>('all')
  // 📱 위쪽 바(검색 헤더) 숨김 — 위로 밀면 숨기고 아래로 당기면 다시
  const [barHidden, setBarHidden] = useState(false)

  // 선택한 카테고리·지역에 맞는 이벤트만 (전체면 모두, 팝업/콜라보/전시/행사면 해당 타입만)
  const filteredEvents = useMemo(() => {
    return mapEvents.filter(ev => {
      if (selectedCat && selectedCat !== '전체' && !(!!ev.type && EV_CAT_NAME[ev.type] === selectedCat)) return false
      if (selectedRegion !== '전체' && ev.region && ev.region !== selectedRegion) return false
      if (selectedDistrict !== '전체' && ev.district && ev.district !== selectedDistrict) return false
      return true
    })
  }, [mapEvents, selectedCat, selectedRegion, selectedDistrict])

  // 샵만/이벤트만 보기
  const shownShops = layer === 'event' ? EMPTY_SHOPS : mapShops
  // 목록(하단 시트)은 사진 있는 샵 먼저
  const listShopsSorted = useMemo(() => imagesFirst(filtered), [filtered])
  const shownListShops = layer === 'event' ? EMPTY_SHOPS : listShopsSorted
  const shownEvents = layer === 'shop' ? EMPTY_EVENTS : filteredEvents
  // 고른 이벤트와 같은 장소의 이벤트들 — 핀은 하나, 말풍선에서 옆으로 넘겨 본다
  const selectedSpot = selectedEvent ? eventSpotKey(selectedEvent) : null
  const eventGroup = useMemo(() => {
    if (!selectedEvent) return []
    const same = selectedSpot ? shownEvents.filter(e => eventSpotKey(e) === selectedSpot) : []
    return same.some(e => e.id === selectedEvent.id) ? same : [selectedEvent, ...same]
  }, [selectedEvent, selectedSpot, shownEvents])

  // 지역별 샵 수 (지금 카테고리 기준, 지도에 표시되는 샵만) — 지역 고르는 창에 숫자로
  const { regionCounts, districtCounts } = useMemo(() => {
    const rc: Record<string, number> = { '전체': 0 }
    const dc: Record<string, Record<string, number>> = {}
    for (const r of regions) if (r !== '전체') rc[r] = 0
    for (const s of shops) {
      if (!dispLat(s) || !dispLng(s) || s.cats.includes('온라인샵')) continue
      if (selectedCat !== '전체' && !s.cats.includes(selectedCat)) continue
      rc['전체']++
      const r = shopRegion(s), d = shopDistrict(s)
      if (!r) continue
      rc[r] = (rc[r] ?? 0) + 1
      if (d) { const m = (dc[r] ??= {}); m[d] = (m[d] ?? 0) + 1 }
    }
    return { regionCounts: rc, districtCounts: dc }
  }, [shops, regions, selectedCat])
  const regionLabel = selectedRegion === '전체' ? null
    : selectedDistrict !== '전체' ? `${selectedRegion} ${selectedDistrict}` : selectedRegion

  // 지도가 준비된 뒤에 실행 (URL 로 들어오면 샵 목록이 지도보다 먼저 올 수 있음)
  const whenMapReady = useCallback((fn: () => void) => {
    let tries = 0
    const tick = () => {
      if (mapRef.current?.isReady()) { fn(); return }
      if (++tries < 60) setTimeout(tick, 100)
    }
    tick()
  }, [])

  // 진행중 이벤트를 지도에 핀으로 (전시 등 — 샵과 별개로 자체 좌표로 표시)
  useEffect(() => {
    let alive = true
    getOngoingMapEvents().then(evs => { if (alive) setMapEvents(evs) })
    return () => { alive = false }
  }, [])

  const handleSelectEvent = useCallback((ev: MapEvent) => {
    setSelectedShop(null)
    setSelectedEvent(ev)
    setGroupShops(null)
    // 샵과 같이 — 그 이벤트 위치로 이동해서 말풍선이 보이게
    if (ev.lat && ev.lng) mapRef.current?.moveCenter(ev.lat, ev.lng, 3)
  }, [setSelectedShop])

  const handleSelectShop = useCallback((shop: Shop) => {
    setSelectedEvent(null)
    setSelectedShop(shop)

    setGroupShops(null)
    const la = dispLat(shop), ln = dispLng(shop)
    if (la && ln) {
      mapRef.current?.moveCenter(la, ln, 3)
    }
  }, [setSelectedShop])

  // 바텀시트 '목록 보기' → 지도에 걸린 필터(지역·구·카테고리)를 들고 전체보기로
  const goToFilteredList = useCallback(() => {
    const params = new URLSearchParams()
    if (selectedRegion && selectedRegion !== '전체') {
      params.set('region', selectedDistrict && selectedDistrict !== '전체'
        ? `${selectedRegion} ${selectedDistrict}`
        : selectedRegion)
    }
    if (selectedCat && selectedCat !== '전체') {
      const slug = CATEGORY_NAME_MAP[selectedCat]?.slug
      if (slug) params.set('cat', slug)
    }
    if (layer === 'event') params.set('tab', 'event')
    const qs = params.toString()
    router.push(qs ? `/shops/all?${qs}` : '/shops/all')
  }, [selectedRegion, selectedDistrict, selectedCat, layer, router])

  const handleSelectGroup = useCallback((shops: Shop[]) => {
    setGroupShops(shops)
  }, [])

  const handleMapClick = useCallback(() => {
    setSelectedShop(null)
    setSelectedEvent(null)   // 이벤트 말풍선도 지도 빈 곳을 누르면 닫힌다

  }, [setSelectedShop])

  // 주어진 샵들이 다 보이는 위치·줌으로 지도 이동
  const fitToShops = useCallback((pts: Shop[]) => {
    if (pts.length === 0) return
    const lats = pts.map(s => dispLat(s) as number)
    const lngs = pts.map(s => dispLng(s) as number)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const span = Math.max(maxLat - minLat, maxLng - minLng)
    mapRef.current?.moveCenter(
      (minLat + maxLat) / 2,
      (minLng + maxLng) / 2,
      pts.length === 1 ? 4 : levelForSpan(span),
    )
  }, [])

  const onMap = useCallback(
    (s: Shop) => !!dispLat(s) && !!dispLng(s) && !s.cats.includes('온라인샵'),
    [],
  )

  // 시/도 선택 → 그 시/도 전체가 보이게 이동 (구 선택은 초기화)
  const handleSelectRegion = useCallback((region: string) => {
    setSelectedRegion(region)
    setSelectedDistrict('전체')
    setSelectedShop(null)
    setGroupShops(null)
    if (region === '전체') return
    fitToShops(shops.filter(s => onMap(s) && shopRegion(s) === region))
  }, [shops, onMap, fitToShops, setSelectedRegion, setSelectedDistrict, setSelectedShop])

  // 구/군 선택 → 그 구만 확대
  const handleSelectDistrict = useCallback((district: string) => {
    setSelectedDistrict(district)
    setSelectedShop(null)
    setGroupShops(null)
    const pts = shops.filter(s =>
      onMap(s) &&
      shopRegion(s) === selectedRegion &&
      (district === '전체' || shopDistrict(s) === district),
    )
    fitToShops(pts)
  }, [shops, selectedRegion, onMap, fitToShops, setSelectedDistrict, setSelectedShop])

  // 📱 지도 화면에선 화면 전체가 끌려 내려가거나 '당겨서 새로고침' 되지 않게
  useEffect(() => {
    const html = document.documentElement, body = document.body
    const prev = [html.style.overscrollBehavior, body.style.overscrollBehavior]
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    return () => { html.style.overscrollBehavior = prev[0]; body.style.overscrollBehavior = prev[1] }
  }, [])

  // 현재 위치를 받아오면 지도 이동
  useEffect(() => {
    if (location) {
      mapRef.current?.moveCenter(location.lat, location.lng, 4)
      // 'IP 기반이라 다를 수 있어요' 안내는 PC에서만 — 폰은 GPS라 정확하다
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
      setLocToast(true)
      const t = setTimeout(() => setLocToast(false), 5000)
      return () => clearTimeout(t)
    }
  }, [location])

  // URL의 ?shop=slug — 특정 샵 위치로 이동 (상단 검색에서 샵을 고르면 상세 대신 여기로 옴)
  // 필터에 가려진 샵이면 필터를 풀어서라도 보여준다. 같은 샵을 다시 검색해도 동작하게 t 값까지 키로 씀
  const handledShopKey = useRef<string | null>(null)
  useEffect(() => {
    const shopSlug = searchParams.get('shop')
    if (!shopSlug) { handledShopKey.current = null; return }
    if (shops.length === 0) return
    const key = `${shopSlug}|${searchParams.get('t') ?? ''}`
    if (handledShopKey.current === key) return
    const target = shops.find(s => s.slug === shopSlug)
    if (!target) return
    handledShopKey.current = key
    const tla = dispLat(target), tln = dispLng(target)
    if (!tla || !tln) return
    const catOk = selectedCat === '전체' || target.cats.includes(selectedCat)
    const regionOk = selectedRegion === '전체' || shopRegion(target) === selectedRegion
    const districtOk = selectedDistrict === '전체' || shopDistrict(target) === selectedDistrict
    if (!catOk) setSelectedCat('전체')
    if (!regionOk || !districtOk) { setSelectedRegion('전체'); setSelectedDistrict('전체') }
    if (layer === 'event') setLayer('all')
    setSelectedEvent(null)
    setGroupShops(null)
    setBarHidden(false)
    whenMapReady(() => mapRef.current?.moveCenter(tla, tln, 3))
    setSelectedShop(target)
  }, [searchParams, shops, selectedCat, selectedRegion, selectedDistrict, layer, whenMapReady, setSelectedCat, setSelectedRegion, setSelectedDistrict, setSelectedShop])

  // URL의 카테고리·지역·탭 — 덕질 지도 칩(?cat=이름), 전체 샵 목록의 '지도 보기'(?region=&district=&cats=&tab=)에서 진입
  const appliedFilterQs = useRef<string | null>(null)
  useEffect(() => {
    if (shops.length === 0) return
    const qs = ['cat', 'cats', 'region', 'district', 'tab'].map(k => `${k}=${searchParams.get(k) ?? ''}`).join('&')
    if (appliedFilterQs.current === qs) return
    appliedFilterQs.current = qs

    const cat = catNameOf(searchParams.get('cat')) ?? catNameOf(searchParams.get('cats')?.split(',')[0])
    if (cat) setSelectedCat(cat)
    if (searchParams.get('tab') === 'event') setLayer('event')

    // region 은 "서울" 또는 "서울 마포구" 형태 둘 다
    let region = searchParams.get('region')
    let district = searchParams.get('district')
    if (region && region.includes(' ')) { const p = region.split(' '); region = p[0]; district = district || p.slice(1).join(' ') }
    if (!region) return
    setSelectedRegion(region)
    setSelectedDistrict(district || '전체')
    setSelectedShop(null)
    const pts = shops.filter(s =>
      onMap(s) && shopRegion(s) === region &&
      (!district || shopDistrict(s) === district) &&
      (!cat || s.cats.includes(cat)),
    )
    const fallback = pts.length ? pts : shops.filter(s => onMap(s) && shopRegion(s) === region)
    whenMapReady(() => fitToShops(fallback))
  }, [searchParams, shops, onMap, fitToShops, whenMapReady, setSelectedCat, setSelectedRegion, setSelectedDistrict, setSelectedShop])

  // 📱 위쪽 바 숨김 — 전역 헤더는 html 속성으로 숨긴다(AppShell CSS). 지도 크기가 바뀌니 다시 맞춤
  useEffect(() => {
    const root = document.documentElement
    if (barHidden) root.dataset.mapBar = 'hidden'
    else delete root.dataset.mapBar
    const t = setTimeout(() => mapRef.current?.relayout(), 300)
    return () => clearTimeout(t)
  }, [barHidden])
  useEffect(() => () => { delete document.documentElement.dataset.mapBar }, [])

  // 위쪽 바(검색 헤더·필터) 위에서 위로 쓸면 숨김, 아래로 쓸면 보임
  const topZoneRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let sx = 0, sy = 0, active = false
    const inZone = (t: EventTarget | null) => {
      const el = t as Element | null
      if (!el || !el.closest) return false
      if (el.closest('[role="dialog"]')) return false   // 지역 고르는 창 안 스크롤은 제외
      return !!(el.closest('header') || (topZoneRef.current && topZoneRef.current.contains(el)))
    }
    const onStart = (e: TouchEvent) => {
      active = inZone(e.target)
      if (!active) return
      sx = e.touches[0].clientX; sy = e.touches[0].clientY
    }
    const onEnd = (e: TouchEvent) => {
      if (!active) return
      active = false
      const t = e.changedTouches[0]
      const dx = t.clientX - sx, dy = t.clientY - sy
      if (Math.abs(dy) < 36 || Math.abs(dy) < Math.abs(dx) * 1.4) return   // 칩 가로 스크롤은 무시
      setBarHidden(dy < 0)
    }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
    }
  }, [])

  const changeLayer = useCallback((v: Layer) => {
    setLayer(v)
    if (v === 'event') setSelectedShop(null)
    if (v === 'shop') setSelectedEvent(null)
    setGroupShops(null)
  }, [setSelectedShop])

  // 루트 보기 모드: URL에 routeId가 있으면 일반 지도 대신 루트 전용 뷰
  // 모바일은 지도 중심 전체화면(RouteMapMobile), 데스크톱은 기존 2단 레이아웃(RouteMapMode)
  const routeId = searchParams?.get('routeId')
  if (routeId) return isDesktop ? <RouteMapMode routeId={routeId} /> : <RouteMapMobile routeId={routeId} />

  return (
    <div className={`${styles.layout}${barHidden ? ' ' + styles.layoutFull : ''}`}>
      {/* 지도 컬럼 (absolute 자식들의 기준점) */}
      <div className={styles.mapCol}>

        {/* 카테고리 필터 + 지역 필터 (TopBar 바로 아래) + 샵/이벤트 보기 */}
        <div ref={topZoneRef} className={styles.topZone}>
          <div className={styles.filterCard}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <CategoryFilter
                  selected={selectedCat}
                  onChange={setSelectedCat}
                  regions={regions}
                  districtsByRegion={districtsByRegion}
                  selectedRegion={selectedRegion}
                  selectedDistrict={selectedDistrict}
                  onChangeRegion={handleSelectRegion}
                  onChangeDistrict={handleSelectDistrict}
                  regionCounts={regionCounts}
                  districtCounts={districtCounts}
                />
              </div>
            </div>
            {/* 📱 손잡이 — 탭하거나 위아래로 쓸어서 위쪽 검색 바 숨기기/보이기 */}
            <button
              type="button"
              className={styles.barGrip}
              onClick={() => setBarHidden(h => !h)}
              aria-label={barHidden ? '위쪽 검색 바 보이기' : '위쪽 검색 바 숨기기'}
            >
              <span />
            </button>
          </div>
          <div className={styles.layerRow}>
            <div className={styles.layerSeg} role="group" aria-label="지도에 보일 것">
              {LAYERS.map(l => (
                <button key={l.v} type="button" aria-pressed={layer === l.v}
                  className={layer === l.v ? styles.layerOn : styles.layerBtn}
                  onClick={() => changeLayer(l.v)}>
                  {l.label}
                </button>
              ))}
            </div>
            {regionLabel && (
              <div className={styles.regionPill}>
                {regionLabel} · {layer === 'event' ? `이벤트 ${shownEvents.length}` : `샵 ${shownListShops.length}`}곳
              </div>
            )}
          </div>
        </div>

        {/* 지도 — 필터 높이(52px)만 비우고 컬럼 가득 */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <KakaoMap
            ref={mapRef}
            shops={shownShops}
            events={shownEvents}
            activeShopId={selectedShop?.id ?? null}
            myLocation={location}
            onSelectShop={handleSelectShop}
            onSelectEvent={handleSelectEvent}
            onMapClick={handleMapClick}
            onSelectGroup={handleSelectGroup}
            /* 카테고리를 고르면 핀을 모두 그 카테고리 색으로 — 전체 보기일 때만 알록달록 */
            pinCat={selectedCat && selectedCat !== '전체' && CATEGORY_NAME_MAP[selectedCat] ? selectedCat : null}
            /* 고른 샵·이벤트 — 가운데 모달 대신 그 위치(핀 위)에 말풍선으로 */
            bubble={selectedShop && dispLat(selectedShop) && dispLng(selectedShop) ? {
              key: selectedShop.id,
              lat: dispLat(selectedShop) as number,
              lng: dispLng(selectedShop) as number,
              content: <MapShopBubble shop={selectedShop} onClose={() => setSelectedShop(null)} />,
            } : selectedEvent && selectedEvent.lat && selectedEvent.lng ? {
              key: `ev:${selectedSpot ?? selectedEvent.id}`,
              lat: selectedEvent.lat,
              lng: selectedEvent.lng,
              content: <MapEventBubble events={eventGroup} initialId={selectedEvent.id} onClose={() => setSelectedEvent(null)} />,
            } : null}
            bubbleTopPad={() => {
              const z = topZoneRef.current
              return z ? z.offsetTop + z.offsetHeight : 0
            }}
          />
        </div>

        <div style={{
          position: 'absolute', right: '16px', zIndex: 130,
          bottom: (selectedShop || selectedEvent) ? '110px' : sheetState === 'peek' ? '380px' : sheetState === 'closed' ? '84px' : '24px',
          opacity: sheetState === 'expanded' ? 0 : 1,
          pointerEvents: sheetState === 'expanded' ? 'none' : 'auto',
          transition: 'bottom .28s cubic-bezier(.32,.72,0,1), opacity .2s ease',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {/* 현재 위치 — 흰 원 + 파란 과녁 */}
          <button
            onClick={requestLocation}
            title="현재 위치"
            aria-label="현재 위치"
            className={`${fab.fab} ${fab.locFab}`}
          >
            <span className={fab.icon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#338bff" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="2.2" fill="#338bff" stroke="none" />
                <line x1="12" y1="1.5" x2="12" y2="4.5" />
                <line x1="12" y1="19.5" x2="12" y2="22.5" />
                <line x1="1.5" y1="12" x2="4.5" y2="12" />
                <line x1="19.5" y1="12" x2="22.5" y2="12" />
              </svg>
            </span>
            <span className={fab.label}>현재 위치</span>
          </button>
          {user && (
            <Link
              href={ROUTES.shopNew}
              title="샵 등록"
              aria-label="샵 등록"
              className={`${fab.fab} ${fab.shopFab}`}
            >
              <span className={fab.icon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
              <span className={fab.label}>샵 등록</span>
            </Link>
          )}
        </div>

        {locToast && (
          <div style={{
            position: 'absolute', left: '50%', bottom: '16px', transform: 'translateX(-50%)',
            zIndex: 150, maxWidth: '88%',
            background: 'rgba(32,32,45,.92)', color: '#fff',
            padding: '10px 16px', borderRadius: '12px',
            fontSize: '12.5px', fontWeight: 600, lineHeight: 1.45,
            boxShadow: '0 4px 16px rgba(0,0,0,.25)', textAlign: 'center',
          }}>
            PC에서는 IP 기반으로 위치를 찾기 때문에<br />실제 위치와 다를 수 있어요
          </div>
        )}
        {!selectedShop && !selectedEvent && (
          <MapBottomSheet shops={shownListShops} events={shownEvents} onSelectShop={handleSelectShop} onSelectEvent={handleSelectEvent} onStateChange={setSheetState} onListClick={goToFilteredList}
            regionLabel={regionLabel} layer={layer} onListScrollDir={dir => setBarHidden(dir === 'down')} loading={loading} />
        )}


        {/* 같은 위치 샵 목록 바텀시트 */}
        <BottomSheet
          isOpen={!!groupShops}
          onClose={() => setGroupShops(null)}
        >
          {groupShops && (
            <div style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '14px', whiteSpace: 'nowrap' }}>
                <AppIcon name="pushpin" size={15} style={{ marginRight: 5, verticalAlign: '-2px' }} />이 위치의 샵 {groupShops.length}곳
              </h3>
              {(() => {
                // 이 그룹이 전부 같은 장소(place) 소속이면 장소 상세로 가는 배너를 띄운다
                const pid = groupShops[0]?.place_id
                const pslug = groupShops[0]?.place_slug
                const pname = groupShops[0]?.place_name
                const allSamePlace = !!pid && groupShops.every(s => s.place_id === pid)
                if (!allSamePlace || !pslug) return null
                return (
                  <a
                    href={`/place/${pslug}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 14px', marginBottom: '12px', borderRadius: '12px',
                      background: 'var(--accent-l)', textDecoration: 'none',
                    }}
                  >
                    <span style={{ fontSize: '18px' }}><AppIcon name="building" size={18} color="var(--accent)" /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--accent)' }}>{pname} 전체 보기</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>입점 샵과 이벤트를 한눈에</div>
                    </div>
                    <span style={{ color: 'var(--accent)', fontSize: '18px' }}>›</span>
                  </a>
                )
              })()}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {groupShops.map(shop => (
                  <div
                    key={shop.id}
                    onClick={() => handleSelectShop(shop)}
                    style={{
                      padding: '12px 14px', borderRadius: '12px',
                      border: '1px solid var(--border)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}
                  >
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden',
                      background: 'var(--surface2)', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                    }}>
                      {shop.images?.[0] ? (
                        <img src={shop.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : <AppIcon name="shop" size={18} color="var(--muted)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{shop.name}</div>
                      <div style={{ display: 'flex', gap: '5px', marginTop: '3px', overflow: 'hidden' }}>
                        {shop.cats.slice(0, 3).map(c => {
                          const info = catInfoOf(c)
                          return (
                            <span key={c} style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', padding: '1px 7px', borderRadius: '6px', color: info?.color ?? 'var(--muted)', background: info?.bgColor ?? 'var(--surface2)' }}>{c}</span>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </BottomSheet>
      </div>

      {/* (오른쪽 빈 광고 칸은 없앴다 — PC에서 지도가 오른쪽 끝까지 넓게) */}
    </div>
  )
}
