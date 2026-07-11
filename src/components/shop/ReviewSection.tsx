'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getReviews, createReview, deleteReview, uploadReviewImages, recordReviewPhotos } from '@/services/reviewService'
import { getComments, createComment, deleteComment, ReviewComment } from '@/services/commentService'
import { Review } from '@/types/review'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { Button } from '@/components/tds/Button'

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
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getReviews(shopId).then(data => {
      setReviews(data)
      setLoading(false)
      const hash = window.location.hash
      if (hash.startsWith('#review-')) {
        setTimeout(() => {
          const el = document.getElementById(hash.slice(1))
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 300)
      }
    })
  }, [shopId])

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    const newImages = [...images, ...files].slice(0, 5)
    setImages(newImages)
    const newPreviews = newImages.map(f => URL.createObjectURL(f))
    setPreviews(newPreviews)
  }

  function removeImage(idx: number) {
    const newImages = images.filter((_, i) => i !== idx)
    const newPreviews = previews.filter((_, i) => i !== idx)
    setImages(newImages)
    setPreviews(newPreviews)
  }

  async function handleSubmit() {
    if (!user || !profile) return
    if (!content.trim()) return
    setSubmitting(true)
    const newReview = await createReview(shopId, user.id, { stars, content, images: [] })
    if (newReview) {
      if (images.length > 0) {
        await uploadReviewImages(newReview.id, images)
        // 성장 Activity — 사진 등록. 실패해도 리뷰는 이미 올라갔다
        recordReviewPhotos(newReview.id, shopId, user.id, images.length).catch(() => {})
        const updated = await getReviews(shopId)
        setReviews(updated)
      } else {
        setReviews(prev => [newReview, ...prev])
      }
      setContent('')
      setStars(5)
      setImages([])
      setPreviews([])
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

  const pencilIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 900 }}>
          리뷰 {reviews.length > 0 && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({reviews.length})</span>}
        </h2>
        {user ? (
          <Button
            variant={showForm ? 'action' : 'primary'}
            size="md"
            onClick={() => setShowForm(v => !v)}
            style={{ padding: '8px 16px', fontSize: 13, borderRadius: 12 }}
            leftIcon={showForm ? undefined : pencilIcon}
          >
            {showForm ? '취소' : '리뷰 작성'}
          </Button>
        ) : (
          <Link href={ROUTES.login} style={{
            padding: '7px 14px', borderRadius: '8px',
            border: '1px solid var(--border)', fontSize: '13px', color: 'var(--muted)',
          }}>
            로그인 후 작성
          </Link>
        )}
      </div>

      {showForm && (
        <div style={{
          background: 'var(--surface2)', borderRadius: '12px',
          padding: '16px', marginBottom: '20px',
          border: '1.5px solid var(--border)',
        }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {[1,2,3,4,5].map(s => (
              <button
                key={s}
                onClick={() => setStars(s)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '24px', padding: '0', lineHeight: 1,
                  color: s <= stars ? '#f59e0b' : 'var(--border)',
                }}
              >★</button>
            ))}
            <span style={{ fontSize: '13px', color: 'var(--muted)', alignSelf: 'center', marginLeft: '4px' }}>
              {stars}점
            </span>
          </div>

          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={`${shopName} 어떠셨어요? 솔직한 후기를 남겨주세요`}
            rows={4}
            style={{
              width: '100%', padding: '12px',
              border: '1.5px solid var(--border)', borderRadius: '8px',
              fontSize: '14px', fontFamily: 'inherit', lineHeight: 1.6,
              background: 'var(--surface)', color: 'var(--text)',
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            }}
          />

          {previews.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              {previews.map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={url} alt="" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                  <button
                    onClick={() => removeImage(i)}
                    style={{
                      position: 'absolute', top: '-6px', right: '-6px',
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: 'var(--red)', color: '#fff',
                      border: 'none', cursor: 'pointer', fontSize: '11px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 5}
              style={{
                padding: '8px 12px', borderRadius: '8px',
                border: '1.5px solid var(--border)',
                background: 'var(--surface)', color: 'var(--muted)',
                fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              📷 사진 {images.length > 0 ? `${images.length}/5` : '추가'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />

            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              disabled={submitting || !content.trim()}
              style={{ padding: '10px 20px', fontSize: 14, borderRadius: 12 }}
            >
              {submitting ? '등록 중...' : '등록'}
            </Button>
          </div>
        </div>
      )}

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
              accentColor={accentColor}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewItem({ review, currentUserId, onDelete, accentColor }: {
  review: Review
  currentUserId: string | null
  onDelete: (id: string) => void
  accentColor: string
}) {
  const isOwn = currentUserId === review.user_id
  const [imgIdx, setImgIdx] = useState<number | null>(null)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [highlighted, setHighlighted] = useState(false)
  const d = new Date(review.created_at)
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`

  useEffect(() => {
    const hash = window.location.hash
    if (hash === `#review-${review.id}`) {
      loadComments()
      setShowComments(true)
      setHighlighted(true)
      const timer = setTimeout(() => setHighlighted(false), 2500)
      return () => clearTimeout(timer)
    }
  }, [review.id])

  function prev() {
    setImgIdx(i => (i !== null && i > 0 ? i - 1 : i))
  }

  function next() {
    setImgIdx(i => (i !== null && i < review.images.length - 1 ? i + 1 : i))
  }

  async function loadComments() {
    const data = await getComments(review.id)
    setComments(data)
  }

  function toggleComments() {
    if (!showComments) loadComments()
    setShowComments(v => !v)
  }

  async function handleCommentSubmit() {
    if (!currentUserId || !commentText.trim()) return
    setSubmittingComment(true)
    const newComment = await createComment(review.id, currentUserId, commentText.trim())
    if (newComment) {
      setComments(prev => [...prev, newComment])
      setCommentText('')
    }
    setSubmittingComment(false)
  }

  async function handleCommentDelete(commentId: string) {
    if (!currentUserId) return
    if (!confirm('댓글을 삭제할까요?')) return
    await deleteComment(commentId, currentUserId)
    setComments(prev => prev.filter(c => c.id !== commentId))
  }

  return (
    <div
      id={`review-${review.id}`}
      style={{
        padding: '14px', borderBottom: '1px solid var(--border)',
        borderRadius: '10px', margin: '0 -14px',
        background: highlighted ? `${accentColor}12` : 'transparent',
        transition: 'background 1s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
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

      {review.content && (
        <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text)', margin: '0' }}>
          {review.content}
        </p>
      )}

      {review.images.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
          {review.images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              onClick={() => setImgIdx(i)}
              style={{
                width: '80px', height: '80px', objectFit: 'cover',
                borderRadius: '8px', cursor: 'pointer',
              }}
            />
          ))}
        </div>
      )}

      <button
        onClick={toggleComments}
        style={{
          background: 'none', border: 'none', fontSize: '12px',
          color: 'var(--muted)', cursor: 'pointer', padding: '8px 0 0',
          fontWeight: 700,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', lineHeight: 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0, position: 'relative', top: '1.5px' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          댓글 {showComments ? '숨기기' : '보기'} {comments.length > 0 && `(${comments.length})`}
        </span>
      </button>

      {showComments && (
        <div style={{ marginTop: '10px', paddingLeft: '8px' }}>
          {comments.map(c => (
            <div key={c.id} style={{
              display: 'flex', gap: '8px', padding: '8px 0',
              borderTop: '1px solid var(--border)',
            }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: 'var(--surface2)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700, color: 'var(--muted)', flexShrink: 0,
              }}>
                {c.author?.avatar_url ? (
                  <img src={c.author.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  c.author?.nickname?.[0] ?? '?'
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>{c.author?.nickname ?? '익명'}</span>
                  {currentUserId === c.user_id && (
                    <button
                      onClick={() => handleCommentDelete(c.id)}
                      style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer' }}
                    >삭제</button>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text)', margin: '2px 0 0' }}>{c.content}</p>
              </div>
            </div>
          ))}

          {currentUserId ? (
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCommentSubmit()}
                placeholder="댓글을 남겨보세요"
                style={{
                  flex: 1, padding: '8px 10px',
                  border: '1.5px solid var(--border)', borderRadius: '8px',
                  fontSize: '13px', fontFamily: 'inherit',
                  background: 'var(--surface2)', color: 'var(--text)',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleCommentSubmit}
                disabled={submittingComment || !commentText.trim()}
                style={{
                  padding: '8px 14px', borderRadius: '8px', border: 'none',
                  background: !commentText.trim() ? 'var(--border)' : accentColor,
                  color: '#fff', fontSize: '12px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >등록</button>
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
              <Link href={ROUTES.login} style={{ color: accentColor }}>로그인</Link> 후 댓글을 남길 수 있어요
            </p>
          )}
        </div>
      )}

      {imgIdx !== null && (
        <div
          onClick={() => setImgIdx(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <img
            src={review.images[imgIdx]}
            alt=""
            style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }}
          />
          {imgIdx > 0 && (
            <button
              onClick={e => { e.stopPropagation(); prev() }}
              style={{
                position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,.2)', border: 'none',
                color: '#fff', fontSize: '24px', cursor: 'pointer',
                width: '44px', height: '44px', borderRadius: '50%',
              }}
            >‹</button>
          )}
          {imgIdx < review.images.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); next() }}
              style={{
                position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,.2)', border: 'none',
                color: '#fff', fontSize: '24px', cursor: 'pointer',
                width: '44px', height: '44px', borderRadius: '50%',
              }}
            >›</button>
          )}
          <button
            onClick={() => setImgIdx(null)}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'rgba(255,255,255,.2)', border: 'none',
              color: '#fff', fontSize: '20px', cursor: 'pointer',
              width: '36px', height: '36px', borderRadius: '50%',
            }}
          >✕</button>
          {review.images.length > 1 && (
            <div style={{
              position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: '6px',
            }}>
              {review.images.map((_, i) => (
                <div
                  key={i}
                  onClick={e => { e.stopPropagation(); setImgIdx(i) }}
                  style={{
                    width: i === imgIdx ? '20px' : '8px', height: '8px',
                    borderRadius: '4px',
                    background: i === imgIdx ? '#fff' : 'rgba(255,255,255,.4)',
                    cursor: 'pointer', transition: 'all .2s',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}





