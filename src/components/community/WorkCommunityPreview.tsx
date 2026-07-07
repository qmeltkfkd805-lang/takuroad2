'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getWorkAllPosts } from '@/services/communityPostService'
import { CommunityPost, BOARD_LABEL } from '@/types/community-post'

export default function WorkCommunityPreview({ tagId, workName }: { tagId: string; workName?: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [posts, setPosts] = useState<CommunityPost[] | null>(null)

  useEffect(() => {
    let alive = true
    getWorkAllPosts(tagId, user?.id).then(p => { if (alive) setPosts(p) }).catch(() => { if (alive) setPosts([]) })
    return () => { alive = false }
  }, [tagId, user?.id])

  const goWrite = () => (user ? router.push(`/community/write?tag=${tagId}`) : router.push('/community'))

  if (posts === null) return <div style={{ padding: '20px 4px', color: 'var(--muted)', fontSize: 13 }}>불러오는 중…</div>

  return (
    <div>
      {posts.length === 0 ? (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: '28px 20px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 800 }}>아직 이 작품 커뮤니티 글이 없어요</p>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>{workName ? `${workName} 팬들과 ` : ''}후기·교환·동행을 나눠보세요</p>
          <button onClick={goWrite} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>글쓰기</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {posts.map(p => (
              <button key={p.id} onClick={() => router.push(`/community/${p.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', flexShrink: 0 }}>{BOARD_LABEL[p.board]}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.flair ? `[${p.flair}] ` : ''}{p.title || '(제목 없음)'}
                  {p.commentCount > 0 && <span style={{ color: 'var(--accent)', fontWeight: 800, marginLeft: 6, fontSize: 12.5 }}>[{p.commentCount}]</span>}
                </span>
                <span style={{ fontSize: 12, color: '#FF4D6D', fontWeight: 700, flexShrink: 0 }}>♥ {p.likeCount}</span>
              </button>
            ))}
          </div>
          <button onClick={goWrite} style={{ marginTop: 12, padding: '11px', width: '100%', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>이 작품으로 글쓰기</button>
        </>
      )}
    </div>
  )
}
