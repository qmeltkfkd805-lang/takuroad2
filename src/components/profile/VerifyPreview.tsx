'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getMyVerifyRequests } from '@/services/shopService'
import { ROUTES } from '@/lib/constants/routes'
import styles from './SectionPreview.module.css'

export default function VerifyPreview({ userId }: { userId: string }) {
  const [reqs, setReqs] = useState<any[]>([])
  useEffect(() => {
    getMyVerifyRequests(userId).then(setReqs).catch(() => {})
  }, [userId])

  const shown = reqs.slice(0, 3)

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <h3>인증 현황</h3>
        <Link href="/profile?tab=verify" className={styles.more}>전체보기 ›</Link>
      </div>
      {shown.length === 0 ? (
        <p className={styles.empty}>인증 신청 내역이 없어요.</p>
      ) : (
        <div className={styles.list}>
          {shown.map(r => (
            <Link key={r.id} href={ROUTES.shop(r.shops?.slug ?? '')} className={styles.row}>
              <div className={styles.rowTop}>
                <span className={styles.title}>{r.shops?.name ?? '알 수 없음'}</span>
                <span className={styles.date}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}