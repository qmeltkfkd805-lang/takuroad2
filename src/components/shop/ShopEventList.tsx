'use client'
import { useState, useEffect } from 'react'
import { getActiveShopEvents, EVENT_TYPE_ICON, ShopEventType } from '@/services/shopEventService'
import { SectionHeader } from '@/components/tds/SectionHeader'
import { getEventsByShop, WORK_EVENT_ICON } from '@/services/eventService'

interface Props {
  shopId: string
}

interface TimelineItem {
  id: string
  source: 'shop' | 'work'
  icon: string
  title: string
  description: string | null
  imageUrl: string | null
  dateText: string | null
  isPinned: boolean
  sortKey: string
}

function fmtDate(s: string | null): string {
  if (!s) return ''
  return new Date(s).toLocaleDateString('ko-KR')
}
function fmtRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null
  if (start && end) return `${fmtDate(start)} ~ ${fmtDate(end)}`
  return fmtDate(start ?? end)
}

export default function ShopEventList({ shopId }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TimelineItem | null>(null)

  useEffect(() => {
    Promise.all([
      getActiveShopEvents(shopId),
      getEventsByShop(shopId),
    ]).then(([shopEvents, workEvents]) => {
      const shopItems: TimelineItem[] = shopEvents.map((e: any) => ({
        id: `shop-${e.id}`,
        source: 'shop',
        icon: EVENT_TYPE_ICON[e.type as ShopEventType] ?? '📌',
        title: e.title,
        description: e.description ?? null,
        imageUrl: e.image_url ?? null,
        dateText: fmtRange(e.starts_at ?? null, e.ends_at ?? null),
        isPinned: !!e.is_pinned,
        sortKey: (e.starts_at ?? e.created_at ?? '').slice(0, 10),
      }))

      const workItems: TimelineItem[] = workEvents.map(e => ({
        id: `work-${e.id}`,
        source: 'work',
        icon: WORK_EVENT_ICON[e.type] ?? '🎯',
        title: e.title ?? '',
        description: null,
        imageUrl: null,
        dateText: fmtRange(e.startDate, e.endDate),
        isPinned: false,
        sortKey: (e.startDate ?? e.createdAt ?? '').slice(0, 10),
      }))

      const merged = [...shopItems, ...workItems].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return b.sortKey.localeCompare(a.sortKey)
      })

      setItems(merged)
      setLoading(false)
    })
  }, [shopId])

  if (loading || items.length === 0) return null

  return (
    <div style={{ marginBottom: '24px' }}>
      <SectionHeader title="진행중인 소식" tone="coral" icon={<span style={{ fontSize: 18 }}>🎉</span>} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map(item => (
          <div
            key={item.id}
            onClick={() => setSelected(item)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px', borderRadius: '14px', cursor: 'pointer',
              border: item.isPinned ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: item.isPinned ? '#FFEDE6' : 'var(--surface)',
              transition: 'transform .1s',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(.99)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
              background: item.isPinned ? '#fff' : 'var(--surface2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
            }}>
              {item.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <span style={{ fontWeight: 800, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                {item.isPinned && (
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--accent)', background: '#fff', border: '1px solid var(--accent)', borderRadius: '6px', padding: '1px 5px', flexShrink: 0 }}>고정</span>
                )}
              </div>
              {item.dateText && (
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>{item.dateText}</p>
              )}
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>
          </div>
        ))}
      </div>

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px' }}>{selected.icon}</span>
                <span style={{ fontWeight: 900, fontSize: '17px' }}>{selected.title}</span>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}
              >✕</button>
            </div>

            {selected.imageUrl && (
              <img
                src={selected.imageUrl}
                alt=""
                style={{
                  width: '100%', maxHeight: '400px', objectFit: 'contain',
                  borderRadius: '12px', marginBottom: '14px', background: 'var(--surface2)',
                }}
              />
            )}

            {selected.description && (
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text)', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
                {selected.description}
              </p>
            )}

            {selected.dateText && (
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{selected.dateText}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

