import Link from 'next/link'
import styles from './PolicyLayout.module.css'

export default function PolicyLayout({
  title, description, updated, children,
}: {
  title: string
  description?: string
  updated?: string
  children: React.ReactNode
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.desc}>{description}</p>}
      </div>
      <div className={styles.body}>{children}</div>
      {updated && <p className={styles.updated}>최종 수정일: {updated}</p>}
      <div className={styles.foot}>
        <Link href="/" className={styles.home}>← 타쿠로드 홈으로</Link>
      </div>
    </div>
  )
}