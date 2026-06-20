'use client'

import { useState, useEffect } from 'react'
import { getBadgesInGroup } from '@/services/badgeService'
import { LoadingState } from './SavedShopsTab'
import BadgeTierDetail from './BadgeTierDetail'

interface Props {
  groupSlug: string
  groupName: string
  userId: string
  onBack: () => void
}

export default function BadgeSeriesList({ groupSlug, groupName, userId, onBack }: Props) {
  const [badges, setBadges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null)

  useEffect(() => {
    getBadgesInGroup(groupSlug, userId).then(data => {
      setBadges(data)
      setLoading(false)
    })
  }, [groupSlug, userId])

  if (selectedBadge) {
    return (
      <BadgeTierDetail
        badgeSlug={selectedBadge}
        userId={userId}
        onBack={() => setSelectedBadge(null)}
      />
    )
  }

  if (loading) return <LoadingState />

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}
        >←</button>
        <h2 style={{ fontSize: '16px', fontWeight: 900 }}>{groupName}</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {badges.map(badge => (
          <div
            key={badge.id}
            onClick={() => setSelectedBadge(badge.slug)}
            style={{
              border: `2px solid ${badge.owned ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '12px', padding: '14px 8px', textAlign: 'center',
              cursor: 'pointer',
              background: badge.owned ? 'var(--accent-l)' : 'var(--surface2)',
              opacity: badge.owned ? 1 : 0.7,
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>
              {badge.owned ? '☑' : '□'}
            </div>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{badge.iconUrl}</div>
            <div style={{ fontSize: '11px', fontWeight: 700 }}>{badge.name}</div>
          </div>
        ))}
      </div>

      {badges.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '40px 0' }}>
          아직 등록된 배지가 없어요
        </p>
      )}
    </div>
  )
}