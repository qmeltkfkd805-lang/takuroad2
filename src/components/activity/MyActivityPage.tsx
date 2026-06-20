'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyLevelInfo, getExpLogs, LevelInfo } from '@/services/expService'
import { ROUTES } from '@/lib/constants/routes'

const REASON_LABEL: Record<string, string> = {
  check_in: '체크인',
  review: '후기 작성',
  review_photo: '사진 첨부',
  route_complete: '루트 완주',
  route_liked: '루트 좋아요',
}

export default function MyActivityPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push(ROUTES.login)
      return
    }
    Promise.all([
      getMyLevelInfo(user.id),
      getExpLogs(user.id),
    ]).then(([level, expLogs]) => {
      setLevelInfo(level)
      setLogs(expLogs)
      setLoading(false)
    })
  }, [user, authLoading, router])

  if (loading || authLoading || !levelInfo) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  }

  const progressPercent = levelInfo.nextLevelExp !== null
    ? Math.round((1 - levelInfo.nextLevelExp / (levelInfo.nextLevelExp + 1)) * 100) // 단순 표시용
    : 100

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>

      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
        >←</button>
        <h1 style={{ fontSize: '16px', fontWeight: 900 }}>내 활동</h1>
      </div>

      {/* 레벨 카드 */}
      <div style={{ padding: '24px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>Lv.{levelInfo.level}</div>
        <div style={{ fontSize: '20px', fontWeight: 900, marginBottom: '16px' }}>{levelInfo.title}</div>

        <div style={{
          height: '10px', background: 'var(--surface2)', borderRadius: '5px',
          overflow: 'hidden', marginBottom: '8px',
        }}>
          <div style={{
            height: '100%', width: '60%', // 단순화된 표시
            background: 'var(--accent)', borderRadius: '5px',
          }} />
        </div>

        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
          누적 경험치 {levelInfo.totalExp}
          {levelInfo.nextLevelExp !== null && (
            <span> · 다음 등급까지 {levelInfo.nextLevelExp}</span>
          )}
        </div>
      </div>

      {/* 활동 로그 */}
      <div style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 900, color: 'var(--muted)', marginBottom: '12px' }}>
          최근 경험치 내역
        </h2>
        {logs.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '40px 0' }}>
            아직 활동 기록이 없어요
          </p>
        ) : (
          logs.map(log => (
            <div key={log.id} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '10px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>
                  {REASON_LABEL[log.reason] ?? log.reason}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  {new Date(log.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--accent)' }}>
                +{log.amount}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}