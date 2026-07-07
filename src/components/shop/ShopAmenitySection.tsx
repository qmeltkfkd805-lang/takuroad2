'use client'

import { useState, useEffect } from 'react'
import { getAllAmenities, getShopAmenityIds, updateShopAmenities, CATEGORY_LABEL } from '@/services/shopAmenityService'
import { iconFor } from './ShopAmenityBadges'

interface Props {
  shopId: string
}

const CATEGORY_ORDER = ['highlight', 'service', 'facility', 'payment']

export default function ShopAmenitySection({ shopId }: Props) {
  const [grouped, setGrouped] = useState<Record<string, any[]>>({})
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadAll()
  }, [shopId])

  async function loadAll() {
    const [all, mine] = await Promise.all([
      getAllAmenities(),
      getShopAmenityIds(shopId),
    ])
    setGrouped(all)
    setSelectedIds(mine)
    setLoading(false)
  }

  function toggle(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    setSaving(true)
    await updateShopAmenities(shopId, selectedIds)
    setSaving(false)
  }

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  }

  return (
    <div>
      {CATEGORY_ORDER.map(category => {
        const items = grouped[category]
        if (!items || items.length === 0) return null

        return (
          <div key={category} style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px' }}>
              {CATEGORY_LABEL[category]}
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {items.map(item => {
                const selected = selectedIds.includes(item.id)
                const iconName = iconFor(item.name)
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '7px 12px', borderRadius: '18px', cursor: 'pointer',
                      border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                      background: selected ? 'var(--accent-l)' : 'var(--surface)',
                      color: selected ? 'var(--accent)' : 'var(--text)',
                      fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                    }}
                  >
                    {iconName && <img src={`/icons/${iconName}.png`} alt="" width={15} height={15} style={{ display: 'block' }} />}
                    <span>{item.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
          background: 'var(--accent)', color: '#fff', fontWeight: 700,
          fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', marginTop: '8px',
        }}
      >
        {saving ? '저장 중...' : '편의시설 저장'}
      </button>
    </div>
  )
}