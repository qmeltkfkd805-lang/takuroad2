'use client'
import { useState, useEffect } from 'react'
import { getShopHomeItems, ShopHomeItem } from '@/services/shopHomeService'
import { getMyCheckIns } from '@/services/checkInService'
import ShopHomeCard from '@/components/shop/ShopHomeCard'
import { LoadingState, EmptyState } from './SavedShopsTab'
export default function VisitedShopsTab({ userId }: { userId: string }) {
  const [shops, setShops] = useState<ShopHomeItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([getShopHomeItems(), getMyCheckIns(userId)]).then(([all, checkins]) => {
      const order: string[] = []
      const seen = new Set<string>()
      for (const c of (checkins as any[])) {
        if (c.shop_id && !seen.has(c.shop_id)) { seen.add(c.shop_id); order.push(c.shop_id) }
      }
      const byId = new Map(all.map(s => [s.id, s]))
      const visited = order.map(id => byId.get(id)).filter(Boolean) as ShopHomeItem[]
      setShops(visited)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [userId])
  if (loading) return <LoadingState />
  if (shops.length === 0) return <EmptyState icon="pin" text="아직 방문한 샵이 없어요" />
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
      {shops.map(s => <ShopHomeCard key={s.id} shop={s} />)}
    </div>
  )
}