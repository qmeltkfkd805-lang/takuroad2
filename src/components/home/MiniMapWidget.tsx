'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Shop } from '@/types/shop'
import styles from './rail.module.css'

// 홈에서도 카카오 SDK(전역 로드)를 쓰지만, SSR은 피해서 클라이언트에서만 렌더
const KakaoMap = dynamic(() => import('@/components/map/KakaoMap'), { ssr: false })

const noop = () => {}

export default function MiniMapWidget({ shops }: { shops: Shop[] }) {
  return (
    <div className={styles.widget}>
      <div className={styles.widgetHead}>
        <span className={styles.widgetTitle}>덕질 지도</span>
        <Link href="/map" className={styles.widgetMore}>지도 보기</Link>
      </div>

      {/* 실제 지도 미리보기 — 위 오버레이가 상호작용 막고 클릭하면 /map */}
      <Link href="/map" className={styles.miniMap} aria-label="지도 보기">
        <span className={styles.miniMapInner}>
          <KakaoMap
            shops={shops}
            activeShopId={null}
            myLocation={null}
            onSelectShop={noop}
            onMapClick={noop}
            onSelectGroup={noop}
          />
        </span>
        <span className={styles.miniMapOverlay} />
      </Link>
    </div>
  )
}
