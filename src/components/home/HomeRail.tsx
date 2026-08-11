'use client'

import RecentCheckinsWidget from './RecentCheckinsWidget'
import MiniMapWidget from './MiniMapWidget'
import styles from './rail.module.css'
import { Shop } from '@/types/shop'
import { HotMapData } from '@/lib/home/hotMap'

interface Props {
  shops?: Shop[]
  hotMap: HotMapData
  eventCount?: number
}

export default function HomeRail({ shops = [], hotMap, eventCount = 0 }: Props) {
  return (
    <aside className={styles.rail}>
      <MiniMapWidget shops={shops} hotMap={hotMap} eventCount={eventCount} />
      {/* 최근 활동은 모바일에서 숨김 (PC는 그대로) */}
      <div className={styles.hideMobile}><RecentCheckinsWidget /></div>
    </aside>
  )
}
