'use client'
import { CSSProperties, ReactNode } from 'react'

export type LibraryState = 'planned' | 'in_progress' | 'completed' | 'paused'

const ICON: Record<LibraryState, ReactNode> = {
  planned:     <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4 7 20l5.5-5 5.5 5V4Z" /></svg>,
  in_progress: <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 5.5v13a1 1 0 0 0 1.5.85l11-6.5a1 1 0 0 0 0-1.7l-11-6.5A1 1 0 0 0 7 5.5Z" /></svg>,
  completed:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>,
  paused:      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>,
}

const META: Record<LibraryState, { label: string; bg: string; fg: string }> = {
  planned:     { label: '볼 예정',    bg: '#F1EFEA', fg: '#5F5E5A' },
  in_progress: { label: '보는 중',    bg: '#E8F4FF', fg: '#1A5F95' },
  completed:   { label: '정주행 완료', bg: '#E1F7F2', fg: '#0E7A63' },
  paused:      { label: '쉬는 중',    bg: '#FFF3D6', fg: '#835700' },
}

interface LibraryStateChipProps {
  state: LibraryState
  rewatchCount?: number
  style?: CSSProperties
}

export function LibraryStateChip({ state, rewatchCount, style }: LibraryStateChipProps) {
  const m = META[state]
  const showRewatch = state === 'completed' && (rewatchCount ?? 0) >= 2
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: m.bg, color: m.fg, fontSize: 12.5, fontWeight: 600, padding: '4px 13px', borderRadius: 9999 }}>
        {ICON[state]}
        {m.label}
      </span>
      {showRewatch && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#F0ECFF', color: '#5A43B5', fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 9999 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>
          {rewatchCount}
        </span>
      )}
    </span>
  )
}
