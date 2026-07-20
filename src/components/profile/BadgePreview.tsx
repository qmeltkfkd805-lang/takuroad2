'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAllBadges, ShowcaseBadge } from '@/services/cosmeticService'
import { getGrowthCenter, GrowthCenter } from '@/services/growthCenterService'
import styles from './BadgePreview.module.css'
export default function BadgePreview({ userId }: { userId: string }) {
  const [badges, setBadges] = useState<ShowcaseBadge[]>([])
  const [growth, setGrowth] = useState<GrowthCenter | null>(null)
  useEffect(() => {
    getAllBadges(userId).then(setBadges).catch(() => {})
    getGrowthCenter(userId).then(setGrowth).catch(() => {})
  }, [userId])
  const earned = badges.filter(b => b.earned)
  const shown = earned.slice(0, 9)

  // 다음 목표 — 완료 안 된 시리즈 중 진행률 최고
  const next = growth ? [...growth.series]
    .filter(s => !s.complete)
    .map(s => { const cur = s.steps.find(st => st.current); const target = cur?.target ?? 0; return { s, target, pct: target ? s.done / target : 0 } })
    .filter(m => m.target > 0)
    .sort((a, b) => b.pct - a.pct)[0] : null

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <h3>획득한 배지</h3>
        <span className={styles.count}>{earned.length} / {badges.length}</span>
      </div>
      {earned.length === 0 ? (
        <p className={styles.empty}>아직 획득한 배지가 없어요</p>
      ) : (
        <div className={styles.grid}>
          {shown.map(b => (
            <div key={b.tierId} className={styles.item}>
              <div className={styles.icon}>
                {b.icon ? <img src={b.icon} /> : null}
              </div>
              <div className={styles.name}>{b.name}</div>
            </div>
          ))}
        </div>
      )}
      <Link href="/cosmetic" className={styles.more}>모든 배지 보기 ›</Link>

      {next && (
        <Link href="/growth" className={styles.nextGoal}>
          <div className={styles.nextHead}>다음 목표</div>
          <div className={styles.nextBadge}>
            {next.s.icon ? <img src={next.s.icon} className={styles.nextIcon} /> : null}
            <span className={styles.nextName}>{next.s.badgeName} Lv.{next.s.earnedCount + 1}</span>
          </div>
          <div className={styles.nextBar}><span style={{ width: Math.min(100, Math.round(next.pct * 100)) + '%' }} /></div>
          <div className={styles.nextNum}>{next.s.done} / {next.target}</div>
        </Link>
      )}
    </div>
  )
}