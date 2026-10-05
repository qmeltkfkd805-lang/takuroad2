'use client'

import { useRouter } from 'next/navigation'
import { MapEvent, MAP_EVENT_TYPE_LABEL } from '@/services/mapEventService'

/* 지도에서 고른 이벤트 — 이벤트 위치(핀 위)에 뜨는 말풍선.
   예전 가운데 모달(MapPinModal)과 같은 정보: 포스터 · 제목 · 기간 · 장소 · 종류 · 전체보기.
   샵 말풍선(MapShopBubble)과 같은 모양. KakaoMap 의 bubble 로 넘기면 카카오 오버레이 안에 포털로 그려진다. */

function fmtDate(d: string) { const p = d.split('-'); return p.length === 3 ? `${p[0].slice(2)}.${p[1]}.${p[2]}` : d }
function fmtPeriod(s: string | null, e: string | null): string | null {
  if (s && e) return `${fmtDate(s)} ~ ${fmtDate(e)}`
  if (e) return `~ ${fmtDate(e)}`
  if (s) return `${fmtDate(s)} ~`
  return null
}

const CalIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
const PinIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 21c-4.5-5.5-6.6-9.4-6.6-12.5a6.6 6.6 0 0 1 13.2 0c0 3.1-2.1 7-6.6 12.5z" /><circle cx="12" cy="8.5" r="2.3" /></svg>

interface Props {
  event: MapEvent
  onClose: () => void
}

export default function MapEventBubble({ event, onClose }: Props) {
  const router = useRouter()
  const href = `/event/${event.id}`
  const period = fmtPeriod(event.startDate, event.endDate)
  const typeLabel = event.type ? (MAP_EVENT_TYPE_LABEL[event.type] ?? '이벤트') : '이벤트'

  const row = (icon: React.ReactNode, text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45, minWidth: 0 }}>
      {icon}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{text}</span>
    </div>
  )

  return (
    <div
      role="dialog"
      aria-label={event.title}
      style={{
        position: 'relative', pointerEvents: 'auto',
        width: 'min(272px, calc(100vw - 32px))',
        filter: 'drop-shadow(0 8px 22px rgba(0,0,0,.22))',
        animation: 'mapBubbleIn .18s cubic-bezier(.32,.72,0,1)',
        transformOrigin: 'center bottom',
        cursor: 'default', textAlign: 'left',
      }}
    >
      <style>{`@keyframes mapBubbleIn{from{transform:translateY(6px) scale(.96);opacity:0}to{transform:none;opacity:1}}`}</style>

      <div style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {/* 포스터 — 세로 포스터가 잘리지 않게 전체(contain)로 */}
        <div
          onClick={() => router.push(href)}
          style={{ position: 'relative', height: 150, background: event.coverUrl ? '#111' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          {event.coverUrl
            ? <img src={event.coverUrl} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            : <span style={{ color: 'var(--muted)', fontSize: 13 }}>이벤트</span>}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onClose() }}
            aria-label="닫기"
            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 9999, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3, color: 'var(--text)', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{event.title}</div>

          {period && row(<CalIco />, period)}
          {event.address && row(<PinIco />, event.address)}

          <div style={{ display: 'flex', marginTop: 2 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 9999, background: 'rgba(232,0,111,.1)', color: '#e8006f', border: '1px solid #e8006f33' }}>{typeLabel}</span>
          </div>

          <button
            type="button"
            onClick={() => router.push(href)}
            style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            전체보기
          </button>
        </div>
      </div>

      {/* 말풍선 꼬리 — 핀을 가리킨다 */}
      <div aria-hidden style={{
        position: 'absolute', left: '50%', bottom: -7, width: 14, height: 14,
        transform: 'translateX(-50%) rotate(45deg)',
        background: 'var(--surface)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        borderBottomRightRadius: 3,
      }} />
    </div>
  )
}
