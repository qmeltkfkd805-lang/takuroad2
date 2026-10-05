'use client'

/* 덕메게시판 글쓰기 — "어떤 이벤트에 같이 갈지" 고르는 칸 (선택).
   진행 중·예정 이벤트를 제목으로 찾아 하나 고른다. 작품 고르기 칸 바로 아래에 붙는다. */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { searchCompanionEvents, PostEventSummary } from '@/services/postEventService'

function fmt(d: string | null) { if (!d) return ''; const p = d.split('-'); return p.length === 3 ? `${Number(p[1])}.${Number(p[2])}` : d }
function period(e: PostEventSummary) {
  if (e.startDate && e.endDate) return `${fmt(e.startDate)} ~ ${fmt(e.endDate)}`
  if (e.endDate) return `~ ${fmt(e.endDate)}`
  if (e.startDate) return `${fmt(e.startDate)} ~`
  return ''
}

export function EventThumb({ url, size = 40 }: { url: string | null; size?: number }) {
  return url
    ? <img src={url} alt="" style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: 'var(--surface2)' }} />
    : <span style={{ width: size, height: size, borderRadius: 8, flexShrink: 0, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
      </span>
}

interface Props {
  value: PostEventSummary | null
  onChange: (ev: PostEventSummary | null) => void
}

export default function CompanionEventPicker({ value, onChange }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<PostEventSummary[]>([])
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // 검색 (입력 멈추고 0.25초 뒤)
  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    const t = setTimeout(async () => {
      const r = await searchCompanionEvents(q)
      if (alive) { setItems(r); setLoading(false) }
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [q, open])

  // 바깥 누르면 닫기
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown) }
  }, [open])

  return (
    <div ref={boxRef} style={{ position: 'relative', marginTop: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>같이 갈 이벤트 (선택)</div>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1.5px solid var(--accent)', borderRadius: 12, background: 'var(--accent-l, rgba(232,0,111,.06))' }}>
          <EventThumb url={value.coverUrl} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.title}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[period(value), value.placeName].filter(Boolean).join(' · ')}</div>
          </div>
          <button type="button" onClick={() => onChange(null)} aria-label="이벤트 빼기"
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1, padding: '2px 6px', fontFamily: 'inherit' }}>×</button>
        </div>
      ) : (
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="이벤트 검색 (팝업·콜라보 카페·전시·행사)"
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }}
        />
      )}
      {open && !value && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4, maxHeight: 280, overflow: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}>
          {loading && items.length === 0
            ? <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--muted)' }}>찾는 중…</div>
            : items.length === 0
              ? <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--muted)' }}>진행 중이거나 예정된 이벤트 중에 없어요</div>
              : items.map(ev => (
                <button key={ev.id} type="button" onClick={() => { onChange(ev); setOpen(false); setQ('') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <EventThumb url={ev.coverUrl} size={36} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[period(ev), ev.placeName].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              ))}
        </div>
      )}
    </div>
  )
}

/** 글 보기 화면 — 연결된 이벤트 카드 (누르면 이벤트로) */
export function PostEventLinkCard({ ev }: { ev: PostEventSummary }) {
  return (
    <Link href={`/event/${ev.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', margin: '0 0 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', textDecoration: 'none', color: 'inherit' }}>
      <EventThumb url={ev.coverUrl} size={48} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: 'var(--accent)', marginBottom: 2 }}>같이 갈 이벤트</span>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[period(ev), ev.placeName].filter(Boolean).join(' · ')}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6" /></svg>
    </Link>
  )
}
