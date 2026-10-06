'use client'

import { useEffect, useState } from 'react'
import RecentCheckinsWidget from './RecentCheckinsWidget'
import MiniMapWidget from './MiniMapWidget'
import styles from './rail.module.css'
import { Shop } from '@/types/shop'
import { HotMapData } from '@/lib/home/hotMap'
import { imagesFirst } from '@/lib/utils/shopOrder'

interface Props {
  hotMap: HotMapData
  eventCount?: number
}

export default function HomeRail({ hotMap, eventCount = 0 }: Props) {
  /* 📱 모바일 홈에는 덕질 지도를 두지 않는다 — 숨기기만 하면 카카오 지도를 그래도 불러와서 홈이 느려지므로
     PC(마우스 기기)로 확인된 뒤에만 그린다 */
  const [pc, setPc] = useState(false)
  useEffect(() => { setPc(window.matchMedia('(hover: hover) and (pointer: fine)').matches) }, [])
  /* 지도에 찍을 샵은 홈 화면이 뜬 뒤에(PC에서만) 따로 가져온다 — 홈 서버 응답을 가볍게 해서 화면이 바로 뜨게 */
  const [shops, setShops] = useState<Shop[]>([])
  useEffect(() => {
    if (!pc) return
    let alive = true
    import('@/services/shopService').then(m => m.getShopsForMiniMap()).then(list => { if (alive) setShops(imagesFirst(list)) }).catch(() => {})
    return () => { alive = false }
  }, [pc])
  return (
    <aside className={`${styles.rail} ${styles.hideMobile}`}>
      {pc && <MiniMapWidget shops={shops} hotMap={hotMap} eventCount={eventCount} />}
      {/* 최근 활동은 모바일에서 숨김 (PC는 그대로) */}
      <div className={styles.hideMobile}><RecentCheckinsWidget /></div>
    </aside>
  )
}
