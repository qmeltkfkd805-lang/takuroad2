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
    <div style={{ padding: '20px 48px 72px' }}>
      <style>{`
        .taku-detail{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:28px}
        @media (max-width:1024px){.taku-detail{grid-template-columns:1fr}.taku-detail-side{display:none}}
      `}</style>
      <div className="taku-detail">
        <div style={{ minWidth: 0 }}>
          <PostDetailModal post={post} variant="page" onClose={() => router.back()} onChanged={load} />
        </div>
        <aside className="taku-detail-side">
          <AdCard />
        </aside>
      </div>
    </div>
  )
}

function AdCard() {
  useEffect(() => {
    try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}) } catch { /* noop */ }
  }, [])
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: 12, overflow: 'hidden', position: 'sticky', top: 16 }}>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', textAlign: 'right', marginBottom: 4 }}>광고</div>
      <ins className="adsbygoogle" style={{ display: 'block', width: '100%', minHeight: 600 }} data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="XXXXXXXXXX" data-ad-format="vertical" data-full-width-responsive="true" />
    </div>
  )
}
