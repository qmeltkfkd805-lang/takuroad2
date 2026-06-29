'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getUnreadCount } from '@/services/notificationService'
import { getMyLevelInfo } from '@/services/expService'
import styles from './TopBar.module.css'

export default function TopBar() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const [q, setQ] = useState('')
  const [unread, setUnread] = useState(0)
  const [level, setLevel] = useState<number | null>(null)

  useEffect(() => {
    if (!user) { setUnread(0); setLevel(null); return }
    getUnreadCount(user.id).then(setUnread).catch(() => {})
    getMyLevelInfo(user.id).then(i => setLevel(i.level)).catch(() => {})
  }, [user])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const term = q.trim()
    if (term) router.push('/search?q=' + encodeURIComponent(term))
  }

  return (
    <div className={styles.bar}>
      <form className={styles.search} onSubmit={onSearch}>
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="작품, 샵, 지역, 이벤트 검색" />
      </form>

      <div className={styles.right}>
        {user ? (
          <>
            <Link href="/notifications" className={styles.iconBtn} aria-label="알림">
              <svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
              {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
            </Link>
            <Link href="/profile" className={styles.user}>
              <span className={styles.avatar}>
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile?.nickname?.[0] ?? '?')}
              </span>
              <span className={styles.userMeta}>
                <span className={styles.userName}>{profile?.nickname ?? '사용자'}</span>
                {level != null && <span className={styles.userLv}>Lv.{level}</span>}
              </span>
            </Link>
          </>
        ) : (
          <Link href="/login" className={styles.login}>로그인</Link>
        )}
      </div>
    </div>
  )
}
