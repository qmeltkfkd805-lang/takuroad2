'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { AXIS_KEYS, AXIS_LABEL, AXIS_ICON, AXIS_VERB, WorkProgress, getWorkProgress } from '@/lib/work/workProgress'
import { MaskIcon } from '@/components/collection/MaskIcon'
import styles from './WorkExploration.module.css'

/* 작품 탐험도 — "이 작품을 얼마나 팠나"
   ⭐ 계산하지 않는다. 정책(lib/work/workProgress)에 물어본다.
   ⭐ 주인공은 숫자 하나(종합 탐험도). 축은 "왜 그 숫자인지"를 설명하는 조연.
      진행바를 4줄 나란히 늘어놓으면 뭐가 중요한지 사라진다. */

export default function WorkExploration({ tagId }: { tagId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [p, setP] = useState<WorkProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [shown, setShown] = useState(0)   // 링이 0에서 차오르게

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getWorkProgress(user.id, [tagId])
      .then(m => setP(m.get(tagId) ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, tagId])

  useEffect(() => {
    if (!p) return
    const t = setTimeout(() => setShown(p.overall), 80)
    return () => clearTimeout(t)
  }, [p])

  if (!user || loading || !p) return null

  const axes = AXIS_KEYS.filter(k => p.axes[k].total > 0)
  if (axes.length === 0) return null   // 빈 껍데기는 그리지 않는다

  return (
    <section className={styles.card}>
      <div className={styles.main}>
        {/* 주인공 — 종합 탐험도 */}
        <div className={styles.gauge} style={{ ['--p' as any]: shown }}>
          <div className={styles.gaugeIn}>
            <span className={styles.pct}>{p.overall}<em>%</em></span>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.title}>나의 탐험도</div>
          <p className={styles.desc}>
            {p.overall >= 100 ? '이 작품은 다 팠어요. 대단한데요.'
              : p.overall >= 50 ? '절반을 넘었어요. 조금만 더.'
              : p.overall > 0 ? '이제 시작이에요.'
              : '아직 기록이 없어요.'}
          </p>

          {/* 조연 — 왜 그 숫자인지 */}
          <ul className={styles.axes}>
            {axes.map(k => {
              const a = p.axes[k]
              return (
                <li key={k} className={styles.axis}>
                  <span className={styles.axisTop}>
                    <MaskIcon name={AXIS_ICON[k]} size={15} color="var(--muted)" />
                    <span className={styles.axisLabel}>{AXIS_LABEL[k]}</span>
                    <span className={styles.axisNum}>{a.done}<em>/{a.total}</em></span>
                  </span>
                  <span className={styles.axisBar}><span style={{ width: `${a.pct}%` }} /></span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {p.next && (
        <button className={styles.next} onClick={() => p.next?.href && router.push(p.next.href)}>
          <span className={styles.nextLabel}>다음 목표</span>
          <span className={styles.nextText}>
            <b>{p.next.name}</b>를 {AXIS_VERB[p.next.axis]} 시 {p.next.after}
          </span>
          <span className={styles.nextArrow}>›</span>
        </button>
      )}
    </section>
  )
}
