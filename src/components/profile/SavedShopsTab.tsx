'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSavedShops } from '@/services/shopService'
import { Shop } from '@/types/shop'
import { ROUTES } from '@/lib/constants/routes'
import ShopCard from '@/components/shop/ShopCard'

export default function SavedShopsTab({ userId }: { userId: string }) {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSavedShops(userId).then(data => {
      setShops(data)
      setLoading(false)
    })
  }, [userId])

  if (loading) return <LoadingState />
  if (shops.length === 0) return <EmptyState icon="🔖" text="저장한 샵이 없어요" />

  return (
    <div>
      {shops.map(shop => (
        <Link key={shop.id} href={ROUTES.shop(shop.slug)} style={{ textDecoration: 'none', color: 'inherit' }}>
          <ShopCard shop={shop} isActive={false} onClick={() => {}} />
        </Link>
      ))}
    </div>
  )
}

export function LoadingState() {
  return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>불러오는 중...</div>
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>{icon}</div>
      <p style={{ color: 'var(--muted)', fontSize: '14px' }}>{text}</p>
    </div>
  )
}