'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getAffinity, setAffinity, clearAffinity } from '@/services/workRelationshipService'
import { FavoriteTier } from '@/types/work-relationship'

export default function WorkAffinityButton({ tagId }: { tagId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [affinity, setAff] = useState<FavoriteTier | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getAffinity(user.id, tagId).then(a => { setAff(a); setLoading(false) })
  }, [user, tagId])

  async function toggle(tier: FavoriteTier) {
    if (!user) { router.push('/login'); return }
    if (saving) return
    setSaving(true)
    if (affinity === tier) {
      const ok = await clearAffinity(user.id, tagId)
      if (ok) setAff(null)
    } else {
      const ok = await setAffinity(user.id, tagId, tier)
      if (ok) setAff(tier)
    }
    setSaving(false)
  }

  if (loading) return <div style={{ height: '40px' }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <TierButton active={affinity === 'favorite'} icon={<HeartIcon active={affinity === 'favorite'} />} label="최애" onClick={() => toggle('favorite')} />
        <TierButton active={affinity === 'interest'} icon={<StarIcon active={affinity === 'interest'} />} label="관심" onClick={() => toggle('interest')} />
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--muted)', paddingLeft: 2 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {affinity ? '새 이벤트가 열리면 알림을 보내드려요' : '최애·관심으로 등록하면 새 이벤트 알림을 받아요'}
      </span>
    </div>
  )
}

function TierButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '10px 18px', borderRadius: '9999px',
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--text)',
        fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function HeartIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : '#FF5692'
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={c} stroke="none">
      <path d="M12 21s-7.5-4.6-10-9.2A5.4 5.4 0 0 1 12 6a5.4 5.4 0 0 1 10 5.8C19.5 16.4 12 21 12 21z" />
    </svg>
  )
}

function StarIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : '#F5B100'
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={c} stroke="none">
      <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.8 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" />
    </svg>
  )
}
