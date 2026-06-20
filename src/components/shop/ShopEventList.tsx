'use client'

import { useState, useEffect } from 'react'
import { getActiveShopEvents, EVENT_TYPE_ICON, EVENT_TYPE_LABEL, ShopEventType } from '@/services/shopEventService'

interface Props {
  shopId: string
}

export default function ShopEventList({ shopId }: Props) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getActiveShopEvents(shopId).then(data => {
      setEvents(data)
      setLoading(false)
    })
  }, [shopId])

  if (loading || events.length === 0) return null

  return (
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '12px' }}>🎉 진행중인 소식</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {events.map(event => (
          <div key={event.id} style={{
            padding: '14px', borderRadius: '12px',
            border: event.is_pinned ? '1.5px solid var(--accent)' : '1px solid var(--border)',
            background: event.is_pinned ? 'var(--accent-l)' : 'var(--surface2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '16px' }}>{EVENT_TYPE_ICON[event.type as ShopEventType]}</span>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>{event.title}</span>
              {event.is_pinned && <span style={{ fontSize: '11px' }}>📌</span>}
            </div>
            {event.description && (
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '6px' }}>{event.description}</p>
            )}
            {(event.starts_at || event.ends_at) && (
              <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {event.starts_at ? new Date(event.starts_at).toLocaleDateString('ko-KR') : ''}
                {event.ends_at ? ` ~ ${new Date(event.ends_at).toLocaleDateString('ko-KR')}` : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}