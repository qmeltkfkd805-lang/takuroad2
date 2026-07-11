'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getGrowthSeries, GrowthSeries, GrowthStep } from '@/services/growthService'
import { Icon, Taku } from '@/components/tds'
import { MaskIcon } from '@/components/collection/MaskIcon'
import { ROUTES } from '@/lib/constants/routes'
import styles from './GrowthPage.module.css'

/* 나의 성장 — 배틀패스

   ⭐ 컬렉션 홈이 "다음 한 걸음"이라면, 여기는 "길 전체"다.
   ⭐ 그래도 주인공은 배지가 아니다. 지금 서 있는 계단이다.
      딴 계단은 조용히 뒤로 물러나고, 지금 도전 중인 것만 빛난다. */

export default function GrowthPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [series, setSeries] = useState<GrowthSeries[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getGrowthSeries(user.id).then(setSeries).catch(() => {}).finally(() => setLoading(false))
  }, [user])

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.signin}>
          <h1>나의 성장</h1>
          <p>로그인하면 도전 중인 목표가 보여요.</p>
          <button onClick={() => router.push(ROUTES.login)}>로그인하기</button>
        </div>
      </div>
    )
  }

  const active = series.filter(s => !s.complete)
  const done = series.filter(s => s.complete)
  const totalEarned = series.reduce((a, s) => a + s.earnedCount, 0)
  const totalSteps = series.reduce((a, s) => a + s.steps.length, 0)

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1>나의 성장 <Icon name="colorstar" size={22} /></h1>
          <p>기록을 쌓을수록 다음 단계가 열려요.</p>
        </div>
        <button className={styles.ghost} onClick={() => router.push('/collection')}>컬렉션으로 ›</button>
      </header>

      {!loading && series.length > 0 && (
        <div className={styles.total}>
          <div className={styles.totalBar}>
            <span style={{ width: `${totalSteps ? (totalEarned / totalSteps) * 100 : 0}%` }} />
          </div>
          <div className={styles.totalNum}>
            <b>{totalEarned}</b> / {totalSteps} 단계 해금
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.list}>
          {[0, 1, 2].map(i => <div key={i} className={styles.skel} />)}
        </div>
      ) : series.length === 0 ? (
        <div className={styles.empty}>
          <Taku pose="sit" size={110} />
          <h2>아직 도전이 없어요</h2>
          <p>곧 새로운 목표가 열려요.</p>
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {active.map(s => (
              <SeriesCard key={s.badgeId} s={s} onGo={() => router.push(s.ctaHref)} />
            ))}
          </div>

          {done.length > 0 && (
            <>
              <h2 className={styles.doneHead}>완료한 도전</h2>
              <div className={styles.list}>
                {done.map(s => (
                  <SeriesCard key={s.badgeId} s={s} onGo={() => router.push(s.ctaHref)} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function SeriesCard({ s, onGo }: { s: GrowthSeries; onGo: () => void }) {
  const current = s.steps.find(st => st.current)
  const remain = current ? Math.max(0, current.target - s.done) : 0
  const pct = current ? Math.min(100, Math.round((s.done / current.target) * 100)) : 100

  return (
    <article className={`${styles.card} ${s.complete ? styles.cardDone : ''}`}>
      <div className={styles.cardHead}>
        <div className={styles.icon}>
          {s.icon
            ? <img src={s.icon} alt="" />
            : <MaskIcon name="star" size={26} color="var(--accent)" />}
        </div>
        <div className={styles.headBody}>
          <div className={styles.name}>{s.badgeName}</div>
          <div className={styles.sub}>
            {s.complete
              ? '모든 단계를 해금했어요'
              : <>{s.verb} <b>{s.done}</b>회 · <b>{remain}회</b>만 더 하면 다음 단계</>}
          </div>
        </div>
        <div className={styles.count}>{s.earnedCount}<em>/{s.steps.length}</em></div>
      </div>

      {!s.complete && (
        <div className={styles.bar}><span style={{ width: `${pct}%` }} /></div>
      )}

      {/* 계단 — 왼쪽에서 오른쪽으로 */}
      <ol className={styles.steps}>
        {s.steps.map((st, i) => (
          <li key={st.tierId} className={styles.stepWrap}>
            {i > 0 && <span className={`${styles.link} ${st.earned ? styles.linkOn : ''}`} />}
            <Step st={st} verb={s.verb} />
          </li>
        ))}
      </ol>

      {!s.complete && (
        <button className={styles.btn} onClick={onGo}>{s.ctaLabel} ›</button>
      )}
    </article>
  )
}

function Step({ st, verb }: { st: GrowthStep; verb: string }) {
  const cls = st.earned
    ? styles.stepDone
    : st.current
      ? styles.stepNow
      : styles.stepLock

  return (
    <div className={`${styles.step} ${cls} ${styles['r_' + (st.rarity ?? 'common')]}`}>
      <div className={styles.stepTarget}>{st.target}</div>
      <div className={styles.stepName}>{st.name}</div>
      <div className={styles.stepState}>
        {st.earned ? '해금' : st.current ? '도전 중' : `${verb} ${st.target}회`}
      </div>
    </div>
  )
}
