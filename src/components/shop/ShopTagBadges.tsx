'use client'
import { useState, useEffect } from 'react'
import { getShopTags } from '@/services/shopProductService'
import WorkTagBadges from '@/components/work/WorkTagBadges'
import { SectionHeader } from '@/components/tds/SectionHeader'

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
    <div style={{ marginBottom: '24px' }}>
      <SectionHeader title="취급 작품" tone="lavender" icon={<span style={{ fontSize: 18 }}>🎮</span>} />
      <WorkTagBadges works={tags} />
    </div>
  )
}

