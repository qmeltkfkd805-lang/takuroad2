'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getPost } from '@/services/communityPostService'
import { CommunityPost } from '@/types/community-post'
import { PostDetailModal } from '@/components/community/PostUI'

export default function PostDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = String(params?.id ?? '')
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setPost(await getPost(id, user?.id))
    setLoading(false)
  }, [id, user?.id])
  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중…</div>
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
        <PostDetailModal post={post} variant="page" onClose={() => router.back()} onChanged={load} />
      </div>
    </div>
  )
}
