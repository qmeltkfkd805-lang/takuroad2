'use client'
import AppIcon from '@/components/tds/AppIcon'

import Link from 'next/link'

const TYPE_ICON: Record<string, string> = { check_in: 'pushpin', review: 'pencil', badge_earned: 'medal', route_completed: 'road', review_comment: 'commentbox' }

interface Props {
  activities: any[]
}

export default function ActivityFeed({ activities }: Props) {
  if (activities.length === 0) {
    return null
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 900, color: 'var(--muted)', marginBottom: '10px' }}>
        최근 활동
      </h3>
      {activities.map(activity => {
        const content = (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 0', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '16px' }}><AppIcon name={TYPE_ICON[activity.type] ?? 'sparkle'} size={16} color="var(--accent)" /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{activity.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {new Date(activity.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>
        )

        return activity.link ? (
          <Link key={activity.id} href={activity.link} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            {content}
          </Link>
        ) : (
          <div key={activity.id}>{content}</div>
        )
      })}
    </div>
  )
}