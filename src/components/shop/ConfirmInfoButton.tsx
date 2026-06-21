'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { confirmInfo, getConfirmationStats, hasCheckedInToday, InfoConfirmationStats } from '@/services/shopInfoConfirmService'
import { ROUTES } from '@/lib/constants/routes'
import { useRouter } from 'next/navigation'

interface Props {
  shopId: string
  targetTable: 'shops' | 'shop_products'
  targetField: string | null
  targetId: string
}

export default function ConfirmInfoButton({ shopId, targetTable, targetField, targetId }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const [stats, setStats] = useState<InfoConfirmationStats | null>(null)
  const [hasCheckIn, setHasCheckIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [justConfirmed, setJustConfirmed] = useState(false)

  useEffect(() => {
    loadStats()
  }, [targetId])

  async function loadStats() {
    const data = await getConfirmationStats(targetTable, targetField, targetId)
    setStats(data)
    if (user) {
      const checkInId = await hasCheckedInToday(user.id, shopId)
      setHasCheckIn(!!checkInId)
    }
    setLoading(false)
  }

  async function handleConfirm() {
    if (!user) {
      router.push(ROUTES.login)
      return
    }
    setConfirming(true)
    let checkInId: string | null = null
    if (hasCheckIn) {
      checkInId = await hasCheckedInToday(user.id, shopId)
    }
    const ok = await confirmInfo(shopId, targetTable, targetField, targetId, user.id, checkInId)
    if (ok) {
      setJustConfirmed(true)
      await loadStats()
    }
    setConfirming(false)
  }

  if (loading || !stats) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
      {stats.count > 0 && (
        <span>
          👥 {stats.count}명 확인
          {stats.lastConfirmedAt && ` · ${new Date(stats.lastConfirmedAt).toLocaleDateString('ko-KR')}`}
        </span>
      )}
      <button
        onClick={handleConfirm}
        disabled={confirming || justConfirmed}
        style={{
          padding: '4px 10px', borderRadius: '12px',
          border: `1px solid ${justConfirmed ? 'var(--green)' : 'var(--border)'}`,
          background: justConfirmed ? 'var(--green-l)' : 'var(--surface)',
          color: justConfirmed ? 'var(--green)' : 'var(--muted)',
          fontSize: '11px', fontWeight: 700, cursor: justConfirmed ? 'default' : 'pointer',
          fontFamily: 'inherit', flexShrink: 0,
        }}
      >
        {justConfirmed
          ? '✓ 확인했어요'
          : hasCheckIn
            ? '📍 방문해서 확인했어요'
            : '✓ 나도 확인했어요'}
      </button>
    </div>
  )
}