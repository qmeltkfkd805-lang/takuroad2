'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getAllShopEvents, createShopEvent, deactivateShopEvent, setShopEventActive,
  pinShopEvent, deleteShopEvent, uploadEventImage, ShopEventType,
  EVENT_TYPE_ICON, EVENT_TYPE_LABEL,
} from '@/services/shopEventService'
import AppIcon from '@/components/tds/AppIcon'

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
  const [managing, setManaging] = useState<any | null>(null)
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

  async function handleToggleActive(eventId: string, isActive: boolean) {
    await setShopEventActive(eventId, !isActive)
    setManaging((m: any) => (m && m.id === eventId ? { ...m, is_active: !isActive } : m))
    loadEvents()
  }

  async function handlePin(eventId: string, current: boolean) {
    await pinShopEvent(eventId, !current)
    setManaging((m: any) => (m && m.id === eventId ? { ...m, is_pinned: !current } : m))
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
                <AppIcon name={EVENT_TYPE_ICON[t]} size={14} style={{ marginRight: 4, verticalAlign: '-2px' }} />{EVENT_TYPE_LABEL[t]}
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
              ><AppIcon name="close" size={15} /></button>
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
              <AppIcon name="camera" size={14} style={{ marginRight: 5 }} />사진 추가 (선택)
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {events.map(event => {
            const isExpired = event.ends_at && new Date(event.ends_at) < new Date()
            const dim = !event.is_active || isExpired
            return (
              <div
                key={event.id}
                onClick={() => setManaging(event)}
                style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden', cursor: 'pointer', background: '#000', opacity: dim ? 0.45 : 1 }}
              >
                {event.video_url
                  ? <video src={event.video_url + '#t=0.1'} preload="metadata" muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : event.image_url
                    ? <img src={event.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#FFE3EC,#FFF0F5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}><AppIcon name={EVENT_TYPE_ICON[event.type as ShopEventType] ?? 'pushpin'} size={26} color="var(--accent)" /></div>}
                <div style={{ position: 'absolute', top: '5px', left: '6px', right: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {event.is_pinned && <AppIcon name="pushpin" size={12} color="#fff" />}
                  {dim && <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,.6)', padding: '1px 6px', borderRadius: '9999px' }}>{!event.is_active ? '숨김' : '만료'}</span>}
                  {event.video_url && <span style={{ marginLeft: 'auto', color: '#fff', fontSize: '12px', textShadow: '0 1px 4px rgba(0,0,0,.6)' }}>▶</span>}
                </div>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,.6) 0%, rgba(0,0,0,0) 45%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', left: '6px', right: '6px', bottom: '5px', color: '#fff', fontSize: '10.5px', fontWeight: 700, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.title}</div>
              </div>
            )
          })}
        </div>
      )}

      {managing && (
        <div onClick={() => setManaging(null)} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '680px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.08))', padding: '3px 9px', borderRadius: '9999px' }}>
                {EVENT_TYPE_LABEL[managing.type as ShopEventType] ?? managing.type}
              </span>
              {managing.is_pinned && <AppIcon name="pushpin" size={13} color="var(--accent)" />}
              {!managing.is_active && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>숨김</span>}
              <button onClick={() => setManaging(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}><AppIcon name="close" size={15} /></button>
            </div>

            {(managing.video_url || managing.image_url) && (
              <div style={{ background: '#000', display: 'flex', justifyContent: 'center' }}>
                {managing.video_url
                  ? <video src={managing.video_url} controls playsInline style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', display: 'block' }} />
                  : <img src={managing.image_url} alt="" style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', display: 'block' }} />}
              </div>
            )}

            <div style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '15px', fontWeight: 900, lineHeight: 1.45 }}>{managing.title}</div>
              {(managing.tags?.name || managing.goods_types?.name) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                  {managing.tags?.name && <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', background: 'var(--surface2)' }}><AppIcon name="film" size={11} style={{ marginRight: 4, verticalAlign: '-1px' }} />{managing.tags.name}</span>}
                  {managing.goods_types?.name && <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', background: 'var(--surface2)' }}>{<AppIcon name="tag" size={11} style={{ marginRight: 3, verticalAlign: '-1px' }} />}{managing.goods_types.name}</span>}
                </div>
              )}
              {managing.description && <p style={{ fontSize: '13.5px', lineHeight: 1.7, color: 'var(--muted)', marginTop: '8px', whiteSpace: 'pre-wrap' }}>{managing.description}</p>}
              {(managing.starts_at || managing.ends_at) && (
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '10px' }}>
                  {managing.starts_at ? new Date(managing.starts_at).toLocaleDateString('ko-KR') : ''}
                  {managing.ends_at ? ` ~ ${new Date(managing.ends_at).toLocaleDateString('ko-KR')}` : ''}
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '0 18px 24px' }}>
              <button
                onClick={() => { window.location.href = '/shop/' + shopSlug + '/manage/events/' + managing.id + '/edit' }}
                style={{ fontSize: '13px', fontWeight: 700, padding: '12px', borderRadius: '10px', border: '1px solid var(--accent)', color: 'var(--accent)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit' }}
              >수정</button>
              <button
                onClick={() => handlePin(managing.id, managing.is_pinned)}
                style={{
                  fontSize: '13px', fontWeight: 700, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit',
                  border: managing.is_pinned ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: managing.is_pinned ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)',
                  color: managing.is_pinned ? 'var(--accent)' : 'var(--text)',
                }}
              >{managing.is_pinned ? <><AppIcon name="pushpin" size={13} style={{ marginRight: 5 }} />고정됨</> : '상단 고정'}</button>
              <button
                onClick={() => handleToggleActive(managing.id, managing.is_active)}
                style={{
                  fontSize: '13px', fontWeight: 700, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit',
                  border: managing.is_active ? '1px solid var(--border)' : '1px solid var(--muted)',
                  background: managing.is_active ? 'var(--surface)' : 'var(--surface2)',
                  color: managing.is_active ? 'var(--text)' : 'var(--muted)',
                }}
              >{managing.is_active ? '숨김' : '숨김 해제'}</button>
              <button
                onClick={() => { handleDelete(managing.id); setManaging(null) }}
                style={{ fontSize: '13px', fontWeight: 700, padding: '12px', borderRadius: '10px', border: '1px solid var(--red)', color: 'var(--red)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit' }}
              >삭제</button>
            </div>
          </div>
        </div>
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