'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/* 글자색 고르기 (2026-10-19) — 타쿠로드 방식: 최근 쓴 색 · 타쿠 컬러(사이트 색) · 기본 색(7색 × 4단계, 동그라미)
   · [기본색](색 빼기) · [다른 색 고르기](브라우저 전체 색).
   툴바가 넘침을 숨겨서 버튼 위치 아래 화면 위(body)에 띄운다. 버튼은 onMouseDown 을 막아 편집기 선택을 지킨다. */

const RECENT_KEY = 'taku:recentTextColors'
const RECENT_MAX = 7

// 타쿠 컬러 — globals.css 의 사이트 색(글자로 읽히도록 조금 진하게 맞춘 것 포함)
export const TAKU_COLORS: { c: string; name: string }[] = [
  { c: '#FF5692', name: '타쿠 핑크' },
  { c: '#E8006F', name: '진한 핑크' },
  { c: '#8B6BD9', name: '라벤더' },
  { c: '#3B9BE8', name: '하늘' },
  { c: '#14B8A0', name: '민트' },
  { c: '#F5A300', name: '노랑' },
  { c: '#FF6B6B', name: '코랄' },
]
// 기본 색 — 회색 + 6색, 위에서 아래로 밝은→진한 4단계
const BASIC: string[][] = [
  ['#BFBFBF', '#FFADAD', '#FFC98B', '#FFE27A', '#9FE3B4', '#9CC8FF', '#C9B3FF'],
  ['#8C8C8C', '#F25C5C', '#FF9A3D', '#F2C200', '#38B26B', '#3F8EF0', '#9466F0'],
  ['#555555', '#C62828', '#D96A00', '#B38F00', '#1E7A45', '#1C5BB8', '#5E35B1'],
  ['#20202D', '#7F1D1D', '#8A4300', '#6B5600', '#0F4A2A', '#0F3470', '#3A1F78'],
]

export function loadRecentColors(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, RECENT_MAX) : [] } catch { return [] }
}
export function pushRecentColor(c: string) {
  try {
    const next = [c.toUpperCase(), ...loadRecentColors().filter(x => x.toUpperCase() !== c.toUpperCase())].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch { /* 저장 못 해도 그만 */ }
}

const keep = (e: React.MouseEvent) => e.preventDefault()

interface Props {
  anchor: DOMRect | null
  current: string
  onPick: (color: string | null) => void   // null = 기본 글자색으로
  onClose: () => void
}

export default function ColorPalette({ anchor, current, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [recent] = useState<string[]>(() => loadRecentColors())
  const [live, setLive] = useState<string | null>(null)   // [다른 색 고르기]에서 고르는 중인 색
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (ref.current && !ref.current.contains(el) && !el.closest('[data-color-toggle]')) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])
  if (typeof document === 'undefined') return null

  const pick = (c: string | null) => { if (c) pushRecentColor(c); onPick(c); onClose() }
  const dot = (c: string, title: string, key: string, size = 22) => {
    const on = c.toUpperCase() === current.toUpperCase()
    return (
      <button key={key} type="button" title={title} aria-label={`글자색 ${title}`} aria-pressed={on} onMouseDown={keep} onClick={() => pick(c)}
        style={{ width: size, height: size, padding: 0, borderRadius: 9999, cursor: 'pointer', background: c, border: 'none', boxShadow: on ? '0 0 0 2px var(--surface), 0 0 0 4px var(--accent)' : 'inset 0 0 0 1px rgba(0,0,0,.08)' }} />
    )
  }
  const label = (t: string) => <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', margin: '0 0 8px' }}>{t}</div>
  const left = anchor ? Math.max(8, Math.min(anchor.left, window.innerWidth - 248)) : 8
  // 버튼이 화면 아래쪽(모바일 서식 패널)이면 버튼 위로 띄운다
  const above = !!anchor && anchor.top > window.innerHeight / 2
  const vpos: React.CSSProperties = above ? { bottom: window.innerHeight - anchor!.top + 6 } : { top: (anchor?.bottom ?? 80) + 6 }

  return createPortal(
    <div ref={ref} role="dialog" aria-label="글자색"
      style={{ position: 'fixed', ...vpos, left, zIndex: 3000, width: 240, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,.14)', padding: 14 }}>
      {recent.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {label('최근 쓴 색')}
          <div style={{ display: 'flex', gap: 8 }}>{recent.map(c => dot(c, c, 'r' + c))}</div>
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        {label('타쿠 컬러')}
        <div style={{ display: 'flex', gap: 8 }}>{TAKU_COLORS.map(t => dot(t.c, t.name, 't' + t.c))}</div>
      </div>
      <div>
        {label('기본 색')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 22px)', gap: 8 }}>
          {BASIC.flat().map((c, i) => dot(c, c, 'b' + i))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button type="button" onMouseDown={keep} onClick={() => pick(null)}
          style={{ flex: 1, padding: '8px 0', borderRadius: 9999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>기본색</button>
        {/* 다른 색 고르기 — 끌면서 고르는 동안엔 바로 칠하고, 창을 닫으면(blur) 최근 색에 넣고 닫는다 */}
        <label style={{ flex: 1.4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 0', borderRadius: 9999, background: 'var(--accent-l, rgba(255,86,146,.12))', color: 'var(--accent)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', position: 'relative' }}>
          + 다른 색 고르기
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(live ?? current) ? (live ?? current) : '#000000'}
            onChange={e => { setLive(e.target.value); onPick(e.target.value) }}
            onBlur={() => { if (live) { pushRecentColor(live); onClose() } }}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
        </label>
      </div>
    </div>,
    document.body,
  )
}
