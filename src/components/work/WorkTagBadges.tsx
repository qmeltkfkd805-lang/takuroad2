'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getAffinitiesForTags, setAffinity, clearAffinity,
} from '@/services/workRelationshipService'
import { FavoriteTier } from '@/types/work-relationship'
import { AFFINITY_LABEL } from '@/lib/constants/workRelationship'

interface Work { id: string; name: string; slug: string }

export default function WorkTagBadges({ works }: { works: Work[] }) {
  const { user } = useAuth()
  const router = useRouter()
  const [affinities, setAffinities] = useState<Record<string, FavoriteTier>>({})
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!user || works.length === 0) { setAffinities({}); return }
    getAffinitiesForTags(user.id, works.map(w => w.id)).then(setAffinities)
  }, [user, works])

  if (works.length === 0) return null

  async function choose(work: Work, choice: FavoriteTier | 'home') {
    setOpenId(null)
    if (choice === 'home') { router.push(`/work/${work.slug}`); return }
    if (!user) { router.push('/login'); return }

    const current = affinities[work.id] ?? null
    if (current === choice) {
      const ok = await clearAffinity(user.id, work.id)
      if (ok) setAffinities(prev => { const n = { ...prev }; delete n[work.id]; return n })
    } else {
      const ok = await setAffinity(user.id, work.id, choice)
      if (ok) setAffinities(prev => ({ ...prev, [work.id]: choice }))
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
      {works.map(work => {
        const aff = affinities[work.id]
        const icon = aff ? AFFINITY_LABEL[aff].icon : null
        const isOpen = openId === work.id
        const isFav = aff === 'favorite'
        const isInterest = aff === 'interest'
        return (
          <div key={work.id} style={{ position: 'relative' }}>
            <button
              onClick={() => setOpenId(isOpen ? null : work.id)}
              style={{
                padding: '7px 14px', borderRadius: '999px',
                border: isFav ? '1.5px solid #FF6B6B'
                  : isInterest ? '1.5px solid var(--accent)'
                  : '1.5px solid var(--border)',
                background: isFav ? '#FFECEC'
                  : isInterest ? '#FFEDE6'
                  : 'var(--surface)',
                fontSize: '13px', fontWeight: 700,
                color: isFav ? '#D63A3A' : isInterest ? '#A23E18' : 'var(--text)',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                transition: 'transform .1s',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(.96)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {icon ? `${icon} ` : ''}{work.name}
            </button>

            {isOpen && (
              <div style={{
                position: 'absolute', top: '40px', left: 0, zIndex: 50,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)', boxShadow: 'var(--sh-md)',
                overflow: 'hidden', minWidth: '160px',
              }}>
                <MenuItem
                  label={`${AFFINITY_LABEL.favorite.icon} ${AFFINITY_LABEL.favorite.label}`}
                  active={aff === 'favorite'}
                  onClick={() => choose(work, 'favorite')}
                />
                <MenuItem
                  label={`${AFFINITY_LABEL.interest.icon} ${AFFINITY_LABEL.interest.label}`}
                  active={aff === 'interest'}
                  onClick={() => choose(work, 'interest')}
                />
                <MenuItem
                  label="작품 페이지로 이동"
                  active={false}
                  onClick={() => choose(work, 'home')}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MenuItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '11px 14px', border: 'none',
        background: active ? 'var(--surface2)' : 'var(--surface)',
        color: 'var(--text)', fontSize: '13px', fontWeight: active ? 700 : 400,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}
