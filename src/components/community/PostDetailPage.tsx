'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getPost, peekPost } from '@/services/communityPostService'
import { CommunityPost } from '@/types/community-post'
import { PostDetailModal } from '@/components/community/PostUI'
import LogoLoader from '@/components/common/LogoLoader'
import { goBack } from '@/lib/nav/leaveEdit'

export default function PostDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = String(params?.id ?? '')
  // 목록에서 넘어왔으면 그 글로 바로 그리고, 뒤에서 최신 내용으로 바꾼다(불러오는 중 화면 없이)
  const [post, setPost] = useState<CommunityPost | null>(() => peekPost(id))
  const [loading, setLoading] = useState(() => !peekPost(id))
  const shownId = useRef(id)

  const load = useCallback(async () => {
    if (shownId.current !== id) {   // 다른 글로 옮김(이전·다음 글) — 기억해 둔 게 있으면 바로, 없으면 불러오는 중
      const peek = peekPost(id)
      if (peek) { setPost(peek); setLoading(false) } else setLoading(true)
      shownId.current = id
    }
    const fresh = await getPost(id, user?.id)
    if (shownId.current !== id) return   // 그새 다른 글로 옮겼으면 버림
    setPost(fresh)
    setLoading(false)
  }, [id, user?.id])
  useEffect(() => { load() }, [load])

  if (loading) return <LogoLoader size="md" />
  if (!post) return (
    <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
      <p style={{ marginBottom: 16 }}>글을 찾을 수 없어요.</p>
      <button onClick={() => router.push('/community')} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>커뮤니티로</button>
    </div>
  )

  return (
    <div className="post-detail-wrap" style={{ paddingTop: 20, paddingBottom: 72 }}>
      <style>{`.post-detail-wrap{padding-left:32px;padding-right:32px}@media (max-width:640px){.post-detail-wrap{padding-left:16px;padding-right:16px}}`}</style>
      {/* 본문 폭 — 다른 커뮤니티처럼 넓게. 굿즈 보드는 우측 레일이 있어 1120 유지 */}
      <div style={{ maxWidth: 1120, margin: '0 auto', minWidth: 0 }}>
        {/* 좌측 상단 뒤로 — 다른 상세 화면과 같은 자리 (2026-10-18 추가) */}
        <button
          type="button"
          onClick={() => goBack(router, '/community')}
          aria-label="뒤로"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 40, margin: '-8px 0 8px -8px', padding: '0 12px 0 6px', border: 'none', borderRadius: 9999, background: 'none', color: 'var(--text)', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          커뮤니티
        </button>
        <PostDetailModal post={post} variant="page" onClose={() => router.back()} onChanged={load} />
      </div>
    </div>
  )
}
