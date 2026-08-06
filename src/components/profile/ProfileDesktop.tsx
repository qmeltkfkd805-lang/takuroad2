'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import AppIcon from '@/components/tds/AppIcon'
import { OtakuPassport } from '@/services/passportService'
import PassportCard from '@/components/passport/PassportCard'
import GrowthPage from '@/components/growth/GrowthPage'
import BadgesTab from './BadgesTab'
import SavedShopsTab from './SavedShopsTab'
import VisitedShopsTab from './VisitedShopsTab'
import MyRoutesTab from './MyRoutesTab'
import SavedRoutesTab from './SavedRoutesTab'
import CompletedRoutesTab from './CompletedRoutesTab'
import MyReviewsTab from './MyReviewsTab'
import MyCommentsTab from './MyCommentsTab'
import MyPostsTab from './MyPostsTab'
import MyShopsTab from './MyShopsTab'
import VerifyStatusTab from './VerifyStatusTab'
import CosmeticPage from '@/components/cosmetic/CosmeticPage'
import ChroniclePage from '@/components/collection/ChroniclePage'
import styles from './ProfileDesktop.module.css'

type Sub = 'passport' | 'customize' | 'chronicle' | 'growth' | 'badges'
  | 'visited' | 'saved' | 'routes' | 'savedroutes' | 'completed'
  | 'posts' | 'reviews' | 'comments' | 'shops' | 'verify'

type Cat = 'profile' | 'collection' | 'explore' | 'activity'

const IA: { cat: Cat; label: string; subs: { key: Sub; label: string }[] }[] = [
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
    { key: 'posts', label: '작성 글' },
    { key: 'comments', label: '내 댓글' },
    { key: 'reviews', label: '내 후기' },
    { key: 'shops', label: '등록한 샵' },
    { key: 'verify', label: '인증 현황' },
  ] },
]

interface Props {
  passport: OtakuPassport | null
  userId: string
}

export default function ProfileDesktop({ passport, userId }: Props) {
  const router = useRouter()
  const { isAdmin, signOut } = useAuth()
  const urlTab = useSearchParams().get('tab') as Sub | null
  const urlCat = urlTab ? (IA.find(c => c.subs.some(s => s.key === urlTab))?.cat ?? 'profile') : 'profile'
  const [cat, setCat] = useState<Cat>(urlCat)
  const [sub, setSub] = useState<Sub>(urlTab ?? 'passport')
  const [openCat, setOpenCat] = useState<Cat | null>(urlCat)
  const [loggingOut, setLoggingOut] = useState(false)

  function toggleCat(c: Cat) {
    setOpenCat(prev => (prev === c ? null : c))
  }

  async function handleLogout() {
    setLoggingOut(true)
    await signOut()
    router.push('/')
  }

  return (
    <div className={styles.wrap}>
      <nav className={styles.cats}>
        {IA.map(c => (
          <div key={c.cat} className={styles.catGroup}>
            <button
              className={[styles.cat, openCat === c.cat ? styles.catOpen : ''].join(' ')}
              onClick={() => toggleCat(c.cat)}
            >
              <span>{c.label}</span>
              <span className={styles.arrow}>{openCat === c.cat ? <AppIcon name="chevron-down" size={14} /> : <AppIcon name="chevron-right" size={14} />}</span>
            </button>
            {openCat === c.cat && (
              <div className={styles.subs}>
                {c.subs.map(s => (
                  <button
                    key={s.key}
                    className={[styles.sub, sub === s.key ? styles.subOn : ''].join(' ')}
                    onClick={() => {
                      setSub(s.key)
                      setOpenCat(null)
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isAdmin && (
          <Link
            href="/admin"
            className={styles.cat}
            style={{ marginTop: 10, color: 'var(--accent)', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="gear" size={15} />관리자 화면</span>
            <AppIcon name="chevron-right" size={14} />
          </Link>
        )}

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={styles.cat}
          style={{ marginTop: isAdmin ? 4 : 10, color: 'var(--muted)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: loggingOut ? 'not-allowed' : 'pointer' }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            {loggingOut ? '로그아웃 중...' : '로그아웃'}
          </span>
        </button>
      </nav>

      <div className={styles.content}>
        {sub === 'passport' && (
          passport ? (
            <div className={styles.passportWrap}>
              <PassportCard passport={passport} isOwner hideRecentVisits onCustomizeClick={() => { setCat('profile'); setOpenCat('profile'); setSub('customize') }} />
            </div>
          ) : <div className={styles.loading}>불러오는 중...</div>
        )}
        {sub === 'customize' && <CosmeticPage />}
        {sub === 'chronicle' && <ChroniclePage />}
        {sub === 'growth' && <GrowthPage />}
        {sub === 'badges' && <BadgesTab userId={userId} />}
        {sub === 'visited' && <VisitedShopsTab userId={userId} />}
        {sub === 'saved' && <SavedShopsTab userId={userId} />}
        {sub === 'routes' && <MyRoutesTab userId={userId} />}
        {sub === 'savedroutes' && <SavedRoutesTab userId={userId} />}
        {sub === 'completed' && <CompletedRoutesTab userId={userId} />}
        {sub === 'posts' && <MyPostsTab userId={userId} />}
        {sub === 'reviews' && <MyReviewsTab userId={userId} />}
        {sub === 'comments' && <MyCommentsTab userId={userId} />}
        {sub === 'shops' && <MyShopsTab userId={userId} />}
        {sub === 'verify' && <VerifyStatusTab userId={userId} />}
      </div>
    </div>
  )
}