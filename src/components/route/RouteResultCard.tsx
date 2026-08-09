'use client'
import RouteThumb from './RouteThumb'
import { formatDistance } from '@/hooks/useCurrentLocation'
import { rtStops, metaShort, type RouteMapVariant } from './routeMeta'
import styles from './RouteResultCard.module.css'

export type RouteView = 'grid' | 'list'

export function HeartIcon({ size = 15, color = 'currentColor', filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, verticalAlign: '-2px' }}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.04 3 5.5l7 7Z" />
    </svg>
  )
}

function WalkIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, verticalAlign: '-2px' }}>
      <circle cx="13" cy="4" r="1.6" /><path d="M11 21l1.5-6-2.5-2.5V8l4 1.5 2 3M9.5 21l2-4M15 14l1.5 7" />
    </svg>
  )
}

/** 홈·목록 공용 루트 카드. view로 그리드/리스트 전환, 동일 데이터 모델 사용. */
export default function RouteResultCard({
  route, view = 'grid', saved, onOpen, onToggleSave, mapVariant = 'detail',
}: {
  route: any
  view?: RouteView
  saved: boolean
  onOpen: () => void
  onToggleSave: (e: React.MouseEvent) => void
  mapVariant?: RouteMapVariant
}) {
  const stops = rtStops(route)

  const heart = (
    <button className={styles.heart} onClick={onToggleSave} aria-pressed={saved} aria-label={saved ? '저장 해제' : '저장'}>
      <HeartIcon size={16} filled={saved} color={saved ? 'var(--accent)' : '#fff'} />
    </button>
  )
  // 같은 건물 등 이동 거리가 0이어도 도보 루트임을 표시 (좌표가 있는 도보 루트)
  const hasStops = (route.route_shops?.length ?? 0) > 0
  const walkLabel = hasStops
    ? ((route.total_distance_m ?? 0) >= 1 ? `도보 ${formatDistance(route.total_distance_m)}` : '도보 이동')
    : null
  const walk = walkLabel ? <span className={styles.walk}><WalkIcon />{walkLabel}</span> : null
  const title = <h3 className={styles.title} title={route.title}>{route.title}</h3>
  const meta = <p className={styles.meta}>{metaShort(route)}</p>
  const saves = <span className={styles.saves}><HeartIcon size={12} filled color="var(--accent)" />{route.likes ?? 0}</span>
  const foot = (
    <div className={styles.foot}>
      {walk ?? <span />}
      {saves}
    </div>
  )

  if (view === 'list') {
    return (
      <article className={styles.row} onClick={onOpen}>
        <div className={styles.rowThumb}>
          <RouteThumb stops={stops} height={104} variant={mapVariant} />
        </div>
        <div className={styles.rowBody}>
          {title}{meta}
          {walk}
        </div>
        <div className={styles.rowRight}>
          {heart}
          {saves}
        </div>
      </article>
    )
  }

  return (
    <article className={styles.card} onClick={onOpen}>
      <div className={styles.thumb}>
        <RouteThumb stops={stops} height={132} variant={mapVariant} />
        {heart}
      </div>
      <div className={styles.body}>
        {title}{meta}{foot}
      </div>
    </article>
  )
}
