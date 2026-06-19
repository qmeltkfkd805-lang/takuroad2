'use client'

import dynamic from 'next/dynamic'
import { formatDistance } from '@/hooks/useCurrentLocation'

const RouteMap = dynamic(() => import('./RouteMap'), { ssr: false })

interface Props {
  route: any
}

export default function RouteDetailPage({ route }: Props) {
  const sortedShops = (route.route_shops ?? [])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>

      {/* 헤더 */}
      <div style={{
        padding: '16px', borderBottom: '1px solid var(--border)',
      }}>
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

      {/* 통계 */}
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

      {/* 지도 */}
      <div style={{ height: '320px', borderBottom: '1px solid var(--border)' }}>
        <RouteMap shops={sortedShops.map((rs: any) => rs.shops).filter(Boolean)} />
      </div>

      {/* 샵 순서 리스트 */}
      <div style={{ padding: '16px' }}>
        {sortedShops.map((rs: any, i: number) => {
          const shop = rs.shops
          if (!shop) return null
          const catInfo = shop.shop_categories?.[0]?.categories
          return (
            <div key={rs.id}>
              
                href={`/shop/${shop.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
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
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{shop.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{shop.addr}</div>
                  </div>
                </div>
              </a>
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
    </div>
  )
}