'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import styles from './settings.module.css'

/* 설정 세부화면 공용 셸 — 헤더(뒤로+제목[+우측 액션]) + 컨테이너 + 인증 가드.
   /profile/settings/* 는 AppShell 에서 설정 전용 레이아웃이 자동 적용됨.
   - right: 헤더 우측 슬롯(모바일 "저장" 텍스트 버튼 등). 없으면 자리만 비운다.
   - onBack: 뒤로가기 동작 오버라이드(이탈 확인 등). 없으면 기본(back/설정 홈). */
export default function SettingsSubShell({
  title, children, right, onBack,
}: {
  title: string
  children: React.ReactNode
  right?: React.ReactNode
  onBack?: () => void
}) {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  function goBack() {
    if (onBack) { onBack(); return }
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/profile/settings')
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <button className={styles.back} onClick={goBack} aria-label="뒤로">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span className={styles.title}>{title}</span>
          {right ? <span className={styles.headerRight}>{right}</span> : null}
        </div>
      </div>
      <div className={styles.container}>
        {loading || !user
          ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
          : children}
      </div>
    </div>
  )
}
