'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { formatDistance } from '@/hooks/useCurrentLocation'

const RouteMap = dynamic(() => import('./RouteMap'), { ssr: false })

interface Props {
  route: any
}

export default function RouteDetailPage({ route }: Props) {
  const [showMapMenu, setShowMapMenu] = useState<any>(null)
  const [showRouteMapMenu, setShowRouteMapMenu] = useState(false)

  const sortedShops = (route.route_shops ?? [])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)

  const shopsWithCoords = sortedShops
    .map((rs: any) => rs.shops)
    .filter((s: any) => s && s.lat && s.lng)

  function openRouteInKakao() {
    if (shopsWithCoords.length === 0) return
    const first = shopsWithCoords[0]
    const dest = shopsWithCoords[shopsWithCoords.length - 1]
    const url = `https://map.kakao.com/link/from/${encodeURIComponent(first.name)},${first.lat},${first.lng}/to/${encodeURIComponent(dest.name)},${dest.lat},${dest.lng}`
    window.open(url, '_blank')
    setShowRouteMapMenu(false)
  }

  function openRouteInGoogle() {
    if (shopsWithCoords.length === 0) return
    const origin = shopsWithCoords[0]
    const destination = shopsWithCoords[shopsWithCoords.length - 1]
    const waypoints = shopsWithCoords.slice(1, -1)

    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin.name)}&destination=${encodeURIComponent(destination.name)}&travelmode=walking`
    if (waypoints.length > 0) {
      const wpStr = waypoints.map((w: any) => encodeURIComponent(w.name)).join('|')
      url += `&waypoints=${wpStr}`
    }
    window.open(url, '_blank')
    setShowRouteMapMenu(false)
  }

  function openSingleShop(shop: any, app: 'kakao' | 'naver' | 'google') {
    if (app === 'kakao') {
      window.open(`https://map.kakao.com/link/to/${encodeURIComponent(shop.name)},${shop.lat},${shop.lng}`, '_blank')
    } else if (app === 'naver') {
      window.open(`https://map.naver.com/p/search/${encodeURIComponent(shop.name)}`, '_blank')
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shop.name + ' ' + (shop.addr ?? ''))}&travelmode=walking`, '_blank')
    }
    setShowMapMenu(null)
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>

      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          fontFamily: "'Cute Font', cursive",
          fontSize: '20px', color: 'var(--accent)', letterSpacing: '2px', marginBottom: '8px',
        }}>
          TAKUROAD
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '6px' }}>{route.title}</h1>
        {route.description && (
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>{route.description}</p>
        )}
        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {route.profiles?.nickname ?? '익명'}님의 루트
        </p>
      </div>

      <div style={{
        display: 'flex', gap: '20px', padding: '14px 16px',
        background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>경유지</div>
          <div style={{ fontSize: '16px', fontWeight: 900 }}>{sortedShops.length}곳</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>총 거리</div>
          <div style={{ fontSize: '16px', fontWeight: 900 }}>{formatDistance(route.total_distance_m)}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>예상 시간</div>
          <div style={{ fontSize: '16px', fontWeight: 900 }}>도보 {route.total_duration_min}분</div>
        </div>
      </div>

      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setShowRouteMapMenu(true)}
          style={{
            width: '100%', padding: '12px', borderRadius: '12px',
            background: 'var(--accent)', color: '#fff', border: 'none',
            fontWeight: 900, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          🗺️ 지도 앱으로 길찾기
        </button>
      </div>

      <div style={{ height: '320px', borderBottom: '1px solid var(--border)' }}>
        <RouteMap shops={shopsWithCoords} />
      </div>

      <div style={{ padding: '16px' }}>
        {sortedShops.map((rs: any, i: number) => {
          const shop = rs.shops
          if (!shop) return null
          const catInfo = shop.shop_categories?.[0]?.categories
          return (
            <div key={rs.id}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px', background: 'var(--surface2)', borderRadius: '12px',
              }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 900, flexShrink: 0,
                }}>{i + 1}</div>
                
                  <a href={`/shop/${shop.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden',
                    background: catInfo?.bg_color ?? 'var(--surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', flexShrink: 0,
                  }}>
                    {shop.shop_images?.[0]?.image_url ? (
                      <img src={shop.shop_images[0].image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      catInfo?.icon ?? '🏪'
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{shop.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.addr}</div>
                  </div>
                </a>
                {shop.lat && shop.lng && (
                  <button
                    onClick={() => setShowMapMenu(shop)}
                    style={{
                      flexShrink: 0, padding: '6px 10px', borderRadius: '8px',
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    🗺️
                  </button>
                )}
              </div>
              {i < sortedShops.length - 1 && (
                <div style={{
                  textAlign: 'center', fontSize: '12px', color: 'var(--muted)',
                  padding: '8px 0',
                }}>
                  ↓ 도보 {sortedShops[i + 1].duration_from_prev_min ?? '?'}분
                  {sortedShops[i + 1].distance_from_prev_m != null &&
                    ` (${formatDistance(sortedShops[i + 1].distance_from_prev_m)})`}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showRouteMapMenu && (
        <RouteMapAppMenu
          onClose={() => setShowRouteMapMenu(false)}
          onKakao={openRouteInKakao}
          onGoogle={openRouteInGoogle}
        />
      )}

      {showMapMenu && (
        <SingleShopMapMenu
          onClose={() => setShowMapMenu(null)}
          onKakao={() => openSingleShop(showMapMenu, 'kakao')}
          onNaver={() => openSingleShop(showMapMenu, 'naver')}
          onGoogle={() => openSingleShop(showMapMenu, 'google')}
          title={showMapMenu.name}
        />
      )}
    </div>
  )
}

// 전체 루트 길찾기 메뉴 (카카오맵, 구글맵만)
function RouteMapAppMenu({ onClose, onKakao, onGoogle }: {
  onClose: () => void
  onKakao: () => void
  onGoogle: () => void
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: '680px', padding: '20px',
        }}
      >
        <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '16px', textAlign: 'center' }}>
          전체 루트 길찾기
        </h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onKakao}
            style={{
              flex: 1, padding: '14px', borderRadius: '12px',
              background: '#FEE500', border: 'none', color: '#191919',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            카카오맵
          </button>
          <button
            onClick={onGoogle}
            style={{
              flex: 1, padding: '14px', borderRadius: '12px',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            구글맵
          </button>
        </div>
      </div>
    </div>
  )
}

// 단일 샵 메뉴 (카카오맵, 네이버맵, 구글맵)
function SingleShopMapMenu({ onClose, onKakao, onNaver, onGoogle, title }: {
  onClose: () => void
  onKakao: () => void
  onNaver: () => void
  onGoogle: () => void
  title: string
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: '680px', padding: '20px',
        }}
      >
        <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '16px', textAlign: 'center' }}>
          {title}
        </h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onKakao}
            style={{
              flex: 1, padding: '14px', borderRadius: '12px',
              background: '#FEE500', border: 'none', color: '#191919',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            카카오맵
          </button>
          <button
            onClick={onNaver}
            style={{
              flex: 1, padding: '14px', borderRadius: '12px',
              background: '#03C75A', border: 'none', color: '#fff',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            네이버맵
          </button>
          <button
            onClick={onGoogle}
            style={{
              flex: 1, padding: '14px', borderRadius: '12px',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            구글맵
          </button>
        </div>
      </div>
    </div>
  )
}