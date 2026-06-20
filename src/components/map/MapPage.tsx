'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useShops } from '@/hooks/useShops'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { useNotifications } from '@/hooks/useNotifications'
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
  const { unreadCount } = useNotifications()
  const {
    filtered, mapShops, loading,
    selectedCat, setSelectedCat,
    selectedRegion, setSelectedRegion,
    selectedShop, setSelectedShop,
  } = useShops()

  const { requestLocation } = useCurrentLocation()
  const [listOpen, setListOpen] = useState(false)
  const [groupShops, setGroupShops] = useState<Shop[] | null>(null)

  const handleSelectShop = useCallback((shop: Shop) => {
    setSelectedShop(shop)
    setListOpen(false)
    setGroupShops(null)
  }, [setSelectedShop])

  const handleSelectGroup = useCallback((shops: Shop[]) => {
    setGroupShops(shops)
  }, [])

  const handleMapClick = useCallback(() => {
    setSelectedShop(null)
  }, [setSelectedShop])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)' }}>

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 150,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <div style={{
          fontFamily: "'Cute Font', cursive",
          fontSize: '22px', color: 'var(--accent)',
          letterSpacing: '2px', flexShrink: 0,
        }}>
          TAKUROAD
        </div>

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

        {user && (
          <Link href="/notifications" style={{
            position: 'relative', width: '32px', height: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0,
          }}>
            🔔
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '0', right: '0',
                minWidth: '15px', height: '15px', borderRadius: '8px',
                background: 'var(--red)', color: '#fff',
                fontSize: '9px', fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        )}

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

      <div style={{
        position: 'absolute', top: '56px', left: 0, right: 0, zIndex: 140,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <CategoryFilter selected={selectedCat} onChange={setSelectedCat} />
      </div>

      <div style={{ position: 'absolute', inset: 0, paddingTop: '108px' }}>
        <KakaoMap
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
  )
}