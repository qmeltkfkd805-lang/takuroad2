import { createClient } from '@/lib/supabase/client'

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  related_type: string | null
  related_id: string | null
  is_read: boolean
  created_at: string
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return []
  return data ?? []
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createClient()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  return count ?? 0
}

export async function markAsRead(notificationId: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('notifications')
    .update({ is_read: true } as any)
    .eq('id', notificationId)
}

export async function markAllAsRead(userId: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('notifications')
    .update({ is_read: true } as any)
    .eq('user_id', userId)
    .eq('is_read', false)
}

/* 알림이 가리키는 곳으로 이동할 링크 만들기.

   인증 심사 알림은 결과에 따라 갈 곳이 다르다.
     승인 → 인증된 그 샵 (트리거가 notifications.link 에 /shop/{slug} 를 넣어준다)
     거절 → 마이페이지 인증 현황 (거절 사유는 VerifyStatusTab 에만 표시된다)
   예전에는 둘 다 인증 현황으로 보내면서 link 를 통째로 버렸다. */
export function getNotificationLink(noti: Notification, shopSlug?: string): string {
  if (noti.type === 'verify_rejected') return '/profile?tab=verify'
  if (noti.link) return noti.link
  if (shopSlug) return `/shop/${shopSlug}`
  return '/'
}