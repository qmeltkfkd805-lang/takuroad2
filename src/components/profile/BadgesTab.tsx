'use client'
import { useState, useEffect } from 'react'
import { getBadgeGroups } from '@/services/badgeService'
import { getShowcase, getAllBadges, getMyBadges, ShowcaseBadge } from '@/services/cosmeticService'
import { RARITY_LABEL } from '@/lib/cosmetics/style'
import { LoadingState } from './SavedShopsTab'
import cos from '@/components/cosmetic/CosmeticPage.module.css'

const RARITY_COLOR: Record<string, string> = {
  common: 'var(--muted)', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b',
}

export default function BadgesTab({ userId }: { userId: string }) {
  const [showcase, setShowcase] = useState<ShowcaseBadge[]>([])
  const [badges, setBadges] = useState<ShowcaseBadge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getShowcase(userId), getMyBadges(userId), getAllBadges(userId)]).then(([ids, mine, all]) => {
      setBadges(all)
      const byId = new Map(mine.map(b => [b.tierId, b]))
      setShowcase(ids.map(id => byId.get(id)).filter(Boolean) as ShowcaseBadge[])
      setLoading(false)
    })
  }, [userId])

  if (loading) return <LoadingState />

  return (
    <div style={{ padding: '16px' }}>
      {/* 대표 배지 */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--muted)', marginBottom: '14px' }}>대표 배지</div>
        {showcase.length > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '80px', padding: '36px 24px', background: 'var(--accent-l)', borderRadius: '16px', border: 'none' }}>
            {showcase.map(b => (
              <div key={b.tierId} style={{ textAlign: 'center' }}>
                <div style={{ width: '80px', height: '80px', margin: '0 auto 10px' }}>
                  {b.icon ? <img src={b.icon} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 6px 8px rgba(0,0,0,.4))' }} /> : null}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', marginBottom: '2px' }}>{b.name}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: RARITY_COLOR[b.rarity] ?? 'var(--muted)' }}>{b.badgeName}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', background: 'var(--surface2)', borderRadius: '14px' }}>
            프로필 꾸미기에서 대표 배지를 골라보세요
          </div>
        )}
      </div>

      {/* 전체 배지 (등급별) */}
      {(['common', 'rare', 'epic', 'legendary'] as const).map(rar => {
        const group = badges.filter(b => b.rarity === rar)
        if (group.length === 0) return null
        const got = group.filter(b => b.earned).length
        return (
          <div key={rar} className={cos.rarGroup}>
            <div className={cos.rarHead}>
              <span className={[cos.rarBadge, cos['r_' + rar]].join(' ')}>{RARITY_LABEL[rar]}</span>
              <span className={cos.rarCount}>{got} / {group.length}</span>
            </div>
            <div className={cos.grid}>
              {group.map(b => <BadgeTile key={b.tierId} b={b} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BadgeTile({ b }: { b: ShowcaseBadge }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      className={[cos.tile, !b.earned ? cos.tileLocked : ''].join(' ')}
      style={{ position: 'relative' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className={!b.earned ? cos.tileLockedInner : undefined}>
        <div className={[cos.thumb, cos['bg_' + b.rarity] ?? ''].join(' ')}>
          {b.icon ? <img src={b.icon} className={cos.badgeImg} /> : null}
        </div>
        <div className={cos.tileName}>{b.name}</div>
        <div className={[cos.rarity, cos['r_' + b.rarity]].join(' ')}>
          {RARITY_LABEL[b.rarity] ?? b.rarity}
        </div>
      </div>
      {hover && b.hint && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 'calc(100% + 8px)', transform: 'translateX(-50%)',
          width: 'max-content', maxWidth: 200, zIndex: 30,
          background: 'var(--text)', color: 'var(--surface)',
          fontSize: 12, lineHeight: 1.55, fontWeight: 500, textAlign: 'left',
          padding: '9px 12px', borderRadius: 10,
          boxShadow: '0 6px 20px rgba(0,0,0,.22)', pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 800, marginBottom: 3 }}>{b.earned ? '획득 완료' : '획득 조건'}</div>
          {b.hint}
        </div>
      )}
    </div>
  )
}