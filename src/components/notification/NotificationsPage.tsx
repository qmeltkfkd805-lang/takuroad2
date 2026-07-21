'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getNotifications, markAsRead, markAllAsRead, Notification } from '@/services/notificationService'
import { getNotificationLink } from '@/services/notificationService'
import { ROUTES } from '@/lib/constants/routes'

const TYPE_ICON: Record<string, string> = {
  badge: '🏅',
  review_comment: '💬',
  verify_approved: '✅',
  verify_rejected: '❌',
  shop_review: '✍️',
  shop_comment: '💬',
}

export default function NotificationsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push(ROUTES.login)
      return
    }
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

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>

      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
          >←</button>
          <h1 style={{ fontSize: '16px', fontWeight: 900 }}>알림</h1>
        </div>
        {hasUnread && (
          <button
            onClick={handleMarkAllRead}
            style={{
              fontSize: '12px', color: 'var(--muted)', background: 'none',
              border: 'none', cursor: 'pointer',
            }}
          >모두 읽음</button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>아직 알림이 없어요</p>
        </div>
      ) : (
        notifications.map(noti => (
          <div
            key={noti.id}
            onClick={() => handleClick(noti)}
            style={{
              display: 'flex', gap: '12px', padding: '14px 16px',
              borderBottom: '1px solid var(--border)', cursor: noti.link ? 'pointer' : 'default',
              background: noti.is_read ? 'var(--surface)' : 'var(--surface2)',
            }}
          >
            <div style={{ fontSize: '20px', flexShrink: 0 }}>
              {TYPE_ICON[noti.type] ?? '🔔'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: noti.is_read ? 400 : 700, fontSize: '14px', marginBottom: '2px' }}>
                {noti.title}
              </div>
              {noti.body && (
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
                  {noti.body}
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {new Date(noti.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            {!noti.is_read && (
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: '4px' }} />
            )}
          </div>
        ))
      )}
    </div>
  )
}