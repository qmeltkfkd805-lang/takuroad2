'use client'

import { useState, useEffect } from 'react'
import { getShopTags } from '@/services/shopProductService'

interface Props {
  shopId: string
}

export default function ShopTagBadges({ shopId }: Props) {
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {tags.map(tag => (
          <span key={tag.id} style={{
            padding: '6px 12px', borderRadius: '16px',
            background: 'var(--surface2)', fontSize: '13px', fontWeight: 700,
          }}>
            {tag.name}
          </span>
        ))}
      </div>
    </div>
  )
}