'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import RouteMapThumb from './RouteMapThumb'

/* 마이페이지 루트 카드 — 만든/저장한/완주한 루트 공통.
   지도 썸네일 + 상태 배지 + ⋮ 메뉴 + 제목(2줄) + 한 줄 메타. 카드 전체 탭 → 상세. */

export type UIRoute = {
  id: string
  title: string
  shareToken: string | null
  regionLabel: string | null
  regions: string[]
  stopCount: number
  durationMin: number | null
  isShared: boolean
  stops: { lat: number; lng: number }[]
}
export type RouteMenuItem = { label: string; danger?: boolean; onClick: () => void }

function metaLine(r: UIRoute): string {
  const parts: string[] = []
  if (r.regionLabel) parts.push(r.regionLabel)
  parts.push(`${r.stopCount}곳`)
  if (r.durationMin) parts.push(r.durationMin >= 60 ? `약 ${Math.round(r.durationMin / 60)}시간` : `약 ${r.durationMin}분`)
  return parts.join(' · ')
}

export default function RouteCard({ route, onOpen, badge, menu }: {
  route: UIRoute
  onOpen: () => void
  badge?: { text: string; bg: string } | null
  menu?: RouteMenuItem[] | null
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation()
    const rect = btnRef.current?.getBoundingClientRect()
    const items = menu?.length ?? 0
    const menuW = 150, menuH = items * 44 + 2
    if (rect) {
      let top = rect.bottom + 4
      if (top + menuH > window.innerHeight - 8) top = Math.max(8, rect.top - menuH - 4)
      let left = rect.right - menuW
      if (left < 8) left = 8
      setPos({ top, left })
    } else setPos({ top: 60, left: 60 })
  }

  return (
    <div
      onClick={onOpen}
      role="button"
      style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', cursor: 'pointer' }}
    >
      {/* 지도 썸네일 */}
      <div style={{ position: 'relative' }}>
        <RouteMapThumb stops={route.stops} />

        {/* 상태 배지 — 좌측 상단 */}
        {badge && (
          <span style={{ position: 'absolute', top: 8, left: 8, background: badge.bg, color: '#fff', fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 8, lineHeight: 1 }}>{badge.text}</span>
        )}

        {/* ⋮ 메뉴 — 우측 상단 (카드 이동 이벤트 차단, 포털로 렌더해 카드 overflow에 안 잘림) */}
        {menu && menu.length > 0 && (
          <button
            ref={btnRef}
            onClick={openMenu}
            aria-label="루트 메뉴"
            style={{ position: 'absolute', top: 6, right: 6, width: 36, height: 36, minWidth: 36, borderRadius: 9, border: 'none', background: 'rgba(255,255,255,.92)', color: '#333', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.18)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>
          </button>
        )}
        {menu && pos && typeof document !== 'undefined' && createPortal(
          <div onClick={(e) => { e.stopPropagation(); setPos(null) }} style={{ position: 'fixed', inset: 0, zIndex: 3000 }}>
            <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, width: 150, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 10px 26px rgba(0,0,0,.18)', overflow: 'hidden' }}>
              {menu.map((m, i) => (
                <button
                  key={i}
                  onClick={() => { setPos(null); m.onClick() }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 44, padding: '0 14px', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: m.danger ? '#e5484d' : 'var(--text)' }}
                >{m.label}</button>
              ))}
            </div>
          </div>,
          document.body,
        )}
      </div>

      {/* 본문 */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{route.title || '제목 없는 루트'}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{metaLine(route)}</div>
      </div>
    </div>
  )
}
