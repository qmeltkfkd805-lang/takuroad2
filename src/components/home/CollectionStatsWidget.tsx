'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyHomeStats, HomeStats } from '@/services/homeStatsService'
import styles from './rail.module.css'

const TILES: { key: keyof HomeStats; label: string; icon: string; color: string; tint: string }[] = [
  { key: 'visitedShopCount', label: '방문 샵', icon: 'shop', color: '#3B9BE8', tint: '#E8F4FF' },
  { key: 'checkInCount', label: '체크인', icon: 'checkin', color: '#FF5692', tint: '#FFEAF1' },
  { key: 'favoriteWorkCount', label: '좋아한 작품', icon: 'heart', color: '#FF6B6B', tint: '#FFECEC' },
  { key: 'completedRouteCount', label: '완료 루트', icon: 'route', color: '#1FAE8C', tint: '#E1F7F2' },
]

export default function CollectionStatsWidget() {
  const { user } = useAuth()
  const [stats, setStats] = useState<HomeStats | null>(null)

  useEffect(() => {
    if (!user) { setStats(null); return }
    getMyHomeStats(user.id).then(setStats).catch(() => {})
  }, [user])

  return (
    <div className={styles.widget}>
      <div className={styles.widgetHead}>
        <span className={styles.widgetTitle}>내 컬렉션</span>
        {user && <Link href="/profile" className={styles.widgetMore}>전체 보기</Link>}
      </div>
      {!user ? (
        <p className={styles.widgetEmpty}>로그인하고 컬렉션을 모아보세요</p>
      ) : (
        <div className={styles.stats}>
          {TILES.map(t => (
            <div key={t.key} className={styles.statTile}>
              <span className={styles.statIconBox} style={{ background: t.tint }}>
                <span
                  className={styles.statIcon}
                  style={{ background: t.color, WebkitMaskImage: 'url(/icons/' + t.icon + '.png)', maskImage: 'url(/icons/' + t.icon + '.png)' }}
                />
              </span>
              <span className={styles.statNum}>{stats ? stats[t.key] : '-'}</span>
              <span className={styles.statLabel}>{t.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
