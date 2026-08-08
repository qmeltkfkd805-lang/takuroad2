'use client'
/* 스팟 요약 — 스팟 수와 무관하게 고정 높이로 표시.
   1~3곳: 전부 / 4곳+: 대표 3개 + '+N곳 더 보기'(방문 코스로 이동).
   이름은 같은 건물(place)로 묶은 rtChain 기준. */
import { rtChain } from './routeMeta'
import styles from './RouteSpotSummary.module.css'

export default function RouteSpotSummary({ route, onMore }: { route: any; onMore: () => void }) {
  const names = rtChain(route)
  if (names.length === 0) return null
  const shown = names.slice(0, 3)
  const rest = names.length - shown.length
  return (
    <div className={styles.wrap}>
      <span className={styles.label}>대표 스팟</span>
      <div className={styles.chips}>
        {shown.map((n, i) => (
          <span key={i} className={styles.chip} title={n}>{i > 0 && <em className={styles.arrow} aria-hidden>→</em>}{n}</span>
        ))}
        {rest > 0 && (
          <button type="button" className={styles.more} onClick={onMore} aria-label={`나머지 ${rest}곳 더 보기 — 방문 코스로 이동`}>+{rest}곳 더 보기</button>
        )}
      </div>
    </div>
  )
}
