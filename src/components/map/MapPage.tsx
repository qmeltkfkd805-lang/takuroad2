'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useShops } from '@/hooks/useShops'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { useAuth } from '@/components/layout/AuthProvider'
import KakaoMap from './KakaoMap'
import CategoryFilter from './CategoryFilter'
import ShopListPanel from '@/components/shop/ShopListPanel'
import ShopDetail from '@/components/shop/ShopDetail'
import BottomSheet from '@/components/bottom-sheet/BottomSheet'
import { Shop } from '@/types/shop'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'

export default function MapPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const {
    filtered, mapShops, loading,
    selectedCat, setSelectedCat,
    selectedRegion, setSelectedRegion,
    selectedShop, setSelectedShop,
  } = useShops()

  const { requestLocation } = useCurrentLocation()
  const [listOpen, setListOpen] = useState(false)

  const handleSelectShop = useCallback((shop: Shop) => {
    setSelectedShop(shop)
    setListOpen(false)
  }, [setSelectedShop])

  const handleMapClick = useCallback(() => {
    setSelectedShop(null)
  }, [setSelectedShop])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)' }}>

      {/* 상단 헤더 바 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 150,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        {/* 로고 */}
        <div style={{
          fontFamily: "'Cute Font', cursive",
          fontSize: '22px', color: 'var(--accent)',
          letterSpacing: '2px', flexShrink: 0,
        }}>
          TAKUROAD
        </div>

        {/* 검색창 — 클릭하면 /search 로 이동 */}
        <div
          onClick={() => router.push('/search')}
          style={{
            flex: 1, padding: '8px 12px',
            border: '1.5px solid var(--border)', borderRadius: '10px',
            fontSize: '13px', color: 'var(--muted)',
            background: 'var(--surface2)', cursor: 'pointer',
          }}
        >
          샵 이름, 지역 검색...
        </div>

        {/* 목록 버튼 */}
        <button
          onClick={() => setListOpen(v => !v)}
          style={{
            padding: '8px 12px', borderRadius: '10px',
            border: '1.5px solid var(--border)',
            background: listOpen ? 'var(--accent)' : 'var(--surface)',
            color: listOpen ? '#fff' : 'var(--text)',
            fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          목록
        </button>

        {/* 프로필 / 로그인 */}
        {user ? (
          <Link href={ROUTES.profile} style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, flexShrink: 0,
          }}>
            {profile?.nickname?.[0] ?? '?'}
          </Link>
        ) : (
          <Link href={ROUTES.login} style={{
            padding: '7px 12px', borderRadius: '10px',
            background: 'var(--accent)', color: '#fff',
            fontWeight: 700, fontSize: '12px', flexShrink: 0,
          }}>
            로그인
          </Link>
        )}
      </div>

      {/* 카테고리 필터 */}
      <div style={{
        position: 'absolute', top: '56px', left: 0, right: 0, zIndex: 140,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <CategoryFilter selected={selectedCat} onChange={setSelectedCat} />
      </div>

      {/* 지도 */}
      <div style={{ position: 'absolute', inset: 0, paddingTop: '108px' }}>
        <KakaoMap
          shops={mapShops}
          activeShopId={selectedShop?.id ?? null}
          onSelectShop={handleSelectShop}
          onMapClick={handleMapClick}
        />
      </div>

      {/* 샵 목록 패널 */}
      <ShopListPanel
        shops={filtered}
        loading={loading}
        activeShopId={selectedShop?.id ?? null}
        isOpen={listOpen}
        onToggle={() => setListOpen(false)}
        onSelectShop={handleSelectShop}
      />

      {/* 지도 우측 버튼들 */}
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

      {/* 샵 상세 바텀시트 */}
      <BottomSheet
        isOpen={!!selectedShop}
        onClose={() => setSelectedShop(null)}
      >
        {selectedShop && (
          <ShopDetail shop={selectedShop} onClose={() => setSelectedShop(null)} />
        )}
      </BottomSheet>
    </div>
  )
}