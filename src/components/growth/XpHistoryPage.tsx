'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getExpLogs, REASON_LABEL, XP_RULES } from '@/services/expService'
import { ROUTES } from '@/lib/constants/routes'

type Log = { id: string; reason: string; amount: number; related_type: string | null; created_at: string }

function dayBucket(iso: string): string {
  const d = new Date(iso)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const ds = new Date(d); ds.setHours(0, 0, 0, 0)
  const diff = Math.round((t.getTime() - ds.getTime()) / 86400000)
  if (diff <= 0) return '오늘'
  if (diff === 1) return '어제'
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
function timeLabel(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function XpHistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [logs, setLogs] = useState<Log[] | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push(ROUTES.login); return }
    getExpLogs(user.id).then(d => setLogs(d as any))
  }, [user, authLoading, router])

  // visible:false(예: 일일 목표 보너스)는 히스토리에서 숨김
  const visible = (logs ?? []).filter(l => XP_RULES[l.reason]?.visible !== false)

  const groups: { label: string; items: Log[] }[] = []
  for (const l of visible) {
    const b = dayBucket(l.created_at)
    let g = groups.find(x => x.label === b)
    if (!g) { g = { label: b, items: [] }; groups.push(g) }
    g.items.push(l)
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '8px 20px 60px' }}>
      <div style={{ padding: '22px 0 6px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.01em' }}>XP 내역</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0 0' }}>어떤 활동으로 경험치를 얻었는지 확인할 수 있어요.</p>
      </div>

      {logs === null ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
      ) : visible.length === 0 ? (
        <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--muted)' }}>아직 XP 내역이 없어요</div>
      ) : (
        groups.map(g => (
          <section key={g.label}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--muted)', margin: '20px 0 2px' }}>{g.label}</div>
            {g.items.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 4px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{REASON_LABEL[l.reason] ?? l.reason}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{timeLabel(l.created_at)}</span>
                <b style={{ fontSize: 14, color: l.amount >= 0 ? 'var(--accent)' : 'var(--red)', flexShrink: 0, minWidth: 46, textAlign: 'right' }}>
                  {l.amount >= 0 ? '+' : ''}{l.amount.toLocaleString()}
                </b>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  )
}
