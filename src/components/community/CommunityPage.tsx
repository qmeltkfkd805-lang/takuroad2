'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useIsDesktop } from '@/hooks/useIsDesktop'
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
import { getFollowingIds } from '@/services/followService'
import { getMyWorkRelationships } from '@/services/workRelationshipService'
import AppIcon from '@/components/tds/AppIcon'

type Scope = 'all' | 'popular' | 'mine' | 'subscribed' | 'worksub'
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
  const isDesktop = useIsDesktop()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [creationOpen, setCreationOpen] = useState(false)   // 서랍: 창작게시판 아코디언
  const [board, setBoard] = useState<Sel>('all')
  // 카테고리 칸은 '전체'에서만 의미가 있다 (게시판을 고르면 전부 같은 카테고리)
  const showCat = board === 'all'
  const listCols = showCat ? '76px 1fr 66px 66px 52px 44px' : '1fr 76px 66px 52px 44px'
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
    // 구독 = 내가 팔로우한 유저의 글만 (커뮤니티 서비스에 필터가 없어 클라이언트에서 걸러낸다)
    if (scope === 'subscribed') {
      if (!user) { setPosts([]); setNotices([]); setLoading(false); setPage(1); return }
      const [all, ntc, followingIds] = await Promise.all([
        getPosts(board, sort, user.id, { search, tagId: tagFilter?.id }),
        getNotices(board),
        getFollowingIds(user.id),
      ])
      const set = new Set(followingIds)
      setPosts(all.filter(p => p.author && set.has(p.author.id)))
      setNotices(ntc); setLoading(false); setPage(1)
      return
    }
    // 작품구독 = 내가 최애·관심으로 저장한 작품이 태그된, 남이 올린 글
    if (scope === 'worksub') {
      if (!user) { setPosts([]); setNotices([]); setLoading(false); setPage(1); return }
      const [all, ntc, rels] = await Promise.all([
        getPosts(board, sort, user.id, { search, tagId: tagFilter?.id }),
        getNotices(board),
        getMyWorkRelationships(user.id),
      ])
      const myWorkIds = new Set(rels.filter(r => r.affinity).map(r => r.work.id))
      // 구독(최애·관심)한 작품이 태그된 글. tag_ids뿐 아니라 대표 태그(tag_id)·작품(work)도 함께 매칭
      setPosts(all.filter(p => {
        const ids = [...(p.tagIds ?? []), p.tagId, p.work?.id].filter(Boolean) as string[]
        return ids.some(id => myWorkIds.has(id))
      }))
      setNotices(ntc); setLoading(false); setPage(1)
      return
    }
    // 인기글 = 종합 점수(좋아요·3 + 댓글·2 + 조회·0.1) 상위. 참여 있는 글만(점수 0 초과)
    if (scope === 'popular') {
      const [all, ntc] = await Promise.all([
        getPosts(board, 'latest', user?.id, { search, tagId: tagFilter?.id }),
        getNotices(board),
      ])
      const popScore = (p: CommunityPost) => p.likeCount * 3 + p.commentCount * 2 + p.viewCount * 0.1
      const ranked = all.filter(p => popScore(p) > 0).sort((a, b) => popScore(b) - popScore(a))
      setPosts(ranked); setNotices(ntc); setLoading(false); setPage(1)
      return
    }
    // 📱 모바일: 팬창작물(부모)을 보면 팬아트(세부) 글도 함께 — 창작게시판 전체. 팬아트 선택 시엔 팬아트만.
    if (!isDesktop && board === 'fancraft') {
      const [all, ntc] = await Promise.all([
        getPosts('all', sort, user?.id, { mineOnly: scope === 'mine', search, tagId: tagFilter?.id }),
        getNotices(board),
      ])
      setPosts(all.filter(p => p.board === 'fancraft' || p.board === 'fanart'))
      setNotices(ntc); setLoading(false); setPage(1)
      return
    }
    const [list, ntc] = await Promise.all([
      getPosts(board, sort, user?.id, {
        mineOnly: scope === 'mine', search, tagId: tagFilter?.id,
      }),
      getNotices(board),
    ])
    setPosts(list); setNotices(ntc); setLoading(false); setPage(1)
  }, [board, sort, scope, search, tagFilter?.id, user?.id, isDesktop])

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

  // 📱 모바일: 팬톡(네이트 판) 스타일 — 카테고리 탭 + 썸네일 리스트 + 서랍. PC는 아래 기존 화면 그대로.
  if (!isDesktop) {
    const boardLabel = board === 'all' ? '커뮤니티' : (BOARD_LABEL[board] ?? '커뮤니티')
    const tagNameById = new Map(allTags.map(t => [t.id, t.name]))
    const namesOf = (p: CommunityPost) => (p.tagIds ?? []).map(id => tagNameById.get(id)).filter((n): n is string => !!n)
    const rows = paged.map(p => <PannRow key={p.id} p={p} showBoard={board === 'all' || board === 'fancraft'} onOpen={openPost} tagNames={namesOf(p)} />)
    const mainBoards = BOARDS.filter(b => !CREATION_BOARDS.includes(b.value))   // 창작게시판(팬아트·팬창작물) 제외한 일반 게시판
    const mobTabs: { label: string; active: boolean; on: () => void }[] = [
      { label: '전체',    active: board === 'all' && scope === 'all',        on: () => { setBoard('all'); setScope('all') } },
      { label: '인기글',  active: scope === 'popular',                        on: () => { setBoard('all'); setScope('popular') } },
      { label: '팬창작물', active: board === 'fancraft' && scope === 'all',   on: () => { setBoard('fancraft'); setScope('all') } },
      { label: '작품구독', active: scope === 'worksub',                        on: () => { setBoard('all'); setScope('worksub') } },
      { label: '팔로잉',   active: scope === 'subscribed',                     on: () => { setBoard('all'); setScope('subscribed') } },
    ]

    return (
      <div style={{ background: 'var(--bg)', minHeight: '100%', paddingBottom: 24 }}>
        <style>{`.taku-noscroll::-webkit-scrollbar{display:none}.taku-noscroll{scrollbar-width:none}`}</style>

        {/* 헤더 — 햄버거 · 제목 · 글쓰기 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 20 }}>
          <button onClick={() => setDrawerOpen(true)} aria-label="카테고리" style={iconBtn}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 900 }}>{boardLabel}</div>
          <button onClick={() => setTagOpen(o => !o)} aria-label="작품 필터" style={{ ...iconBtn, ...(tagFilter || tagOpen ? { background: 'var(--accent)', color: '#fff' } : {}) }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18l-7 8v6l-4-2v-4z" /></svg>
          </button>
          <button onClick={openWrite} aria-label="글쓰기" style={{ ...iconBtn, background: 'var(--accent)', color: '#fff' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>

        {/* 카테고리 탭 — 전체 · 인기글 · 팬창작물 · 구독 (나머지 게시판은 왼쪽 서랍에) */}
        <div className="taku-noscroll" style={{ display: 'flex', overflowX: 'auto', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          {mobTabs.map(t => <MobTab key={t.label} label={t.label} active={t.active} onClick={t.on} />)}
        </div>

        {/* 작품 필터 — 필터 버튼 누르면 검색창만 뜨고, 입력하면 아래에 작품 목록 */}
        {tagOpen && (
          <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input autoFocus value={tagQuery} onChange={e => setTagQuery(e.target.value)} placeholder="작품 검색" style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit' }} />
              <button onClick={() => { setTagOpen(false); setTagQuery('') }} aria-label="닫기" style={{ border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}><AppIcon name="close" size={13} /></button>
            </div>
            {tagQuery.trim() && (
              <div className="taku-noscroll" style={{ marginTop: 8, maxHeight: 280, overflowY: 'auto' }}>
                {filteredTags.map(t => (
                  <button key={t.id} onClick={() => { setTagFilter(t); setTagOpen(false); setTagQuery('') }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: tagFilter?.id === t.id ? 'var(--accent-l, rgba(232,0,111,.08))' : 'none', color: tagFilter?.id === t.id ? 'var(--accent)' : 'var(--text)', padding: '11px 10px', borderRadius: 8, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{t.name}</button>
                ))}
                {filteredTags.length === 0 && <div style={{ padding: '14px 10px', fontSize: 13.5, color: 'var(--muted)' }}>결과 없음</div>}
              </div>
            )}
          </div>
        )}

        {/* 작품 필터 활성 칩 */}
        {tagFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}># {tagFilter.name}</span>
            <button onClick={() => setTagFilter(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'var(--surface2)', color: 'var(--muted)', borderRadius: 9999, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>필터 해제 <AppIcon name="close" size={11} /></button>
          </div>
        )}

        {/* 공지 */}
        {notices.length > 0 && (
          <div style={{ background: 'var(--surface)' }}>
            {notices.map(n => (
              <div key={n.id} onClick={() => openPost(n)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 9999, padding: '2px 8px', flexShrink: 0 }}>공지</span>
                <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || '(제목 없음)'}</span>
              </div>
            ))}
          </div>
        )}

        {/* 리스트 */}
        <div style={{ background: 'var(--surface)' }}>
          {loading ? (
            <p style={{ color: 'var(--muted)', padding: '32px 16px', textAlign: 'center' }}>불러오는 중…</p>
          ) : posts.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--muted)' }}>
              <p style={{ margin: '0 0 16px', fontSize: 14 }}>{
                scope === 'subscribed'
                  ? (user ? '팔로우한 유저의 글이 아직 없어요.' : '로그인하고 유저를 팔로우하면 여기에 모여요.')
                  : scope === 'worksub'
                    ? (user ? '최애·관심 작품이 태그된 글이 아직 없어요.' : '로그인하고 최애·관심 작품을 등록하면 여기에 모여요.')
                    : scope === 'popular'
                      ? '아직 인기글이 없어요. 추천·댓글·조회가 쌓이면 올라와요.'
                      : (search || tagFilter ? '조건에 맞는 글이 없어요.' : '아직 글이 없어요. 첫 글을 남겨보세요!')
              }</p>
              {scope !== 'subscribed' && scope !== 'popular' && scope !== 'worksub' && <button onClick={openWrite} style={{ padding: '11px 18px', borderRadius: 11, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>게시글 작성</button>}
            </div>
          ) : rows}
        </div>

        {/* 페이지 */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, margin: '20px 0' }}>
            <PageBtn disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</PageBtn>
            {pageNumbers(page, totalPages).map((n, i) => n === '…'
              ? <span key={i} style={{ color: 'var(--muted)', padding: '0 4px' }}>…</span>
              : <PageBtn key={i} active={n === page} onClick={() => setPage(n as number)}>{n}</PageBtn>)}
            <PageBtn disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</PageBtn>
          </div>
        )}

        {/* 왼쪽 서랍 — 카테고리 */}
        {drawerOpen && typeof document !== 'undefined' && createPortal(
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)' }}>
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '80%', maxWidth: 320, background: 'var(--surface)', boxShadow: '2px 0 24px rgba(0,0,0,.2)', overflowY: 'auto' }}>
              <div style={{ padding: '18px 18px 12px', fontSize: 18, fontWeight: 900 }}>커뮤니티</div>
              <DrawerGroup label="게시판">
                <DrawerItem label="전체" active={board === 'all'} onClick={() => { setBoard('all'); setScope('all'); setDrawerOpen(false) }} />
                {mainBoards.map(b => <DrawerItem key={b.value} label={b.label} active={board === b.value} onClick={() => { setBoard(b.value); setScope('all'); setDrawerOpen(false) }} />)}
                {/* 창작게시판 — 누르면 세부(팬아트·팬창작물) 펼침 */}
                <button onClick={() => setCreationOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', border: 'none', background: 'none', color: (board === 'fanart' || board === 'fancraft') ? 'var(--accent)' : 'var(--text)', padding: '12px 18px', fontSize: 15, fontWeight: (board === 'fanart' || board === 'fancraft') ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  창작게시판
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: creationOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {creationOpen && (
                  <>
                    <DrawerItem sub label="팬아트" active={board === 'fanart'} onClick={() => { setBoard('fanart'); setScope('all'); setDrawerOpen(false) }} />
                    <DrawerItem sub label="팬창작물" active={board === 'fancraft'} onClick={() => { setBoard('fancraft'); setScope('all'); setDrawerOpen(false) }} />
                  </>
                )}
              </DrawerGroup>
              <DrawerGroup label="보기">
                <DrawerItem label="인기글" active={scope === 'popular'} onClick={() => { setBoard('all'); setScope('popular'); setDrawerOpen(false) }} />
                <DrawerItem label="작품구독" active={scope === 'worksub'} onClick={() => { setBoard('all'); setScope('worksub'); setDrawerOpen(false) }} />
                <DrawerItem label="팔로잉" active={scope === 'subscribed'} onClick={() => { setBoard('all'); setScope('subscribed'); setDrawerOpen(false) }} />
                <DrawerItem label="내 게시글" active={scope === 'mine'} onClick={() => { setBoard('all'); setScope('mine'); setDrawerOpen(false) }} />
              </DrawerGroup>
            </div>
          </div>,
          document.body,
        )}
      </div>
    )
  }

  return (
    <div className="taku-comm-min" style={{ padding: '24px 32px 72px' }}>
      <style>{`
        .taku-comm{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;align-items:start}
        @media (hover:none) and (pointer:coarse) and (max-width:1024px){.taku-comm{grid-template-columns:1fr}.taku-comm-side{display:none}}
        .taku-noscroll::-webkit-scrollbar{display:none}.taku-noscroll{scrollbar-width:none}
                .taku-prow:hover{background:var(--surface2)}
        .taku-comm-min{min-width:1040px}
        @media (hover:none) and (pointer:coarse) and (max-width:1024px){.taku-comm-min{min-width:0}}
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
              {search && <button onClick={() => { setSearchInput(''); setSearch('') }} style={{ border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}><AppIcon name="close" size={13} /></button>}
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
              <div style={{ display: 'grid', gridTemplateColumns: listCols, gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border)', fontSize: 12.5, fontWeight: 800, color: 'var(--muted)', background: 'var(--surface2)' }}>
                {showCat && <span style={{ textAlign: 'center' }}>카테고리</span>}<span style={{ textAlign: 'center' }}>제목</span><span style={{ textAlign: 'center' }}>작성자</span><span style={{ textAlign: 'center' }}>작성일</span><span style={{ textAlign: 'center' }}>조회</span><span style={{ textAlign: 'center' }}>좋아요</span>
              </div>
              {paged.map(p => (
                <div key={p.id} className="taku-prow" onClick={() => openPost(p)} style={{ display: 'grid', gridTemplateColumns: listCols, gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer', fontSize: 13.5 }}>
                  {showCat && <span style={{ color: 'var(--muted)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{BOARD_LABEL[p.board]}</span>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{p.flair && <span style={flairBadge}>{p.flair}</span>}{p.isSpoiler && <span style={spoilerBadge}>스포주의</span>}{p.title || '(제목 없음)'}{p.commentCount > 0 && <span style={{ color: 'var(--accent)', fontWeight: 800, marginLeft: 6, fontSize: 12.5 }}>[{p.commentCount}]</span>}</span>
                    {p.images.length > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 4.5-4.5 3 3L16 11l4 4.5" /></svg>{p.images.length}
                      </span>
                    )}
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.author?.nickname ?? '익명'}</span>
                  <span style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{timeAgo(p.createdAt)}</span>
                  <span style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12.5 }}>{p.viewCount}</span>
                  <span style={{ textAlign: 'center', color: '#FF4D6D', fontWeight: 700, fontSize: 12.5 }}>♥ {p.likeCount}</span>
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

/* ── 📱 모바일 팬톡 스타일 전용 ── */
const iconBtn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 10, border: 'none', background: 'var(--surface2)',
  color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
}

function MobTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: active ? 800 : 600, color: active ? 'var(--accent)' : 'var(--muted)', borderBottom: `2.5px solid ${active ? 'var(--accent)' : 'transparent'}`, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</button>
  )
}

function PannRow({ p, showBoard, onOpen, tagNames }: { p: CommunityPost; showBoard: boolean; onOpen: (p: CommunityPost) => void; tagNames?: string[] }) {
  const thumb = p.images?.[0]
  return (
    <div onClick={() => onOpen(p)} style={{ display: 'flex', gap: 12, padding: '13px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.36, color: 'var(--text)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.flair && <span style={flairBadge}>{p.flair}</span>}
          {p.isSpoiler && <span style={spoilerBadge}>스포주의</span>}
          {p.title || '(제목 없음)'}
          {p.commentCount > 0 && <span style={{ color: 'var(--accent)', fontWeight: 800, marginLeft: 5 }}>({p.commentCount})</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
          {showBoard && <><span style={{ color: 'var(--accent)', fontWeight: 700 }}>{BOARD_LABEL[p.board]}</span><span>·</span></>}
          <span>조회 {p.viewCount}</span><span>·</span><span>추천 {p.likeCount}</span>
        </div>
        {tagNames && tagNames.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
            {tagNames.slice(0, 5).map((n, i) => (
              <span key={i} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 9px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</span>
            ))}
          </div>
        )}
      </div>
      {thumb && (
        <div style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
    </div>
  )
}

function DrawerGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
      <div style={{ padding: '10px 18px 4px', fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{label}</div>
      {children}
    </div>
  )
}

function DrawerItem({ label, active, onClick, sub }: { label: string; active: boolean; onClick: () => void; sub?: boolean }) {
  return (
    <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: active ? 'var(--accent-l, rgba(232,0,111,.08))' : 'none', color: active ? 'var(--accent)' : (sub ? 'var(--muted)' : 'var(--text)'), padding: sub ? '3px 18px 10px 34px' : '12px 18px', marginTop: sub ? -8 : undefined, fontSize: sub ? 14 : 15, fontWeight: active ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit' }}>{sub ? `ㄴ ${label}` : label}</button>
  )
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