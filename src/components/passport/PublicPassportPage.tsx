'use client'

import { OtakuPassport } from '@/services/passportService'
import PassportCard from './PassportCard'
import ActivityFeed from './ActivityFeed'
import PublicActivity from './PublicActivity'
import FanartHonorStrip from './FanartHonorStrip'

interface Props {
  passport: OtakuPassport
}

export default function PublicPassportPage({ passport }: Props) {
  return (
    <div style={{ width: '100%', maxWidth: '820px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>
      <PassportCard passport={passport} showFollow />
      <FanartHonorStrip userId={passport.userId} />
      <ActivityFeed activities={passport.recentActivities} />
      <PublicActivity userId={passport.userId} />
    </div>
  )
}