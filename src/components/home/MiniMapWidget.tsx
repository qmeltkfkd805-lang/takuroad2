'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import { Shop } from '@/types/shop'
import { HotMapData } from '@/lib/home/hotMap'
import KakaoMap, { KakaoMapRef } from '@/components/map/KakaoMap'
import { CATEGORIES } from '@/lib/constants/categories'
import { getShopStatus } from '@/lib/utils/shopStatus'
import styles from './rail.module.css'
import AppIcon from '@/components/tds/AppIcon'

const noop = () => {}

interface Props {
  shops: Shop[]
  hotMap: HotMapData
  eventCount: number
}

// 미니맵 아래 대표 샵: 운영중 + 방문수 높은 순 1개 (실데이터)
function pickFeatured(shops: Shop[]): Shop | null {
  const active = shops.filter((s) => s.status === 'active')
  const pool = active.length ? active : shops
  if (!pool.length) return null
  return [...pool].sort((a, b) => (b.visit_count ?? 0) - (a.visit_count ?? 0))[0]
}

export default function MiniMapWidget({ shops, hotMap }: Props) {
  const { center, hotRegions } = hotMap
  const mapRef = useRef<KakaoMapRef>(null)

  useEffect(() => {
    if (!center) return
    let n = 0
    const id = setInterval(() => {
      mapRef.current?.relayout()
      mapRef.current?.moveCenter(center.lat, center.lng, 6)
      if (++n >= 12) clearInterval(id)
    }, 250)
    return () => clearInterval(id)
  }, [center])

  const featured = pickFeatured(shops)
  const status = featured ? getShopStatus(featured) : null
  const isOpen = status?.kind === 'open' || status?.kind === 'closing_soon'

  return (
    <div className={styles.widget}>
      <div className={styles.widgetHead}>
        <span className={styles.widgetTitle}>덕질 지도</span>
        <Link href="/map" className={styles.widgetMore}>전체 지도 보기</Link>
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

      <div className={styles.mapChips}>
        <Link href="/map" className={styles.mapChip}>전체</Link>
        {CATEGORIES.map((c) => (
          <Link key={c.slug} href={`/map?cat=${encodeURIComponent(c.name)}`} className={styles.mapChip}>
            {c.name}
          </Link>
        ))}
      </div>

      {featured && (
        <Link href={`/shop/${featured.slug}`} className={styles.mapShopCard}>
          <span className={styles.mapShopThumb}>
            {featured.images?.[0] ? <img src={featured.images[0]} alt="" /> : <AppIcon name="shop" size={22} color="var(--muted)" />}
          </span>
          <span className={styles.mapShopBody}>
            <span className={styles.mapShopName}>{featured.name}</span>
            <span className={styles.mapShopMeta}>
              {status && status.label && (
                <span className={isOpen ? styles.openNow : styles.closedNow}>{status.label}</span>
              )}
              {featured.rating_count > 0 && (
                <span className={styles.mapShopRating}>★ {featured.rating_avg.toFixed(1)} ({featured.rating_count})</span>
              )}
            </span>
          </span>
        </Link>
      )}
    </div>
  )
}
