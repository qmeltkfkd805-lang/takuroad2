'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getMyPosts } from '@/services/communityPostService'
import { LoadingState } from './SavedShopsTab'
export default function MyPostsTab({ userId }: { userId: string }) {
  const router = useRouter()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    getMyPosts(userId).then(data => { setPosts(data); setLoading(false) })
  }, [userId])
  if (loading) return <LoadingState />
  return (
    <div style={{ padding: '0 4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>
            <th style={{ textAlign: 'left', padding: '12px 8px' }}>제목</th>
            <th style={{ textAlign: 'center', padding: '12px 8px', width: 50, whiteSpace: 'nowrap' }}>댓글</th>
            <th style={{ textAlign: 'center', padding: '12px 8px', width: 50, whiteSpace: 'nowrap' }}>조회</th>
            <th style={{ textAlign: 'right', padding: '12px 8px', width: 90, whiteSpace: 'nowrap' }}>작성일</th>
          </tr>
        </thead>
        <tbody>
          {posts.length === 0 ? (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>작성한 글이 없어요</td></tr>
          ) : (
            posts.map(p => (
              <tr
                key={p.id}
                onClick={() => router.push('/community/' + p.id)}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              >
                <td style={{ padding: '14px 8px', fontWeight: 700, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || (p.content ? p.content.slice(0, 30) : '(제목 없음)')}</td>
                <td style={{ padding: '14px 8px', textAlign: 'center', color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>{p.commentCount ?? 0}</td>
                <td style={{ padding: '14px 8px', textAlign: 'center', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{p.viewCount ?? 0}</td>
                <td style={{ padding: '14px 8px', textAlign: 'right', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(p.createdAt).toLocaleDateString('ko-KR')}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}