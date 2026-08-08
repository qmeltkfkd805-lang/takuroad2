'use client'
/* 진행 중 하단 미니시트 — 현장 확인 n/m, 다음 추천지, 거리/도보시간, 길안내/일시중지/루트 종료.
   방문 인증 버튼은 두지 않음(자동 감지). 화면에 고정 오버레이라 기존 레이아웃은 건드리지 않음. */
import type { RunCheckpoint, RunPhase } from '@/lib/routeRun/useRouteRun'
import { formatDistance } from '@/hooks/useCurrentLocation'
import styles from './RouteRunSheet.module.css'

function walkMin(m: number | null): string | null {
  if (m == null) return null
  const min = Math.max(1, Math.round(m / 75))   // 도보 약 75m/분
  return `도보 약 ${min}분`
}

export default function RouteRunSheet(props: {
  phase: RunPhase
  verifiedCount: number
  totalCheckpoints: number
  nextCheckpoint: RunCheckpoint | null
  nextDistanceM: number | null
  geoDenied: boolean
  onPause: () => void
  onResume: () => void
  onEnd: () => void
}) {
  const { phase, verifiedCount, totalCheckpoints, nextCheckpoint, nextDistanceM, geoDenied, onPause, onResume, onEnd } = props
  const pct = totalCheckpoints ? Math.round((verifiedCount / totalCheckpoints) * 100) : 0
  const paused = phase === 'paused'

  const navigate = () => {
    if (!nextCheckpoint) return
    const name = encodeURIComponent(nextCheckpoint.label ?? '목적지')
    window.open(`https://map.kakao.com/link/to/${name},${nextCheckpoint.lat},${nextCheckpoint.lng}`, '_blank', 'noopener')
  }

  return (
    <div className={styles.sheet} role="region" aria-label="루트 진행">
      <div className={styles.grip} />
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <span className={styles.badge}>{paused ? '일시중지' : '진행 중'}</span>
          <span className={styles.count}>현장 확인 {verifiedCount}/{totalCheckpoints}</span>
        </div>
        <span className={styles.pct}>{pct}%</span>
      </div>
      <div className={styles.bar}><div className={styles.barFill} style={{ width: `${pct}%` }} /></div>

      {geoDenied && (
        <div className={styles.notice}>
          위치 권한이 꺼져 있어 자동 확인이 안 돼요. 그래도 <b>루트 종료</b>에서 방문한 곳을 직접 확인하고 완주할 수 있어요.
        </div>
      )}

      {nextCheckpoint ? (
        <div className={styles.next}>
          <div className={styles.nextMeta}>
            <span className={styles.nextLabel}>다음</span>
            <span className={styles.nextName}>{nextCheckpoint.label ?? '다음 장소'}</span>
          </div>
          <div className={styles.nextDist}>
            {nextDistanceM != null ? <>{formatDistance(nextDistanceM)}{walkMin(nextDistanceM) ? ` · ${walkMin(nextDistanceM)}` : ''}</> : '위치 확인 중…'}
          </div>
        </div>
      ) : (
        <div className={styles.next}><div className={styles.nextName}>모든 지점을 확인했어요 🎉</div></div>
      )}

      <div className={styles.controls}>
        <button className={styles.ghost} onClick={navigate} disabled={!nextCheckpoint}>길안내</button>
        {paused
          ? <button className={styles.ghost} onClick={onResume}>다시 시작</button>
          : <button className={styles.ghost} onClick={onPause}>일시중지</button>}
        <button className={styles.end} onClick={onEnd}>오늘 루트 종료</button>
      </div>
    </div>
  )
}
