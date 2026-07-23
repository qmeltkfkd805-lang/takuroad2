'use client'

import { useState, useEffect, useMemo } from 'react'
import { getBadgesInGroup } from '@/services/badgeService'
import { LoadingState } from './SavedShopsTab'
import BadgeTierDetail from './BadgeTierDetail'
import AppIcon from '@/components/tds/AppIcon'

interface Props {
  groupSlug: string
  groupName: string
  userId: string
  onBack: () => void
}

function BadgeIcon({ iconUrl }: { iconUrl: string | null }) {
  if (!iconUrl) return <span style={{ fontSize: 40 }}>🏅</span>
  if (iconUrl.startsWith('http')) {
    return (
      <img
        src={iconUrl}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    )
  }
  return <span style={{ fontSize: 40 }}>{iconUrl}</span>
}

export default function BadgeSeriesList({ groupSlug, groupName, userId, onBack }: Props) {
  const [badges, setBadges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    getBadgesInGroup(groupSlug, userId).then(data => {
      setBadges(data)
      setLoading(false)
    })
  }, [groupSlug, userId])

  const sortedBadges = useMemo(() => {
    return [...badges].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [badges])

  const filteredBadges = useMemo(() => {
    if (!query.trim()) return sortedBadges
    return sortedBadges.filter(b => b.name.toLowerCase().includes(query.toLowerCase()))
  }, [sortedBadges, query])

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}
        >←</button>
        <h2 style={{ fontSize: '16px', fontWeight: 900 }}>{groupName}</h2>
      </div>

      {badges.length > 5 && (
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`${groupName} 검색...`}
            style={{
              width: '100%', padding: '10px 36px 10px 14px',
              border: '1.5px solid var(--border)', borderRadius: '10px',
              fontSize: '14px', fontFamily: 'inherit',
              background: 'var(--surface2)', color: 'var(--text)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', fontSize: '14px', color: 'var(--muted)', cursor: 'pointer',
              }}
            >✕</button>
          ) : (
            <span style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '14px', color: 'var(--muted)', pointerEvents: 'none',
            }}>🔍</span>
          )}
        </div>
      )}

      {query && (
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
          {filteredBadges.length}개 검색됨
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {filteredBadges.map(badge => (
          <BadgeCard key={badge.id} badge={badge} onClick={() => setSelectedBadge(badge.slug)} />
        ))}
      </div>

      {badges.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '40px 0' }}>
          아직 등록된 배지가 없어요
        </p>
      )}

      {badges.length > 0 && filteredBadges.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '40px 0' }}>
          &quot;{query}&quot;에 해당하는 작품이 없어요
        </p>
      )}
    </div>
  )
}

function BadgeCard({ badge, onClick }: { badge: any; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        border: '2px solid ' + (badge.owned ? 'var(--accent)' : 'var(--border)'),
        borderRadius: '12px', padding: '14px 12px', textAlign: 'center',
        cursor: 'pointer',
        background: badge.owned ? 'var(--accent-l)' : 'var(--surface2)',
        opacity: badge.owned ? 1 : 0.7,
      }}
    >
      <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'center' }}>
        <AppIcon name={badge.owned ? 'check' : 'close'} size={15} color={badge.owned ? 'var(--accent)' : 'var(--muted)'} />
      </div>
      <div style={{ width: '100%', height: '70px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '8px' }}>
        <BadgeIcon iconUrl={badge.iconUrl} />
      </div>
      <div style={{ fontSize: '12px', fontWeight: 700 }}>{badge.name}</div>

      {hover && badge.hint && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 'calc(100% + 8px)', transform: 'translateX(-50%)',
          width: 'max-content', maxWidth: 220, zIndex: 20,
          background: 'var(--text)', color: 'var(--surface)',
          fontSize: 12, lineHeight: 1.55, fontWeight: 500, textAlign: 'left',
          padding: '9px 12px', borderRadius: 10,
          boxShadow: '0 6px 20px rgba(0,0,0,.22)', pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 800, marginBottom: 3 }}>
            {badge.allDone ? '모두 달성했어요' : (badge.hintTier ? badge.hintTier + ' 조건' : '획득 조건')}
          </div>
          {badge.hint}
        </div>
      )}
    </div>
  )
}
