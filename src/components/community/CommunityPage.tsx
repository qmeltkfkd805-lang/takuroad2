'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { ROUTES } from '@/lib/constants/routes'
import { UserAvatar, UserTitle } from '@/components/cosmetic/UserFace'
import { getAllTagsForSelect } from '@/services/routeService'
import {
  getPosts, getNotices, getPopularPosts, getCommunityStats, getTrendingTags, getWorkSearchCounts,
} from '@/services/communityPostService'
import {
  Board, BOARDS, BOARD_LABEL, COMMUNITY_NAV, CREATION_BOARDS, CommunityPost, PostSort,
  CommunityStats, TrendingTag,
} from '@/types/community-post'
import { PostCard } from '@/components/community/PostUI'

type Scope = 'all' | 'popular' | 'mine'
type View = 'list' | 'grid'
type Sel = Board | 'all'
type Tag = { id: string; name: string; slug: string }
const PAGE_SIZE = 20

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60) return '방금'
  if (d < 3600) return `${Math.floor(d / 60)}분 전`
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`
  if (d < 86400 * 7) return `${Math.floor(d / 86400)}일 전`
  const dt = new Date(iso)
  return `${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`
}

export default function CommunityPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [board, setBoard] = useState<Sel>('all')
  const [sort, setSort] = useState<PostSort>('latest')
  const [scope, setScope] = useState<Scope>('all')
  const [view, setView] = useState<View>('list')
  const [page, setPage] = useState(1)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<Tag | null>(null)
  const [tagQuery, setTagQuery] = useState('')
  const [tagOpen, setTagOpen] = useState(false)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [searchCounts, setSearchCounts] = useState<Record<string, number>>({})

  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [notices, setNotices] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)

  const [popular, setPopular] = useState<CommunityPost[]>([])
  const [tags, setTags] = useState<TrendingTag[]>([])
  const [stats, setStats] = useState<CommunityStats | null>(null)

  const tabsRef = useRef<HTMLDivElement>(null)
  const [tabOverflow, setTabOverflow] = useState(false)
  const scrollTabs = (dir: number) => tabsRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' })
  useEffect(() => {
    const el = tabsRef.current
    if (!el) return
    const check = () => setTabOverflow(el.scrollWidth > el.clientWidth + 4)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [list, ntc] = await Promise.all([
      getPosts(board, scope === 'popular' ? 'popular' : sort, user?.id, {
        mineOnly: scope === 'mine', search, tagId: tagFilter?.id,
      }),
      getNotices(board),
    ])
    setPosts(list); setNotices(ntc); setLoading(false); setPage(1)
  }, [board, sort, scope, search, tagFilter?.id, user?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getPopularPosts(5).then(setPopular).catch(() => {})
    getTrendingTags(10).then(setTags).catch(() => {})
    getCommunityStats().then(setStats).catch(() => {})
    getAllTagsForSelect().then((t) => setAllTags(t as Tag[])).catch(() => {})
    getWorkSearchCounts().then(setSearchCounts).catch(() => {})
  }, [])

  const reloadSidebar = () => {
    getPopularPosts(5).then(setPopular).catch(() => {})
    getCommunityStats().then(setStats).catch(() => {})
  }

  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE))
  const paged = useMemo(() => posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [posts, page])
  const openWrite = () => (user ? router.push('/community/write' + (board !== 'all' ? `?board=${board}` : '')) : router.push(ROUTES.login))
  const openPost = (p: CommunityPost) => router.push(`/community/${p.id}`)

  const inCreation = CREATION_BOARDS.includes(board as Board)
  const sortedTags = useMemo(
    () => [...allTags].sort((a, b) => (searchCounts[b.id] ?? 0) - (searchCounts[a.id] ?? 0) || a.name.localeCompare(b.name, 'ko')),
    [allTags, searchCounts],
  )
  const filteredTags = tagQuery.trim()
    ? sortedTags.filter(t => t.name.toLowerCase().includes(tagQuery.trim().toLowerCase())).slice(0, 30)
    : sortedTags.slice(0, 30)

  return (
    <div className="taku-comm-min" style={{ padding: '24px 32px 72px' }}>
      <style>{`
        .taku-comm{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;align-items:start}
        @media (max-width:1024px){.taku-comm{grid-template-columns:1fr}.taku-comm-side{display:none}}
        .taku-noscroll::-webkit-scrollbar{display:none}.taku-noscroll{scrollbar-width:none}
                .taku-prow:hover{background:var(--surface2)}
        .taku-comm-min{min-width:1040px}
        @media (max-width:1024px){.taku-comm-min{min-width:0}}
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 4px' }}>커뮤니티</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>타쿠들과 함께 정보도 나누고, 덕질도 즐겨요!</p>
        </div>
        <button onClick={openWrite} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 18px', borderRadius: 11, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          게시글 작성
        </button>
      </div>

      <div className="taku-comm">
        <main style={{ minWidth: 0 }}>
          {/* 상단 탭 */}
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 2, borderBottom: '1px solid var(--border)' }}>
            {tabOverflow && <button onClick={() => scrollTabs(-1)} aria-label="이전" style={tabArrow}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>}
            <div ref={tabsRef} className="taku-noscroll" style={{ display: 'flex', gap: 4, overflowX: 'auto', flex: 1, minWidth: 0, scrollBehavior: 'smooth' }}>
              <BoardTab label="전체" active={board === 'all'} onClick={() => setBoard('all')} />
              {COMMUNITY_NAV.map((item, i) => item.type === 'board'
                ? <BoardTab key={i} label={item.label} active={board === item.board} onClick={() => setBoard(item.board)} />
                : <BoardTab key={i} label={item.label} active={CREATION_BOARDS.includes(board as Board)} onClick={() => setBoard(item.boards[0])} />)}
            </div>
            {tabOverflow && <button onClick={() => scrollTabs(1)} aria-label="다음" style={tabArrow}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>}
          </div>

          {/* 창작게시판 세부탭 */}
          {inCreation && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {CREATION_BOARDS.map(b => (
                <button key={b} onClick={() => setBoard(b)} style={{
                  padding: '7px 15px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                  border: `1.5px solid ${board === b ? 'var(--accent)' : 'var(--border)'}`,
                  background: board === b ? 'var(--accent)' : 'var(--surface)',
                  color: board === b ? '#fff' : 'var(--text)',
                }}>{BOARD_LABEL[b]}</button>
              ))}
            </div>
          )}

          {/* 히어로 배너 */}
          <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(100deg, #FFE3EF 0%, #FFD1E6 100%)', padding: '30px 34px', margin: '18px 0 20px', minHeight: 116, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#C41E6A', marginBottom: 6 }}>타쿠들의 자유로운 공간</div>
            <div style={{ fontSize: 14, color: '#B84A7E' }}>즐거운 덕질 생활을 함께 나눠요!</div>
          </div>

          {/* 검색 + 작품 필터 */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flex: 1, minWidth: 200, alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && setSearch(searchInput)} placeholder="제목·내용 검색" style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit' }} />
              {search && <button onClick={() => { setSearchInput(''); setSearch('') }} style={{ border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>}
            </div>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setTagOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: `1px solid ${tagFilter ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--surface)', color: tagFilter ? 'var(--accent)' : 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                {tagFilter ? `# ${tagFilter.name}` : '작품 필터'}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {tagFilter && <button onClick={() => setTagFilter(null)} style={{ marginLeft: 6, border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>해제</button>}
              {tagOpen && (
                <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 20, marginTop: 4, width: 240, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.14)', padding: 8 }}>
                  <input autoFocus value={tagQuery} onChange={e => setTagQuery(e.target.value)} placeholder="작품 검색" style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 6 }} />
                  <div style={{ maxHeight: 220, overflow: 'auto' }}>
                    {filteredTags.map(t => (
                      <button key={t.id} onClick={() => { setTagFilter(t); setTagOpen(false); setTagQuery('') }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, color: 'var(--text)', borderRadius: 7 }}>{t.name}</button>
                    ))}
                    {filteredTags.length === 0 && <div style={{ padding: '10px 11px', fontSize: 13, color: 'var(--muted)' }}>결과 없음</div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 필터 바 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <select value={sort} onChange={e => setSort(e.target.value as PostSort)} style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value="latest">최신순</option>
                <option value="popular">인기순</option>
              </select>
              {(['all', 'popular', 'mine'] as Scope[]).map(sc => (
                <button key={sc} onClick={() => setScope(sc)} style={{ padding: '7px 14px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, border: 'none', background: scope === sc ? 'var(--accent-l, rgba(232,0,111,.1))' : 'transparent', color: scope === sc ? 'var(--accent)' : 'var(--muted)' }}>{sc === 'all' ? '전체' : sc === 'popular' ? '인기글' : '내 게시글'}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <ViewBtn active={view === 'grid'} onClick={() => setView('grid')} kind="grid" />
              <ViewBtn active={view === 'list'} onClick={() => setView('list')} kind="list" />
            </div>
          </div>

          {/* 공지 */}
          {notices.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
              {notices.map(n => (
                <div key={n.id} onClick={() => openPost(n)} className="taku-prow" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'rgba(232,0,111,.04)' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', background: 'var(--surface)', border: '1px solid var(--accent)', padding: '2px 8px', borderRadius: 9999, flexShrink: 0 }}>공지</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || '(제목 없음)'}</span>
                </div>
              ))}
            </div>
          )}

          {/* 목록 */}
          {loading ? (
            <p style={{ color: 'var(--muted)', padding: '24px 0' }}>불러오는 중…</p>
          ) : posts.length === 0 ? (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 16, padding: '48px 20px', textAlign: 'center', color: 'var(--muted)' }}>
              <p style={{ margin: '0 0 16px', fontSize: 14 }}>{search || tagFilter ? '조건에 맞는 글이 없어요.' : '아직 글이 없어요. 첫 글을 남겨보세요!'}</p>
              <button onClick={openWrite} style={{ padding: '11px 18px', borderRadius: 11, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>게시글 작성</button>
            </div>
          ) : view === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {paged.map(p => <PostCard key={p.id} post={p} onOpen={openPost} showBoard />)}
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 116px 78px 64px 60px', gap: 8, padding: '11px 16px', borderBottom: '1px solid var(--border)', fontSize: 12.5, fontWeight: 800, color: 'var(--muted)', background: 'var(--surface2)' }}>
                <span>카테고리</span><span>제목</span><span>작성자</span><span style={{ textAlign: 'right' }}>작성일</span><span style={{ textAlign: 'center' }}>좋아요</span><span style={{ textAlign: 'center' }}>조회</span>
              </div>
              {paged.map(p => (
                <div key={p.id} className="taku-prow" onClick={() => openPost(p)} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 116px 78px 64px 60px', gap: 8, padding: '11px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--muted)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{BOARD_LABEL[p.board]}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{p.flair && <span style={flairBadge}>{p.flair}</span>}{p.isSpoiler && <span style={spoilerBadge}>스포주의</span>}{p.title || '(제목 없음)'}{p.commentCount > 0 && <span style={{ color: 'var(--accent)', fontWeight: 800, marginLeft: 6, fontSize: 12.5 }}>[{p.commentCount}]</span>}</span>
                    {p.images.length > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 4.5-4.5 3 3L16 11l4 4.5" /></svg>{p.images.length}
                      </span>
                    )}
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <UserAvatar userId={p.author?.id} src={p.author?.avatarUrl} name={p.author?.nickname} size={18} showEffect={false} />
                  <span style={{ color: 'var(--muted)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.author?.nickname ?? '익명'}</span>
                  <UserTitle userId={p.author?.id} />
                </span>
                  <span style={{ textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>{timeAgo(p.createdAt)}</span>
                  <span style={{ textAlign: 'center', color: '#FF4D6D', fontWeight: 700, fontSize: 12.5 }}>♥ {p.likeCount}</span>
                  <span style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12.5 }}>{p.viewCount}</span>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 22 }}>
              <PageBtn disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</PageBtn>
              {pageNumbers(page, totalPages).map((n, i) => n === '…'
                ? <span key={i} style={{ color: 'var(--muted)', padding: '0 4px' }}>…</span>
                : <PageBtn key={i} active={n === page} onClick={() => setPage(n as number)}>{n}</PageBtn>)}
              <PageBtn disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</PageBtn>
            </div>
          )}
        </main>

        <aside className="taku-comm-side" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SideCard title="인기 게시글">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {popular.slice(0, 5).map((p, i) => (
                <div key={p.id} onClick={() => openPost(p)} style={{ display: 'flex', gap: 10, cursor: 'pointer', alignItems: 'center' }}>
                  <span style={{ width: 22, textAlign: 'center', fontWeight: 900, fontSize: 14, color: i < 3 ? 'var(--accent)' : 'var(--muted)', flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.isSpoiler && <span style={spoilerBadge}>스포</span>}{p.title || '(제목 없음)'}</div>
                  </div>
                  <span style={{ fontSize: 12, color: '#FF4D6D', fontWeight: 700, flexShrink: 0 }}>♥ {p.likeCount}</span>
                </div>
              ))}
              {popular.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>아직 없어요</div>}
            </div>
          </SideCard>

          <SideCard title="실시간 인기 태그">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {tags.map(t => (
                <button key={t.id} onClick={() => { const f = allTags.find(x => x.id === t.id); setTagFilter(f ?? { id: t.id, name: t.name, slug: t.slug ?? '' }) }} style={{ padding: '5px 11px', borderRadius: 9999, border: 'none', background: 'var(--surface2)', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}># {t.name}</button>
              ))}
              {tags.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>아직 없어요</div>}
            </div>
          </SideCard>

          <SideCard title="커뮤니티 통계">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              <Stat icon="doc" color="#FF5C8A" label="전체 게시글" value={stats?.totalPosts ?? 0} />
              <Stat icon="calendar" color="#22C3A6" label="오늘 게시글" value={stats?.todayPosts ?? 0} />
              <Stat icon="chat" color="#8B6BD9" label="오늘 댓글" value={stats?.todayComments ?? 0} />
              <Stat icon="user" color="#3B9BE8" label="온라인 유저" value="—" />
            </div>
          </SideCard>

          <AdCard />
        </aside>
      </div>

    </div>
  )
}

const spoilerBadge: React.CSSProperties = {
  display: 'inline-block', fontSize: 10.5, fontWeight: 800, color: '#fff', background: '#e04343',
  padding: '1px 6px', borderRadius: 5, marginRight: 6, verticalAlign: 'middle',
}
const flairBadge: React.CSSProperties = {
  display: 'inline-block', fontSize: 11, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.12))',
  padding: '1px 7px', borderRadius: 5, marginRight: 6, verticalAlign: 'middle',
}

function BoardTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '11px 15px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: active ? 800 : 600, color: active ? 'var(--accent)' : 'var(--muted)', borderBottom: `2.5px solid ${active ? 'var(--accent)' : 'transparent'}`, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</button>
  )
}

function ViewBtn({ active, onClick, kind }: { active: boolean; onClick: () => void; kind: 'grid' | 'list' }) {
  return (
    <button onClick={onClick} aria-label={kind} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)', color: active ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {kind === 'grid'
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>}
    </button>
  )
}

const tabArrow: React.CSSProperties = {
  flexShrink: 0, alignSelf: 'center', width: 32, height: 32, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: '16px 18px' }}>
      <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

function AdCard() {
  useEffect(() => {
    try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}) } catch { /* noop */ }
  }, [])
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: 12, overflow: 'hidden' }}>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', textAlign: 'right', marginBottom: 4 }}>광고</div>
      <ins className="adsbygoogle" style={{ display: 'block' }} data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="XXXXXXXXXX" data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  )
}

function Stat({ icon, color, label, value }: { icon: 'doc' | 'calendar' | 'chat' | 'user'; color: string; label: string; value: number | string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: `${color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 7px' }}>
        <StatIcon kind={icon} color={color} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)', lineHeight: 1.1 }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 3 }}>{label}</div>
    </div>
  )
}

function StatIcon({ kind, color }: { kind: 'doc' | 'calendar' | 'chat' | 'user'; color: string }) {
  const p = { width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (kind === 'doc') return <svg {...p}><path d="M6 2.5h8L19 7.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" /><path d="M13.5 2.5V8H19" /><path d="M8.5 13h7M8.5 16.5h5" /></svg>
  if (kind === 'calendar') return <svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
  if (kind === 'chat') return <svg {...p}><path d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 16h-8l-4.5 3.5V16H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 5z" /></svg>
  return <svg {...p}><circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
}

function PageBtn({ children, active, disabled, onClick }: { children: React.ReactNode; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ minWidth: 34, height: 34, padding: '0 8px', borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: active ? 800 : 600, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : disabled ? 'var(--border)' : 'var(--text)' }}>{children}</button>
  )
}

function pageNumbers(cur: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const s = Math.max(2, cur - 1), e = Math.min(total - 1, cur + 1)
  if (s > 2) out.push('…')
  for (let i = s; i <= e; i++) out.push(i)
  if (e < total - 1) out.push('…')
  out.push(total)
  return out
}
