import Link from 'next/link'
import ContactSection from '@/components/contact/ContactSection'
import styles from './contact.module.css'

export const metadata = { title: '문의하기 · 타쿠로드' }

const HELP_LINKS = [
  { label: 'FAQ · 자주 묻는 질문', href: '/support/faq' },
  { label: '버그 신고', href: '/support/bug' },
  { label: '제휴 안내', href: '/support/partnership' },
  { label: '권리자 문의', href: '/policies/rights' },
]

export default function Page() {
  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h1 className={styles.title}>문의하기</h1>
        <p className={styles.desc}>궁금한 점이나 제안, 오류 신고, 제휴 문의까지 무엇이든 편하게 남겨주세요.</p>
        <span className={styles.badge}>평균 답변 1~3일</span>
      </div>

      <div className={styles.grid}>
        <div className={styles.formCol}>
          <ContactSection />
        </div>
        <aside className={styles.side}>
          <h3 className={styles.sideTitle}>자주 찾는 도움말</h3>
          <ul className={styles.sideList}>
            {HELP_LINKS.map(l => (
              <li key={l.href}><Link href={l.href} className={styles.sideLink}>{l.label}</Link></li>
            ))}
          </ul>
          <div className={styles.emailBox}>
            <span className={styles.emailLabel}>이메일로 직접 문의</span>
            <a href="mailto:ttakuroad@gmail.com" className={styles.email}>ttakuroad@gmail.com</a>
          </div>
          <div className={styles.emailBox}>
            <span className={styles.emailLabel}>인스타그램 DM 문의</span>
            <a href="https://instagram.com/takuroad_official" target="_blank" rel="noopener noreferrer" className={styles.email}>@takuroad_official</a>
          </div>
        </aside>
      </div>
    </div>
  )
}