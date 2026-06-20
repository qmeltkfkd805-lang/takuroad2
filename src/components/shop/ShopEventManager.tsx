'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getAllShopEvents, createShopEvent, deactivateShopEvent,
  pinShopEvent, deleteShopEvent, ShopEventType,
  EVENT_TYPE_ICON, EVENT_TYPE_LABEL,
} from '@/services/shopEventService'

interface Props {
  shopId: string
}

const EVENT_TYPES: ShopEventType[] = [
  'notice', 'event', 'restock', 'new_arrival',
  'sold_out', 'discount', 'reservation', 'exchange_meet', 'fan_meet',
]

export default function ShopEventManager({ shopId }: Props) {
  const { user } = useAuth()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<ShopEventType>('notice')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadEvents()
  }, [shopId])

  async function loadEvents() {
    const data = await getAllShopEvents(shopId)
    setEvents(data)
    setLoading(false)
  }

  async function handleCreate() {
    if (!user || !title.trim()) return
    setSubmitting(true)
    const ok = await createShopEvent({
      shopId, type, title,
      description: description || undefined,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      userId: user.id,
    })
    if (ok) {
      setTitle(''); setDescription(''); setStartsAt(''); setEndsAt(''); setType('notice')
      setShowForm(false)
      loadEvents()
    }
    setSubmitting(false)
  }

  async function handleDeactivate(eventId: string) {
    await deactivateShopEvent(eventId)
    loadEvents()
  }

  async function handlePin(eventId: string, current: boolean) {
    await pinShopEvent(eventId, !current)
    loadEvents()
  }

  async function handleDelete(eventId: string) {
    if (!confirm('이 소식을 삭제할까요?')) return
    await deleteShopEvent(eventId)
    loadEvents()
  }

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  }

  return (
    <div>
      <button
        onClick={() => setShowForm(v => !v)}
        style={{
          width: '100%', padding: '11px', borderRadius: '10px', marginBottom: '16px',
          background: showForm ? 'var(--surface2)' : 'var(--accent)',
          color: showForm ? 'var(--text)' : '#fff', border: 'none',
          fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {showForm ? '취소' : '+ 새 소식 등록'}
      </button>

      {showForm && (
        <div style={{
          border: '1.5px solid var(--border)', borderRadius: '12px',
          padding: '16px', marginBottom: '20px', background: 'var(--surface2)',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {EVENT_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: '6px 10px', borderRadius: '16px',
                  border: `1.5px solid ${type === t ? 'var(--accent)' : 'var(--border)'}`,
                  background: type === t ? 'var(--accent-l)' : 'var(--surface)',
                  fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {EVENT_TYPE_ICON[t]} {EVENT_TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목 (예: 블루아카 아크릴 재입고)"
            style={inputStyle}
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--muted)' }}>시작일 (선택)</label>
              <input type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--muted)' }}>종료일 (선택)</label>
              <input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={submitting || !title.trim()}
            style={{
              width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
              background: title.trim() ? 'var(--accent)' : 'var(--border)', color: '#fff',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {submitting ? '등록 중...' : '등록'}
          </button>
        </div>
      )}

      {events.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '30px 0' }}>
          아직 등록된 소식이 없어요
        </p>
      ) : (
        events.map(event => {
          const isExpired = event.ends_at && new Date(event.ends_at) < new Date()
          return (
            <div key={event.id} style={{
              padding: '14px', borderRadius: '10px', marginBottom: '8px',
              border: '1px solid var(--border)',
              background: event.is_active && !isExpired ? 'var(--surface)' : 'var(--surface2)',
              opacity: event.is_active && !isExpired ? 1 : 0.6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, fontSize: '13px' }}>
                  {EVENT_TYPE_ICON[event.type as ShopEventType]} {event.title}
                  {event.is_pinned && ' 📌'}
                </span>
                {!event.is_active && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>비활성</span>}
                {isExpired && event.is_active && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>만료됨</span>}
              </div>
              {event.description && (
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>{event.description}</p>
              )}
              {(event.starts_at || event.ends_at) && (
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>
                  {event.starts_at ? new Date(event.starts_at).toLocaleDateString('ko-KR') : ''}
                  {event.ends_at ? ` ~ ${new Date(event.ends_at).toLocaleDateString('ko-KR')}` : ''}
                </p>
              )}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handlePin(event.id, event.is_pinned)}
                  style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {event.is_pinned ? '고정 해제' : '상단 고정'}
                </button>
                {event.is_active && (
                  <button
                    onClick={() => handleDeactivate(event.id)}
                    style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    종료하기
                  </button>
                )}
                <button
                  onClick={() => handleDelete(event.id)}
                  style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--red)', color: 'var(--red)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  삭제
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', marginBottom: '10px',
  border: '1.5px solid var(--border)', borderRadius: '8px',
  fontSize: '13px', fontFamily: 'inherit',
  background: 'var(--surface)', color: 'var(--text)',
  outline: 'none', boxSizing: 'border-box',
}