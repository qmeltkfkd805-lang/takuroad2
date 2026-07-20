'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { ROUTES } from '@/lib/constants/routes'
import { getMyPassport, OtakuPassport } from '@/services/passportService'
import PassportCard from '@/components/passport/PassportCard'
import ActivityFeed from '@/components/passport/ActivityFeed'
import TitleBadgeSelector from '@/components/passport/TitleBadgeSelector'
import ChronicleTimeline from '@/components/passport/ChronicleTimeline'
import SavedShopsTab from './SavedShopsTab'
import VisitedShopsTab from './VisitedShopsTab'
import MyRoutesTab from './MyRoutesTab'
import SavedRoutesTab from './SavedRoutesTab'
import CompletedRoutesTab from './CompletedRoutesTab'
import MyReviewsTab from './MyReviewsTab'
import MyShopsTab from './MyShopsTab'
import VerifyStatusTab from './VerifyStatusTab'
import AccountSettingsTab from './AccountSettingsTab'
import BadgesTab from './BadgesTab'
import CollectionTab from './CollectionTab'
import ChroniclePage from '@/components/collection/ChroniclePage'
import GrowthPage from '@/components/growth/GrowthPage'
import CosmeticPage from '@/components/cosmetic/CosmeticPage'
import ProfileDesktop from './ProfileDesktop'
import { useSearchParams } from 'next/navigation'

type Tab = 'passport' | 'customize' | 'chronicle' | 'growth' | 'visited' | 'saved' | 'routes' | 'savedroutes' | 'completed' | 'reviews' | 'comments' | 'shops' | 'verify' | 'badges' | 'collection' | 'settings'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'passport',   label: '여권',         icon: '📔' },
  { key: 'chronicle',  label: '연대기',       icon: '📰' },
  { key: 'saved',      label: '저장한 샵',    icon: '🔖' },
  { key: 'routes',     label: '내 루트',      icon: '🧭' },
  { key: 'savedroutes', label: '저장한 루트',  icon: '❤️' },
  { key: 'completed',  label: '완료한 루트',  icon: '🏁' },
  { key: 'reviews',    label: '내 후기',      icon: '⭐' },
  { key: 'comments',   label: '내 댓글',      icon: '💬' },
  { key: 'shops',      label: '등록한 샵',    icon: '🏪' },
  { key: 'verify',     label: '인증 현황',    icon: '🛡' },
  { key: 'badges',     label: '배지',         icon: '🏆' },
  { key: 'collection', label: '컬렉션',       icon: '📦' },
  { key: 'settings',   label: '설정',         icon: '⚙️' },
]
const MOBILE_IA: { cat: string; label: string; subs: { key: Tab; label: string }[] }[] = [
  { cat: 'profile', label: '프로필', subs: [
    { key: 'passport', label: '여권' },
    { key: 'customize', label: '프로필 꾸미기' },
  ] },
  { cat: 'collection', label: '컬렉션', subs: [
    { key: 'chronicle', label: '연대기' },
    { key: 'growth', label: '성장센터' },
    { key: 'badges', label: '배지' },
  ] },
  { cat: 'explore', label: '탐험', subs: [
    { key: 'visited', label: '최근 방문' },
    { key: 'saved', label: '저장한 샵' },
    { key: 'routes', label: '내 루트' },
    { key: 'savedroutes', label: '저장한 루트' },
    { key: 'completed', label: '완주한 루트' },
  ] },
  { cat: 'activity', label: '활동', subs: [
    { key: 'reviews', label: '내 후기' },
    { key: 'comments', label: '내 댓글' },
    { key: 'shops', label: '등록한 샵' },
    { key: 'verify', label: '인증 현황' },
  ] },
]

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, loading, signOut } = useAuth()
  const initialTab = (useSearchParams().get('tab') as Tab) ?? 'passport'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [openCat, setOpenCat] = useState<string | null>('profile')
  const [passport, setPassport] = useState<OtakuPassport | null>(null)
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (!loading && !user) {
      router.push(ROUTES.login)
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user) loadPassport()
  }, [user])

  async function loadPassport() {
    if (!user) return
    const data = await getMyPassport(user.id)
    setPassport(data)
  }

  if (loading || !user || !profile) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
        불러오는 중...
      </div>
    )
  }

  if (isDesktop) {
    return (
      <ProfileDesktop passport={passport} userId={user.id} />
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
          {profile.role === 'admin' && (
            <Link
              href="/admin"
              style={{
                fontSize: '12px', color: 'var(--accent)', background: 'var(--accent-l)',
                border: '1px solid var(--accent)', borderRadius: '8px',
                padding: '6px 10px', cursor: 'pointer', textDecoration: 'none', fontWeight: 700,
              }}
            >⚙️ 관리자</Link>
          )}
          <button
            onClick={async () => { await signOut(); router.push('/') }}
            style={{
              fontSize: '12px', color: 'var(--muted)', background: 'none',
              border: '1px solid var(--border)', borderRadius: '8px',
              padding: '6px 10px', cursor: 'pointer',
            }}
          >로그아웃</button>
        </div>

        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', marginBottom: '10px' }}>
          {MOBILE_IA.map(c => (
            <button
              key={c.cat}
              onClick={() => setOpenCat(c.cat)}
              style={{
                padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '14px', fontWeight: 700,
                color: openCat === c.cat ? 'var(--accent)' : 'var(--muted)',
                borderBottom: openCat === c.cat ? '2px solid var(--accent)' : '2px solid transparent',
                position: 'relative', top: '1px',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {MOBILE_IA.find(c => c.cat === openCat)?.subs.map(s => (
            <button
              key={s.key}
              onClick={() => { if (s.key === 'customize') { router.push('/cosmetic'); return } setTab(s.key) }}
              style={{
                padding: '7px 12px', borderRadius: '20px',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: tab === s.key ? 'var(--accent)' : 'var(--surface2)',
                color: tab === s.key ? '#fff' : 'var(--text)',
                fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {tab === 'passport' && (
          passport ? (
            <PassportCard
              passport={passport}
              isOwner
              hideRecentVisits
              onCustomizeClick={() => { setOpenCat('profile'); setTab('customize') }}
            />
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
          )
        )}
        {tab === 'customize' && <CosmeticPage />}
        {tab === 'growth' && <GrowthPage />}
        {tab === 'visited' && <VisitedShopsTab userId={user.id} />}
        {tab === 'chronicle' && <ChroniclePage />}
        {tab === 'saved' && <SavedShopsTab userId={user.id} />}
        {tab === 'routes' && <MyRoutesTab userId={user.id} />}
        {tab === 'savedroutes' && <SavedRoutesTab userId={user.id} />}
        {tab === 'completed' && <CompletedRoutesTab userId={user.id} />}
        {tab === 'reviews' && <MyReviewsTab userId={user.id} />}
        {tab === 'comments' && <EmptyTab text="댓글 기능은 곧 추가될 예정이에요" />}
        {tab === 'shops' && <MyShopsTab userId={user.id} />}
        {tab === 'verify' && <VerifyStatusTab userId={user.id} />}
        {tab === 'badges' && <BadgesTab userId={user.id} />}
        {tab === 'collection' && <CollectionTab userId={user.id} />}
        {tab === 'settings' && <AccountSettingsTab />}
      </div>

    </div>
  )
}

function useIsDesktop() {
  const [d, setD] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px)')
    const on = () => setD(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return d
}

function EmptyTab({ text }: { text: string }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
      <p style={{ color: 'var(--muted)', fontSize: '14px' }}>{text}</p>
    </div>
  )
}