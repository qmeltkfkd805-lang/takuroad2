'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getMyShops } from '@/services/shopService'
import { Shop } from '@/types/shop'
import { ROUTES } from '@/lib/constants/routes'
import { SHOP_STATUS_LABEL } from '@/lib/constants/categories'
import { LoadingState, EmptyState } from './SavedShopsTab'

export default function MyShopsTab({ userId }: { userId: string }) {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyShops(userId).then(data => {
      setShops(data)
      setLoading(false)
    })
  }, [userId])

  if (loading) return <LoadingState />
  if (shops.length === 0) return <EmptyState icon="🏪" text="등록한 샵이 없어요" />

  const statusColor: Record<string, string> = {
    pending: 'var(--yellow)',
    active: 'var(--green)',
    hidden: 'var(--muted)',
    closed: 'var(--red)',
    temporary_closed: 'var(--yellow)',
  }

  return (
    <div>
      {shops.map(shop => (
        <Link key={shop.id} href={ROUTES.shop(shop.slug)} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{shop.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{shop.addr || '주소 없음'}</div>
            </div>
            <span style={{
              fontSize: '11px', fontWeight: 700,
              color: statusColor[shop.status] ?? 'var(--muted)',
              border: `1px solid ${statusColor[shop.status] ?? 'var(--border)'}`,
              borderRadius: '6px', padding: '3px 8px', flexShrink: 0,
            }}>
              {SHOP_STATUS_LABEL[shop.status] ?? shop.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}