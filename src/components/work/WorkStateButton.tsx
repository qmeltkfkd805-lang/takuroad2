'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getRelationshipState, setRelationshipState, clearRelationshipState,
} from '@/services/workRelationshipService'
import { RelationshipState } from '@/types/work-relationship'
import { STATE_LABEL } from '@/lib/constants/workRelationship'

const ALL_STATES: RelationshipState[] = ['planned', 'in_progress', 'completed', 'paused']

// 현재 상태를 작은 버튼으로 보여주고, 누르면 메뉴로 변경. 작품 홈 헤더용.
export default function WorkStateButton({ tagId }: { tagId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<RelationshipState | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getRelationshipState(user.id, tagId).then(s => { setState(s); setLoading(false) })
  }, [user, tagId])

  async function choose(next: RelationshipState | null) {
    if (!user) { router.push('/login'); return }
    setOpen(false)
    if (next === null) {
      const ok = await clearRelationshipState(user.id, tagId)
      if (ok) setState(null)
    } else {
      const ok = await setRelationshipState(user.id, tagId, next)
      if (ok) setState(next)
    }
  }

  if (loading) return <div style={{ width: '110px' }} />

  const current = state
    ? `${STATE_LABEL[state].icon} ${STATE_LABEL[state].label}`
    : '＋ 상태 추가'

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '10px 12px', borderRadius: 'var(--r-sm)',
          border: `1.5px solid ${state ? 'var(--purple)' : 'var(--border)'}`,
          background: 'var(--surface)',
          color: state ? 'var(--purple)' : 'var(--muted)',
          fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}
      >
        {current} ▼
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '46px', right: 0, zIndex: 50,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)', boxShadow: 'var(--sh-md)',
          overflow: 'hidden', minWidth: '140px',
        }}>
          {ALL_STATES.map(s => (
            <MenuItem
              key={s}
              label={`${STATE_LABEL[s].icon} ${STATE_LABEL[s].label}`}
              active={state === s}
              onClick={() => choose(s)}
            />
          ))}
          {state && (
            <MenuItem label="✕ 상태 없음" active={false} onClick={() => choose(null)} />
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '11px 14px', border: 'none',
        background: active ? 'var(--surface2)' : 'var(--surface)',
        color: 'var(--text)', fontSize: '13px', fontWeight: active ? 700 : 400,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}