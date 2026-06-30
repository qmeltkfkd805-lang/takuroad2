'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import { Shop } from '@/types/shop'
import { HotMapData } from '@/lib/home/hotMap'
import KakaoMap, { KakaoMapRef } from '@/components/map/KakaoMap'
import styles from './rail.module.css'

const noop = () => {}

interface Props {
  shops: Shop[]
  hotMap: HotMapData
  eventCount: number
}

export default function MiniMapWidget({ shops, hotMap, eventCount }: Props) {
  const { center, hotRegions, hotShopCount, shopCount } = hotMap
  const mapRef = useRef<KakaoMapRef>(null)

  // 지도가 로드된 뒤 핫 지역 중심으로 이동 (몇 초간 재시도 — 로드 타이밍 대응)
  useEffect(() => {
    if (!center) return
    let n = 0
    const id = setInterval(() => {
      mapRef.current?.moveCenter(center.lat, center.lng, 6)
      if (++n >= 12) clearInterval(id)
    }, 250)
    return () => clearInterval(id)
  }, [center])

  return (
    <div className={styles.widget}>
      <div className={styles.widgetHead}>
        <span className={styles.widgetTitle}>탐험 지도</span>
        <Link href="/map" className={styles.widgetMore}>지도 보기</Link>
      </div>

      <Link href="/map" className={styles.miniMap} aria-label="지도 보기">
        <span className={styles.miniMapInner}>
          <KakaoMap
            ref={mapRef}
            shops={shops}
            activeShopId={null}
            myLocation={null}
            onSelectShop={noop}
            onMapClick={noop}
            onSelectGroup={noop}
          />
        </span>
        <span className={styles.miniMapOverlay} />
        {hotRegions.length > 0 && (
          <span className={styles.hotBadge}>
            <b>오늘 HOT</b>
            <span>{hotRegions.join(' · ')}</span>
          </span>
        )}
      </Link>

      <div className={styles.miniInfo}>
        <span><b>{hotShopCount}</b> HOT 샵</span>
        <span className={styles.dot}>·</span>
        <span><b>{eventCount}</b> 이벤트</span>
        <span className={styles.dot}>·</span>
        <span><b>{shopCount}</b> 전체 샵</span>
      </div>
    </div>
  )
}
