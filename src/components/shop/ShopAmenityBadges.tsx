'use client'
import { useState, useEffect } from 'react'
import { getShopAmenities, CATEGORY_LABEL } from '@/services/shopAmenityService'
import { SectionHeader } from '@/components/tds/SectionHeader'

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
      <SectionHeader title="편의시설 / 서비스" tone="gray" icon={<span style={{ fontSize: 18 }}>🚗</span>} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {CATEGORY_ORDER.map(category => {
          const items = grouped[category]
          if (!items || items.length === 0) return null
          return (
            <div key={category}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, marginBottom: '7px' }}>
                {CATEGORY_LABEL[category]}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                {items.map(item => (
                  <span key={item.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '7px 13px', borderRadius: '999px',
                    background: 'var(--surface2)', fontSize: '13px', fontWeight: 700,
                    color: 'var(--text)',
                  }}>
                    {item.icon} {item.name}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

