/* 덕마크 표시 — 핑크 북마크 (커뮤니티 탭 이름 옆, 덕마크 탭 제목 옆) */
export default function DukmarkMark({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" /></svg>
}
