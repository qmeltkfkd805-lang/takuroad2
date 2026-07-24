'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getMyReviews } from '@/services/reviewService'
import { ROUTES } from '@/lib/constants/routes'
import { LoadingState } from './SavedShopsTab'
import AppIcon from '@/components/tds/AppIcon'
export default function MyReviewsTab({ userId }: { userId: string }) {
  const router = useRouter()
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    getMyReviews(userId).then(data => { setReviews(data); setLoading(false) })
  }, [userId])
  if (loading) return <LoadingState />
  return (
    <div style={{ padding: '0 4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>
            <th style={{ textAlign: 'left', padding: '12px 8px', width: 70, whiteSpace: 'nowrap' }}>위치</th>
            <th style={{ textAlign: 'left', padding: '12px 8px' }}>샵</th>
            <th style={{ textAlign: 'left', padding: '12px 8px' }}>후기</th>
            <th style={{ textAlign: 'center', padding: '12px 8px', width: 70, whiteSpace: 'nowrap' }}>별점</th>
            <th style={{ textAlign: 'right', padding: '12px 8px', width: 90, whiteSpace: 'nowrap' }}>작성일</th>
          </tr>
        </thead>
        <tbody>
          {reviews.length === 0 ? (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>작성한 후기가 없어요</td></tr>
          ) : (
            reviews.map(r => (
              <tr
                key={r.id}
                onClick={() => router.push(ROUTES.shop(r.shops?.slug ?? '') + '?review=' + r.id)}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              >
                <td style={{ padding: '14px 8px', whiteSpace: 'nowrap' }}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'var(--surface2)', color: 'var(--muted)' }}>샵</span></td>
                <td style={{ padding: '14px 8px', fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.shops?.name ?? '삭제된 샵'}</td>
                <td style={{ padding: '14px 8px', color: 'var(--text)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content || '—'}</td>
                <td style={{ padding: '14px 8px', textAlign: 'center', color: '#f59e0b', whiteSpace: 'nowrap' }}><AppIcon name="star" size={12} color="#f59e0b" style={{ verticalAlign: '-1px', marginRight: 2 }} />{r.stars}</td>
                <td style={{ padding: '14px 8px', textAlign: 'right', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}