'use client'

import { useRouter } from 'next/navigation'
import { Shop } from '@/types/shop'
import { MapEvent, MAP_EVENT_TYPE_LABEL } from '@/services/mapEventService'
import { ROUTES } from '@/lib/constants/routes'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import { getTodayStatus } from '@/lib/utils/date'

function fmtDate(d: string) { const p = d.split('-'); return p.length === 3 ? `${p[0].slice(2)}.${p[1]}.${p[2]}` : d }
function fmtPeriod(s: string | null, e: string | null): string | null {
  if (s && e) return `${fmtDate(s)} ~ ${fmtDate(e)}`
  if (e) return `~ ${fmtDate(e)}`
  if (s) return `${fmtDate(s)} ~`
  return null
}

const ClockIco = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
const CalIco = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
const PinIco = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c-4.5-5.5-6.6-9.4-6.6-12.5a6.6 6.6 0 0 1 13.2 0c0 3.1-2.1 7-6.6 12.5z" /><circle cx="12" cy="8.5" r="2.3" /></svg>

interface Props {
  shop?: Shop | null
  event?: MapEvent | null
  onClose: () => void
}

export default function MapPinModal({ shop, event, onClose }: Props) {
  const router = useRouter()
  if (!shop && !event) return null

  const isEvent = !!event
  const cover = isEvent ? event!.coverUrl : (shop!.eventCover ?? shop!.images?.[0])
  const title = isEvent ? event!.title : shop!.name
  const detailHref = isEvent ? `/event/${event!.id}` : ROUTES.shop(shop!.slug)

  const period = isEvent ? fmtPeriod(event!.startDate, event!.endDate) : null
  const evLabel = isEvent && event!.type ? (MAP_EVENT_TYPE_LABEL[event!.type] ?? '이벤트') : '이벤트'
  const today = !isEvent ? getTodayStatus(shop!.hours) : null

  const row = (icon: React.ReactNode, text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
      {icon}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  )

  const chipStyle = (color: string, bg: string): React.CSSProperties => ({
    fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 9999, background: bg, color, border: `1px solid ${color}33`,
  })

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,.28)', animation: 'pinModalIn .2s cubic-bezier(.32,.72,0,1)' }}
      >
        <style>{`@keyframes pinModalIn{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

        {/* 커버 — 이벤트는 포스터 전체(contain), 샵은 커버 크롭 */}
        <div style={{ position: 'relative', background: isEvent && cover ? '#111' : '#F7F7F8', display: 'flex', alignItems: 'center', justifyContent: 'center', ...(isEvent && cover ? {} : { height: 160 }) }}>
          {cover
            ? <img src={cover} alt={title} style={isEvent
                ? { width: '100%', height: 'auto', maxHeight: '56vh', objectFit: 'contain', display: 'block' }
                : { width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: 'var(--muted)', fontSize: 14 }}>{isEvent ? '이벤트' : '샵'}</span>}
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 9999, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, lineHeight: 1.3 }}>{title}</div>

          {isEvent ? (
            <>
              {period && row(<CalIco />, period)}
              {event!.address && row(<PinIco />, event!.address)}
              <div style={{ marginTop: 4 }}>
                <span style={chipStyle('#e8006f', 'rgba(232,0,111,.1)')}>{evLabel}</span>
              </div>
            </>
          ) : (
            <>
              {today?.todayHours && row(<ClockIco />, `${today.label} · ${today.todayHours}`)}
              {shop!.addr && row(<PinIco />, shop!.addr)}
              {shop!.cats?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {shop!.cats.slice(0, 3).map(c => {
                    const ci = CATEGORY_NAME_MAP[c]
                    return <span key={c} style={chipStyle(ci?.color ?? '#e8006f', ci?.bgColor ?? 'rgba(232,0,111,.1)')}>{c}</span>
                  })}
                </div>
              )}
            </>
          )}

          <button
            onClick={() => router.push(detailHref)}
            style={{ width: '100%', marginTop: 16, padding: '13px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            전체보기
          </button>
        </div>
      </div>
    </div>
  )
}
