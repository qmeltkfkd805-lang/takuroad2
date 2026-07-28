'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { ROUTES } from '@/lib/constants/routes'
import { getWorkPosts } from '@/services/communityPostService'
import { getFanartBadgesForTag } from '@/services/fanartService'
import { Board, CommunityPost, PostSort, WORK_TAB_BOARDS, BOARD_LABEL } from '@/types/community-post'
import { PostCard, PostDetailModal } from '@/components/community/PostUI'
import WorkFeaturedFanart from '@/components/community/WorkFeaturedFanart'

// 작품 상세: 이 작품에 연결된 팬 활동(팬아트/팬창작/굿즈자랑)이 모이는 허브 섹션
export default function WorkCommunityTabs({ tagId, workName }: { tagId: string; workName: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [board, setBoard] = useState<Board>('fanart')
  const [sort, setSort] = useState<PostSort>('popular')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [opened, setOpened] = useState<CommunityPost | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const list = await getWorkPosts(tagId, board, sort, user?.id)
    if (board === 'fanart') {
      const badges = await getFanartBadgesForTag(tagId)
      if (badges.size) list.forEach(p => { const f = badges.get(p.id); if (f) p.featured = f })
    }
    setPosts(list); setLoading(false)
  }, [tagId, board, sort, user?.id])

  useEffect(() => { load() }, [load])

  return (
    <div>
      {/* 대표 팬아트 (시즌 대표 / 인기 임시 / 팬아트 없음 3-case) */}
      {board === 'fanart' && <WorkFeaturedFanart tagId={tagId} workName={workName} onOpenPost={setOpened} />}

      {/* 탭 + 글쓰기 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {WORK_TAB_BOARDS.map(b => (
            <button key={b} onClick={() => setBoard(b)} style={{
              padding: '8px 14px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
              border: `1.5px solid ${board === b ? 'var(--accent)' : 'var(--border)'}`,
              background: board === b ? 'var(--accent)' : 'var(--surface)',
              color: board === b ? '#fff' : 'var(--text)',
            }}>{BOARD_LABEL[b]}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['popular', 'latest'] as PostSort[]).map(s => (
              <button key={s} onClick={() => setSort(s)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: s === sort ? 800 : 600, color: s === sort ? 'var(--accent)' : 'var(--muted)' }}>{s === 'popular' ? '인기순' : '최신순'}</button>
            ))}
          </div>
          <button onClick={() => (user ? router.push(`/community/write?board=${board}&tag=${tagId}&lockTag=1`) : router.push(ROUTES.login))} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 15px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            글쓰기
          </button>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>불러오는 중…</p>
      ) : posts.length === 0 ? (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 16, padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
          <p style={{ margin: '0 0 14px', fontSize: 14 }}>아직 이 작품의 {BOARD_LABEL[board]} 글이 없어요. 첫 글을 남겨보세요!</p>
          <button onClick={() => (user ? router.push(`/community/write?board=${board}&tag=${tagId}&lockTag=1`) : router.push(ROUTES.login))} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>글쓰기</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {posts.map(p => <PostCard key={p.id} post={p} onOpen={setOpened} />)}
        </div>
      )}

      {opened && <PostDetailModal post={opened} onClose={() => setOpened(null)} onChanged={load} />}
    </div>
  )
}
