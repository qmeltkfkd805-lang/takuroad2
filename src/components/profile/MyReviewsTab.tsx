'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getMyReviews } from '@/services/reviewService'
import { ROUTES } from '@/lib/constants/routes'
import { LoadingState, EmptyState } from './SavedShopsTab'

export default function MyReviewsTab({ userId }: { userId: string }) {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyReviews(userId).then(data => {
      setReviews(data)
      setLoading(false)
    })
  }, [userId])

  if (loading) return <LoadingState />
  if (reviews.length === 0) return <EmptyState icon="✍️" text="작성한 후기가 없어요" />

  return (
    <div>
      {reviews.map(review => (
        <Link
          key={review.id}
          href={ROUTES.shop(review.shops?.slug ?? '')}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>{review.shops?.name ?? '알 수 없음'}</span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {new Date(review.created_at).toLocaleDateString('ko-KR')}
              </span>
            </div>
            <div style={{ color: '#f59e0b', fontSize: '12px', marginBottom: '6px' }}>
              {'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}
            </div>
            {review.content && (
              <p style={{
                fontSize: '13px', color: 'var(--text)', lineHeight: 1.6,
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {review.content}
              </p>
            )}
            {review.review_images?.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                {review.review_images.slice(0, 3).map((img: any, i: number) => (
                  <img key={i} src={img.image_url} alt="" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' }} />
                ))}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}