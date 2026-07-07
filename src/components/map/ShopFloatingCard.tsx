'use client'

import Link from 'next/link'
import { Shop } from '@/types/shop'
import { ROUTES } from '@/lib/constants/routes'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import { getTodayStatus } from '@/lib/utils/date'
import { formatDistance } from '@/hooks/useCurrentLocation'

interface ShopFloatingCardProps {
  shop: Shop
  onClose: () => void
  onToggleSave?: (shop: Shop) => void
}

export default function ShopFloatingCard({ shop, onClose, onToggleSave }: ShopFloatingCardProps) {
  const catInfo = CATEGORY_NAME_MAP[shop.cat]
  const cover = shop.images?.[0]
  const today = getTodayStatus(shop.hours)
  const showDistance = shop.distance != null

  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 16,
        zIndex: 135,
        animation: 'shopCardUp .22s cubic-bezier(.32,.72,0,1)',
      }}
    >
      <style>{`
        @keyframes shopCardUp {
          from { transform: translateY(14px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <Link
        href={ROUTES.shop(shop.slug)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 8px 28px rgba(0,0,0,.16)',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        {/* 썸네일 */}
        <div style={{
          width: 64, height: 64, borderRadius: 14, overflow: 'hidden', flexShrink: 0,
          background: catInfo?.bgColor ?? 'rgba(232,0,111,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>
          {cover
            ? <img src={cover} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (catInfo?.icon ? <CatIcon name={catInfo.icon} color={catInfo.color ?? '#e8006f'} size={30} /> : '🏪')}
        </div>

        {/* 이름 + 거리·평점 + 영업시간 + 자세히 보기 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <span style={{
              fontSize: 15, fontWeight: 800, lineHeight: 1.25,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{shop.name}</span>
            {shop.is_verified && (
              <span style={{
                width: 15, height: 15, borderRadius: 9999, background: 'var(--cyan)', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
              </span>
            )}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            fontSize: 12.5, color: 'var(--muted)', marginBottom: 4,
          }}>
            {showDistance && (
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatDistance(shop.distance!)}</span>
            )}
            {shop.rating_count > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#F5B100" stroke="none"><path d="M12 4.5 14.2 9l5 .7-3.6 3.5.9 5-4.5-2.4L7.4 18l.9-5L4.7 9.7l5-.7z" /></svg>
                <span style={{ color: 'var(--text)', fontWeight: 700 }}>{shop.rating_avg.toFixed(1)}</span>
              </span>
            )}
          </div>

          {today.todayHours && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--muted)', marginBottom: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              <span style={{ whiteSpace: 'nowrap' }}>{today.todayHours}</span>
            </div>
          )}

          {/* 자세히 보기 — 카드 전체가 상세 페이지로 이동 */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            fontSize: 12.5, fontWeight: 800, color: 'var(--accent)',
          }}>
            <span>자세히 보기</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </div>
        </div>

        {/* 오른쪽: 닫기 + 하트 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}
            aria-label="닫기"
            style={{
              width: 26, height: 26, borderRadius: 9999, border: 'none', cursor: 'pointer', padding: 0,
              background: 'transparent', color: 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave?.(shop) }}
            aria-label="저장"
            style={{
              width: 34, height: 34, borderRadius: 9999, border: 'none', cursor: 'pointer', padding: 0,
              background: 'var(--surface2, rgba(0,0,0,.04))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"
              fill={shop.isSaved ? 'var(--accent)' : 'none'}
              stroke={shop.isSaved ? 'var(--accent)' : '#9B968D'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
          </button>
        </div>
      </Link>
    </div>
  )
}

function CatIcon({ name, color, size = 18 }: { name: string; color: string; size?: number }) {
  return (
    <span style={{
      width: size, height: size, display: 'inline-block', flexShrink: 0,
      backgroundColor: color,
      WebkitMaskImage: `url(/icons/${name}.png)`, maskImage: `url(/icons/${name}.png)`,
      WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
      WebkitMaskSize: 'contain', maskSize: 'contain',
      WebkitMaskPosition: 'center', maskPosition: 'center',
    }} />
  )
}
