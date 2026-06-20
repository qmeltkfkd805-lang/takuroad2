'use client'

import { useRouter } from 'next/navigation'
import { OtakuPassport } from '@/services/passportService'
import PassportCard from './PassportCard'
import ActivityFeed from './ActivityFeed'

interface Props {
  passport: OtakuPassport
}

export default function PublicPassportPage({ passport }: Props) {
  const router = useRouter()

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>

      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
        >←</button>
        <div style={{
          fontFamily: "'Cute Font', cursive",
          fontSize: '18px', color: 'var(--accent)', letterSpacing: '2px',
        }}>
          TAKUROAD
        </div>
      </div>

      <PassportCard passport={passport} />
      <ActivityFeed activities={passport.recentActivities} />
    </div>
  )
}