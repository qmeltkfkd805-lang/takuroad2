'use client'

import { Shop } from '@/types/shop'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import { getTodayStatus, getPopupStatus } from '@/lib/utils/date'
import { useAuth } from '@/components/layout/AuthProvider'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'

interface ShopDetailProps {
  shop: Shop
  onClose: () => void
}

export default function ShopDetail({ shop, onClose }: ShopDetailProps) {
  const { user } = useAuth()
  const catInfo = CATEGORY_NAME_MAP[shop.cat]
  const color = catInfo?.color ?? '#e8006f'
  const todayStatus = getTodayStatus(shop.hours)
  const popupStatus = getPopupStatus(shop.start_date, shop.end_date)

  return (
    <div style={{ padding: '16px 20px 32px' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
        {/* 썸네일 */}
        <div style={{
          width: '56px', height: '56px',
          borderRadius: '14px', overflow: 'hidden', flexShrink: 0,
          background: catInfo?.bgColor ?? 'rgba(232,0,111,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px',
        }}>
          {shop.images[0]
            ? <img src={shop.images[0]} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : catInfo?.icon ?? '🏪'
          }
        </div>

        {/* 이름 + 카테고리 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 900, lineHeight: 1.3 }}>{shop.name}</h2>
            {shop.is_verified && (
              <span style={{ fontSize: '13px', color: 'var(--cyan)', fontWeight: 700 }}>✓인증</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '5px' }}>
            {shop.cats.map(cat => {
              const ci = CATEGORY_NAME_MAP[cat]
              return (
                <span key={cat} style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                  background: ci?.bgColor ?? 'rgba(232,0,111,.12)',
                  color: ci?.color ?? color,
                  border: `1px solid ${(ci?.color ?? color)}40`, fontWeight: 700,
                }}>{cat}</span>
              )
            })}
          </div>
        </div>
      </div>

      {/* 별점 */}
      {shop.rating_count > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <span style={{ color: '#f59e0b', fontSize: '14px' }}>
            {'★'.repeat(Math.round(shop.rating_avg))}{'☆'.repeat(5 - Math.round(shop.rating_avg))}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>{shop.rating_avg.toFixed(1)}</span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>({shop.rating_count}개 리뷰)</span>
        </div>
      )}

      {/* 팝업 상태 */}
      {popupStatus.status && (
        <div style={{
          padding: '8px 12px', borderRadius: '8px', marginBottom: '12px',
          background: 'var(--surface2)', fontSize: '13px', fontWeight: 700,
        }}>
          {popupStatus.emoji} 팝업 {popupStatus.label}
          {shop.start_date && shop.end_date && (
            <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: '8px' }}>
              {shop.start_date} ~ {shop.end_date}
            </span>
          )}
        </div>
      )}

      {/* 주소 */}
      {shop.addr && (
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px', display: 'flex', gap: '6px' }}>
          <span>📍</span>
          <span>{shop.addr}</span>
        </div>
      )}

      {/* 영업시간 */}
      {shop.hours && (
        <div style={{ fontSize: '13px', marginBottom: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span>🕐</span>
          <span style={{ color: todayStatus.isOpen ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
            {todayStatus.label}
          </span>
          {todayStatus.todayHours && (
            <span style={{ color: 'var(--muted)' }}>{todayStatus.todayHours}</span>
          )}
        </div>
      )}

      {/* 주차 */}
      {shop.parking !== null && (
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px', display: 'flex', gap: '6px' }}>
          <span>🅿️</span>
          <span>
            {shop.parking ? '주차 가능' : '주차 불가'}
            {shop.parking_note && ` · ${shop.parking_note}`}
          </span>
        </div>
      )}

      {/* 설명 */}
      {shop.description && (
        <p style={{
          fontSize: '13px', color: 'var(--text)', lineHeight: 1.7,
          background: 'var(--surface2)', borderRadius: '10px',
          padding: '10px 12px', marginBottom: '16px',
        }}>
          {shop.description}
        </p>
      )}

      {/* 액션 버튼 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Link
          href={ROUTES.shop(shop.slug)}
          style={{
            flex: 1, padding: '10px', borderRadius: '10px',
            background: color, color: '#fff',
            fontWeight: 700, fontSize: '13px', textAlign: 'center',
            border: 'none', cursor: 'pointer', textDecoration: 'none',
          }}
        >
          상세 보기
        </Link>

        {shop.shop_link && (
          <a
            href={shop.shop_link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 16px', borderRadius: '10px',
              border: '1.5px solid var(--border)',
              fontWeight: 700, fontSize: '13px', color: 'var(--text)',
            }}
          >
            🔗 링크
          </a>
        )}

        {shop.addr && (
          <a
            href={`https://map.kakao.com/link/search/${encodeURIComponent(shop.addr)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 16px', borderRadius: '10px',
              border: '1.5px solid var(--border)',
              fontWeight: 700, fontSize: '13px', color: 'var(--text)',
            }}
          >
            🗺️ 길찾기
          </a>
        )}
      </div>
    </div>
  )
}
