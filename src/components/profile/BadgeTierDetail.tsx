'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getBadgeTiers, getUnvisitedShopsForTag, RARITY_COLOR, RARITY_LABEL } from '@/services/badgeService'
import { LoadingState } from './SavedShopsTab'

interface Props {
  badgeSlug: string
  userId: string
  onBack: () => void
}

function BadgeIcon({ iconUrl, size = 40 }: { iconUrl: string | null; size?: number }) {
  if (!iconUrl) return <span style={{ fontSize: size }}>🏅</span>
  if (iconUrl.startsWith('http')) {
    return (
      <img
        src={iconUrl}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    )
  }
  return <span style={{ fontSize: size }}>{iconUrl}</span>
}

export default function BadgeTierDetail({ badgeSlug, userId, onBack }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [unvisitedShops, setUnvisitedShops] = useState<any[]>([])
  const [showUnvisited, setShowUnvisited] = useState(false)

  useEffect(() => {
    getBadgeTiers(badgeSlug, userId).then(result => {
      setData(result)
      setLoading(false)
    })
  }, [badgeSlug, userId])

  async function handleShowUnvisited(tag: string) {
    const shops = await getUnvisitedShopsForTag(userId, tag)
    setUnvisitedShops(shops)
    setShowUnvisited(true)
  }

  if (loading) return <LoadingState />
  if (!data) return null

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}
        >←</button>
        <h2 style={{ fontSize: '18px', fontWeight: 900 }}>{data.badge.name}</h2>
      </div>

      <div style={{
        width: '100%', height: '100px',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        marginBottom: '20px', background: 'var(--surface2)', borderRadius: '14px',
        padding: '12px',
      }}>
        <BadgeIcon iconUrl={data.badge.iconUrl} size={48} />
      </div>

      {data.tiers.map((tier: any) => (
        <div key={tier.id} style={{
          border: `1.5px solid ${tier.earned ? RARITY_COLOR[tier.rarity as keyof typeof RARITY_COLOR] : 'var(--border)'}`,
          borderRadius: '14px', padding: '16px', marginBottom: '12px',
          background: tier.earned ? `${RARITY_COLOR[tier.rarity as keyof typeof RARITY_COLOR]}10` : 'var(--surface2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '18px' }}>{tier.earned ? '☑' : '□'}</span>
            <span style={{ fontWeight: 900, fontSize: '15px' }}>
              {tier.isHidden && !tier.earned ? '???' : tier.name}
            </span>
            <span style={{
              fontSize: '10px', fontWeight: 700, color: RARITY_COLOR[tier.rarity as keyof typeof RARITY_COLOR],
              border: `1px solid ${RARITY_COLOR[tier.rarity as keyof typeof RARITY_COLOR]}`, borderRadius: '6px', padding: '1px 6px',
            }}>
              {RARITY_LABEL[tier.rarity as keyof typeof RARITY_LABEL]}
            </span>
          </div>

          {tier.description && !(tier.isHidden && !tier.earned) && (
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>{tier.description}</p>
          )}

          {!tier.earned && tier.progress && (
            <div>
              <div style={{
                height: '8px', background: 'var(--border)', borderRadius: '4px',
                overflow: 'hidden', marginBottom: '6px',
              }}>
                <div style={{
                  height: '100%', width: `${tier.progress.percent}%`,
                  background: RARITY_COLOR[tier.rarity as keyof typeof RARITY_COLOR], borderRadius: '4px',
                  transition: 'width .3s',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)' }}>
                <span>{tier.progress.visited} / {tier.progress.total}</span>
                <span>{tier.progress.percent}%</span>
              </div>

              {tier.conditionType === 'tag_visit_percent' && (
                <button
                  onClick={() => handleShowUnvisited(tier.conditionTarget.tag)}
                  style={{
                    marginTop: '10px', width: '100%', padding: '8px',
                    borderRadius: '8px', border: '1px solid var(--border)',
                    background: 'var(--surface)', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  📍 남은 샵 보기
                </button>
              )}
            </div>
          )}

          {tier.earned && tier.earnedAt && (
            <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
              획득일 {new Date(tier.earnedAt).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>
      ))}

      {showUnvisited && (
        <div
          onClick={() => setShowUnvisited(false)}
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
            <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '12px' }}>
              아직 안 가본 샵 ({unvisitedShops.length}곳)
            </h3>
            {unvisitedShops.map(shop => (
              <Link
                key={shop.id}
                href={`/shop/${shop.slug}`}
                style={{
                  display: 'block', padding: '10px 0', borderBottom: '1px solid var(--border)',
                  textDecoration: 'none', color: 'inherit',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{shop.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{shop.addr}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}