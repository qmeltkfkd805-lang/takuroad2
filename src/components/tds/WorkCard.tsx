'use client'
import { WorkIcon } from './WorkIcon'
import { CSSProperties } from 'react'
import { Icon } from './Icon'
import { LibraryStateChip, LibraryState } from './LibraryStateChip'
import { ActivityBadge, ActivityItem, ActivityKind, TIER1 } from './ActivityBadge'

export interface WorkCardData {
  id: string
  name: string
  coverUrl?: string | null
  affinity?: 'favorite' | 'interest' | null
  state?: LibraryState | null
  rewatchCount?: number
  activities?: ActivityItem[]
  recentlyActive?: boolean
}

const rank = (k: ActivityKind) => (TIER1.includes(k) ? 0 : 1)

interface WorkCardProps {
  work: WorkCardData
  onClick?: (work: WorkCardData) => void
  style?: CSSProperties
}

export function WorkCard({ work, onClick, style }: WorkCardProps) {
  const cover = work.coverUrl
  const acts = [...(work.activities ?? [])].sort((a, b) => rank(a.kind) - rank(b.kind)).slice(0, 2)
  const fallback: ActivityKind = work.recentlyActive ? 'waiting' : 'quiet'

  const slots: (ActivityItem | null)[] =
    acts.length === 0 ? [{ kind: fallback }, null] : [acts[0] ?? null, acts[1] ?? null]

  return (
    <div
      onClick={() => onClick?.(work)}
      style={{
        width: '100%',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,.04)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div style={{ position: 'relative', height: 180, background: '#FBF6EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {cover ? (
          <img src={cover} alt={work.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <WorkIcon size={44} style={{ opacity: 0.4 }} />
        )}
        {work.affinity && (
          <span style={{ position: 'absolute', bottom: 10, left: 10, width: 32, height: 32, borderRadius: 9999, background: 'rgba(255,255,255,.95)', boxShadow: '0 1px 3px rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {work.affinity === 'favorite' ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#FF6B6B" stroke="#FF6B6B" strokeWidth="2" strokeLinejoin="round"><path d="M12 20C5 15 3.5 10.5 5.5 7.8 7.1 5.9 10.2 6.1 12 8.4 13.8 6.1 16.9 5.9 18.5 7.8 20.5 10.5 19 15 12 20Z" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFD166" stroke="#E9B72E" strokeWidth="1.5" strokeLinejoin="round"><path d="M12 4.5 14.2 9l5 .7-3.6 3.5.9 5-4.5-2.4L7.4 18l.9-5L4.7 9.7l5-.7z" /></svg>
            )}
          </span>
        )}
      </div>

      <div style={{ padding: '16px 16px 18px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{work.name}</div>

        {work.state && (
          <div style={{ marginBottom: 12 }}>
            <LibraryStateChip state={work.state} rewatchCount={work.rewatchCount} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slots.map((s, i) => (
            <div key={i} style={{ minHeight: 18, display: 'flex', alignItems: 'center' }}>
              {s && <ActivityBadge kind={s.kind} count={s.count} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}



