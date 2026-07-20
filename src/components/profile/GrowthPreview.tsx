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
    .slice(0, 4)
  const mission = [...d.series]
    .filter(s => !s.complete)
    .map(s => { const cur = s.steps.find(st => st.current); const target = cur?.target ?? 0; return { s, target, pct: target ? s.done / target : 0 } })
    .filter(m => m.target > 0)
    .sort((a, b) => b.pct - a.pct)[0]

  const recent = d.recent.slice(0, 3)
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

      {mission && (
        <Link href={'/growth'} className={styles.mission}>
          <div className={styles.missionHead}>오늘의 추천 미션</div>
          <div className={styles.missionText}>
            <b>{mission.s.badgeName}</b> 까지 {Math.max(0, mission.target - mission.s.done)}번 남았어요!
          </div>
          <div className={styles.missionCta}>도전하러 가기 ›</div>
          <img className={styles.missionTaku} src='/taku/taku-run.png' />
        </Link>
      )}

    </div>
  )
}
function fmtDate(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate())
}
function Row({ s }: { s: GrowthSeries }) {
  const cur = s.steps.find(st => st.current)
  const target = cur?.target ?? 0
  const level = s.complete ? s.steps.length : s.earnedCount + 1
  const pct = s.complete ? 100 : (target ? Math.min(100, Math.round((s.done / target) * 100)) : 0)
  return (
    <div className={styles.row}>
      <div className={styles.icon}>
        {s.icon ? <img src={s.icon} /> : null}
      </div>
      <div className={styles.body}>
        <div className={styles.name}>{s.badgeName} <span>Lv.{level}</span></div>
        <div className={styles.bar}><span style={{ width: pct + '%' }} /></div>
      </div>
      <div className={styles.num}>{s.complete ? '완료' : s.done + '/' + target}</div>
    </div>
  )
}