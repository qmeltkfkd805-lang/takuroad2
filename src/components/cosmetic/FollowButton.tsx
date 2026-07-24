'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getFollowState, follow, unfollow, setFollowNotify } from '@/services/followService'
import AppIcon from '@/components/tds/AppIcon'

export default function FollowButton({ targetUserId }: { targetUserId?: string | null }) {
  const { user } = useAuth()
  const router = useRouter()
  const [following, setFollowing] = useState(false)
  const [notify, setNotify] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user?.id || !targetUserId) { setReady(true); return }
    getFollowState(user.id, targetUserId).then(s => {
      setFollowing(s.following)
      setNotify(s.notify)
      setReady(true)
    })
  }, [user?.id, targetUserId])

  if (!targetUserId || (user && user.id === targetUserId)) return null
  if (!ready) return null

  async function onToggleFollow() {
    if (!user) { router.push('/login'); return }
    if (!targetUserId || busy) return
    setBusy(true)
    if (following) {
      const ok = await unfollow(user.id, targetUserId)
      if (ok) { setFollowing(false); setNotify(false) }
    } else {
      const ok = await follow(user.id, targetUserId)
      if (ok) { setFollowing(true); setNotify(true) }
    }
    setBusy(false)
  }

  // 팔로우 전에 알림을 누르면 팔로우까지 한 번에
  async function onToggleNotify() {
    if (!user) { router.push('/login'); return }
    if (!targetUserId || busy) return
    setBusy(true)
    if (!following) {
      const ok = await follow(user.id, targetUserId)
      if (ok) {
        setFollowing(true)
        const ok2 = await setFollowNotify(user.id, targetUserId, true)
        if (ok2) setNotify(true)
      }
    } else {
      const next = !notify
      const ok = await setFollowNotify(user.id, targetUserId, next)
      if (ok) setNotify(next)
    }
    setBusy(false)
  }

  const base: React.CSSProperties = {
    flex: 1, padding: '10px 0', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13.5, fontWeight: 800,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  }

  return (
    <div style={{ display: 'flex', gap: 8, margin: '0 0 14px' }}>
      <button
        onClick={onToggleFollow}
        disabled={busy}
        style={{
          ...base,
          border: following ? 'none' : '1px solid var(--border)',
          background: following ? 'var(--accent)' : 'var(--surface)',
          color: following ? '#fff' : 'var(--muted)',
        }}
      >
        {following ? '팔로잉' : '팔로우'}
      </button>

      <button
        onClick={onToggleNotify}
        disabled={busy}
        style={{
          ...base,
          border: '1px solid ' + (notify ? 'var(--accent)' : 'var(--border)'),
          background: notify ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)',
          color: notify ? 'var(--accent)' : 'var(--muted)',
        }}
      >
        <AppIcon name="bell" size={14} color={notify ? 'var(--accent)' : 'var(--muted)'} />
        {notify ? '알림 켜짐' : '알림'}
      </button>
    </div>
  )
}