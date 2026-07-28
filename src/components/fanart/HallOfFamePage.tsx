'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getHallOfFame, HallItem } from '@/services/fanartService'

// '2026-07A' → '2026.07 상반기'
function seasonLabel(key: string | null, seasonStart: string): string {
  if (key && /^\d{4}-\d{2}[AB]$/.test(key)) {
    const y = key.slice(0, 4)
    const m = key.slice(5, 7)
    const half = key.endsWith('A') ? '상반기' : '하반기'
    return `${y}.${m} ${half}`
  }
  const d = new Date(seasonStart)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function Trophy({ size = 16, color = '#D69A00' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  )
}

const MEDAL: Record<number, { bg: string; fg: string }> = {
  1: { bg: 'linear-gradient(90deg,#FFD84D,#F5B100)', fg: '#5c3b00' },
  2: { bg: 'linear-gradient(90deg,#DfE4EA,#B7BFC9)', fg: '#3a3f47' },
  3: { bg: 'linear-gradient(90deg,#F0B892,#D98A5B)', fg: '#5a2f12' },
}
function rankStyle(rank: number, big?: boolean): React.CSSProperties {
  const c = MEDAL[rank] ?? { bg: 'rgba(0,0,0,.62)', fg: '#fff' }
  const sz = big ? 30 : 24
  return {
    position: 'absolute', top: big ? 10 : 8, left: big ? 10 : 8, zIndex: 2,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: sz, height: sz, padding: `0 ${big ? 9 : 7}px`, borderRadius: 9999,
    fontSize: big ? 15 : 12.5, fontWeight: 900, color: c.fg, background: c.bg,
    boxShadow: '0 2px 8px rgba(0,0,0,.22)',
  }
}

function HofCard({ s, rank, big }: { s: HallItem; rank: number; big?: boolean }) {
  const medaled = rank <= 3
  return (
    <Link
      href={`/community/${s.postId}`}
      style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: medaled ? '2px solid #F5C542' : '1px solid var(--border)', background: 'var(--surface)', textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div style={{ aspectRatio: '1 / 1', background: 'var(--surface2)' }}>
        {s.image
          ? <img src={s.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trophy size={30} color="var(--border)" /></div>}
      </div>

      <span style={rankStyle(rank, big)}>{rank}</span>

      {s.isCurrent && (
        <span style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 800, color: '#7a4f00', background: 'linear-gradient(90deg,#FFE08A,#FFC64B)' }}>
          <Trophy size={11} color="#7a4f00" /> 현재
        </span>
      )}

      <div style={{ padding: big ? '12px 14px' : '10px 12px' }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{s.workName}</div>
        {s.title && <div style={{ fontSize: big ? 15 : 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{s.title}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>by {s.author?.nickname ?? '익명'}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, fontWeight: 800, color: '#C98A00' }}>
            <Trophy size={12} color="#C98A00" />{s.score}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{seasonLabel(s.seasonKey, s.seasonStart)}</div>
      </div>
    </Link>
  )
}

export default function HallOfFamePage() {
  const [items, setItems] = useState<HallItem[] | null>(null)

  useEffect(() => {
    let alive = true
    getHallOfFame().then(e => { if (alive) setItems(e) })
    return () => { alive = false }
  }, [])

  const top = items ? items.slice(0, 3) : []
  const rest = items ? items.slice(3) : []

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '8px 20px 60px' }}>
      <div style={{ padding: '24px 0 8px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 9, margin: 0 }}>
          <Trophy size={24} /> 명예의 전당
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.6 }}>
          역대 대표 팬아트를 점수가 높았던 순서로 모았어요.
        </p>
      </div>

      {items === null ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '90px 20px', textAlign: 'center' }}>
          <Trophy size={44} color="var(--border)" />
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 14 }}>아직 선정된 대표 팬아트가 없어요</p>
        </div>
      ) : (
        <>
          {/* TOP 3 */}
          <div style={{ marginTop: 18, borderRadius: 20, padding: '18px 16px', background: 'linear-gradient(135deg, rgba(255,224,138,.22), rgba(255,198,75,.05))', border: '1px solid #F1D48A' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 13, fontWeight: 900, color: '#B9820A', letterSpacing: '0.04em' }}>
              <Trophy size={15} color="#B9820A" /> TOP 3
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, top.length)}, 1fr)`, gap: 14 }}>
              {top.map((s, i) => <HofCard key={s.postId + s.seasonStart} s={s} rank={i + 1} big />)}
            </div>
          </div>

          {/* 나머지 전체 기록 */}
          {rest.length > 0 && (
            <>
              <h2 style={{ fontSize: 15, fontWeight: 800, margin: '30px 0 12px' }}>전체 기록</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 16 }}>
                {rest.map((s, i) => <HofCard key={s.postId + s.seasonStart} s={s} rank={i + 4} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
