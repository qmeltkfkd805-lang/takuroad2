'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAllMyComments } from '@/services/commentService'
import { ROUTES } from '@/lib/constants/routes'
import { LoadingState } from './SavedShopsTab'
export default function MyCommentsTab({ userId }: { userId: string }) {
  const router = useRouter()
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    getAllMyComments(userId).then(data => { setComments(data); setLoading(false) })
  }, [userId])
  function go(c: any) {
    if (c.kind === 'shop' && c.slug) router.push(ROUTES.shop(c.slug) + '?comment=' + c.id + '&review=' + (c.reviewId ?? ''))
    else if (c.kind === 'post' && c.postId) router.push('/community/' + c.postId + '?comment=' + c.id)
  }
  if (loading) return <LoadingState />
  return (
    <div style={{ padding: '0 4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>
            <th style={{ textAlign: 'left', padding: '12px 8px', width: 90, whiteSpace: 'nowrap' }}>위치</th>
            <th style={{ textAlign: 'left', padding: '12px 8px' }}>원글</th>
            <th style={{ textAlign: 'left', padding: '12px 8px' }}>내 댓글</th>
            <th style={{ textAlign: 'right', padding: '12px 8px', width: 90, whiteSpace: 'nowrap' }}>작성일</th>
          </tr>
        </thead>
        <tbody>
          {comments.length === 0 ? (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>작성한 댓글이 없어요</td></tr>
          ) : (
            comments.map(c => (
              <tr
                key={c.kind + c.id}
                onClick={() => go(c)}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              >
                <td style={{ padding: '14px 8px', whiteSpace: 'nowrap' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
                    background: c.source === '커뮤니티' ? 'var(--accent-l)' : 'var(--surface2)',
                    color: c.source === '커뮤니티' ? 'var(--accent)' : 'var(--muted)',
                  }}>{c.source}</span>
                </td>
                <td style={{ padding: '14px 8px', fontWeight: 700, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</td>
                <td style={{ padding: '14px 8px', color: 'var(--text)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.content || '—'}</td>
                <td style={{ padding: '14px 8px', textAlign: 'right', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleDateString('ko-KR')}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}