'use client'

import { Shop } from '@/types/shop'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import { formatDistance } from '@/hooks/useCurrentLocation'

interface ShopCardProps {
  shop: Shop
  isActive: boolean
  onClick: (shop: Shop) => void
}

export default function ShopCard({ shop, isActive, onClick }: ShopCardProps) {
  const catInfo = CATEGORY_NAME_MAP[shop.cat]
  const color = catInfo?.color ?? '#e8006f'
  const bgColor = catInfo?.bgColor ?? 'rgba(232,0,111,.12)'

  return (
    <div
      onClick={() => onClick(shop)}
      style={{
        display: 'flex',
        gap: '12px',
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        background: isActive ? 'var(--surface2)' : 'var(--surface)',
        borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
        transition: 'background .15s',
      }}
    >
      {/* 썸네일 */}
      <div style={{
        width: '52px',
        height: '52px',
        borderRadius: '12px',
        overflow: 'hidden',
        flexShrink: 0,
        background: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '22px',
      }}>
        {shop.images[0] ? (
          <img
            src={shop.images[0]}
            alt={shop.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          catInfo?.icon ?? '🏪'
        )}
      </div>

      {/* 정보 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          <span style={{
            fontSize: '14px',
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {shop.name}
          </span>
          {shop.is_verified && (
            <span style={{ fontSize: '12px', color: 'var(--cyan)' }}>✓</span>
          )}
        </div>

        {/* 주소 */}
        <div style={{
          fontSize: '12px',
          color: 'var(--muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: '6px',
        }}>
          📍 {shop.addr ?? '주소 정보 없음'}
          {shop.distance !== undefined && (
            <span style={{ marginLeft: '6px', color: 'var(--accent)', fontWeight: 700 }}>
              {formatDistance(shop.distance)}
            </span>
          )}
        </div>

        {/* 카테고리 태그 */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {shop.cats.slice(0, 2).map(cat => {
            const ci = CATEGORY_NAME_MAP[cat]
            return (
              <span
                key={cat}
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: ci?.bgColor ?? bgColor,
                  color: ci?.color ?? color,
                  border: `1px solid ${(ci?.color ?? color)}40`,
                  fontWeight: 700,
                }}
              >
                {cat}
              </span>
            )
          })}
          {shop.rating_count > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--muted)', alignSelf: 'center' }}>
              ★ {shop.rating_avg.toFixed(1)} ({shop.rating_count})
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
