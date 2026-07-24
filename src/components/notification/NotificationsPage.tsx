'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getNotifications, markAsRead, markAllAsRead, getNotificationLink, Notification } from '@/services/notificationService'
import { ROUTES } from '@/lib/constants/routes'
import AppIcon from '@/components/tds/AppIcon'

/* 알림 — 날짜 그룹형 리스트 (카드 없이, 왼쪽 정렬, 타입별 아이콘)
   ⭐ 타쿠로드는 이미 카드가 많다. 알림은 리스트가 더 깔끔하다. */

const NOTI_ICON: Record<string, string> = {
  review_comment: 'commentbox', shop_comment: 'commentbox', comment: 'commentbox', post_comment: 'commentbox',
  like: 'heart', post_like: 'heart', review_like: 'heart',
  check_in: 'pushpin', checkin: 'pushpin',
  goods: 'gift', goods_restock: 'gift', product_restock: 'gift',
  shop_approved: 'shop', shop_review: 'pencil',
  verify_approved: 'check', verify_rejected: 'close',
  event: 'event',
  notice: 'megaphone', announcement: 'megaphone',
  report: 'warning', report_resolved: 'warning', post_report: 'warning',
  follow: 'bell', follow_post: 'bell', follow_route: 'bell',
  badge: 'medal', badge_earned: 'medal',
  route_completed: 'road', review: 'pencil',
}
const iconFor = (type: string) => NOTI_ICON[type] ?? 'bell'

const BUCKET_LABEL = ['오늘', '어제', '지난 7일', '이전']
function bucketOf(iso: string): number {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const s = start.getTime()
  const t = new Date(iso).getTime()
  if (t >= s) return 0
  if (t >= s - 86400000) return 1
  if (t >= s - 7 * 86400000) return 2
  return 3
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return m + '분 전'
  const h = Math.floor(m / 60)
  if (h < 24) return h + '시간 전'
  const d = Math.floor(h / 24)
  if (d < 7) return d + '일 전'
  const dt = new Date(iso)
  return (dt.getMonth() + 1) + '월 ' + dt.getDate() + '일'
}

export default function NotificationsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push(ROUTES.login); return }
    getNotifications(user.id).then(data => {
      setNotifications(data)
      setLoading(false)
    })
  }, [user, authLoading, router])

  async function handleClick(noti: Notification) {
    if (!noti.is_read) {
      await markAsRead(noti.id)
      setNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, is_read: true } : n))
      window.dispatchEvent(new Event('noti-read'))
    }
    const dest = getNotificationLink(noti)
    if (dest && dest !== '/') router.push(dest)
  }

  async function handleMarkAllRead() {
    if (!user) return
    await markAllAsRead(user.id)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    window.dispatchEvent(new Event('noti-read'))
  }

  if (loading || authLoading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  }

  const hasUnread = notifications.some(n => !n.is_read)

  const groups: { label: string; items: Notification[] }[] = []
  for (let b = 0; b < BUCKET_LABEL.length; b++) {
    const items = notifications.filter(n => bucketOf(n.created_at) === b)
    if (items.length) groups.push({ label: BUCKET_LABEL[b], items })
  }

  return (
    <div style={{ maxWidth: 960, margin: 0, padding: '8px 24px 56px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 0 8px',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.01em' }}>알림</h1>
        {hasUnread && (
          <button
            onClick={handleMarkAllRead}
            style={{ fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >모두 읽음</button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={{ padding: '90px 20px', textAlign: 'center' }}>
          <AppIcon name="bell" size={44} color="var(--muted)" style={{ margin: '0 auto 14px' }} />
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>아직 알림이 없어요</p>
        </div>
      ) : (
        groups.map(g => (
          <section key={g.label}>
            <div style={{
              fontSize: 12.5, fontWeight: 800, color: 'var(--muted)',
              margin: '22px 0 2px', letterSpacing: '0.02em',
            }}>{g.label}</div>

            {g.items.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '15px 4px', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: 8, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 7 }}>
                  {!n.is_read && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'block' }} />
                  )}
                </div>

                <div style={{ flexShrink: 0, paddingTop: 1 }}>
                  <AppIcon name={iconFor(n.type)} size={20} color="var(--accent)" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 14.5, fontWeight: n.is_read ? 500 : 800, color: 'var(--text)' }}>{n.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{timeAgo(n.created_at)}</span>
                  </div>
                  {n.body && (
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, lineHeight: 1.45 }}>{n.body}</div>
                  )}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  )
}