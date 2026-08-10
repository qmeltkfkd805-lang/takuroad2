'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyRecentActivities, RecentActivity } from '@/services/activityService'
import styles from './rail.module.css'

function timeAgo(iso: string) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const m = Math.floor((Date.now() - t) / 60000)
  if (m < 1) return '방금'
  if (m < 60) return m + '분 전'
  const h = Math.floor(m / 60)
  if (h < 24) return h + '시간 전'
  return Math.floor(h / 24) + '일 전'
}

// 활동 종류별 파스텔 색 (내 컬렉션 타일 톤 참고)
const ICON_STYLE: Record<string, { c: string; bg: string }> = {
  checkin: { c: '#3B9BE8', bg: '#E8F4FF' },  // 방문 — 블루
  route:   { c: '#1FAE8C', bg: '#E1F7F2' },  // 완주·제작 — 민트
  event:   { c: '#E0952B', bg: '#FFF3DE' },  // 이벤트 — 앰버
  shop:    { c: '#8B7BE8', bg: '#EFECFD' },  // 샵 등록 — 바이올렛
  heart:   { c: '#FF6B6B', bg: '#FFECEC' },  // 작품 — 레드
  star:    { c: '#FF5692', bg: '#FFEAF1' },  // 리뷰·업적 — 핑크
}

// 활동 종류별 인라인 아이콘 (외부 png 의존 X)
function ActIcon({ kind }: { kind: string }) {
  const color = ICON_STYLE[kind]?.c ?? ICON_STYLE.star.c
  const p = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'checkin': return <svg {...p}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
    case 'route': return <svg {...p}><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="5" r="2.2" /><path d="M8.2 19H14a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h5.6" /></svg>
    case 'event': return <svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
    case 'shop': return <svg {...p}><path d="M4 9l1-5h14l1 5M5 9v10h14V9M4 9h16" /></svg>
    case 'heart': return <svg {...p}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.04 3 5.5l7 7Z" /></svg>
    default: return <svg {...p}><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.8 6.8 20l1-5.8L3.5 9.2l5.9-.9z" /></svg>
  }
}

export default function RecentCheckinsWidget() {
  const { user } = useAuth()
  const [items, setItems] = useState<RecentActivity[] | null>(null)

  useEffect(() => {
    if (!user) { setItems(null); return }
    getMyRecentActivities(user.id, 5).then(setItems).catch(() => setItems([]))
  }, [user])

  return (
    <div className={styles.widget}>
      <div className={styles.widgetHead}>
        <span className={styles.widgetTitle}>최근 활동</span>
        {user && items && items.length > 0 && <Link href="/profile" className={styles.widgetMore}>활동 더 보기</Link>}
      </div>
      {!user ? (
        <p className={styles.widgetEmpty}>로그인하면 내 활동 기록이 쌓여요</p>
      ) : items && items.length === 0 ? (
        <p className={styles.widgetEmpty}>아직 활동 기록이 없어요</p>
      ) : (
        <div>
          {(items ?? []).map(a => {
            const when = timeAgo(a.occurredAt)
            const inner = (
              <>
                <span className={styles.checkIcon} style={{ background: ICON_STYLE[a.icon]?.bg ?? ICON_STYLE.star.bg }}><ActIcon kind={a.icon} /></span>
                <span className={styles.checkBody}>
                  <span className={styles.checkName}>{a.title}</span>
                  {when && <span className={styles.checkMeta}>{when}</span>}
                </span>
              </>
            )
            return a.href
              ? <Link key={a.id} href={a.href} className={styles.checkRow}>{inner}</Link>
              : <div key={a.id} className={styles.checkRow}>{inner}</div>
          })}
        </div>
      )}
    </div>
  )
}
