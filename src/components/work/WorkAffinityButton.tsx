'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getAffinity, setAffinity, clearAffinity } from '@/services/workRelationshipService'
import { FavoriteTier } from '@/types/work-relationship'
import { AFFINITY_LABEL } from '@/lib/constants/workRelationship'

// 작품을 만나는 화면(작품 홈/샵 상세/검색)에서 재사용하는 ❤️/⭐ 등록 버튼.
// affinity는 (user,tag)당 하나 → 최애/좋아하는 작품은 상호배타. 3단계 토글.
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
      // 같은 걸 다시 누름 → 해제
      const ok = await clearAffinity(user.id, tagId)
      if (ok) setAff(null)
    } else {
      // 없거나 다른 등급 → 이 등급으로 설정/변경
      const ok = await setAffinity(user.id, tagId, tier)
      if (ok) setAff(tier)
    }
    setSaving(false)
  }

  if (loading) {
    return <div style={{ height: '40px' }} />
  }

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <TierButton
        active={affinity === 'favorite'}
        label={`${AFFINITY_LABEL.favorite.icon} ${AFFINITY_LABEL.favorite.label}`}
        onClick={() => toggle('favorite')}
      />
      <TierButton
        active={affinity === 'interest'}
        label={`${AFFINITY_LABEL.interest.icon} ${AFFINITY_LABEL.interest.label}`}
        onClick={() => toggle('interest')}
      />
    </div>
  )
}

function TierButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 12px', borderRadius: 'var(--r-sm)',
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--text)',
        fontSize: '13px', fontWeight: 700, cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}