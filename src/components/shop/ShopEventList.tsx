'use client'

import { useState, useEffect } from 'react'
import { getActiveShopEvents, EVENT_TYPE_ICON, EVENT_TYPE_LABEL, ShopEventType } from '@/services/shopEventService'

interface Props {
  shopId: string
}

export default function ShopEventList({ shopId }: Props) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)

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
          <div
            key={event.id}
            onClick={() => setSelected(event)}
            style={{
              padding: '14px', borderRadius: '12px', cursor: 'pointer',
              border: event.is_pinned ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: event.is_pinned ? 'var(--accent-l)' : 'var(--surface2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '16px' }}>{EVENT_TYPE_ICON[event.type as ShopEventType]}</span>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>{event.title}</span>
              {event.is_pinned && <span style={{ fontSize: '11px' }}>📌</span>}
              {event.image_url && <span style={{ fontSize: '12px', marginLeft: 'auto' }}>📷</span>}
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

      {/* 상세 모달 */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,.6)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: '20px 20px 0 0',
              width: '100%', maxWidth: '680px', maxHeight: '85vh', overflowY: 'auto',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '18px' }}>{EVENT_TYPE_ICON[selected.type as ShopEventType]}</span>
                <span style={{ fontWeight: 900, fontSize: '16px' }}>{selected.title}</span>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--muted)' }}
              >✕</button>
            </div>

            {selected.image_url && (
              <img
                src={selected.image_url}
                alt=""
                style={{
                  width: '100%', maxHeight: '400px', objectFit: 'contain',
                  borderRadius: '12px', marginBottom: '14px', background: 'var(--surface2)',
                }}
              />
            )}

            {selected.description && (
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text)', marginBottom: '12px' }}>
                {selected.description}
              </p>
            )}

            {(selected.starts_at || selected.ends_at) && (
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                {selected.starts_at ? new Date(selected.starts_at).toLocaleDateString('ko-KR') : ''}
                {selected.ends_at ? ` ~ ${new Date(selected.ends_at).toLocaleDateString('ko-KR')}` : ''}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}