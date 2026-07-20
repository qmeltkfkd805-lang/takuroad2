'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OtakuPassport } from '@/services/passportService'
import PassportCard from '@/components/passport/PassportCard'
import GrowthPage from '@/components/growth/GrowthPage'
import BadgesTab from './BadgesTab'
import SavedShopsTab from './SavedShopsTab'
import MyRoutesTab from './MyRoutesTab'
import SavedRoutesTab from './SavedRoutesTab'
import CompletedRoutesTab from './CompletedRoutesTab'
import MyReviewsTab from './MyReviewsTab'
import MyShopsTab from './MyShopsTab'
import VerifyStatusTab from './VerifyStatusTab'
import CosmeticPage from '@/components/cosmetic/CosmeticPage'
import ChroniclePage from '@/components/collection/ChroniclePage'
import styles from './ProfileDesktop.module.css'

type Sub = 'passport' | 'customize' | 'chronicle' | 'growth' | 'badges'
  | 'saved' | 'routes' | 'savedroutes' | 'completed'
  | 'reviews' | 'comments' | 'shops' | 'verify'

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

interface Props {
  passport: OtakuPassport | null
  userId: string
}

export default function ProfileDesktop({ passport, userId }: Props) {
  const router = useRouter()
  const [cat, setCat] = useState<Cat>('profile')
  const [sub, setSub] = useState<Sub>('passport')
  const [openCat, setOpenCat] = useState<Cat | null>('profile')

  function toggleCat(c: Cat) {
    setOpenCat(prev => (prev === c ? null : c))
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
              <span className={styles.arrow}>{openCat === c.cat ? '▾' : '▸'}</span>
            </button>
            {openCat === c.cat && (
              <div className={styles.subs}>
                {c.subs.map(s => (
                  <button
                    key={s.key}
                    className={[styles.sub, sub === s.key ? styles.subOn : ''].join(' ')}
                    onClick={() => {
                      setSub(s.key)
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
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
        {sub === 'saved' && <SavedShopsTab userId={userId} />}
        {sub === 'routes' && <MyRoutesTab userId={userId} />}
        {sub === 'savedroutes' && <SavedRoutesTab userId={userId} />}
        {sub === 'completed' && <CompletedRoutesTab userId={userId} />}
        {sub === 'reviews' && <MyReviewsTab userId={userId} />}
        {sub === 'comments' && <div className={styles.loading}>댓글 기능은 곧 추가될 예정이에요</div>}
        {sub === 'shops' && <MyShopsTab userId={userId} />}
        {sub === 'verify' && <VerifyStatusTab userId={userId} />}
      </div>
    </div>
  )
}