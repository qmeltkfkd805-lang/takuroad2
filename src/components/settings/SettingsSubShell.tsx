'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import styles from './settings.module.css'

/* 설정 세부화면 공용 셸 — 헤더(뒤로+제목) + 컨테이너 + 인증 가드.
   /profile/settings/* 는 AppShell 에서 설정 전용 레이아웃이 자동 적용됨. */
export default function SettingsSubShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  function goBack() {
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
