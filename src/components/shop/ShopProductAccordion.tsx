'use client'
import { useState, useEffect } from 'react'
import { getShopProductsBySeries } from '@/services/shopProductService'
import ConfirmInfoButton from './ConfirmInfoButton'
import { StockBadge } from './StockBadge'
import { SectionHeader } from '@/components/tds/SectionHeader'

interface Props {
  shopId: string
}

export default function ShopProductAccordion({ shopId }: Props) {
  const [series, setSeries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openTag, setOpenTag] = useState<string | null>(null)
  useEffect(() => {
    getShopProductsBySeries(shopId).then(data => {
      const filtered = data.filter((s: any) =>
        s.goodsList.some((g: any) => g.availability !== 'unknown')
      )
      setSeries(filtered)
      setLoading(false)
      if (filtered.length > 0) setOpenTag(filtered[0].tagId)
    })
  }, [shopId])
  if (loading || series.length === 0) return null
  return (
    <div style={{ marginBottom: '24px' }}>
      <SectionHeader title="작품별 취급 굿즈" tone="mint" icon={<img src="/icons/goods.png" alt="" width={22} height={22} />} />
      {series.map(s => {
        const isOpen = openTag === s.tagId
        return (
          <div key={s.tagId} style={{ marginBottom: '8px', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
            <button
              onClick={() => setOpenTag(isOpen ? null : s.tagId)}
              style={{
                width: '100%', padding: '14px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', background: isOpen ? 'var(--surface2)' : 'var(--surface)',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontWeight: 800, fontSize: '14px' }}>{s.tagName}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {isOpen && (
              <div style={{ padding: '4px 14px 10px' }}>
                {s.goodsList.filter((g: any) => g.availability !== 'unknown').map((g: any) => (
                  <div key={g.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>
                        {g.characterName ? `${g.characterName} ` : ''}{g.goodsTypeIcon} {g.goodsTypeName}
                        {g.variantName ? ` (${g.variantName})` : ''}
                      </span>
                      <StockBadge availability={g.availability} />
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      <ConfirmInfoButton
                        shopId={shopId}
                        targetTable="shop_products"
                        targetField={null}
                        targetId={g.id}
                      />
                    </div>
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
