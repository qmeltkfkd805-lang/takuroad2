'use client'
import { useState, useEffect } from 'react'
import { getShopAmenities, CATEGORY_LABEL } from '@/services/shopAmenityService'
import { SectionHeader } from '@/components/tds/SectionHeader'

interface Props {
  shopId: string
}

const CATEGORY_ORDER = ['service', 'facility', 'payment']

// 편의시설 name → 아이콘 파일명. 없으면 기존 이모지 사용.
const AMENITY_ICON: Record<string, string> = {
  '택배': 'parcel',
  '예약': 'calendar',
  '교환': 'exchange',
  '택스프리': 'receipt',
  '와이파이': 'wifi',
  '화장실': 'restroom',
  '엘리베이터': 'elevator',
  '포토존': 'photo',
  '카드': 'card',
  '삼성페이': 'samsungpay',
  '애플페이': 'applepay',
  '계좌이체': 'cash',
  '새상품': 'new',
  '중고': 'secondhand',
  '정가': 'price',
  '프리미엄': 'premium',
  '할인': 'fire',
}

export function iconFor(name: string): string | null {
  // 정확히 일치하거나, name이 키를 포함하면 매칭 (예: "새상품 위주" → "새상품")
  if (AMENITY_ICON[name]) return AMENITY_ICON[name]
  for (const key in AMENITY_ICON) {
    if (name.includes(key)) return AMENITY_ICON[key]
  }
  return null
}

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
      <SectionHeader title="편의시설 / 서비스" tone="gray" icon={<img src="/icons/service.png" alt="" width={22} height={22} />} />
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
                {items.map(item => {
                  const iconName = iconFor(item.name)
                  return (
                    <span key={item.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '7px 13px', borderRadius: '999px',
                      background: 'var(--surface2)', fontSize: '13px', fontWeight: 700,
                      color: 'var(--text)',
                    }}>
                      {iconName
                        ? <img src={`/icons/${iconName}.png`} alt="" width={16} height={16} style={{ display: 'block' }} />
                        : null}
                      {item.name}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

