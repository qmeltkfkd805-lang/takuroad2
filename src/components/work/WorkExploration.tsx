'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { AXIS_KEYS, AXIS_LABEL, AXIS_ICON, AXIS_VERB, WorkProgress, getWorkProgress } from '@/lib/work/workProgress'
import { MaskIcon } from '@/components/collection/MaskIcon'
import styles from './WorkExploration.module.css'

/* 작품 탐험도 — "이 작품을 얼마나 팠나"
   ⭐ 계산은 정책(lib/work/workProgress)에 물어본다. 화면은 그걸로 레벨만 매긴다.
   ⭐ 주인공은 '탐험 레벨'. "전부 다녀야 하는 100%"는 인기작일수록 도달 불가라 동기를 꺾는다.
      대신 방문/이벤트/카페 1점 + 루트 2점을 모은 점수로 레벨을 올려, 항상 다음 레벨이 손에 닿게 한다. */

// 레벨 임계값 — 삼각수(1·3·6·10·15…): Lv.L 도달에 필요한 누적 점수 = L(L+1)/2. 뒤로 갈수록 벌어진다.
const needFor = (level: number) => (level * (level + 1)) / 2
function levelTitle(level: number): string {
  if (level <= 0) return '탐험 준비'
  if (level <= 2) return '입문 탐험가'
  if (level <= 4) return '탐험가'
  if (level <= 6) return '성지순례자'
  if (level <= 8) return '탐험 마스터'
  return '탐험 정복자'
}
function workScore(p: WorkProgress): number {
  return p.axes.shop.done + p.axes.event.done + p.axes.cafe.done + p.axes.route.done * 2
}
function workLevel(score: number): number {
  let lv = 0
  while (score >= needFor(lv + 1)) lv++
  return lv
}

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
    const s = workScore(p)
    const lv = workLevel(s)
    // 링은 '다음 레벨까지' 진행률로 채운다. 이미 전부 다 팠으면 꽉 채움.
    const rp = p.overall >= 100 ? 100 : Math.round(((s - needFor(lv)) / (needFor(lv + 1) - needFor(lv))) * 100)
    const t = setTimeout(() => setShown(rp), 80)
    return () => clearTimeout(t)
  }, [p])

  if (!user || loading || !p) return null

  const axes = AXIS_KEYS.filter(k => p.axes[k].total > 0)
  if (axes.length === 0) return null   // 빈 껍데기는 그리지 않는다

  const score = workScore(p)
  const level = workLevel(score)
  const maxed = p.overall >= 100
  const remain = Math.max(0, needFor(level + 1) - score)   // 다음 레벨까지 남은 점수

  return (
    <section className={styles.card}>
      <div className={styles.main}>
        {/* 주인공 — 탐험 레벨 (링은 다음 레벨까지 진행률) */}
        <div className={styles.gauge} style={{ ['--p' as any]: shown }}>
          <div className={styles.gaugeIn}>
            <span className={styles.pct}><em>Lv.</em>{level}</span>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.title}>나의 탐험 레벨</div>
          <p className={styles.desc}>
            {maxed ? '이 작품을 완전히 정복했어요!'
              : level === 0 ? '한 곳만 다녀와도 Lv.1 달성!'
              : `${levelTitle(level)} · 다음 레벨까지 ${remain}`}
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
