'use client'
import { useState } from 'react'
import styles from './MapLegend.module.css'

/* 범례 — 기본 접힘. '경로 안내' 버튼으로 펼침.
   hasReturn=false 면 '되돌아가는 구간' 항목은 숨긴다. */
export default function MapLegend({ hasReturn = false }: { hasReturn?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.wrap}>
      {open && (
        <div className={styles.panel} role="group" aria-label="경로 안내 범례">
          <div className={styles.row}><span className={styles.flag}>출발</span><span>출발 · 도착</span></div>
          <div className={styles.row}><span className={styles.line} /><span>일반 이동</span></div>
          {hasReturn && <div className={styles.row}><span className={styles.dash} /><span>되돌아가는 구간</span></div>}
          <div className={styles.row}><span className={styles.dot} /><span>선택된 스팟</span></div>
          <div className={styles.attr}>© openrouteservice / OpenStreetMap</div>
        </div>
      )}
      <button className={styles.toggle} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {open ? '닫기' : '경로 안내'}
      </button>
    </div>
  )
}
