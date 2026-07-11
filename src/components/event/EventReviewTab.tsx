'use client'
import { UserAvatar, UserTitle } from '@/components/cosmetic/UserFace'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  EventReview, getEventReviews, createEventReview, deleteEventReview,
} from '@/services/eventReviewService'
import { EventIcon } from './EventIcon'

const fmt = (s: string) => {
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function EventReviewTab({ eventId, onCountChange }: { eventId: string; onCountChange?: (n: number) => void }) {
  const { user } = useAuth()
  const router = useRouter()
  const [reviews, setReviews] = useState<EventReview[]>([])
  const [loading, setLoading] = useState(true)
  const [stars, setStars] = useState(5)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    const rows = await getEventReviews(eventId)
    setReviews(rows)
    onCountChange?.(rows.length)
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [eventId])

  const mine = user ? reviews.find(r => r.userId === user.id) : null

  const submit = async () => {
    if (!user) { router.push('/login'); return }
    if (content.trim().length === 0) return
    setSaving(true); setError(null)
    const res = await createEventReview(eventId, user.id, stars, content.trim())
    setSaving(false)
    if (!res.ok) { setError(res.message ?? '실패했어요.'); return }
    setContent(''); setStars(5)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('후기를 삭제할까요?')) return
    if (await deleteEventReview(id)) load()
  }

  const avg = reviews.length ? reviews.reduce((a, r) => a + r.stars, 0) / reviews.length : null

  return (
    <div>
      {avg !== null && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 26, fontWeight: 800, color: 'var(--accent)' }}>
            <EventIcon name="starFill" size={22} /> {avg.toFixed(1)}
          </span>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>후기 {reviews.length}개</span>
        </div>
      )}

      {/* 작성 */}
      {!mine && (
        <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setStars(n)}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                  color: n <= stars ? '#FFB020' : '#D8D5CE', lineHeight: 1,
                }}
                aria-label={`${n}점`}
              >
                <EventIcon name={n <= stars ? 'starFill' : 'star'} size={24} />
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={user ? '이벤트는 어땠나요? 다녀온 경험을 남겨주세요.' : '로그인하고 후기를 남겨보세요.'}
            rows={3}
            maxLength={2000}
            style={{
              width: '100%', border: '1px solid var(--border)', borderRadius: 10,
              padding: 12, fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical',
              background: 'var(--surface)', color: 'var(--text)',
            }}
          />
          {error && <div style={{ fontSize: 12.5, color: 'var(--red, #FF6B6B)', marginTop: 8 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={submit}
              disabled={saving || content.trim().length === 0}
              style={{
                border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
                background: 'var(--accent)', color: '#fff', opacity: saving || !content.trim() ? .5 : 1,
              }}
            >
              {saving ? '등록 중…' : '후기 남기기'}
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>불러오는 중…</div>
      ) : reviews.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, padding: '20px 0' }}>
          아직 후기가 없어요. 첫 번째 후기를 남겨보세요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {reviews.map(r => (
            <div key={r.id} style={{ padding: '16px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <UserAvatar
                  userId={r.author?.id}
                  src={r.author?.avatarUrl}
                  name={r.author?.nickname}
                  size={30}
                  showEffect={false}
                />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{r.author?.nickname ?? '알 수 없음'}</span>
                <UserTitle userId={r.author?.id} />
                <span style={{ display: 'inline-flex', gap: 1, color: '#FFB020' }}>
                  {Array.from({ length: r.stars }).map((_, i) => <EventIcon key={i} name="starFill" size={14} />)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{fmt(r.createdAt)}</span>
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{r.content}</p>
              {user?.id === r.userId && (
                <button
                  onClick={() => remove(r.id)}
                  style={{ marginTop: 8, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'var(--muted)' }}
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
