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

// 알림이 가리키는 곳으로 이동할 링크 만들기
export function getNotificationLink(noti: Notification, shopSlug?: string): string {
  if (noti.type === 'verify_approved' || noti.type === 'verify_rejected') return '/profile?tab=verify'
  if (noti.link) return noti.link
  if (shopSlug) return `/shop/${shopSlug}`
  return '/'
}