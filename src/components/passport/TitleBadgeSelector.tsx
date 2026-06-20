'use client'

import { useState, useEffect } from 'react'
import { getMyAvailableTitles, setTitleBadge, clearTitleBadge } from '@/services/passportService'
import { RARITY_COLOR } from '@/services/badgeService'

interface Props {
  userId: string
  onClose: () => void
  onSelected: () => void
}

export default function TitleBadgeSelector({ userId, onClose, onSelected }: Props) {
  const [titles, setTitles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyAvailableTitles(userId).then(data => {
      setTitles(data)
      setLoading(false)
    })
  }, [userId])

  async function handleSelect(tierId: string) {
    const ok = await setTitleBadge(userId, tierId)
    if (ok) {
      onSelected()
      onClose()
    }
  }

  async function handleClear() {
    await clearTitleBadge(userId)
    onSelected()
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: '680px', maxHeight: '70vh', overflowY: 'auto',
          padding: '20px',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '16px' }}>명패 선택</h3>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0' }}>불러오는 중...</p>
        ) : titles.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0', fontSize: '13px' }}>
            아직 보유한 배지가 없어요. 체크인해서 배지를 모아보세요!
          </p>
        ) : (
          <>
            {titles.map(tier => (
              <button
                key={tier.id}
                onClick={() => handleSelect(tier.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '12px 14px', marginBottom: '8px',
                  borderRadius: '10px', border: `1.5px solid ${RARITY_COLOR[tier.rarity] ?? 'var(--border)'}`,
                  background: 'var(--surface2)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{tier.name}</span>
                <span style={{ fontSize: '11px', color: RARITY_COLOR[tier.rarity] }}>{tier.rarity}</span>
              </button>
            ))}
            <button
              onClick={handleClear}
              style={{
                width: '100%', padding: '10px', marginTop: '8px',
                borderRadius: '10px', border: '1px solid var(--border)',
                background: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer',
              }}
            >
              명패 해제
            </button>
          </>
        )}
      </div>
    </div>
  )
}