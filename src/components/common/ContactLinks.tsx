import Link from 'next/link'

/** 문의 안내 — 모든 문의는 문의하기 페이지로 모읍니다 */
export default function ContactLinks({ label = '문의' }: { label?: string | null }) {
  return (
    <div style={{ marginTop: 12 }}>
      {label && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>{label}</div>
      )}
      <Link
        href="/support/contact"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '11px 20px', borderRadius: 10,
          background: 'var(--accent)', color: '#fff',
          fontSize: 14, fontWeight: 800, textDecoration: 'none',
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.4-.6L3 21l1.8-5.1A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
        </svg>
        문의하기
      </Link>
    </div>
  )
}