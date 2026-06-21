'use client'

import { useState, useEffect } from 'react'
import { getShopProductsBySeries, AVAILABILITY_LABEL, Availability } from '@/services/shopProductService'
import ConfirmInfoButton from './ConfirmInfoButton'

interface Props {
  shopId: string
}

const AVAILABILITY_COLOR: Record<Availability, string> = {
  unknown: 'var(--muted)', not_sold: 'var(--muted)', sold_out: 'var(--red)',
  few: '#eab308', normal: 'var(--accent)', many: 'var(--green)',
}

export default function ShopProductAccordion({ shopId }: Props) {
  const [series, setSeries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openTag, setOpenTag] = useState<string | null>(null)

  useEffect(() => {
    getShopProductsBySeries(shopId).then(data => {
      setSeries(data)
      setLoading(false)
      if (data.length > 0) setOpenTag(data[0].tagId)
    })
  }, [shopId])

  if (loading || series.length === 0) return null

  return (
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '12px' }}>🛍️ 작품별 취급 굿즈</h2>
      {series.map(s => {
        const isOpen = openTag === s.tagId
        return (
          <div key={s.tagId} style={{ marginBottom: '8px', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <button
              onClick={() => setOpenTag(isOpen ? null : s.tagId)}
              style={{
                width: '100%', padding: '12px 14px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', background: 'var(--surface2)', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '14px' }}>{s.tagName}</span>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div style={{ padding: '12px 14px' }}>
                {s.goodsList.map((g: any) => (
                  <div key={g.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>
                        {g.characterName ? `${g.characterName} ` : ''}{g.goodsTypeIcon} {g.goodsTypeName}
                        {g.variantName ? ` (${g.variantName})` : ''}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: AVAILABILITY_COLOR[g.availability as Availability] }}>
                        {AVAILABILITY_LABEL[g.availability as Availability]}
                      </span>
                    </div>
                    <ConfirmInfoButton
                      shopId={shopId}
                      targetTable="shop_products"
                      targetField={null}
                      targetId={g.id}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}