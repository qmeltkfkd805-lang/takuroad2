'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapEvent, MAP_EVENT_TYPE_LABEL } from '@/services/mapEventService'
import ThumbImg from '@/components/common/ThumbImg'

/* 지도에서 고른 이벤트 — 이벤트 위치(핀 위)에 뜨는 말풍선.
   포스터 · 제목 · 기간 · 장소 · 종류 · 전체보기.
   같은 장소에서 하는 이벤트가 여럿이면 핀은 하나, 말풍선에서 옆으로 넘겨(스와이프·화살표) 본다.
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

// 한 줄로, 넘치면 … (글자가 잘려 보이지 않게)
const oneLine: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }

interface Props {
  /** 같은 장소의 이벤트들 (하나면 넘기기 없음) */
  events: MapEvent[]
  /** 처음 보여줄 이벤트 (핀·목록에서 누른 것) */
  initialId?: string | number | null
  onClose: () => void
}

export default function MapEventBubble({ events, initialId = null, onClose }: Props) {
  const router = useRouter()
  const startIdx = Math.max(0, events.findIndex(e => String(e.id) === String(initialId ?? '')))
  const [idx, setIdx] = useState(startIdx)
  useEffect(() => { setIdx(startIdx) }, [startIdx])
  const n = events.length
  const event = events[Math.min(idx, n - 1)] ?? events[0]

  const go = (d: number) => setIdx(i => (i + d + n) % n)

  // 좌우로 밀어서 넘기기 — 지도가 같이 끌리지 않게 말풍선 안에서 멈춘다
  const sx = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { e.stopPropagation(); sx.current = e.touches[0].clientX }
  const onTouchMove = (e: React.TouchEvent) => { e.stopPropagation() }
  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation()
    if (sx.current === null || n < 2) return
    const dx = e.changedTouches[0].clientX - sx.current
    sx.current = null
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
  }

  if (!event) return null
  const href = `/event/${event.id}`
  const period = fmtPeriod(event.startDate, event.endDate)
  const typeLabel = event.type ? (MAP_EVENT_TYPE_LABEL[event.type] ?? '이벤트') : '이벤트'

  const row = (icon: React.ReactNode, text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45, minWidth: 0 }}>
      {icon}<span style={oneLine}>{text}</span>
    </div>
  )

  const arrow = (dir: 'l' | 'r') => (
    <button
      type="button"
      aria-label={dir === 'l' ? '이전 이벤트' : '다음 이벤트'}
      onClick={e => { e.stopPropagation(); go(dir === 'l' ? -1 : 1) }}
      style={{ position: 'absolute', top: '50%', [dir === 'l' ? 'left' : 'right']: 6, transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: 9999, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, boxShadow: '0 1px 4px rgba(0,0,0,.25)' }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={dir === 'l' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} /></svg>
    </button>
  )

  return (
    <div
      role="dialog"
      aria-label={event.title}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
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
        {/* 포스터 — 칸을 꽉 채워서 */}
        <div
          onClick={() => router.push(href)}
          style={{ position: 'relative', height: 150, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
        >
          {event.coverUrl
            ? <ThumbImg key={event.id} src={event.coverUrl} alt={event.title} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
            : <span style={{ color: 'var(--muted)', fontSize: 13 }}>이벤트</span>}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onClose() }}
            aria-label="닫기"
            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 9999, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
          {n > 1 && (
            <>
              {arrow('l')}
              {arrow('r')}
              <span style={{ position: 'absolute', left: 8, top: 8, padding: '3px 9px', borderRadius: 9999, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 11.5, fontWeight: 800 }}>
                {idx + 1} / {n}
              </span>
            </>
          )}
        </div>

        <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <div title={event.title} style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.35, color: 'var(--text)', ...oneLine }}>{event.title}</div>

          {period && row(<CalIco />, period)}
          {event.address && row(<PinIco />, event.address)}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 9999, background: 'rgba(232,0,111,.1)', color: '#e8006f', border: '1px solid #e8006f33' }}>{typeLabel}</span>
            {n > 1 && (
              <span style={{ display: 'flex', gap: 4 }} aria-hidden>
                {events.map((e, i) => (
                  <span key={e.id} style={{ width: i === idx ? 14 : 6, height: 6, borderRadius: 9999, background: i === idx ? 'var(--accent)' : 'var(--border)', transition: 'width .15s' }} />
                ))}
              </span>
            )}
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
