'use client'

import { useState, useEffect } from 'react'
import { getBadgeGroups } from '@/services/badgeService'
import { LoadingState } from './SavedShopsTab'
import BadgeSeriesList from './BadgeSeriesList'

export default function BadgesTab({ userId }: { userId: string }) {
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  useEffect(() => {
    getBadgeGroups(userId).then(data => {
      setGroups(data)
      setLoading(false)
    })
  }, [userId])

  if (selectedGroup) {
    return (
      <BadgeSeriesList
        groupSlug={selectedGroup}
        groupName={groups.find(g => g.slug === selectedGroup)?.name ?? ''}
        userId={userId}
        onBack={() => setSelectedGroup(null)}
      />
    )
  }

  if (loading) return <LoadingState />

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {groups.map(group => (
          <button
            key={group.id}
            onClick={() => setSelectedGroup(group.slug)}
            style={{
              border: '1.5px solid var(--border)', borderRadius: '14px',
              padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
              background: 'var(--surface2)', fontFamily: 'inherit',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>{group.icon}</div>
            <div style={{ fontWeight: 900, fontSize: '14px', marginBottom: '4px' }}>{group.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {group.owned} / {group.total}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}