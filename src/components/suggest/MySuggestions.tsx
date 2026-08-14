'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMySuggestions, type FeatureSuggestion } from '@/services/suggestionService'

// 제안자 화면용 상태 표시 (관리자 라벨과 다르게 친절한 문구)
const META: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: '접수됨',     color: 'var(--muted)', bg: 'var(--surface2)' },
  reviewing: { label: '검토중',     color: '#2563EB',      bg: 'rgba(37,99,235,.10)' },
  planned:   { label: '반영 예정',  color: 'var(--accent)', bg: 'var(--accent-l)' },
  done:      { label: '반영 완료',  color: 'var(--green, #10b981)', bg: 'rgba(16,185,129,.12)' },
  rejected:  { label: '반려',       color: 'var(--red, #e5484d)', bg: 'rgba(229,72,77,.10)' },
}

export default function MySuggestions() {
  const { user } = useAuth()
  const [rows, setRows] = useState<FeatureSuggestion[] | null>(null)

  useEffect(() => {
    if (user) getMySuggestions(user.id).then(setRows)
  }, [user])

  if (!user || rows === null || rows.length === 0) return null

  return (
    <div style={{ marginTop: 30 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: '0 0 12px' }}>내 제안</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(s => {
          const m = META[s.status] ?? META.new
          return (
            <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                <b style={{ fontSize: 14.5, color: 'var(--text)' }}>{s.title}</b>
                <span style={{ fontSize: 12, fontWeight: 800, color: m.color, background: m.bg, padding: '3px 11px', borderRadius: 9999, flexShrink: 0 }}>{m.label}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, whiteSpace: 'pre-wrap', margin: 0 }}>{s.content}</p>

              {s.reply && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: s.status === 'rejected' ? 'rgba(229,72,77,.06)' : 'var(--surface2)', borderRadius: 10, borderLeft: '3px solid ' + m.color }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: m.color, marginBottom: 3 }}>
                    {s.status === 'rejected' ? '반려 사유' : '운영자 답변'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{s.reply}</div>
                </div>
              )}

              {s.reward_exp > 0 && (
                <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 800, color: 'var(--accent)' }}>🎉 채택 보상 EXP +{s.reward_exp}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
