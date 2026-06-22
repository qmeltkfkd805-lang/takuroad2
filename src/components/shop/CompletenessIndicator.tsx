'use client'

import { useState, useEffect } from 'react'
import { getShopCompleteness } from '@/services/shopCompletenessService'

interface Props {
  shopId: string
}

export default function CompletenessIndicator({ shopId }: Props) {
  const [data, setData] = useState<{ percent: number; checks: any[] } | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    getShopCompleteness(shopId).then(setData)
  }, [shopId])

  if (!data) return null

  const color = data.percent >= 80 ? 'var(--green)' : data.percent >= 50 ? '#eab308' : 'var(--red)'

  return (
    <div style={{
      border: '1.5px solid var(--border)', borderRadius: '12px',
      padding: '14px', marginBottom: '16px', cursor: 'pointer',
    }} onClick={() => setShowDetail(v => !v)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700 }}>📋 정보 완성도</span>
        <span style={{ fontSize: '16px', fontWeight: 900, color }}>{data.percent}%</span>
      </div>
      <div style={{ height: '8px', background: 'var(--surface2)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${data.percent}%`, background: color, borderRadius: '4px', transition: 'width .3s' }} />
      </div>

      {showDetail && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {data.checks.map((c: any) => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <span style={{ color: c.isComplete ? 'var(--green)' : 'var(--muted)' }}>
                {c.isComplete ? '✔' : '○'}
              </span>
              <span style={{ color: c.isComplete ? 'var(--text)' : 'var(--muted)' }}>{c.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}