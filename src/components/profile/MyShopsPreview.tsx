'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getMyShops } from '@/services/shopService'
import { ROUTES } from '@/lib/constants/routes'
import { SHOP_STATUS_LABEL } from '@/lib/constants/categories'
import styles from './SectionPreview.module.css'

export default function MyShopsPreview({ userId }: { userId: string }) {
  const [shops, setShops] = useState<any[]>([])
  useEffect(() => {
    getMyShops(userId).then(setShops).catch(() => {})
  }, [userId])

  const shown = shops.slice(0, 3)

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <h3>내가 등록한 샵</h3>
        <Link href="/profile?tab=shops" className={styles.more}>전체보기 ›</Link>
      </div>
      {shown.length === 0 ? (
        <p className={styles.empty}>등록한 샵이 없어요.</p>
      ) : (
        <div className={styles.list}>
          {shown.map(s => (
            <Link key={s.id} href={ROUTES.shop(s.slug)} className={styles.row}>
              <div className={styles.rowTop}>
                <span className={styles.title}>{s.name}</span>
                <span className={styles.date}>{SHOP_STATUS_LABEL[s.status] ?? s.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}