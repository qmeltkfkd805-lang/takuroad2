'use client'
import Link from 'next/link'

const CONTACT_EMAIL = 'contact@takuroad.kr'

const LINKS: { label: string; href: string }[] = [
  { label: '서비스 소개', href: '/about' },
  { label: '공지사항', href: '/support/notice' },
  { label: '문의하기', href: '/support/contact' },
  { label: '제휴 문의', href: '/support/partnership' },
  { label: '이용약관', href: '/policies/terms' },
  { label: '개인정보처리방침', href: '/policies/privacy' },
  { label: '저작권 안내', href: '/policies/copyright' },
  { label: '권리자 문의', href: '/policies/rights' },
]

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '24px 32px', marginTop: 40 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: 13, fontWeight: 600 }}>
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{l.label}</Link>
          ))}
          <a href={'mailto:' + CONTACT_EMAIL} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{CONTACT_EMAIL}</a>
        <a href="https://instagram.com/takuroad_official" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)', textDecoration: 'none' }}>@takuroad_official</a>
        </nav>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
          TAKUROAD는 애니메이션·굿즈 매장 정보를 모으는 팬 커뮤니티 서비스예요. 공식 서비스가 아니며 작품·캐릭터·상표의 권리는 각 권리자에게 있어요.
          영업시간·이벤트·재고는 바뀔 수 있으니 방문 전 공식 채널을 확인해 주세요.
        </p>
        <span style={{ fontSize: 12, color: 'var(--muted)', opacity: .8 }}>© {new Date().getFullYear()} TAKUROAD</span>
      </div>
    </footer>
  )
}