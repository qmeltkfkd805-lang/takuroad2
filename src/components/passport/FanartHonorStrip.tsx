'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getUserFanartHonor, UserFanartHonor } from '@/services/fanartService'

// 작가 명예 스트립 — 대표 팬아트 선정 이력이 있을 때만 노출
export default function FanartHonorStrip({ userId }: { userId: string }) {
  const [honor, setHonor] = useState<UserFanartHonor | null>(null)

  useEffect(() => {
    let alive = true
    getUserFanartHonor(userId).then(h => { if (alive) setHonor(h) })
    return () => { alive = false }
  }, [userId])

  if (!honor || honor.count === 0) return null

  return (
    <div style={{ margin: '14px 16px 0', padding: '14px 16px', borderRadius: 16, border: '1px solid #F1D48A', background: 'linear-gradient(135deg, rgba(255,224,138,.20), rgba(255,198,75,.07))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D69A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>
        <span style={{ fontSize: 14.5, fontWeight: 900, color: 'var(--text)' }}>
          대표 팬아트 <span style={{ color: '#C98A00' }}>{honor.count}회</span> 선정
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {honor.works.map(w => (
          <Link
            key={w.tagId}
            href={w.slug ? `/work/${w.slug}` : `/work/${w.tagId}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 9999, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12.5, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}
          >
            {w.name}
            {w.seasons > 1 && <span style={{ color: 'var(--muted)', fontWeight: 800 }}>×{w.seasons}</span>}
          </Link>
        ))}
      </div>
    </div>
  )
}
