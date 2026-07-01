'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getRelationshipState, setRelationshipState, clearRelationshipState,
} from '@/services/workRelationshipService'
import { RelationshipState } from '@/types/work-relationship'
import { STATE_LABEL } from '@/lib/constants/workRelationship'

const ALL_STATES: RelationshipState[] = ['planned', 'in_progress', 'completed', 'paused']

const STATE_COLOR: Record<RelationshipState, string> = {
  planned: '#3B9BE8',
  in_progress: 'var(--accent)',
  completed: '#1FAE8C',
  paused: '#8A857C',
}

export default function WorkStateButton({ tagId }: { tagId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<RelationshipState | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getRelationshipState(user.id, tagId).then(s => { setState(s); setLoading(false) })
  }, [user, tagId])

  function openMenu() {
    const el = btnRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setOpen(v => !v)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('click', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('click', close)
    }
  }, [open])

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

  const menu = open && pos ? createPortal(
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)', boxShadow: '0 8px 28px rgba(0,0,0,.18)',
        overflow: 'hidden', minWidth: '150px',
      }}
    >
      {ALL_STATES.map(s => (
        <MenuItem key={s} icon={<StateIcon state={s} color={STATE_COLOR[s]} />} label={STATE_LABEL[s].label} active={state === s} onClick={() => choose(s)} />
      ))}
      {state && (
        <MenuItem icon={<XIcon />} label="상태 없음" active={false} onClick={() => choose(null)} />
      )}
    </div>,
    document.body,
  ) : null

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); openMenu() }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 16px', borderRadius: '9999px',
          border: `1.5px solid ${state ? STATE_COLOR[state] : 'var(--border)'}`,
          background: 'var(--surface)',
          color: state ? STATE_COLOR[state] : 'var(--muted)',
          fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}
      >
        {state ? <StateIcon state={state} color={STATE_COLOR[state]} /> : <PlusIcon />}
        {state ? STATE_LABEL[state].label : '상태 추가'}
        <Chevron open={open} />
      </button>
      {menu}
    </div>
  )
}

function MenuItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
        padding: '11px 14px', border: 'none',
        background: active ? 'var(--surface2)' : 'var(--surface)',
        color: 'var(--text)', fontSize: '13px', fontWeight: active ? 700 : 500,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function StateIcon({ state, color }: { state: RelationshipState; color: string }) {
  const c = color
  if (state === 'planned') return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" fill={c} stroke="none" />
    </svg>
  )
  if (state === 'in_progress') return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={c} stroke="none"><path d="M7 4v16l13-8z" /></svg>
  )
  if (state === 'completed') return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  )
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={c} stroke="none"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
  )
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="m6 9 6 6 6-6" /></svg>
  )
}
