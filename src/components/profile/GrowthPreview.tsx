'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getGrowthCenter, GrowthCenter } from '@/services/growthCenterService'
import { GrowthSeries } from '@/services/growthService'
import styles from './GrowthPreview.module.css'

export default function GrowthPreview({ userId }: { userId: string }) {
  const [d, setD] = useState<GrowthCenter | null>(null)
  useEffect(() => {
    getGrowthCenter(userId).then(setD).catch(() => {})
  }, [userId])

  if (!d) return null

  const top = [...d.series]
    .sort((a, b) => Number(a.complete) - Number(b.complete))
    .slice(0, 5)

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <h3>성장 센터</h3>
        <Link href="/growth" className={styles.more}>전체 보기 ›</Link>
      </div>
      <div className={styles.total}>{d.totalEarned} / {d.totalSteps} 단계 해금</div>
      <div className={styles.list}>
        {top.map(s => <Row key={s.badgeId} s={s} />)}
      </div>
    </div>
  )
}

function Row({ s }: { s: GrowthSeries }) {
  const cur = s.steps.find(st => st.current)
  const target = cur?.target ?? 0
  const level = s.complete ? s.steps.length : s.earnedCount + 1
  const pct = s.complete ? 100 : (target ? Math.min(100, Math.round((s.done / target) * 100)) : 0)
  return (
    <div className={styles.row}>
      <div className={styles.icon}>
        {s.icon ? <img src={s.icon} alt="" /> : null}
      </div>
      <div className={styles.body}>
        <div className={styles.name}>{s.badgeName} <span>Lv.{level}</span></div>
        <div className={styles.bar}><span style={{ width: `${pct}%` }} /></div>
      </div>
      <div className={styles.num}>{s.complete ? '완료' : `${s.done}/${target}`}</div>
    </div>
  )
}