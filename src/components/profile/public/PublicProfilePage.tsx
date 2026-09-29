'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { UserAvatar } from '@/components/cosmetic/UserFace'
import { follow, unfollow } from '@/services/followService'
import { blockUser } from '@/services/blockService'
import { getExhibits, type ExhibitCard } from '@/services/exhibitService'
import { localDay } from '@/services/storyBuilder'
import { BOARD_LABEL } from '@/types/community-post'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import ExhibitLightbox from '@/components/exhibit/ExhibitLightbox'
import { PhotoViewer } from '@/components/collection/StoryCard'
import s from './PublicProfile.module.css'

/* ============================================================
   공개 프로필 /user/[nickname] — 다른 사람이 보는 내 프로필

   헤더(가로형) : 아바타 · 닉네임 · 소개 · 좋아하는 작품 · 게시글/팔로워/팔로잉 · 팔로우 · 공유 · ⋯
   탭          : 전시관(전시 / 작품별 전시 / 내 굿즈) · 게시글 · 방문 기록

   ⭐ 데이터는 전부 서버가 권한을 거른 뒤 준다 (lib/profile/profileAccess + 각 API)
      - 전시        : /api/exhibit/list  (전시관에 추가한 글 · 원본 글의 공개/삭제를 그대로 따름) — 기본 화면
      - 작품별 전시 : /api/profile/{id}/collections (굿즈 보관함의 작품별 컬렉션, 공개범위 '굿즈'+'컬렉션')
                      → 누르면 그 작품 굿즈만 /api/profile/{id}/goods?work=
      - 내 굿즈     : /api/profile/{id}/goods  (올린 굿즈 전체, 공개범위 '굿즈' + 굿즈별 공개범위)
      - 게시글      : /api/profile/{id}/posts  (활성 · 공개 글)
      - 방문 기록   : /api/profile/{id}/visits (공개범위 '활동 내역' 등 + 원본을 볼 수 있는 것만)
   ⭐ 설명 문구를 지어내지 않는다 — 기록에 있는 장소·지역·작품 이름만 보여준다.
   ============================================================ */

export type ProfileTab = 'exhibit' | 'posts' | 'visits'
type Sub = 'exhibit' | 'works' | 'goods'

export interface PublicProfileData {
  user: { id: string; nickname: string; avatarUrl: string | null; bio: string | null }
  works: { id: string; name: string; slug: string | null }[]
  stats: { posts: number; followers: number; following: number }
  isSelf: boolean
  initialFollowing: boolean
  can: { goods: boolean; collections: boolean; visits: boolean }
}

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const ImgPh = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg>
)

/* 사진 — 원본 파일이 지워졌거나 만료됐으면 빈 칸 대신 자리표시 아이콘 */
function Photo({ src, size = 28 }: { src: string | null; size?: number }) {
  const [bad, setBad] = useState(false)
  if (!src || bad) return <span className={s.ph}><ImgPh size={size} /></span>
  return <img src={src} alt="" loading="lazy" onError={() => setBad(true)} />
}

type Load<T> = { state: 'loading' } | { state: 'error' } | { state: 'ok'; items: T[]; next: string | null; hidden?: boolean; more?: boolean }

async function getJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

/* 목록 하나를 불러오고 "더 보기"까지 — 탭을 처음 열 때만 부른다 */
function usePaged<T>(url: string, enabled: boolean) {
  const [data, setData] = useState<Load<T>>({ state: 'loading' })
  const started = useRef(false)
  const load = useCallback(async (before?: string | null) => {
    if (!before) setData({ state: 'loading' })
    else setData(d => d.state === 'ok' ? { ...d, more: true } : d)
    try {
      const j = await getJson(before ? `${url}${url.includes('?') ? '&' : '?'}before=${encodeURIComponent(before)}` : url)
      setData(d => ({
        state: 'ok',
        items: [...(before && d.state === 'ok' ? d.items : []), ...(j.items ?? [])],
        next: j.nextBefore ?? null,
        hidden: !!j.hidden,
      }))
    } catch {
      if (!before) setData({ state: 'error' })
      else setData(d => d.state === 'ok' ? { ...d, more: false } : d)
    }
  }, [url])
  useEffect(() => { if (enabled && !started.current) { started.current = true; load() } }, [enabled, load])
  return { data, reload: () => load(), more: (b: string) => load(b) }
}

export default function PublicProfilePage({ data, initialTab, initialSub }: { data: PublicProfileData; initialTab: ProfileTab; initialSub: Sub }) {
  const router = useRouter()
  const { user: me } = useAuth() as any
  const { user, works, isSelf } = data
  const [tab, setTab] = useState<ProfileTab>(initialTab)
  const [sub, setSub] = useState<Sub>(initialSub)
  const [following, setFollowing] = useState(data.initialFollowing)
  const [followers, setFollowers] = useState(data.stats.followers)
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const profileUrl = `/user/${encodeURIComponent(user.nickname)}`

  // 탭은 주소에도 남겨 공유·새로고침해도 그 자리로
  function go(t: ProfileTab, sb: Sub = sub) {
    setTab(t); setSub(sb)
    const q = new URLSearchParams()
    if (t !== 'exhibit') q.set('tab', t)
    if (t === 'exhibit' && sb !== 'exhibit') q.set('sub', sb)
    const qs = q.toString()
    window.history.replaceState(null, '', qs ? `${profileUrl}?${qs}` : profileUrl)
  }

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 1800); return () => clearTimeout(t) }, [toast])

  async function toggleFollow() {
    if (!me) { router.push('/login'); return }
    if (busy) return
    setBusy(true)
    const will = !following
    setFollowing(will); setFollowers(n => Math.max(0, n + (will ? 1 : -1)))
    const ok = will ? await follow(me.id, user.id) : await unfollow(me.id, user.id)
    if (!ok) { setFollowing(!will); setFollowers(n => Math.max(0, n + (will ? -1 : 1))) }
    setBusy(false)
  }

  async function share() {
    const url = window.location.origin + profileUrl
    try {
      const nav = navigator as any
      if (nav.share && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) await nav.share({ title: `${user.nickname}님의 프로필`, url })
      else { await navigator.clipboard.writeText(url); setToast('링크를 복사했어요') }
    } catch { /* 공유 취소 */ }
  }

  async function copyLink() {
    setMenu(false)
    try { await navigator.clipboard.writeText(window.location.origin + profileUrl); setToast('링크를 복사했어요') } catch { /* 무시 */ }
  }

  async function onBlock() {
    setMenu(false)
    if (!window.confirm('이 사용자를 차단할까요?\n서로의 글·댓글·활동이 보이지 않게 되고, 기존 팔로우도 해제돼요.')) return
    const r = await blockUser(user.id)
    if (r.ok) { window.alert('차단했어요. 해제는 설정 > 차단 관리에서 할 수 있어요.'); router.push('/') }
    else window.alert(r.message ?? '차단할 수 없어요.')
  }

  return (
    <div className={s.page}>
      {/* ── 헤더 ── */}
      <header className={s.head}>
        <span className={s.avatar}><UserAvatar userId={user.id} src={user.avatarUrl} name={user.nickname} size={84} /></span>
        <div className={s.info}>
          <div className={s.nameRow}><h1 className={s.name}>{user.nickname}</h1></div>
          {user.bio && <p className={s.bio}>{user.bio}</p>}
          {works.length > 0 && (
            <div className={s.works} aria-label="좋아하는 작품">
              {works.map(w => w.slug
                ? <Link key={w.id} href={`/work/${w.slug}`} className={s.work}>{w.name}</Link>
                : <span key={w.id} className={s.work}>{w.name}</span>)}
            </div>
          )}
          <div className={s.stats}>
            <span><b>{data.stats.posts.toLocaleString('ko-KR')}</b>게시글</span>
            <span><b>{followers.toLocaleString('ko-KR')}</b>팔로워</span>
            <span><b>{data.stats.following.toLocaleString('ko-KR')}</b>팔로잉</span>
          </div>
        </div>
        <div className={s.actions}>
          {!isSelf && (
            <button className={`${s.btn} ${following ? s.grow : s.follow}`} onClick={toggleFollow} disabled={busy}>
              {following ? '팔로잉' : '팔로우'}
            </button>
          )}
          <button className={`${s.btn} ${s.iconBtn}`} onClick={share} aria-label="프로필 공유">
            <svg width="17" height="17" viewBox="0 0 24 24" {...P}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" /></svg>
          </button>
          <div className={s.menuWrap} ref={menuRef}>
            <button className={`${s.btn} ${s.iconBtn}`} onClick={() => setMenu(v => !v)} aria-label="더보기" aria-expanded={menu}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
            </button>
            {menu && (
              <div className={s.menu} role="menu">
                <button role="menuitem" onClick={copyLink}>링크 복사</button>
                {me && !isSelf && <button role="menuitem" className={s.danger} onClick={onBlock}>차단하기</button>}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── 메인 탭 ── */}
      <nav className={s.tabs} role="tablist">
        {([['exhibit', '전시관'], ['posts', '게시글'], ['visits', '방문 기록']] as [ProfileTab, string][]).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={s.tab} onClick={() => go(k)}>{label}</button>
        ))}
      </nav>

      <div className={s.panel}>
        <div hidden={tab !== 'exhibit'}>
            <div className={s.subs} role="tablist">
              <button role="tab" aria-selected={sub === 'exhibit'} className={s.sub} onClick={() => go('exhibit', 'exhibit')}>전시</button>
              <button role="tab" aria-selected={sub === 'works'} className={s.sub} onClick={() => go('exhibit', 'works')}>작품별 전시</button>
              <button role="tab" aria-selected={sub === 'goods'} className={s.sub} onClick={() => go('exhibit', 'goods')}>내 굿즈</button>
            </div>
            <div hidden={sub !== 'exhibit'}><ExhibitGrid userId={user.id} nickname={user.nickname} isSelf={isSelf} active={tab === 'exhibit' && sub === 'exhibit'} /></div>
            <div hidden={sub !== 'works'}><WorkCollections userId={user.id} isSelf={isSelf} active={tab === 'exhibit' && sub === 'works'} allowed={data.can.goods && data.can.collections} /></div>
            <div hidden={sub !== 'goods'}><GoodsGrid userId={user.id} isSelf={isSelf} active={tab === 'exhibit' && sub === 'goods'} allowed={data.can.goods} /></div>
        </div>
        <div hidden={tab !== 'posts'}><PostsList userId={user.id} isSelf={isSelf} active={tab === 'posts'} /></div>
        <div hidden={tab !== 'visits'}><VisitTimeline userId={user.id} isSelf={isSelf} active={tab === 'visits'} allowed={data.can.visits} /></div>
      </div>

      {toast && <div className={s.toast} role="status">{toast}</div>}
    </div>
  )
}

/* ── 공통 상태 ── */
function GridSkeleton({ n = 6 }: { n?: number }) {
  return <div className={s.grid}>{Array.from({ length: n }, (_, i) => <div key={i} className={`${s.cell} ${s.skel}`} style={{ cursor: 'default' }} />)}</div>
}
function ListSkeleton({ n = 4, h = 72 }: { n?: number; h?: number }) {
  return <div>{Array.from({ length: n }, (_, i) => <div key={i} className={s.skel} style={{ height: h, borderRadius: 12, margin: '10px 0' }} />)}</div>
}
function Empty({ children }: { children: React.ReactNode }) { return <div className={s.state}>{children}</div> }
function Failed({ onRetry }: { onRetry: () => void }) {
  return <div className={s.state}>불러오지 못했어요.<br /><button className={s.btn} onClick={onRetry}>다시 시도</button></div>
}
function More({ next, busy, onMore }: { next: string | null; busy?: boolean; onMore: (b: string) => void }) {
  if (!next) return null
  return <div className={s.more}><button className={s.btn} disabled={busy} onClick={() => onMore(next)}>{busy ? '불러오는 중…' : '더 보기'}</button></div>
}

/* ── 전시 — 전시관에 추가한 글(과 예전 전시). 전시관의 메인 화면 ── */
function ExhibitGrid({ userId, nickname, isSelf, active }: { userId: string; nickname: string; isSelf: boolean; active: boolean }) {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const [cards, setCards] = useState<ExhibitCard[] | null | 'error'>(null)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const started = useRef(false)

  const load = useCallback(() => { setCards(null); getExhibits(userId).then(setCards).catch(() => setCards('error')) }, [userId])
  useEffect(() => { if (active && !started.current) { started.current = true; load() } }, [active, load])

  if (cards === null) return <GridSkeleton />
  if (cards === 'error') return <Failed onRetry={load} />
  if (cards.length === 0) return <Empty>{isSelf ? '아직 전시한 굿즈가 없어요.\n굿즈자랑 글의 ⋯ 메뉴에서 전시관에 추가할 수 있어요.' : '아직 공개된 전시가 없어요.'}</Empty>

  return (
    <>
      <div className={s.grid}>
        {cards.map((c, i) => (
          <button key={c.id} className={s.cell} aria-label={c.caption || c.workName || '전시'}
            onClick={() => isDesktop ? setLightbox(i) : router.push(`/exhibit/${encodeURIComponent(nickname)}/${c.id}`)}>
            <Photo src={c.coverUrl} />
            {c.imageCount > 1 && (
              <span className={s.multi}><svg width="13" height="13" viewBox="0 0 24 24" {...P}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" /></svg></span>
            )}
          </button>
        ))}
      </div>

      {isDesktop && lightbox !== null && cards.length > 0 && (
        <ExhibitLightbox cards={cards} index={lightbox} ownerName={nickname}
          onIndex={setLightbox} onClose={() => setLightbox(null)}
          isOwner={isSelf}
          shareUrl={c => `/exhibit/${encodeURIComponent(nickname)}/${c.id}`}
          onRemoved={id => {
            const next = cards.filter(c => c.id !== id)
            setCards(next)
            if (next.length === 0) setLightbox(null)
            else setLightbox(i => (i === null ? null : Math.min(i, next.length - 1)))
          }} />
      )}
    </>
  )
}

/* ── 작품별 전시 — 굿즈 보관함의 작품별 컬렉션. 누르면 그 작품 굿즈만 ── */
interface Collection { workId: string | null; workName: string | null; workSlug: string | null; count: number; coverUrl: string | null }
function WorkCollections({ userId, isSelf, active, allowed }: { userId: string; isSelf: boolean; active: boolean; allowed: boolean }) {
  const [data, setData] = useState<{ state: 'loading' } | { state: 'error' } | { state: 'ok'; items: Collection[]; hidden: boolean }>({ state: 'loading' })
  const [open, setOpen] = useState<Collection | null>(null)
  const started = useRef(false)
  const load = useCallback(() => {
    setData({ state: 'loading' })
    getJson(`/api/profile/${userId}/collections`)
      .then(j => setData({ state: 'ok', items: j.items ?? [], hidden: !!j.hidden }))
      .catch(() => setData({ state: 'error' }))
  }, [userId])
  useEffect(() => { if (active && allowed && !started.current) { started.current = true; load() } }, [active, allowed, load])

  if (!allowed) return <Empty>컬렉션을 공개하지 않은 사용자예요.</Empty>
  if (data.state === 'loading') return <GridSkeleton />
  if (data.state === 'error') return <Failed onRetry={load} />
  if (data.hidden) return <Empty>컬렉션을 공개하지 않은 사용자예요.</Empty>
  if (data.items.length === 0) return <Empty>{isSelf ? '아직 컬렉션이 없어요.\n굿즈를 올리고 작품을 연결하면 작품별로 모여요.' : '공개된 컬렉션이 없어요.'}</Empty>

  if (open) {
    return (
      <>
        <div className={s.groupHead}>
          <button className={s.back} onClick={() => setOpen(null)} aria-label="작품별 전시로 돌아가기">
            <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <h3 className={s.groupName}>{open.workName || '작품 미지정'}</h3>
          <span className={s.groupCount}>{open.count}</span>
        </div>
        <GoodsGrid key={open.workId ?? 'none'} userId={userId} isSelf={isSelf} active allowed work={open.workId ?? 'none'} />
      </>
    )
  }

  return (
    <div className={`${s.grid} ${s.gridGoods}`}>
      {data.items.map(c => (
        <button key={c.workId ?? 'none'} className={s.gCard} onClick={() => setOpen(c)} aria-label={`${c.workName || '작품 미지정'} 컬렉션`}>
          <span className={s.cell} style={{ display: 'block' }}><Photo src={c.coverUrl} /></span>
          <p className={s.gName}>{c.workName || '작품 미지정'}</p>
          <p className={s.gWork}>굿즈 {c.count}개</p>
        </button>
      ))}
    </div>
  )
}

/* ── 내 굿즈 — 올린 굿즈 중 보는 사람에게 공개된 것 (work 를 주면 그 작품만) ── */
interface GoodsItem { id: string; name: string | null; goodsTypeName: string | null; workName: string | null; coverUrl: string | null; postId: string | null }
function GoodsGrid({ userId, isSelf, active, allowed, work }: { userId: string; isSelf: boolean; active: boolean; allowed: boolean; work?: string }) {
  const router = useRouter()
  const { data, reload, more } = usePaged<GoodsItem>(`/api/profile/${userId}/goods${work ? `?work=${encodeURIComponent(work)}` : ''}`, active && allowed)
  if (!allowed) return <Empty>굿즈를 공개하지 않은 사용자예요.</Empty>
  if (data.state === 'loading') return <GridSkeleton />
  if (data.state === 'error') return <Failed onRetry={reload} />
  if (data.hidden) return <Empty>굿즈를 공개하지 않은 사용자예요.</Empty>
  if (data.items.length === 0) return <Empty>{isSelf ? '아직 등록한 굿즈가 없어요.' : '공개된 굿즈가 없어요.'}</Empty>
  return (
    <>
      <div className={`${s.grid} ${s.gridGoods}`}>
        {data.items.map(g => {
          const title = g.name || g.goodsTypeName || '이름 없는 굿즈'
          return (
            <button key={g.id} className={s.gCard} onClick={() => router.push(g.postId ? `/community/${g.postId}` : `/profile/goods/${g.id}`)} aria-label={title}>
              <span className={s.cell} style={{ display: 'block' }}>
                <Photo src={g.coverUrl} />
              </span>
              <p className={s.gName}>{title}</p>
              {g.workName && <p className={s.gWork}>{g.workName}</p>}
            </button>
          )
        })}
      </div>
      <More next={data.next} busy={data.more} onMore={more} />
    </>
  )
}

/* ── 게시글 ── */
interface PostItem { id: string; board: string; title: string | null; excerpt: string | null; thumb: string | null; workName: string | null; isPrivate: boolean; likeCount: number; commentCount: number; createdAt: string }
const ymd = (iso: string) => { const d = localDay(iso); return d ? d.replace(/-/g, '.') : '' }
function PostsList({ userId, isSelf, active }: { userId: string; isSelf: boolean; active: boolean }) {
  const { data, reload, more } = usePaged<PostItem>(`/api/profile/${userId}/posts`, active)
  if (data.state === 'loading') return <ListSkeleton />
  if (data.state === 'error') return <Failed onRetry={reload} />
  if (data.items.length === 0) return <Empty>{isSelf ? '아직 작성한 글이 없어요.' : '공개된 글이 없어요.'}</Empty>
  return (
    <>
      <ul className={s.postList}>
        {data.items.map(p => (
          <li key={p.id} className={s.post}>
            <Link href={`/community/${p.id}`} className={s.postLink}>
              <div className={s.postBody}>
                <div className={s.postMeta}>
                  <span>{BOARD_LABEL[p.board] ?? '게시글'}</span>
                  {p.workName && <><span>·</span><span>{p.workName}</span></>}
                  {p.isPrivate && <span className={s.pill}>나만 보기</span>}
                </div>
                <p className={s.postTitle}>{p.title || p.excerpt || '(제목 없음)'}</p>
                {p.title && p.excerpt && <p className={s.postEx}>{p.excerpt}</p>}
                <div className={s.postMeta} style={{ marginTop: 6 }}>
                  <span>{ymd(p.createdAt)}</span>
                  {p.likeCount > 0 && <span>· 좋아요 {p.likeCount}</span>}
                  {p.commentCount > 0 && <span>· 댓글 {p.commentCount}</span>}
                </div>
              </div>
              {p.thumb && <span className={s.postThumb}><Photo src={p.thumb} size={20} /></span>}
            </Link>
          </li>
        ))}
      </ul>
      <More next={data.next} busy={data.more} onMore={more} />
    </>
  )
}

/* ── 방문 기록 — 연대기와 같은 날짜 규칙(localDay)으로 월별 묶음 ── */
interface VisitItem { id: string; type: string; at: string; name: string | null; eventType: string | null; placeName: string | null; region: string | null; workName: string | null; gps: boolean; href: string | null; thumb: string | null; photos?: { url: string; private: boolean }[] }
const EVENT_LABEL: Record<string, string> = { popup: '팝업 참여', collab_cafe: '콜라보 카페 방문', exhibition: '전시 관람', official_event: '행사 참가' }
function typeLabel(v: VisitItem): string {
  if (v.type === 'shop_visit') return '샵 방문'
  if (v.type === 'route_completed') return '루트 완주'
  return EVENT_LABEL[v.eventType ?? ''] ?? '이벤트 참여'
}
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
function VisitTimeline({ userId, isSelf, active, allowed }: { userId: string; isSelf: boolean; active: boolean; allowed: boolean }) {
  const { data, reload, more } = usePaged<VisitItem>(`/api/profile/${userId}/visits`, active && allowed)
  const [viewer, setViewer] = useState<{ title: string; photos: string[]; index: number } | null>(null)
  const months = useMemo(() => {
    if (data.state !== 'ok') return []
    const m = new Map<string, { day: string; v: VisitItem }[]>()
    for (const v of data.items) {
      const day = localDay(v.at)
      if (!day) continue
      const k = day.slice(0, 7)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push({ day, v })
    }
    return [...m.entries()]
  }, [data])

  if (!allowed) return <Empty>방문 기록을 공개하지 않은 사용자예요.</Empty>
  if (data.state === 'loading') return <ListSkeleton n={5} h={60} />
  if (data.state === 'error') return <Failed onRetry={reload} />
  if (data.hidden) return <Empty>방문 기록을 공개하지 않은 사용자예요.</Empty>
  if (months.length === 0) return <Empty>{isSelf ? '아직 방문 기록이 없어요.' : '공개된 방문 기록이 없어요.'}</Empty>

  return (
    <>
      {months.map(([ym, list]) => {
        const [y, mo] = ym.split('-')
        return (
          <section key={ym} className={s.month}>
            <h3 className={s.monthHead}>{y}년 {Number(mo)}월</h3>
            <ol className={s.tl}>
              {list.map(({ day, v }) => {
                const [yy, mm, dd] = day.split('-').map(Number)
                const wd = WEEK[new Date(yy, mm - 1, dd).getDay()]
                const desc = [v.placeName && v.placeName !== v.name ? v.placeName : null, v.region, v.workName].filter(Boolean).join(' · ')
                const inner = (
                  <>
                    <span className={s.tlDate}>{mm}.{dd} ({wd})</span>
                    <span className={s.tlBody}>
                      <span className={s.tlTop}>
                        <span className={s.tlType}>{typeLabel(v)}</span>
                        {v.gps && <span className={s.tlGps}>GPS 인증</span>}
                      </span>
                      <p className={s.tlName}>{v.name || typeLabel(v)}</p>
                      {desc && <p className={s.tlDesc}>{desc}</p>}
                    </span>
                    <span className={s.tlThumb}><Photo src={v.thumb} size={20} /></span>
                  </>
                )
                const photos = v.photos ?? []
                return (
                  <li key={v.id} className={s.tlItem}>
                    {v.href ? <Link href={v.href} className={s.tlRow}>{inner}</Link> : <div className={s.tlRow}>{inner}</div>}
                    {/* 그 이벤트에서 남긴 사진 — 남에게는 '공개'로 고른 사진만 온다 */}
                    {photos.length > 0 && (
                      <div className={s.tlPhotos}>
                        {photos.map((ph, pi) => (
                          <button key={pi} type="button" className={s.tlPhoto}
                            aria-label={`${v.name ?? '방문'} 사진 ${pi + 1} 크게 보기`}
                            onClick={() => setViewer({ title: v.name ?? typeLabel(v), photos: photos.map(x => x.url), index: pi })}>
                            <Photo src={ph.url} size={18} />
                            {ph.private && <span className={s.tlLock} title="나만 보기 — 다른 사람에게는 안 보여요">나만</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}
      <More next={data.next} busy={data.more} onMore={more} />
      {viewer && <PhotoViewer title={viewer.title} photos={viewer.photos} start={viewer.index} onClose={() => setViewer(null)} />}
    </>
  )
}
