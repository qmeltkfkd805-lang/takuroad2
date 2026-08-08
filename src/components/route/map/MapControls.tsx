'use client'
import styles from './MapControls.module.css'

/* 지도 조작 버튼 묶음 — 전체 경로 맞추기 / (선택) 현재 위치. 동일한 디자인 언어. */
export default function MapControls({ onFit, onLocate }: { onFit: () => void; onLocate?: () => void }) {
  return (
    <div className={styles.controls}>
      <button className={styles.btn} onClick={onFit} aria-label="전체 경로 맞추기">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
        </svg>
        <span className={styles.label}>전체 경로</span>
      </button>
      {onLocate && (
        <button className={styles.btn} onClick={onLocate} aria-label="현재 위치">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      )}
    </div>
  )
}
