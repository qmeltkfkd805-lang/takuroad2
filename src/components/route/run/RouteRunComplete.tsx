'use client'
/* 종료 결과 모달 — '루트 완주'는 하나의 경험으로만 표시. '인증 완주/일반 완주' 구분 없음.
   방문/현장확인/직접기록은 부가 정보로만 보여준다. */
import type { EndResult } from '@/lib/routeRun/useRouteRun'
import styles from './RouteRunComplete.module.css'

export default function RouteRunComplete({ result, routeTitle, onClose }: {
  result: EndResult
  routeTitle: string
  onClose: () => void
}) {
  const completed = result.completed
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/taku/taku-checkin.png" alt="" className={styles.char} />
        <div className={styles.sub}>{completed ? '루트 완주' : '오늘의 기록'}</div>
        <div className={styles.title}>{routeTitle}</div>
        <p className={styles.msg}>
          {completed ? '완주를 축하합니다!' : '기록을 저장했어요.'}
        </p>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{result.visitedCount}</span>
            <span className={styles.statLabel}>방문한 장소</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{result.fieldVerified}</span>
            <span className={styles.statLabel}>현장에서 확인</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{result.manualCount}</span>
            <span className={styles.statLabel}>직접 기록</span>
          </div>
        </div>

        {result.bonusGranted && <div className={styles.bonus}>현장 확인 보너스를 받았어요 ✨</div>}

        <button className={styles.close} onClick={onClose}>확인</button>
      </div>
    </div>
  )
}
