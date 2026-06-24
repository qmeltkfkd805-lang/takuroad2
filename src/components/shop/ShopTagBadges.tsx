'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getShopTags } from '@/services/shopProductService'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getAffinitiesForTags, setAffinity, clearAffinity,
} from '@/services/workRelationshipService'
import { FavoriteTier } from '@/types/work-relationship'
import { AFFINITY_LABEL } from '@/lib/constants/workRelationship'

interface Props {
  shopId: string
}

export default function ShopTagBadges({ shopId }: Props) {
  const { user } = useAuth()
  const router = useRouter()
  const [tags, setTags] = useState<any[]>([])
  const [affinities, setAffinities] = useState<Record<string, FavoriteTier>>({})
  const [openTagId, setOpenTagId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // 1) 취급 작품 가져오기
  useEffect(() => {
    getShopTags(shopId).then(data => {
      setTags(data)
      setLoading(false)
    })
  }, [shopId])

  // 2) 그 작품들의 내 affinity를 "한 번에" 조회 (N+1 회피)
  useEffect(() => {
    if (!user || tags.length === 0) return
    const tagIds = tags.map((t: any) => t.id)
    getAffinitiesForTags(user.id, tagIds).then(setAffinities)
  }, [user, tags])

  if (loading || tags.length === 0) return null

  async function choose(tag: any, tier: FavoriteTier | 'home') {
    setOpenTagId(null)
    if (tier === 'home') {
      router.push(`/work/${tag.slug}`)
      return
    }
    if (!user) { router.push('/login'); return }

    const current = affinities[tag.id] ?? null
    if (current === tier) {
      // 같은 걸 다시 누름 → 해제
      const ok = await clearAffinity(user.id, tag.id)
      if (ok) setAffinities(prev => {
        const next = { ...prev }; delete next[tag.id]; return next
      })
    } else {
      const ok = await setAffinity(user.id, tag.id, tier)
      if (ok) setAffinities(prev => ({ ...prev, [tag.id]: tier }))
    }
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '10px' }}>🎮 취급 작품</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {tags.map(tag => {
          const aff = affinities[tag.id]
          const icon = aff ? AFFINITY_LABEL[aff].icon : null
          const isOpen = openTagId === tag.id
          return (
            <div key={tag.id} style={{ position: 'relative' }}>
              <button
                onClick={() => setOpenTagId(isOpen ? null : tag.id)}
                style={{
                  padding: '6px 12px', borderRadius: '16px',
                  border: aff ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                  background: 'var(--surface2)', fontSize: '13px', fontWeight: 700,
                  color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {icon ? `${icon} ` : ''}{tag.name}
              </button>

              {isOpen && (
                <div style={{
                  position: 'absolute', top: '38px', left: 0, zIndex: 50,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)', boxShadow: 'var(--sh-md)',
                  overflow: 'hidden', minWidth: '150px',
                }}>
                  <MenuItem
                    label={`${AFFINITY_LABEL.favorite.icon} ${AFFINITY_LABEL.favorite.label}`}
                    active={aff === 'favorite'}
                    onClick={() => choose(tag, 'favorite')}
                  />
                  <MenuItem
                    label={`${AFFINITY_LABEL.interest.icon} ${AFFINITY_LABEL.interest.label}`}
                    active={aff === 'interest'}
                    onClick={() => choose(tag, 'interest')}
                  />
                  <MenuItem
                    label="→ 작품 홈으로 이동"
                    active={false}
                    onClick={() => choose(tag, 'home')}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
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