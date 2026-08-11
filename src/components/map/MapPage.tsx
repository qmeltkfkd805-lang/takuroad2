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
import { CATEGORY_NAME_MAP, catInfoOf } from '@/lib/constants/categories'
import MapBottomSheet from './MapBottomSheet'
import MapPinModal from './MapPinModal'
import { getOngoingMapEvents, MapEvent } from '@/services/mapEventService'
import RouteMapMode from '@/components/route/RouteMapMode'
import RouteMapMobile from '@/components/route/RouteMapMobile'
import { useIsDesktop } from '@/hooks/useIsDesktop'

// Place 소속 샵은 place 좌표로 접어서 표시한다 (저장 좌표 lat/lng 은 안 건드림)
const dispLat = (s: any) => s.displayLat ?? s.lat
const dispLng = (s: any) => s.displayLng ?? s.lng

// 이벤트 type → 샵 카테고리 이름 (카테고리 필터 매칭용)
const EV_CAT_NAME: Record<string, string> = { popup: '팝업스토어', collab_cafe: '콜라보카페', exhibition: '전시', official_event: '행사' }


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

  // 선택한 카테고리에 맞는 이벤트만 (전체면 모두, 팝업/콜라보/전시/행사면 해당 타입만)
  const filteredEvents = useMemo(() => {
    if (!selectedCat || selectedCat === '전체') return mapEvents
    return mapEvents.filter(ev => !!ev.type && EV_CAT_NAME[ev.type] === selectedCat)
  }, [mapEvents, selectedCat])

  // 진행중 이벤트를 지도에 핀으로 (전시 등 — 샵과 별개로 자체 좌표로 표시)
  useEffect(() => {
    let alive = true
    getOngoingMapEvents().then(evs => { if (alive) setMapEvents(evs) })
    return () => { alive = false }
  }, [])

  const handleSelectEvent = useCallback((ev: MapEvent) => {
    setSelectedShop(null)
    setSelectedEvent(ev)
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
    const qs = params.toString()
    router.push(qs ? `/shops/all?${qs}` : '/shops/all')
  }, [selectedRegion, selectedDistrict, selectedCat, router])

  const handleSelectGroup = useCallback((shops: Shop[]) => {
    setGroupShops(shops)
  }, [])

  const handleMapClick = useCallback(() => {
    setSelectedShop(null)

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

  // 현재 위치를 받아오면 지도 이동
  useEffect(() => {
    if (location) {
      mapRef.current?.moveCenter(location.lat, location.lng, 4)
      setLocToast(true)
      const t = setTimeout(() => setLocToast(false), 5000)
      return () => clearTimeout(t)
    }
  }, [location])

  // URL의 ?shop=slug 파라미터로 특정 샵 위치로 이동
  useEffect(() => {
    const shopSlug = searchParams.get('shop')
    if (!shopSlug || mapShops.length === 0) return

    const target = mapShops.find(s => s.slug === shopSlug)
    const tla = target ? dispLat(target) : null, tln = target ? dispLng(target) : null
    if (target && tla && tln) {
      mapRef.current?.moveCenter(tla, tln, 3)
      setSelectedShop(target)
    }
  }, [searchParams, mapShops, setSelectedShop])

  // URL의 ?cat=이름 파라미터로 카테고리 선택 (덕질 지도 칩에서 진입)
  useEffect(() => {
    const cat = searchParams.get('cat')
    if (cat) setSelectedCat(cat)
  }, [searchParams, setSelectedCat])

  // 루트 보기 모드: URL에 routeId가 있으면 일반 지도 대신 루트 전용 뷰
  // 모바일은 지도 중심 전체화면(RouteMapMobile), 데스크톱은 기존 2단 레이아웃(RouteMapMode)
  const routeId = searchParams?.get('routeId')
  if (routeId) return isDesktop ? <RouteMapMode routeId={routeId} /> : <RouteMapMobile routeId={routeId} />

  return (
    <div className={styles.layout}>
      {/* 지도 컬럼 (absolute 자식들의 기준점) */}
      <div className={styles.mapCol}>

        {/* 카테고리 필터 + 지역 필터 (TopBar 바로 아래) */}
        <div style={{
          position: 'absolute', top: 10, left: 10, right: 10, zIndex: 140,
          background: 'var(--surface)', borderRadius: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,.12)',
          display: 'flex', alignItems: 'center',
        }}>
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
            />
          </div>
        </div>

        {/* 지도 — 필터 높이(52px)만 비우고 컬럼 가득 */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <KakaoMap
            ref={mapRef}
            shops={mapShops}
            events={filteredEvents}
            activeShopId={selectedShop?.id ?? null}
            myLocation={location}
            onSelectShop={handleSelectShop}
            onSelectEvent={handleSelectEvent}
            onMapClick={handleMapClick}
            onSelectGroup={handleSelectGroup}
          />
        </div>

        <div style={{
          position: 'absolute', right: '16px', zIndex: 130,
          bottom: selectedShop ? '110px' : sheetState === 'peek' ? '380px' : '24px',
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
        {!selectedShop && (
          <MapBottomSheet shops={filtered} events={filteredEvents} onSelectShop={handleSelectShop} onSelectEvent={handleSelectEvent} onStateChange={setSheetState} onListClick={goToFilteredList} />
        )}

        {/* 핀 클릭 — 샵/이벤트 요약 모달 (전체보기 → 상세) */}
        {(selectedShop || selectedEvent) && (
          <MapPinModal
            shop={selectedShop ? ({ ...selectedShop, isSaved: isSaved(selectedShop.id) } as Shop) : null}
            event={selectedEvent}
            onClose={() => { setSelectedShop(null); setSelectedEvent(null) }}
          />
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

      {/* 오른쪽 광고 칸 (데스크톱만, 모바일은 숨김) */}
      <aside className={styles.adCol}>
        <div className={styles.adSlot}>
          {/* 여기에 구글 애드센스 <ins> 태그를 넣으세요 */}
        </div>
      </aside>
    </div>
  )
}
