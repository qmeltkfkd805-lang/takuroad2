'use client'

import { useState, useEffect } from 'react'
import { getActiveShopEvents, EVENT_TYPE_ICON, ShopEventType } from '@/services/shopEventService'
import { getEventsByShop, WORK_EVENT_ICON } from '@/services/eventService'

interface Props {
  shopId: string
}

// 두 소스(샵 소식 shop_events + 작품 이벤트 events)를 하나로 정규화한 타임라인 항목
interface TimelineItem {
  id: string
  source: 'shop' | 'work'
  icon: string
  title: string
  description: string | null
  imageUrl: string | null
  dateText: string | null
  isPinned: boolean
  sortKey: string        // 정렬용 (최신 우선)
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
      getActiveShopEvents(shopId),   // 샵 자체 소식 (휴무/재입고/공지 등)
      getEventsByShop(shopId),       // 이 샵의 작품 이벤트 (팝업/콜라보/전시)
    ]).then(([shopEvents, workEvents]) => {
      // 샵 소식 → 타임라인 항목
      const shopItems: TimelineItem[] = shopEvents.map((e: any) => ({
        id: `shop-${e.id}`,
        source: 'shop',
        icon: EVENT_TYPE_ICON[e.type as ShopEventType] ?? '🎉',
        title: e.title,
        description: e.description ?? null,
        imageUrl: e.image_url ?? null,
        dateText: fmtRange(e.starts_at ?? null, e.ends_at ?? null),
        isPinned: !!e.is_pinned,
        sortKey: (e.starts_at ?? e.created_at ?? '').slice(0, 10),
      }))

      // 작품 이벤트 → 타임라인 항목 (description/image 없음 — 우리 events엔 미저장)
      const workItems: TimelineItem[] = workEvents.map(e => ({
        id: `work-${e.id}`,
        source: 'work',
        icon: WORK_EVENT_ICON[e.type] ?? '✨',
        title: e.title ?? '',
        description: null,
        imageUrl: null,
        dateText: fmtRange(e.startDate, e.endDate),
        isPinned: false,
        sortKey: (e.startDate ?? e.createdAt ?? '').slice(0, 10),
      }))

      // 합치고 정렬: 고정(샵 소식만) 먼저, 그다음 날짜 최신순
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
      <h2 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '12px' }}>🎉 진행중인 소식</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map(item => (
          <div
            key={item.id}
            onClick={() => setSelected(item)}
            style={{
              padding: '14px', borderRadius: '12px', cursor: 'pointer',
              border: item.isPinned ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: item.isPinned ? 'var(--accent-l)' : 'var(--surface2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>{item.title}</span>
              {item.isPinned && <span style={{ fontSize: '11px' }}>📌</span>}
              {item.imageUrl && <span style={{ fontSize: '12px', marginLeft: 'auto' }}>📷</span>}
            </div>
            {item.description && (
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '6px' }}>{item.description}</p>
            )}
            {item.dateText && (
              <p style={{ fontSize: '11px', color: 'var(--muted)' }}>{item.dateText}</p>
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
                <span style={{ fontSize: '18px' }}>{selected.icon}</span>
                <span style={{ fontWeight: 900, fontSize: '16px' }}>{selected.title}</span>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--muted)' }}
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
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text)', marginBottom: '12px' }}>
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