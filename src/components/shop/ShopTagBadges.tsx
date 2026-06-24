'use client'

import { useState, useEffect } from 'react'
import { getShopTags } from '@/services/shopProductService'
import WorkTagBadges from '@/components/work/WorkTagBadges'

export default function ShopTagBadges({ shopId }: { shopId: string }) {
  const [tags, setTags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getShopTags(shopId).then(data => {
      setTags(data)
      setLoading(false)
    })
  }, [shopId])

  if (loading || tags.length === 0) return null

  return (
    <div style={{ marginBottom: '20px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '10px' }}>🎮 취급 작품</h2>
      <WorkTagBadges works={tags} />
    </div>
  )
}