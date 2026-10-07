'use client'

/* 마이페이지 하위 화면 공통 틀 — '내 활동'과 같은 모양.
   ‹ 마이페이지 → 큰 제목 → 짧은 설명 → (내용)
   흰 배경 · PC 최대 840px · 모바일 좌우 16px. 스타일은 MyActivity.module.css 를 같이 쓴다. */
import type { ReactNode } from 'react'
import styles from './MyActivity.module.css'

export default function MyPageSubShell({ title, desc, action, onBack, children }: {
  title: string
  desc?: string
  /** 제목 줄 오른쪽 버튼 (예: + 루트 만들기) */
  action?: ReactNode
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <button type="button" className={styles.back} onClick={onBack}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
          마이페이지
        </button>
        <div className={styles.headRow}>
          <h1 className={styles.title}>{title}</h1>
          {action}
        </div>
        {desc && <p className={styles.desc}>{desc}</p>}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  )
}
