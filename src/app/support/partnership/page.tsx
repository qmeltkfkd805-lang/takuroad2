import Link from 'next/link'
import styles from './partnership.module.css'
import PartnerForm from '@/components/contact/PartnerForm'
import AppIcon from '@/components/tds/AppIcon'

export const metadata = { title: '제휴 문의 · 타쿠로드' }

const PROVIDE = [
  { icon: 'target', title: '애니메이션 팬 타겟', desc: '덕질에 진심인 사용자에게 정확히 닿아요.' },
  { icon: 'bag', title: '굿즈 관심 사용자', desc: '피규어·굿즈를 실제로 사러 다니는 사람들이에요.' },
  { icon: 'map', title: '지도 기반 노출', desc: '매장을 지도에서 발견하고 직접 찾아가요.' },
  { icon: 'bookmark', title: '작품 기반 탐색', desc: '좋아하는 작품으로 매장·이벤트를 탐색해요.' },
]

const TYPES = [
  { icon: 'shop', title: '굿즈샵 등록·인증', desc: '매장을 공식 등록하고 사장님 인증을 받아요.' },
  { icon: 'ticket', title: '이벤트·팝업 홍보', desc: '팝업스토어·전시·행사를 널리 알려요.' },
  { icon: 'handshake', title: '브랜드·기업 제휴', desc: '브랜드 협업과 공동 기획을 함께해요.' },
  { icon: 'megaphone', title: '광고·프로모션', desc: '배너·추천 노출로 더 많은 사람에게 닿아요.' },
  { icon: 'sparkle', title: '콘텐츠 협업', desc: '함께 만드는 기획 콘텐츠와 캠페인.' },
  { icon: 'chat', title: '기타 제안', desc: '어떤 형태든 좋아요. 편하게 제안해 주세요.' },
]

const FAQ = [
  { q: '비용이 발생하나요?', a: '굿즈샵 등록·기본 노출은 무료예요. 광고·프로모션 등 일부는 협의가 필요할 수 있어요.' },
  { q: '굿즈샵도 등록할 수 있나요?', a: '물론이에요. 매장 정보를 등록하고 사장님 인증까지 받을 수 있어요.' },
  { q: '행사만 홍보할 수도 있나요?', a: '네, 팝업·전시·행사 단위 홍보도 환영해요.' },
]

export default function Page() {
  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <span className={styles.heroBadge}>제휴 문의</span>
        <h1 className={styles.heroTitle}>함께 만드는<br />즐거운 덕질 경험</h1>
        <p className={styles.heroDesc}>
          굿즈샵, 카페, 팝업, 전시, 브랜드까지 —<br />
          TAKUROAD와 함께할 다양한 협업을 기다리고 있어요.
        </p>
        <a href="#form" className={styles.heroCta}>제휴 문의하기</a>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>왜 TAKUROAD와 제휴할까요?</h2>
        <div className={styles.provideGrid}>
          {PROVIDE.map(p => (
            <div key={p.title} className={styles.provideCard}>
              <span className={styles.provideIcon}><AppIcon name={p.icon} size={30} color="var(--accent)" /></span>
              <div className={styles.provideTitle}>{p.title}</div>
              <p className={styles.provideDesc}>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>이런 제휴가 가능해요</h2>
        <div className={styles.typeGrid}>
          {TYPES.map(t => (
            <div key={t.title} className={styles.typeCard}>
              <span className={styles.typeIcon}><AppIcon name={t.icon} size={26} color="var(--accent)" /></span>
              <div className={styles.typeBody}>
                <div className={styles.typeTitle}>{t.title}</div>
                <p className={styles.typeDesc}>{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>자주 묻는 질문</h2>
        <div className={styles.faqList}>
          {FAQ.map(f => (
            <div key={f.q} className={styles.faqItem}>
              <div className={styles.faqQ}>Q. {f.q}</div>
              <p className={styles.faqA}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="form" className={styles.formSection}>
        <h2 className={styles.sectionTitle}>제휴 문의하기</h2>
        <PartnerForm />
      </section>
    </div>
  )
}