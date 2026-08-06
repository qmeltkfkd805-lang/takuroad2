'use client'
import { CSSProperties } from 'react'
import { Shop } from '@/types/shop'
import { formatDistance } from '@/hooks/useCurrentLocation'
import { Icon } from './Icon'
import { StatusBadge } from './StatusBadge'
import { Chip } from './Chip'

type ChipTone = 'coral' | 'lavender' | 'mint' | 'blue' | 'yellow' | 'gray'

const CAT_TONE: Record<string, ChipTone> = {
  '굿즈샵': 'coral', '서점': 'blue', '카드/TCG': 'yellow', '중고샵': 'mint',
  '콜라보카페': 'coral', '팝업스토어': 'blue', '게임샵': 'lavender',
  '온라인샵': 'mint', '가챠/쿠지': 'coral', '전시': 'lavender',
}

const BADGE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  recommend: { bg: '#E1F7F2', fg: '#0E7A63', label: '추천' },
  new:       { bg: '#FFEDE6', fg: '#A23E18', label: 'NEW' },
  hot:       { bg: '#FFE3E3', fg: '#C0392B', label: 'HOT' },
}

interface ShopCardProps {
  shop: Shop
  meta?: 'region' | 'distance'
  badge?: 'recommend' | 'new' | 'hot'
  onClick?: (shop: Shop) => void
  onToggleSave?: (shop: Shop) => void
  style?: CSSProperties
}

export function ShopCard({ shop, meta = 'region', badge, onClick, onToggleSave, style }: ShopCardProps) {
  const region = shop.district ?? shop.city ?? shop.region ?? ''
  const showDistance = meta === 'distance' && shop.distance != null
  const cover = shop.eventCover ?? shop.images?.[0]   // 이벤트 중이면 포스터 우선
  const b = badge ? BADGE_STYLE[badge] : null

  return (
    <div
      onClick={() => onClick?.(shop)}
      style={{
        width: '100%',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,.04)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div style={{ position: 'relative', height: 120, background: '#F7F7F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {cover ? (
          <img src={cover} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Icon name="shop" size={40} style={{ opacity: 0.4 }} />
        )}
        {b && (
          <span style={{ position: 'absolute', top: 10, left: 10, background: b.bg, color: b.fg, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>{b.label}</span>
        )}
        {shop.hasEvent && !b && (
          <span style={{ position: 'absolute', top: 10, left: 10, background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6 }}>이벤트</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSave?.(shop) }}
          style={{ position: 'absolute', top: 9, right: 9, width: 30, height: 30, borderRadius: 9999, background: 'rgba(255,255,255,.92)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          aria-label="저장"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill={(shop as any).isSaved ? 'var(--accent)' : 'none'} stroke={(shop as any).isSaved ? 'var(--accent)' : '#9B968D'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
        </button>
      </div>

      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.name}</span>
          {shop.is_verified && (
            <span style={{ width: 16, height: 16, borderRadius: 9999, background: 'var(--cyan)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
            </span>
          )}
        </div>

        <StatusBadge shop={shop} style={{ marginBottom: 6 }} />

        {shop.rating_count > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--muted)', marginBottom: region ? 5 : 9 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#F5B100" stroke="none"><path d="M12 4.5 14.2 9l5 .7-3.6 3.5.9 5-4.5-2.4L7.4 18l.9-5L4.7 9.7l5-.7z" /></svg>
            <span style={{ color: 'var(--text)', fontWeight: 700 }}>{shop.rating_avg.toFixed(1)}</span>
            <span>({shop.rating_count})</span>
          </div>
        )}

        {region && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c-4.5-5.5-6.6-9.4-6.6-12.5a6.6 6.6 0 0 1 13.2 0c0 3.1-2.1 7-6.6 12.5z" /><circle cx="12" cy="8.5" r="2.3" /></svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{region}</span>
            {showDistance && (
              <>
                <span style={{ color: '#D5D0C6' }}>·</span>
                <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>{formatDistance(shop.distance!)}</span>
              </>
            )}
          </div>
        )}

        {shop.cats?.length > 0 && (
          <div className="shopcard-cats" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {shop.cats.slice(0, 2).map((c) => (
              <Chip key={c} tone={CAT_TONE[c] ?? 'gray'}>{c}</Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
