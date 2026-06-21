'use client'

import { useState, useEffect } from 'react'
import { getShopAmenities, CATEGORY_LABEL } from '@/services/shopAmenityService'

interface Props {
  shopId: string
}

const CATEGORY_ORDER = ['service', 'facility', 'payment', 'sales_style']

export default function ShopAmenityBadges({ shopId }: Props) {
  const [grouped, setGrouped] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getShopAmenities(shopId).then(data => {
      setGrouped(data)
      setLoading(false)
    })
  }, [shopId])

  const hasAny = Object.values(grouped).some(arr => arr.length > 0)
  if (loading || !hasAny) return null

  return (
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '12px' }}>🚗 편의시설 / 서비스</h2>
      {CATEGORY_ORDER.map(category => {
        const items = grouped[category]
        if (!items || items.length === 0) return null
        return (
          <div key={category} style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
              {CATEGORY_LABEL[category]}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {items.map(item => (
                <span key={item.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '5px 10px', borderRadius: '14px',
                  background: 'var(--surface2)', fontSize: '12px', fontWeight: 700,
                }}>
                  {item.icon} {item.name}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}