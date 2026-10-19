'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/* 글쓰기 › 꾸미기 (2026-10-19) — 강조 박스 · 별점 · 단계 (소제목은 글꼴 왼쪽 '본문' 고르기)
   (형광펜은 툴바의 형광펜 버튼, 꾸밈 구분선은 툴바의 구분선 버튼 → DividerPicker)
   PC: 꾸미기 버튼 아래 팝오버 / 모바일: 아래에서 올라오는 시트.
   버튼은 onMouseDown 에서 기본 동작을 막아 편집기의 글자 선택을 잃지 않는다(형광펜·소제목은 선택한 곳에 건다). */

export type CalloutKind = 'tip' | 'info' | 'warn' | 'check'
export type DividerKind = 'line' | 'dot' | 'heart' | 'star' | 'wave'

export const HIGHLIGHTS: { color: string; label: string }[] = [
  { color: '#FFD6E5', label: '핑크' },
  { color: '#FFF1A8', label: '노랑' },
  { color: '#C9F2EA', label: '민트' },
  { color: '#D6ECFF', label: '하늘' },
]
const CALLOUTS: { kind: CalloutKind; label: string; bg: string; fg: string }[] = [
  { kind: 'tip', label: '💡 꿀팁', bg: 'rgba(255,86,146,.10)', fg: '#E8006F' },
  { kind: 'info', label: '📌 정보', bg: 'rgba(123,198,255,.16)', fg: '#1F7BC9' },
  { kind: 'warn', label: '⚠️ 주의', bg: 'rgba(245,177,0,.14)', fg: '#A87500' },
  { kind: 'check', label: '✅ 체크', bg: 'rgba(110,220,202,.2)', fg: '#0E8A78' },
]
const DIVIDERS: { kind: DividerKind; label: string; sample: React.ReactNode }[] = [
  { kind: 'line', label: '기본', sample: <span style={{ display: 'block', width: 40, borderTop: '2px solid var(--border)' }} /> },
  { kind: 'dot', label: '점선', sample: <span style={{ display: 'block', width: 40, borderTop: '2px dashed var(--border)' }} /> },
  { kind: 'heart', label: '하트', sample: <span style={{ color: 'var(--accent)', letterSpacing: 2 }}>♡♡♡</span> },
  { kind: 'star', label: '별', sample: <span style={{ color: 'var(--accent)', letterSpacing: 2 }}>✦✦✦</span> },
  { kind: 'wave', label: '물결', sample: <span style={{ color: 'var(--accent)', opacity: .7, letterSpacing: -1 }}>〰〰</span> },
]

interface Props {
  desktop: boolean
  anchor?: DOMRect | null   // PC: 꾸미기 버튼 위치 — 툴바가 넘침을 숨겨서 화면 위(body)에 띄운다
  onClose: () => void
  onCallout: (kind: CalloutKind) => void
  onStars: (n: number, label: string) => void
  onSteps: () => void
}

const keep = (e: React.MouseEvent) => e.preventDefault()   // 편집기 선택 유지

export default function DecorPanel(p: Props) {
  const [stars, setStars] = useState(5)
  const [starLabel, setStarLabel] = useState('만족도')
  const ref = useRef<HTMLDivElement>(null)
  // PC 팝오버: 바깥을 누르면 닫기
  useEffect(() => {
    if (!p.desktop) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (ref.current && !ref.current.contains(t) && !t.closest('[data-decor-toggle]')) p.onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [p])

  const run = (fn: () => void) => { fn(); p.onClose() }

  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section title="강조 박스">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {CALLOUTS.map(c => (
            <button key={c.kind} type="button" onMouseDown={keep} onClick={() => run(() => p.onCallout(c.kind))}
              style={{ ...opt, justifyContent: 'flex-start', background: c.bg, borderColor: 'transparent', color: c.fg, fontWeight: 900 }}>{c.label}</button>
          ))}
        </div>
      </Section>

      <Section title="별점">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={starLabel} onChange={e => setStarLabel(e.target.value.slice(0, 20))} placeholder="만족도" aria-label="별점 이름"
            style={{ width: 96, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit' }} />
          <span style={{ display: 'inline-flex' }} role="radiogroup" aria-label="별 개수">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`별 ${n}개`} onMouseDown={keep} onClick={() => setStars(n)}
                style={{ border: 'none', background: 'none', padding: '2px 1px', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: n <= stars ? '#FFB400' : 'var(--border)' }}>★</button>
            ))}
          </span>
          <button type="button" onMouseDown={keep} onClick={() => run(() => p.onStars(stars, starLabel.trim() || '만족도'))}
            style={{ ...opt, marginLeft: 'auto', background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff', fontWeight: 800, padding: '8px 14px' }}>넣기</button>
        </div>
      </Section>

      <Section title="단계" sub="엔터로 단계 추가">
        <button type="button" onMouseDown={keep} onClick={() => run(p.onSteps)} style={{ ...opt, width: '100%', justifyContent: 'flex-start', gap: 8 }}>
          {[1, 2, 3].map(n => <span key={n} style={{ width: 20, height: 20, borderRadius: 9999, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>)}
          <b style={{ fontSize: 13.5 }}>단계 블록 넣기</b>
        </button>
      </Section>

    </div>
  )

  if (typeof document === 'undefined') return null
  if (p.desktop) {
    const a = p.anchor
    const left = a ? Math.max(8, Math.min(a.left, window.innerWidth - 348)) : 8
    const top = a ? a.bottom + 6 : 80
    return createPortal(
      <div ref={ref} role="dialog" aria-label="꾸미기"
        style={{ position: 'fixed', top, left, zIndex: 3000, width: 340, maxHeight: `calc(100vh - ${top + 12}px)`, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,.16)', padding: 16 }}>
        {body}
      </div>,
      document.body,
    )
  }
  return createPortal(
    <div onClick={p.onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault() }} role="dialog" aria-label="꾸미기"
        style={{ width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '10px 18px calc(18px + env(safe-area-inset-bottom))', maxHeight: '82vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 9999, background: 'var(--border)', margin: '0 auto 12px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 900 }}>꾸미기</span>
          <button type="button" onClick={p.onClose} aria-label="닫기" style={{ border: 'none', background: 'none', fontSize: 24, lineHeight: 1, color: 'var(--muted)', cursor: 'pointer', padding: 0 }}>×</button>
        </div>
        {body}
      </div>
    </div>,
    document.body,
  )
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8, color: 'var(--text)' }}>{title}{sub && <span style={{ fontWeight: 600, color: 'var(--muted)', marginLeft: 6, fontSize: 12 }}>{sub}</span>}</div>
      {children}
    </div>
  )
}

const opt: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

export type QuoteKind = 'line' | 'mark' | 'bubble' | 'box' | 'note'
const QUOTES: { kind: QuoteKind; label: string; sample: React.ReactNode }[] = [
  { kind: 'line', label: '기본', sample: <span style={{ display: 'block', width: 30, height: 16, borderLeft: '3px solid var(--accent)', background: 'var(--surface2)' }} /> },
  { kind: 'mark', label: '따옴표', sample: <span style={{ color: 'var(--accent)', fontSize: 22, fontWeight: 800, fontFamily: 'Georgia,serif', lineHeight: '16px' }}>&ldquo;&rdquo;</span> },
  { kind: 'bubble', label: '말풍선', sample: <span style={{ display: 'block', width: 30, height: 16, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }} /> },
  { kind: 'box', label: '박스', sample: <span style={{ display: 'block', width: 30, height: 16, borderRadius: 4, border: '1.5px solid var(--border)' }} /> },
  { kind: 'note', label: '메모지', sample: <span style={{ display: 'block', width: 30, height: 16, borderRadius: 2, background: '#FFF4B8', boxShadow: '0 1px 3px rgba(0,0,0,.12)' }} /> },
]

/* 툴바 버튼 → 모양 고르기 (구분선·인용구). PC: 버튼 아래 작은 창 / 모바일: 아래 시트 */
function StylePicker<K extends string>({ title, items, cols, desktop, anchor, toggleAttr, onPick, onClose }: {
  title: string; items: { kind: K; label: string; sample: React.ReactNode }[]; cols?: number
  desktop: boolean; anchor?: DOMRect | null; toggleAttr: string; onPick: (k: K) => void; onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (ref.current && !ref.current.contains(el) && !el.closest(`[${toggleAttr}]`)) onClose()
    }
    if (desktop) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [desktop, onClose, toggleAttr])
  if (typeof document === 'undefined') return null
  const grid = (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols ?? items.length}, 1fr)`, gap: 6 }}>
      {items.map(d => (
        <button key={d.kind} type="button" onMouseDown={keep} onClick={() => { onPick(d.kind); onClose() }} aria-label={`${d.label} ${title}`}
          style={{ ...opt, flexDirection: 'column', gap: 6, padding: '10px 2px', fontSize: 11.5, color: 'var(--muted)' }}>
          <span style={{ height: 16, display: 'flex', alignItems: 'center' }}>{d.sample}</span>{d.label}
        </button>
      ))}
    </div>
  )
  if (desktop) {
    const left = anchor ? Math.max(8, Math.min(anchor.left, window.innerWidth - 328)) : 8
    return createPortal(
      <div ref={ref} role="dialog" aria-label={`${title} 고르기`}
        style={{ position: 'fixed', top: (anchor?.bottom ?? 80) + 6, left, zIndex: 3000, width: 320, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,.16)', padding: 10 }}>
        {grid}
      </div>,
      document.body,
    )
  }
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} onMouseDown={keep} role="dialog" aria-label={`${title} 고르기`}
        style={{ width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '10px 18px calc(18px + env(safe-area-inset-bottom))' }}>
        <div style={{ width: 40, height: 4, borderRadius: 9999, background: 'var(--border)', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 12 }}>{title}</div>
        {grid}
      </div>
    </div>,
    document.body,
  )
}

type PickerProps<K> = { desktop: boolean; anchor?: DOMRect | null; onPick: (k: K) => void; onClose: () => void }
export function DividerPicker(p: PickerProps<DividerKind>) {
  return <StylePicker title="구분선" items={DIVIDERS} toggleAttr="data-divider-toggle" {...p} />
}
export function QuotePicker(p: PickerProps<QuoteKind>) {
  return <StylePicker title="인용구" items={QUOTES} toggleAttr="data-quote-toggle" {...p} />
}
