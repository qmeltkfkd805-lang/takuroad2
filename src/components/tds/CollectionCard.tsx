'use client'
import { CSSProperties } from 'react'
import { Icon } from './Icon'

export type CollectionKind = 'pilgrimage' | 'region' | 'exhibition' | 'work'

export interface CollectionCardData {
  id: string
  title: string
  visited: number
  total: number
  kind?: CollectionKind
  justCompleted?: boolean
}

const KIND_META: Record<CollectionKind, { icon: string; bg: string }> = {
  pilgrimage: { icon: 'box', bg: '#FFEDE6' },
  region:     { icon: 'map', bg: '#E8F4FF' },
  exhibition: { icon: 'exhibition', bg: '#F0ECFF' },
  work:       { icon: 'star', bg: '#F0ECFF' },
}

interface CollectionCardProps {
  collection: CollectionCardData
  onClick?: (c: CollectionCardData) => void
  style?: CSSProperties
}

export function CollectionCard({ collection, onClick, style }: CollectionCardProps) {
  const { title, visited, total, kind = 'pilgrimage', justCompleted } = collection
  const pct = total > 0 ? Math.round((visited / total) * 100) : 0
  const remaining = Math.max(total - visited, 0)
  const complete = total > 0 && visited >= total
  const notStarted = visited <= 0
  const nearComplete = !complete && remaining > 0 && remaining <= 2
  const km = KIND_META[kind]

  return (
    <div
      onClick={() => onClick?.(collection)}
      style={{
        position: 'relative',
        background: complete ? 'linear-gradient(135deg,#FFF9EC,#FFFFFF)' : 'var(--surface)',
        border: complete ? '1.5px solid #F5D88A' : '1px solid var(--border)',
        borderRadius: 18,
        padding: '16px 17px',
        boxShadow: complete ? '0 1px 6px rgba(245,177,0,.12)' : '0 1px 4px rgba(0,0,0,.04)',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 36, height: 36, borderRadius: 11, background: complete ? '#FFF0C9' : km.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={km.icon} size={20} />
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {complete ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, color: '#946400', fontWeight: 800, background: '#FFE8A8', padding: '3px 9px', borderRadius: 9999 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#946400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>완료
          </span>
        ) : nearComplete ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#D98A12', fontWeight: 700 }}>
            <Icon name="fire" size={13} />{remaining}곳 남음
          </span>
        ) : null}
      </div>

      <div style={{ height: 9, borderRadius: 9999, background: complete ? '#FBE9B8' : '#F1EFEA', overflow: 'hidden', marginBottom: 9 }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 9999, background: complete ? 'linear-gradient(90deg,#F5B100,#FFD166)' : 'var(--accent)', transition: 'width .3s' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
        {complete ? (
          <>
            <span style={{ color: '#946400', fontWeight: 600 }}>{total}곳 전부 방문 · 컴플리트!</span>
            <span style={{ color: '#946400', fontWeight: 800 }}>100%</span>
          </>
        ) : notStarted ? (
          <>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>첫 체크인을 해보세요 →</span>
            <span style={{ color: '#B0ABA2', fontWeight: 700 }}>0 / {total}</span>
          </>
        ) : (
          <>
            <span style={{ color: 'var(--muted)' }}><b style={{ color: 'var(--text)' }}>{visited}곳 방문</b> · {remaining}곳 남음</span>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{pct}%</span>
          </>
        )}
      </div>

      {complete && justCompleted && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/stamps/${kind}.png`} alt="" aria-hidden="true" style={{ position: 'absolute', right: 4, bottom: -4, width: 104, height: 104, opacity: 0.95, transform: 'rotate(-12deg)', pointerEvents: 'none', zIndex: 5 }} />
      )}
    </div>
  )
}

