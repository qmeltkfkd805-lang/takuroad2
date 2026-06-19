'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getUnreadCount } from '@/services/notificationService'
import { createClient } from '@/lib/supabase/client'

export function useNotifications() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(() => {
    if (!user) return
    getUnreadCount(user.id).then(setUnreadCount)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  // 실시간 구독 (새 알림 생기면 카운트 자동 갱신)
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const channel = supabase
      .channel('notifications-' + user.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        refresh()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, refresh])

  return { unreadCount, refresh }
}