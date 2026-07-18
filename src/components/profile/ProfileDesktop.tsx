'use client'

import { useRouter } from 'next/navigation'
import { OtakuPassport } from '@/services/passportService'
import PassportCard from '@/components/passport/PassportCard'
import GrowthPreview from './GrowthPreview'
import BadgePreview from './BadgePreview'
import MyReviewsPreview from './MyReviewsPreview'
import MyCommentsPreview from './MyCommentsPreview'
import MyShopsPreview from './MyShopsPreview'
import VerifyPreview from './VerifyPreview'
import styles from './ProfileDesktop.module.css'

interface Props {
  passport: OtakuPassport | null
  userId: string
}

export default function ProfileDesktop({ passport, userId }: Props) {
  const router = useRouter()
  return (
    <div className={styles.wrap}>
      {/* 상단: 여권 + 성장센터 + 배지 */}
      <div className={styles.top}>
        <div className={styles.passport}>
          {passport && (
            <PassportCard passport={passport} isOwner onCustomizeClick={() => router.push('/cosmetic')} />
          )}
        </div>
        <div className={styles.card}><GrowthPreview userId={userId} /></div>
        <div className={styles.card}><BadgePreview userId={userId} /></div>
      </div>

      {/* 하단: 후기 / 댓글 / 샵 / 인증 4칸 */}
      <div className={styles.bottom}>
        <div className={styles.card}><MyReviewsPreview userId={userId} /></div>
        <div className={styles.card}><MyCommentsPreview userId={userId} /></div>
        <div className={styles.card}><MyShopsPreview userId={userId} /></div>
        <div className={styles.card}><VerifyPreview userId={userId} /></div>
      </div>
    </div>
  )
}