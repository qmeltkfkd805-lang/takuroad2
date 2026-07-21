'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getAllShopEvents, createShopEvent, deactivateShopEvent,
  pinShopEvent, deleteShopEvent, uploadEventImage, ShopEventType,
  EVENT_TYPE_ICON, EVENT_TYPE_LABEL,
} from '@/services/shopEventService'

interface Props {
  shopId: string
  shopSlug: string
  hideForm?: boolean
}

const EVENT_TYPES: ShopEventType[] = [
  'notice', 'event', 'restock', 'new_arrival',
  'sold_out', 'discount', 'reservation', 'exchange_meet', 'fan_meet',
]

export default function ShopEventManager({ shopId, shopSlug, hideForm }: Props) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<ShopEventType>('notice')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadEvents()
  }, [shopId])

  async function loadEvents() {
    const data = await getAllShopEvents(shopId)
    setEvents(data)
    setLoading(false)
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleCreate() {
    if (!user || !title.trim()) return
    setSubmitting(true)

    let imageUrl: string | undefined
    if (imageFile) {
      const url = await uploadEventImage(imageFile, shopSlug)
      if (url) imageUrl = url
    }

    const ok = await createShopEvent({
      shopId, type, title,
      description: description || undefined,
      imageUrl,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      userId: user.id,
    })
    if (ok) {
      setTitle(''); setDescription(''); setStartsAt(''); setEndsAt(''); setType('notice')
      removeImage()
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
      {!hideForm && (
      <button
        onClick={() => { window.location.href = '/shop/' + shopSlug + '/manage/events' }}
        style={{
          width: '100%', padding: '11px', borderRadius: '10px', marginBottom: '16px',
          background: showForm ? 'var(--surface2)' : 'var(--accent)',
          color: showForm ? 'var(--text)' : '#fff', border: 'none',
          fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {showForm ? '취소' : '+ 새 소식 등록'}
      </button>
      )}

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

          {imagePreview ? (
            <div style={{ position: 'relative', marginBottom: '10px', display: 'inline-block' }}>
              <img
                src={imagePreview}
                alt=""
                style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '10px' }}
              />
              <button
                onClick={removeImage}
                style={{
                  position: 'absolute', top: '-6px', right: '-6px',
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: 'var(--red)', color: '#fff', border: 'none',
                  cursor: 'pointer', fontSize: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 12px', borderRadius: '8px', marginBottom: '10px',
                border: '1.5px dashed var(--border)', background: 'var(--surface)',
                fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              📷 사진 추가 (선택)
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
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
              {event.image_url && (
                <img
                  src={event.image_url}
                  alt=""
                  style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px', marginBottom: '8px', background: 'var(--surface2)' }}
                />
              )}
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