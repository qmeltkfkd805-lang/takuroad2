'use client'
import { useState, useEffect } from 'react'
import { getActiveShopEvents, EVENT_TYPE_ICON, EVENT_TYPE_LABEL, ShopEventType } from '@/services/shopEventService'
import { SectionHeader } from '@/components/tds/SectionHeader'
import { getEventsByShop, WORK_EVENT_ICON } from '@/services/eventService'

interface Props {
  shopId: string
}

interface WorkItem {
  id: string
  icon: string
  title: string
  dateText: string | null
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
  const [news, setNews] = useState<any[]>([])
  const [works, setWorks] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)

  useEffect(() => {
    Promise.all([
      getActiveShopEvents(shopId),
      getEventsByShop(shopId),
    ]).then(([shopEvents, workEvents]) => {
      const sorted = [...shopEvents].sort((a: any, b: any) => {
        if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1
        return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
      })
      setNews(sorted)
      setWorks(workEvents.map(e => ({
        id: `work-${e.id}`,
        icon: WORK_EVENT_ICON[e.type] ?? '🎯',
        title: e.title ?? '',
        dateText: fmtRange(e.startDate, e.endDate),
        sortKey: (e.startDate ?? e.createdAt ?? '').slice(0, 10),
      })).sort((a, b) => b.sortKey.localeCompare(a.sortKey)))
      setLoading(false)
    })
  }, [shopId])

  if (loading) return null
  if (news.length === 0 && works.length === 0) return null

  return (
    <div style={{ marginBottom: '24px' }}>
      {news.length > 0 && (
        <>
          <SectionHeader title="소식" tone="coral" icon={<img src="/icons/event.png" alt="" width={22} height={22} />} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '24px' }}>
            {news.map((n: any) => (
              <div
                key={n.id}
                onClick={() => setSelected(n)}
                style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden', cursor: 'pointer', background: '#000' }}
              >
                {n.video_url
                  ? <video src={n.video_url + '#t=0.1'} preload="metadata" muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : n.image_url
                    ? <img src={n.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#FFE3EC,#FFF0F5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>{EVENT_TYPE_ICON[n.type as ShopEventType] ?? '📌'}</div>}
                {n.video_url && (
                  <span style={{ position: 'absolute', top: '6px', right: '6px', color: '#fff', fontSize: '12px', textShadow: '0 1px 4px rgba(0,0,0,.6)' }}>▶</span>
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,.6) 0%, rgba(0,0,0,0) 45%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', left: '6px', right: '6px', bottom: '5px', color: '#fff', fontSize: '10.5px', fontWeight: 700, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.title}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {works.length > 0 && (
        <>
          <SectionHeader title="진행중인 이벤트" tone="coral" icon={<img src="/icons/event.png" alt="" width={22} height={22} />} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {works.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{item.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>{item.title}</div>
                  {item.dateText && <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>{item.dateText}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '680px', maxHeight: '92vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.08))', padding: '3px 9px', borderRadius: '9999px' }}>
                {EVENT_TYPE_LABEL[selected.type as ShopEventType] ?? selected.type}
              </span>
              {selected.is_pinned && (
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '6px', padding: '1px 5px' }}>고정</span>
              )}
              <button
                onClick={() => setSelected(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}
              >✕</button>
            </div>

            {(selected.video_url || selected.image_url) && (
              <div style={{ background: '#000', display: 'flex', justifyContent: 'center' }}>
                {selected.video_url
                  ? <video src={selected.video_url} controls autoPlay playsInline style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block' }} />
                  : <img src={selected.image_url} alt="" style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block' }} />}
              </div>
            )}

            <div style={{ padding: '16px 18px 28px' }}>
              <div style={{ fontSize: '16px', fontWeight: 900, lineHeight: 1.45 }}>{selected.title}</div>
              {selected.description && (
                <p style={{ fontSize: '14px', lineHeight: 1.75, color: 'var(--text)', marginTop: '10px', whiteSpace: 'pre-wrap' }}>{selected.description}</p>
              )}
              {fmtRange(selected.starts_at ?? null, selected.ends_at ?? null) && (
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '12px' }}>{fmtRange(selected.starts_at ?? null, selected.ends_at ?? null)}</p>
              )}
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '10px' }}>{fmtDate(selected.created_at ?? null)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}