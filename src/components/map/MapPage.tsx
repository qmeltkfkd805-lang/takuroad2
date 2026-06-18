'use client'

import { useState, useCallback } from 'react'
import { env } from '@/lib/env'
import { useShops } from '@/hooks/useShops'
import { useSearch } from '@/hooks/useSearch'
import { useCurrentLocation, formatDistance } from '@/hooks/useCurrentLocation'
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
  const { user, profile } = useAuth()
  const {
    filtered, mapShops, regions, loading,
    selectedCat, setSelectedCat,
    selectedRegion, setSelectedRegion,
    selectedShop, setSelectedShop,
  } = useShops()

  const { query, setQuery, results, isOpen: searchOpen, setIsOpen: setSearchOpen, clearSearch } = useSearch(filtered)
  const { location, requestLocation } = useCurrentLocation()
  const [listOpen, setListOpen] = useState(false)

  const handleSelectShop = useCallback((shop: Shop) => {
    setSelectedShop(shop)
    setListOpen(false)
    clearSearch()
  }, [setSelectedShop, clearSearch])

  const handleMapClick = useCallback(() => {
    setSelectedShop(null)
  }, [setSelectedShop])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg) ' }}>

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

        {/* 검색창 */}
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => query && setSearchOpen(true)}
            placeholder="샵 이름, 지역 검색..."
            style={{
              width: '100%', padding: '8px 12px',
              border: '1.5px solid var(--border)', borderRadius: '10px',
              fontSize: '13px', fontFamily: 'inherit',
              background: 'var(--surface2)', color: 'var(--text)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          {query && (
            <button
              onClick={clearSearch}
              style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: '14px',
              }}
            >✕</button>
          )}

          {/* 검색 드롭다운 */}
          {searchOpen && results.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: 'var(--surface)', border: '1.5px solid var(--border)',
              borderRadius: '10px', boxShadow: 'var(--sh-md)', zIndex: 200,
              overflow: 'hidden',
            }}>
              {results.map(shop => (
                <div
                  key={shop.id}
                  onClick={() => handleSelectShop(shop)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', fontSize: '13px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{shop.name}</span>
                  <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>{shop.addr}</span>
                </div>
              ))}
            </div>
          )}
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
        {/* 현재 위치 */}
        <button
          onClick={requestLocation}
          title="현재 위치"
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'var(--surface)', border: '1.5px solid var(--border)',
            boxShadow: 'var(--sh-sm)', cursor: 'pointer', fontSize: '18px',
          }}
        >📍</button>

        {/* 샵 등록 */}
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
