'use client'

import Link from 'next/link'
import CollectionStatsWidget from './CollectionStatsWidget'
import RecentCheckinsWidget from './RecentCheckinsWidget'
import styles from './rail.module.css'

export default function HomeRail() {
  return (
    <aside className={styles.rail}>
      <CollectionStatsWidget />
      <RecentCheckinsWidget />

      {/* 미니맵 — 지도(04) 리디자인 후 MiniMapWidget으로 추출 예정 */}
      <div className={styles.widget}>
        <div className={styles.widgetHead}>
          <span className={styles.widgetTitle}>덕질 지도</span>
          <Link href="/map" className={styles.widgetMore}>지도 보기</Link>
        </div>
        <div className={styles.mapPlaceholder}>
          <span className={styles.mapSoon}>준비 중</span>
          <span className={styles.mapSub}>지도 페이지를 새로 단장하고 있어요</span>
        </div>
      </div>
    </aside>
  )
}
