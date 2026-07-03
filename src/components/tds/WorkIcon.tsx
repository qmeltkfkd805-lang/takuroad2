import { CSSProperties } from 'react'

// 작품 공용 아이콘 — 회색 아웃라인 + 핑크 채움 (전 페이지 통일)
export function WorkIcon({ size = 20, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block', flexShrink: 0, ...style }}>
      <path d="M6.5 3.75h11a1.75 1.75 0 0 1 1.75 1.75v14.4a.9.9 0 0 1-1.4.75L12 16.7l-5.85 3.95a.9.9 0 0 1-1.4-.75V5.5A1.75 1.75 0 0 1 6.5 3.75Z" fill="#FF8FB1" stroke="#4A4A55" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M9 8.5h6M9 11.5h4" stroke="#4A4A55" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
