'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getMyChronicle, getMemoriesOnThisDay, ChronicleMonth } from '@/services/chronicleService'
import AppIcon from '@/components/tds/AppIcon'

const TYPE_ICON: Record<string, string> = {
  check_in: 'pin',
  review: 'note',
  badge_earned: 'medal',
  route_completed: 'road',
  review_comment: 'comment',
  shop_registered: 'shop',
  shop_verified: 'check',
  title_set: 'crown',
  route_created: 'compass',
  official_route: 'sparkle',
}

interface Props {
  userId: string
}

export default function ChronicleTimeline({ userId }: Props) {
  const [months, setMonths] = useState<ChronicleMonth[]>([])
  const [memories, setMemories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getMyChronicle(userId),
      getMemoriesOnThisDay(userId),
    ]).then(([chronicle, mem]) => {
      setMonths(chronicle)
      setMemories(mem)
      setLoading(false)
    })
  }, [userId])

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  }

  return (
    <div style={{ padding: '16px' }}>

      {/* 오늘의 추억 */}
      {memories.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          {memories.map(mem => (
            <div key={mem.yearsAgo} style={{
              background: 'var(--accent-l)', border: '1px solid var(--accent)',
              borderRadius: '12px', padding: '14px', marginBottom: '8px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 900, color: 'var(--accent)', marginBottom: '6px' }}>
                <AppIcon name="sparkle" size={13} style={{ marginRight: 5 }} />{mem.yearsAgo}년 전 오늘
              </div>
              {mem.events.map((e: any) => (
                <div key={e.id} style={{ fontSize: '13px', display: 'flex', gap: '6px', marginBottom: '2px' }}>
                  <AppIcon name={TYPE_ICON[e.type] ?? 'sparkle'} size={15} color="var(--accent)" />
                  <span>{e.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 연대기 타임라인 */}
      {months.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '40px 0' }}>
          아직 덕질 기록이 없어요. 첫 체크인을 해보세요!
        </p>
      ) : (
        months.map(month => (
          <div key={month.yearMonth} style={{ marginBottom: '24px' }}>
            <div style={{
              fontSize: '13px', fontWeight: 900, color: 'var(--muted)',
              marginBottom: '12px', paddingLeft: '4px',
            }}>
              {month.yearMonth.replace('-', '.')}
            </div>

            <div style={{ position: 'relative', paddingLeft: '20px' }}>
              {/* 세로선 */}
              <div style={{
                position: 'absolute', left: '5px', top: '8px', bottom: '8px',
                width: '2px', background: 'var(--border)',
              }} />

              {month.events.map(event => {
                const content = (
                  <div style={{ position: 'relative', paddingBottom: '16px' }}>
                    {/* 동그라미 */}
                    <div style={{
                      position: 'absolute', left: '-20px', top: '3px',
                      width: '12px', height: '12px', borderRadius: '50%',
                      background: event.isMilestone ? 'var(--accent)' : 'var(--border)',
                      border: '2px solid var(--surface)',
                    }} />

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <AppIcon name={TYPE_ICON[event.type] ?? 'sparkle'} size={15} color="var(--accent)" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: event.isMilestone ? 900 : 400 }}>
                          {event.isMilestone && <span style={{ color: 'var(--accent)' }}><AppIcon name="sparkle" size={12} color="var(--accent)" style={{ marginRight: 3 }} />첫 </span>}
                          {event.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {new Date(event.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>
                )

                return event.link ? (
                  <Link key={event.id} href={event.link} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    {content}
                  </Link>
                ) : (
                  <div key={event.id}>{content}</div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}