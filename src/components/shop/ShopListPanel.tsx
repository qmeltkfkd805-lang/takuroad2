'use client'

import { Shop } from '@/types/shop'
import ShopCard from './ShopCard'
import AppIcon from '@/components/tds/AppIcon'

interface ShopListPanelProps {
  shops: Shop[]
  loading: boolean
  activeShopId: string | null
  isOpen: boolean
  onToggle: () => void
  onSelectShop: (shop: Shop) => void
}

export default function ShopListPanel({
  shops,
  loading,
  activeShopId,
  isOpen,
  onToggle,
  onSelectShop,
}: ShopListPanelProps) {
  return (
    <div style={{
      position: 'absolute',
      left: 0, top: '108px', bottom: 0,
      width: isOpen ? '320px' : '0',
      background: 'var(--surface)',
      boxShadow: isOpen ? 'var(--sh-md)' : 'none',
      zIndex: 100,
      transition: 'width .3s ease',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontWeight: 900, fontSize: '15px' }}>
          성지 목록
          <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '13px', marginLeft: '6px' }}>
            {loading ? '로딩 중...' : `${shops.length}개`}
          </span>
        </div>
        <button
          onClick={onToggle}
          style={{
            background: 'none', border: 'none',
            fontSize: '18px', cursor: 'pointer', color: 'var(--muted)',
            padding: '4px',
          }}
        >
          ✕
        </button>
      </div>

      {/* 목록 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
            불러오는 중...
          </div>
        ) : shops.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <AppIcon name="map" size={40} color="var(--muted)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>이 조건에 맞는 성지가 없어요.</p>
          </div>
        ) : (
          shops.map(shop => (
            <ShopCard
              key={shop.id}
              shop={shop}
              isActive={shop.id === activeShopId}
              onClick={onSelectShop}
            />
          ))
        )}
      </div>
    </div>
  )
}