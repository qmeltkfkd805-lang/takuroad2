'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getReviews, createReview, deleteReview } from '@/services/reviewService'
import { Review } from '@/types/review'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'

interface Props {
  shopId: string
  shopName: string
  accentColor: string
}

export default function ReviewSection({ shopId, shopName, accentColor }: Props) {
  const { user, profile } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [stars, setStars] = useState(5)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getReviews(shopId).then(data => {
      setReviews(data)
      setLoading(false)
    })
  }, [shopId])

  async function handleSubmit() {
    if (!user || !profile) return
    if (!content.trim()) return

    setSubmitting(true)
    const newReview = await createReview(shopId, user.id, { stars, content, images: [] })
    if (newReview) {
      setReviews(prev => [newReview, ...prev])
      setContent('')
      setStars(5)
      setShowForm(false)
    }
    setSubmitting(false)
  }

  async function handleDelete(reviewId: string) {
    if (!user) return
    if (!confirm('리뷰를 삭제할까요?')) return
    await deleteReview(reviewId, user.id)
    setReviews(prev => prev.filter(r => r.id !== reviewId))
  }

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 900 }}>
          리뷰 {reviews.length > 0 && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({reviews.length})</span>}
        </h2>
        {user ? (
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              padding: '7px 14px', borderRadius: '8px',
              background: showForm ? 'var(--surface2)' : accentColor,
              color: showForm ? 'var(--text)' : '#fff',
              border: 'none', fontWeight: 700, fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {showForm ? '취소' : '리뷰 쓰기'}
          </button>
        ) : (
          <Link href={ROUTES.login} style={{
            padding: '7px 14px', borderRadius: '8px',
            border: '1px solid var(--border)', fontSize: '13px', color: 'var(--muted)',
          }}>
            로그인 후 작성
          </Link>
        )}
      </div>

      {/* 리뷰 작성 폼 */}
      {showForm && (
        <div style={{
          background: 'var(--surface2)', borderRadius: '12px',
          padding: '16px', marginBottom: '20px',
          border: '1.5px solid var(--border)',
        }}>
          {/* 별점 */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {[1,2,3,4,5].map(s => (
              <button
                key={s}
                onClick={() => setStars(s)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '24px', padding: '0',
                  color: s <= stars ? '#f59e0b' : 'var(--border)',
                }}
              >★</button>
            ))}
            <span style={{ fontSize: '13px', color: 'var(--muted)', alignSelf: 'center', marginLeft: '4px' }}>
              {stars}점
            </span>
          </div>

          {/* 내용 */}
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={`${shopName} 어땠나요? 솔직한 후기를 남겨주세요.`}
            rows={4}
            style={{
              width: '100%', padding: '12px',
              border: '1.5px solid var(--border)', borderRadius: '8px',
              fontSize: '14px', fontFamily: 'inherit', lineHeight: 1.6,
              background: 'var(--surface)', color: 'var(--text)',
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              onClick={handleSubmit}
              disabled={submitting || !content.trim()}
              style={{
                padding: '10px 20px', borderRadius: '8px',
                background: submitting || !content.trim() ? 'var(--border)' : accentColor,
                color: '#fff', border: 'none',
                fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      {/* 리뷰 목록 */}
      {loading ? (
        <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
          불러오는 중...
        </div>
      ) : reviews.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>✏️</div>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>아직 리뷰가 없어요. 첫 리뷰를 남겨보세요!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {reviews.map(review => (
            <ReviewItem
              key={review.id}
              review={review}
              currentUserId={user?.id ?? null}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// 리뷰 아이템
function ReviewItem({ review, currentUserId, onDelete }: {
  review: Review
  currentUserId: string | null
  onDelete: (id: string) => void
}) {
  const isOwn = currentUserId === review.user_id
  const date = new Date(review.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div style={{
      padding: '14px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* 작성자 + 별점 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        {/* 아바타 */}
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: 'var(--surface2)', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700, color: 'var(--muted)', flexShrink: 0,
        }}>
          {review.author?.avatar_url ? (
            <img src={review.author.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            review.author?.nickname?.[0] ?? '?'
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '13px' }}>
            {review.author?.nickname ?? '익명'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#f59e0b', fontSize: '12px' }}>
              {'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{date}</span>
          </div>
        </div>

        {isOwn && (
          <button
            onClick={() => onDelete(review.id)}
            style={{
              background: 'none', border: 'none', fontSize: '12px',
              color: 'var(--muted)', cursor: 'pointer', padding: '4px',
            }}
          >
            삭제
          </button>
        )}
      </div>

      {/* 내용 */}
      {review.content && (
        <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text)', margin: '0' }}>
          {review.content}
        </p>
      )}

      {/* 리뷰 이미지 */}
      {review.images.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
          {review.images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
