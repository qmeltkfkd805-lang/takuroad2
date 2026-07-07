'use client'
import { CSSProperties } from 'react'
import { getRouteDifficulty, difficultyDotColor } from '@/lib/utils/routeDifficulty'

export interface RouteCardData {
  id: string
  title: string
  summary?: string | null
  shopCount: number
  distanceM?: number | null
  durationMin?: number | null
  visited?: number | null
  completedAt?: string | null
}

const STEPS = 5

const fmtDist = (m?: number | null) => {
  if (m == null) return null
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`
}

const LINE_CORAL = 'var(--accent)'
const LINE_DASH = '#FFC9B3'
const GOLD = '#F5B100'

interface RouteCardProps {
  route: RouteCardData
  onStart?: (route: RouteCardData) => void
  onClick?: (route: RouteCardData) => void
  style?: CSSProperties
}

export function RouteCard({ route, onStart, onClick, style }: RouteCardProps) {
  const { title, summary, shopCount, distanceM, durationMin, visited, completedAt } = route
  const diff = getRouteDifficulty(durationMin)
  const started = visited != null && visited > 0
  const complete = visited != null && shopCount > 0 && visited >= shopCount
  const dist = fmtDist(distanceM)

  const ratio = complete ? 1 : shopCount > 0 && visited != null ? Math.min(visited / shopCount, 1) : 0
  const filledSteps = Math.round(ratio * (STEPS - 1))
  const filledPct = (filledSteps / (STEPS - 1)) * 100

  return (
    <div
      onClick={() => onClick?.(route)}
      style={{
        position: 'relative',
        background: complete ? 'linear-gradient(135deg,#FFF9EC,#FFFFFF)' : 'var(--surface)',
        border: complete ? '1.5px solid #F5D88A' : '1px solid var(--border)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: complete ? '0 1px 6px rgba(245,177,0,.12)' : '0 1px 4px rgba(0,0,0,.04)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div style={{ position: 'relative', height: 88, background: complete ? 'linear-gradient(135deg,#FFF4D6,#FFFFFF)' : 'linear-gradient(135deg,#FFF3EE,#FFFFFF)', display: 'flex', alignItems: 'center', padding: '0 22px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          {complete ? (
            <div style={{ position: 'absolute', left: 7, right: 7, top: '50%', height: 0, borderTop: `3px solid ${GOLD}`, transform: 'translateY(-50%)' }} />
          ) : (
            <>
              <div style={{ position: 'absolute', left: 7, right: 7, top: '50%', height: 0, borderTop: `2.5px dashed ${LINE_DASH}`, transform: 'translateY(-50%)' }} />
              {filledPct > 0 && (
                <div style={{ position: 'absolute', left: 7, width: `calc(${filledPct}% - 7px)`, top: '50%', height: 0, borderTop: `3px solid ${LINE_CORAL}`, transform: 'translateY(-50%)' }} />
              )}
            </>
          )}
          {Array.from({ length: STEPS }).map((_, i) => {
            const isEnd = i === 0 || i === STEPS - 1
            const filled = complete || i <= filledSteps
            const size = isEnd ? 14 : 11
            return (
              <span key={i} style={{
                position: 'relative',
                width: size, height: size, borderRadius: '50%',
                background: complete ? GOLD : filled ? LINE_CORAL : '#fff',
                border: filled ? 'none' : `2.5px solid ${LINE_DASH}`,
                boxShadow: filled ? `0 0 0 3px ${complete ? '#FFFBF0' : '#fff'}` : 'none',
                flexShrink: 0,
              }} />
            )
          })}
        </div>
        {!complete && (
          <span style={{ position: 'absolute', top: 9, right: 10, background: started ? LINE_CORAL : 'rgba(255,255,255,.95)', color: started ? '#fff' : '#A23E18', fontSize: 11, fontWeight: started ? 800 : 700, padding: '3px 9px', borderRadius: 9999 }}>
            {started ? `${visited} / ${shopCount}` : `${shopCount}곳`}
          </span>
        )}
      </div>

      <div style={{ position: 'relative', padding: '12px 15px 14px' }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {summary && (
          <div style={{ fontSize: 12.5, color: complete ? '#B08A3C' : '#5A43B5', fontWeight: 600, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 11, fontSize: 12, color: complete ? '#946400' : '#7A7A7A', marginBottom: complete ? 0 : 12 }}>
          {dist && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={complete ? '#B08A3C' : '#9B968D'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c-4.5-5.5-6.6-9.4-6.6-12.5a6.6 6.6 0 0 1 13.2 0c0 3.1-2.1 7-6.6 12.5z" /><circle cx="12" cy="8.5" r="2.3" /></svg>
              {dist}
            </span>
          )}
          {durationMin != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={complete ? '#B08A3C' : '#9B968D'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
              도보 {durationMin}분
            </span>
          )}
          {complete && completedAt ? (
            <span style={{ marginLeft: 'auto', color: '#946400', fontWeight: 700 }}>완주 {completedAt}</span>
          ) : diff ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
              <span style={{ color: diff.color, fontWeight: 700 }}>{diff.label}</span>
              <span style={{ display: 'inline-flex', gap: 2 }}>
                {[0, 1, 2].map((d) => (
                  <i key={d} style={{ width: 4, height: 9, borderRadius: 1, background: d < diff.dots ? difficultyDotColor(diff.level) : '#E3E1D8' }} />
                ))}
              </span>
            </span>
          ) : null}
        </div>

        {!complete && (
          <button
            onClick={(e) => { e.stopPropagation(); onStart?.(route) }}
            style={{
              width: '100%',
              border: started ? `1px solid ${LINE_CORAL}` : 'none',
              background: started ? '#fff' : LINE_CORAL,
              color: started ? LINE_CORAL : '#fff',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              padding: 9, borderRadius: 11, cursor: 'pointer',
            }}
          >
            {started ? '이어서 가기' : '코스 시작'}
          </button>
        )}
      </div>

      {complete && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/stamps/route.png" alt="" aria-hidden="true" style={{ position: 'absolute', right: 10, top: 74, width: 104, height: 104, opacity: 0.9, transform: 'rotate(-14deg)', pointerEvents: 'none', zIndex: 5 }} />
      )}
    </div>
  )
}

