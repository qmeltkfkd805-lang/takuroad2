'use client'

import { useState, useEffect } from 'react'
import {
  getSeasonalEvents, createSeasonalEvent, endEventEarly,
  getEventGroupBadges, linkBadgeToEvent,
} from '@/services/adminEventService'

export default function SeasonalEventTab() {
  const [events, setEvents] = useState<any[]>([])
  const [eventBadges, setEventBadges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [linkingEventId, setLinkingEventId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [evts, badges] = await Promise.all([
      getSeasonalEvents(),
      getEventGroupBadges(),
    ])
    setEvents(evts)
    setEventBadges(badges)
    setLoading(false)
  }

  async function handleCreate() {
    if (!title.trim() || !startsAt || !endsAt) return
    setSubmitting(true)
    const ok = await createSeasonalEvent({ title, description, startsAt, endsAt })
    if (ok) {
      setTitle(''); setDescription(''); setStartsAt(''); setEndsAt('')
      setShowForm(false)
      loadData()
    }
    setSubmitting(false)
  }

  async function handleEndEarly(eventId: string) {
    if (!confirm('이 이벤트를 지금 바로 종료할까요?')) return
    await endEventEarly(eventId)
    loadData()
  }

  async function handleLinkBadge(badgeId: string, eventId: string) {
    await linkBadgeToEvent(badgeId, eventId)
    setLinkingEventId(null)
    loadData()
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>

  return (
    <div style={{ padding: '16px' }}>
      <button
        onClick={() => setShowForm(v => !v)}
        style={{
          width: '100%', padding: '11px', borderRadius: '10px', marginBottom: '16px',
          background: showForm ? 'var(--surface2)' : 'var(--accent)',
          color: showForm ? 'var(--text)' : '#fff', border: 'none',
          fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {showForm ? '취소' : '+ 새 시즌 이벤트 만들기'}
      </button>

      {showForm && (
        <div style={{
          border: '1.5px solid var(--border)', borderRadius: '12px',
          padding: '16px', marginBottom: '20px', background: 'var(--surface2)',
        }}>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="이벤트 이름 (예: AGF 2028)"
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
              <label style={{ fontSize: '11px', color: 'var(--muted)' }}>시작일</label>
              <input
                type="date"
                value={startsAt}
                onChange={e => setStartsAt(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--muted)' }}>종료일</label>
              <input
                type="date"
                value={endsAt}
                onChange={e => setEndsAt(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0 }}
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={submitting}
            style={{
              width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700,
              fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {submitting ? '생성 중...' : '이벤트 생성'}
          </button>
        </div>
      )}

      {events.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '40px 0' }}>
          등록된 시즌 이벤트가 없어요
        </p>
      ) : (
        events.map(event => {
          const now = new Date()
          const isOngoing = new Date(event.starts_at) <= now && now <= new Date(event.ends_at) && event.is_active
          const isUpcoming = new Date(event.starts_at) > now
          const status = isOngoing ? '진행중' : isUpcoming ? '진행예정' : '종료됨'
          const statusColor = isOngoing ? 'var(--green)' : isUpcoming ? 'var(--yellow)' : 'var(--muted)'

          return (
            <div key={event.id} style={{
              border: '1.5px solid var(--border)', borderRadius: '12px',
              padding: '16px', marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 900, fontSize: '15px' }}>🎪 {event.title}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: statusColor }}>{status}</span>
              </div>
              {event.description && (
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>{event.description}</p>
              )}
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
                {new Date(event.starts_at).toLocaleDateString('ko-KR')} ~ {new Date(event.ends_at).toLocaleDateString('ko-KR')}
              </p>

              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
                연결된 배지: {event.badges?.length > 0 ? event.badges.map((b: any) => b.name).join(', ') : '없음'}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setLinkingEventId(linkingEventId === event.id ? null : event.id)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  + 배지 연결
                </button>
                {isOngoing && (
                  <button
                    onClick={() => handleEndEarly(event.id)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px',
                      border: '1px solid var(--red)', background: 'var(--surface)',
                      color: 'var(--red)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    조기 종료
                  </button>
                )}
              </div>

              {linkingEventId === event.id && (
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {eventBadges.map(badge => (
                    <button
                      key={badge.id}
                      onClick={() => handleLinkBadge(badge.id, event.id)}
                      style={{
                        padding: '5px 10px', borderRadius: '14px',
                        border: `1.5px solid ${badge.seasonal_event_id === event.id ? 'var(--accent)' : 'var(--border)'}`,
                        background: badge.seasonal_event_id === event.id ? 'var(--accent-l)' : 'var(--surface)',
                        fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {badge.name}
                    </button>
                  ))}
                  {eventBadges.length === 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      먼저 배지 관리에서 &quot;이벤트&quot; 그룹에 시리즈를 추가해주세요
                    </p>
                  )}
                </div>
              )}
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