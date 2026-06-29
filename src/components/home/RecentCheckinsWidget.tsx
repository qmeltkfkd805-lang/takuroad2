'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyCheckIns } from '@/services/checkInService'
import styles from './rail.module.css'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return m + '분 전'
  const h = Math.floor(m / 60)
  if (h < 24) return h + '시간 전'
  return Math.floor(h / 24) + '일 전'
}

export default function RecentCheckinsWidget() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[] | null>(null)

  useEffect(() => {
    if (!user) { setItems(null); return }
    getMyCheckIns(user.id).then(d => setItems(d.slice(0, 4))).catch(() => {})
  }, [user])

  return (
    <div className={styles.widget}>
      <div className={styles.widgetHead}>
        <span className={styles.widgetTitle}>최근 체크인</span>
      </div>
      {!user ? (
        <p className={styles.widgetEmpty}>로그인하면 체크인 기록이 쌓여요</p>
      ) : items && items.length === 0 ? (
        <p className={styles.widgetEmpty}>아직 체크인이 없어요</p>
      ) : (
        <div>
          {(items ?? []).map(c => (
            <Link key={c.id} href={c.shops?.slug ? '/shop/' + c.shops.slug : '#'} className={styles.checkRow}>
              <span className={styles.checkIcon}><img src="/icons/checkin.png" alt="" /></span>
              <span className={styles.checkBody}>
                <span className={styles.checkName}>{c.shops?.name ?? '샵'}</span>
                <span className={styles.checkMeta}>{timeAgo(c.created_at)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
