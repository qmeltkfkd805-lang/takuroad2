'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import styles from './TrendingTicker.module.css'

export interface TrendingItem {
  id: string
  name: string
  href: string
}

// 검색창 옆 롤링 인기 순위 (네이버 실검 스타일).
// 데이터는 부모(AppShell)가 줌 — 이 컴포넌트는 롤링 UI만 담당.
export default function TrendingTicker({ items }: { items: TrendingItem[] }) {
  const [idx, setIdx] = useState(0)
  const [open, setOpen] = useState(false)

  // 4초마다 다음 순위로
  useEffect(() => {
    if (items.length <= 1 || open) return
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 4000)
    return () => clearInterval(t)
  }, [items.length, open])

  // 바깥 클릭하면 패널 닫기
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  if (items.length === 0) return null

  const cur = items[idx]

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button className={styles.ticker} onClick={() => setOpen(o => !o)} aria-label="인기 작품">
        
        <span className={idx < 3 ? styles.rankTop : styles.rank}>{idx + 1}</span>
        <span className={styles.name}>{cur.name}</span>
        <svg className={open ? styles.caretOpen : styles.caret} viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>지금 인기 작품</div>
          {items.map((item, i) => (
            <Link key={item.id} href={item.href} className={styles.row} onClick={() => setOpen(false)}>
              <span className={i < 3 ? styles.rowRankTop : styles.rowRank}>{i + 1}</span>
              <span className={styles.rowName}>{item.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
