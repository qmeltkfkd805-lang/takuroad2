'use client'

import CollectionStatsWidget from './CollectionStatsWidget'
import RecentCheckinsWidget from './RecentCheckinsWidget'
import MiniMapWidget from './MiniMapWidget'
import styles from './rail.module.css'
import { Shop } from '@/types/shop'

export default function HomeRail({ shops = [] }: { shops?: Shop[] }) {
  return (
    <aside className={styles.rail}>
      <CollectionStatsWidget />
      <RecentCheckinsWidget />
      <MiniMapWidget shops={shops} />
    </aside>
  )
}
