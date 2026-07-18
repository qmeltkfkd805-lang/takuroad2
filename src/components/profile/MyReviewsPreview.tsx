'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getMyReviews } from '@/services/reviewService'
import { ROUTES } from '@/lib/constants/routes'
import styles from './SectionPreview.module.css'

export default function MyReviewsPreview({ userId }: { userId: string }) {
  const [reviews, setReviews] = useState<any[]>([])
  useEffect(() => {
    getMyReviews(userId).then(setReviews).catch(() => {})
  }, [userId])

  const shown = reviews.slice(0, 3)

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <h3>최신 후기</h3>
        <Link href="/profile?tab=reviews" className={styles.more}>전체보기 ›</Link>
      </div>
      {shown.length === 0 ? (
        <p className={styles.empty}>작성한 후기가 없어요.</p>
      ) : (
        <div className={styles.list}>
          {shown.map(r => (
            <Link key={r.id} href={ROUTES.shop(r.shops?.slug ?? '')} className={styles.row}>
              <div className={styles.rowTop}>
                <span className={styles.title}>{r.shops?.name ?? '알 수 없음'}</span>
                <span className={styles.date}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
              <div className={styles.stars}>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</div>
              {r.content && <p className={styles.desc}>{r.content}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}