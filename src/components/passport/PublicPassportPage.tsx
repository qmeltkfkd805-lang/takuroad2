'use client'

import { OtakuPassport } from '@/services/passportService'
import PassportCard from './PassportCard'
import ActivityFeed from './ActivityFeed'
import PublicActivity from './PublicActivity'

interface Props {
  passport: OtakuPassport
}

export default function PublicPassportPage({ passport }: Props) {
  return (
    <div style={{ width: '100%', maxWidth: '820px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>
      <PassportCard passport={passport} showFollow />
      <ActivityFeed activities={passport.recentActivities} />
      <PublicActivity userId={passport.userId} />
    </div>
  )
}