'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { ROUTES } from '@/lib/constants/routes'
import SavedShopsTab from './SavedShopsTab'
import MyRoutesTab from './MyRoutesTab'
import MyReviewsTab from './MyReviewsTab'
import MyShopsTab from './MyShopsTab'
import VerifyStatusTab from './VerifyStatusTab'
import AccountSettingsTab from './AccountSettingsTab'
import BadgesTab from './BadgesTab'

type Tab = 'saved' | 'routes' | 'reviews' | 'comments' | 'shops' | 'verify' | 'badges' | 'settings'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'saved',    label: '저장한 샵',    icon: '🔖' },
  { key: 'routes',   label: '내 루트',      icon: '🗺️' },
  { key: 'reviews',  label: '내 후기',      icon: '✍️' },
  { key: 'comments', label: '내 댓글',      icon: '💬' },
  { key: 'shops',    label: '내 샵',        icon: '🏪' },
  { key: 'verify',   label: '인증 현황',    icon: '✅' },
  { key: 'badges',   label: '배지',         icon: '🏅' },
  { key: 'settings', label: '설정',         icon: '⚙️' },
]

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, loading, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('saved')

  useEffect(() => {
    if (!loading && !user) {
      router.push(ROUTES.login)
    }
  }, [loading, user, router])

  if (loading || !user || !profile) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>

      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <button
            onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
          >←</button>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 900, overflow: 'hidden',
          }}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              profile.nickname[0]
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: '16px' }}>{profile.nickname}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {profile.role === 'admin' ? '관리자' : profile.role === 'manager' ? '매니저' : '일반 회원'}
            </div>
          </div>
          <button
            onClick={async () => { await signOut(); router.push('/') }}
            style={{
              fontSize: '12px', color: 'var(--muted)', background: 'none',
              border: '1px solid var(--border)', borderRadius: '8px',
              padding: '6px 10px', cursor: 'pointer',
            }}
          >로그아웃</button>
        </div>

        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '7px 12px', borderRadius: '20px',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: tab === t.key ? 'var(--accent)' : 'var(--surface2)',
                color: tab === t.key ? '#fff' : 'var(--text)',
                fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {tab === 'saved' && <SavedShopsTab userId={user.id} />}
        {tab === 'routes' && <MyRoutesTab userId={user.id} />}
        {tab === 'reviews' && <MyReviewsTab userId={user.id} />}
        {tab === 'comments' && <EmptyTab text="댓글 기능은 곧 추가될 예정이에요" />}
        {tab === 'shops' && <MyShopsTab userId={user.id} />}
        {tab === 'verify' && <VerifyStatusTab userId={user.id} />}
        {tab === 'badges' && <BadgesTab userId={user.id} />}
        {tab === 'settings' && <AccountSettingsTab />}
      </div>
    </div>
  )
}

function EmptyTab({ text }: { text: string }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚧</div>
      <p style={{ color: 'var(--muted)', fontSize: '14px' }}>{text}</p>
    </div>
  )
}