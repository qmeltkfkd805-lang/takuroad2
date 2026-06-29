'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useShops } from '@/hooks/useShops'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { useAuth } from '@/components/layout/AuthProvider'
import KakaoMap, { KakaoMapRef } from './KakaoMap'
import CategoryFilter from './CategoryFilter'
import ShopListPanel from '@/components/shop/ShopListPanel'
import ShopDetail from '@/components/shop/ShopDetail'
import BottomSheet from '@/components/bottom-sheet/BottomSheet'
import { Shop } from '@/types/shop'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import styles from './MapPage.module.css'
import MapBottomSheet from './MapBottomSheet'

export default function MapPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const {
    filtered, mapShops, loading,
    selectedCat, setSelectedCat,
    selectedRegion, setSelectedRegion,
    selectedShop, setSelectedShop,
  } = useShops()

  const { location, requestLocation } = useCurrentLocation()
  const [listOpen, setListOpen] = useState(false)
  const [groupShops, setGroupShops] = useState<Shop[] | null>(null)
  const mapRef = useRef<KakaoMapRef>(null)

  const handleSelectShop = useCallback((shop: Shop) => {
    setSelectedShop(shop)
    setListOpen(false)
    setGroupShops(null)
    if (shop.lat && shop.lng) {
      mapRef.current?.moveCenter(shop.lat, shop.lng, 3)
    }
  }, [setSelectedShop])

  const handleSelectGroup = useCallback((shops: Shop[]) => {
    setGroupShops(shops)
  }, [])

  const handleMapClick = useCallback(() => {
    setSelectedShop(null)
    setListOpen(false)
  }, [setSelectedShop])

  // 현재 위치를 받아오면 지도 이동
  useEffect(() => {
    if (location) {
      mapRef.current?.moveCenter(location.lat, location.lng, 4)
    }
  }, [location])

  // URL의 ?shop=slug 파라미터로 특정 샵 위치로 이동
  useEffect(() => {
    const shopSlug = searchParams.get('shop')
    if (!shopSlug || mapShops.length === 0) return

    const target = mapShops.find(s => s.slug === shopSlug)
    if (target && target.lat && target.lng) {
      mapRef.current?.moveCenter(target.lat, target.lng, 3)
      setSelectedShop(target)
    }
  }, [searchParams, mapShops, setSelectedShop])

  return (
    <div className={styles.layout}>
      {/* 지도 컬럼 (absolute 자식들의 기준점) */}
      <div className={styles.mapCol}>

        {/* 카테고리 필터 + 목록 토글 (TopBar 바로 아래) */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 140,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <CategoryFilter
              selected={selectedCat}
              onChange={cat => { setSelectedCat(cat); setListOpen(true) }}
            />
          </div>
          <button
            onClick={() => setListOpen(v => !v)}
            style={{
              flexShrink: 0, margin: '0 12px',
              padding: '6px 14px', borderRadius: '20px',
              border: `1.5px solid ${listOpen ? 'var(--accent)' : 'var(--border)'}`,
              background: listOpen ? 'var(--accent)' : 'var(--surface)',
              color: listOpen ? '#fff' : 'var(--text)',
              fontWeight: 700, fontSize: '12px', cursor: 'pointer',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            ☰ 목록
          </button>
        </div>

        {/* 지도 — 필터 높이(52px)만 비우고 컬럼 가득 */}
        <div style={{ position: 'absolute', inset: 0, paddingTop: '52px' }}>
          <KakaoMap
            ref={mapRef}
            shops={mapShops}
            activeShopId={selectedShop?.id ?? null}
            onSelectShop={handleSelectShop}
            onMapClick={handleMapClick}
            onSelectGroup={handleSelectGroup}
          />
        </div>

        <ShopListPanel
          shops={filtered}
          loading={loading}
          activeShopId={selectedShop?.id ?? null}
          isOpen={listOpen}
          onToggle={() => setListOpen(false)}
          onSelectShop={handleSelectShop}
        />

        <div style={{
          position: 'absolute', right: '12px', bottom: '100px', zIndex: 130,
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <button
            onClick={requestLocation}
            title="현재 위치"
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'var(--surface)', border: '1.5px solid var(--border)',
              boxShadow: 'var(--sh-sm)', cursor: 'pointer', fontSize: '18px',
            }}
          >📍</button>

          {user && (
            <Link
              href={ROUTES.shopNew}
              title="샵 등록"
              style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'var(--accent)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--sh-sm)', fontSize: '20px',
              }}
            >+</Link>
          )}
        </div>

        <MapBottomSheet shops={filtered} onSelectShop={handleSelectShop} />

        {/* 샵 상세 바텀시트 */}
        <BottomSheet
          isOpen={!!selectedShop}
          onClose={() => setSelectedShop(null)}
        >
          {selectedShop && (
            <ShopDetail shop={selectedShop} onClose={() => setSelectedShop(null)} />
          )}
        </BottomSheet>

        {/* 같은 위치 샵 목록 바텀시트 */}
        <BottomSheet
          isOpen={!!groupShops}
          onClose={() => setGroupShops(null)}
        >
          {groupShops && (
            <div style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '14px' }}>
                📍 이 위치의 샵 {groupShops.length}곳
              </h3>
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
                      ) : '🏪'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{shop.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {shop.cats.join(', ')}
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
