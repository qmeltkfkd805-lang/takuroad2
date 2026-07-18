'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAllBadges, ShowcaseBadge } from '@/services/cosmeticService'
import styles from './BadgePreview.module.css'

export default function BadgePreview({ userId }: { userId: string }) {
  const [badges, setBadges] = useState<ShowcaseBadge[]>([])
  useEffect(() => {
    getAllBadges(userId).then(setBadges).catch(() => {})
  }, [userId])

  const earned = badges.filter(b => b.earned)
  const shown = earned.slice(0, 9)

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <h3>획득한 배지</h3>
        <span className={styles.count}>{earned.length} / {badges.length}</span>
      </div>
      {earned.length === 0 ? (
        <p className={styles.empty}>아직 획득한 배지가 없어요.</p>
      ) : (
        <div className={styles.grid}>
          {shown.map(b => (
            <div key={b.tierId} className={styles.item}>
              <div className={styles.icon}>
                {b.icon ? <img src={b.icon} alt="" /> : null}
              </div>
              <div className={styles.name}>{b.name}</div>
            </div>
          ))}
        </div>
      )}
      <Link href="/cosmetic" className={styles.more}>모든 배지 보기 ›</Link>
    </div>
  )
}