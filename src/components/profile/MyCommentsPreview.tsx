'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getMyComments } from '@/services/commentService'
import { ROUTES } from '@/lib/constants/routes'
import styles from './SectionPreview.module.css'

export default function MyCommentsPreview({ userId }: { userId: string }) {
  const [comments, setComments] = useState<any[]>([])
  useEffect(() => {
    getMyComments(userId).then(setComments).catch(() => {})
  }, [userId])

  const shown = comments.slice(0, 3)

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <h3>최근 댓글</h3>
        <Link href="/profile?tab=comments" className={styles.more}>전체보기 ›</Link>
      </div>
      {shown.length === 0 ? (
        <p className={styles.empty}>작성한 댓글이 없어요.</p>
      ) : (
        <div className={styles.list}>
          {shown.map(c => (
            <Link key={c.id} href={ROUTES.shop(c.reviews?.shops?.slug ?? '')} className={styles.row}>
              <div className={styles.rowTop}>
                <span className={styles.title}>{c.reviews?.shops?.name ?? '알 수 없음'}</span>
                <span className={styles.date}>{new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
              {c.content && <p className={styles.desc}>{c.content}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}