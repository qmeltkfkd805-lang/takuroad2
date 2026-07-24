'use client'
import { useState, useEffect } from 'react'
import { getMyLevelInfo, levelTier } from '@/services/expService'

/** 닉네임 옆에 붙는 작은 레벨 배지 */
export default function UserLevelBadge({ userId, size = 11 }: { userId?: string | null; size?: number }) {
  const [lv, setLv] = useState<number | null>(null)

  useEffect(() => {
    if (!userId) return
    let alive = true
    getMyLevelInfo(userId)
      .then(info => { if (alive) setLv((info as any)?.level ?? null) })
      .catch(() => {})
    return () => { alive = false }
  }, [userId])

  if (lv == null) return null
  const tier = levelTier(lv)

  return (
    <span
      title={tier.title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
        fontSize: size, fontWeight: 800, lineHeight: 1,
        color: 'var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.08))',
        border: '1px solid var(--accent)', borderRadius: 4,
        padding: '2px 5px',
      }}
    >
      Lv.{lv}
    </span>
  )
}