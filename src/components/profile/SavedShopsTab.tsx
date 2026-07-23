'use client'
import { useState, useEffect } from 'react'
import { getShopHomeItems, ShopHomeItem } from '@/services/shopHomeService'
import { getSavedShops } from '@/services/shopService'
import ShopHomeCard from '@/components/shop/ShopHomeCard'
import AppIcon from '@/components/tds/AppIcon'

export default function SavedShopsTab({ userId }: { userId: string }) {
  const [shops, setShops] = useState<ShopHomeItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getShopHomeItems(), getSavedShops(userId)]).then(([all, saved]) => {
      const byId = new Map(all.map(s => [s.id, s]))
      const items = (saved as any[])
        .map(s => byId.get(s.id))
        .filter(Boolean) as ShopHomeItem[]
      setShops(items)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [userId])

  if (loading) return <LoadingState />
  if (shops.length === 0) return <EmptyState icon="bookmark" text="저장한 샵이 없어요" />

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
      {shops.map(s => <ShopHomeCard key={s.id} shop={s} />)}
    </div>
  )
}

export function LoadingState() {
  return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>불러오는 중...</div>
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <AppIcon name={icon} size={40} color="var(--muted)" style={{ margin: '0 auto 12px' }} />
      <p style={{ color: 'var(--muted)', fontSize: '14px' }}>{text}</p>
    </div>
  )
}