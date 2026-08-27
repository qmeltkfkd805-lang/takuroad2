'use client'

import { ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import styles from './Goods.module.css'

/* 굿즈 브라우징 페이지 공용 셸 — 기본 앱 셸(사이드바) 안에서 사용.
   데스크톱: 브레드크럼. 모바일: sticky 뒤로+제목 헤더. 로그인 가드 포함. */
export default function GoodsPageShell({
  crumbs, title, right, children,
}: {
  crumbs: { label: string; href?: string }[]
  title: string
  right?: ReactNode
  children: ReactNode
}) {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [loading, user, router])

  if (loading || !user) {
    return <div className={styles.page}><div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div></div>
  }

  return (
    <div className={styles.page}>
      {/* 모바일 헤더 */}
      <div className={styles.mHead}>
        <button className={styles.mBack} onClick={() => router.back()} aria-label="뒤로">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span className={styles.mTitle}>{title}</span>
        {right}
      </div>

      {/* 데스크톱 브레드크럼 */}
      <div className={styles.crumbs}>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span className={styles.crumbSep}>›</span>}
            {c.href && i < crumbs.length - 1
              ? <button className={styles.crumbLink} onClick={() => router.push(c.href!)}>{c.label}</button>
              : <span className={styles.crumbCur}>{c.label}</span>}
          </span>
        ))}
      </div>

      {children}
    </div>
  )
}
