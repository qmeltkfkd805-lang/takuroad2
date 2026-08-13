'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { useWorn } from '@/components/cosmetic/CosmeticProvider'
import { UserAvatar } from '@/components/cosmetic/UserFace'
import { Icon } from '@/components/tds'
import AppIcon from '@/components/tds/AppIcon'
import { OtakuPassport } from '@/services/passportService'
import { getMyLevelInfo, LevelInfo } from '@/services/expService'
import { getFollowCounts, getFollowers, getFollowing, getFollowFeed, FollowUser, FollowFeedItem } from '@/services/followService'
import { getMyRecentActivities, RecentActivity } from '@/services/activityService'
import { getQuickMenu, setQuickMenu } from '@/services/quickMenuService'
import GrowthPage from '@/components/growth/GrowthPage'
import ChroniclePage from '@/components/collection/ChroniclePage'
import BadgesTab from './BadgesTab'
import CollectionTab from './CollectionTab'
import SavedShopsTab from './SavedShopsTab'
import VisitedShopsTab from './VisitedShopsTab'
import MyRoutesTab from './MyRoutesTab'
import SavedRoutesTab from './SavedRoutesTab'
import CompletedRoutesTab from './CompletedRoutesTab'
import MyReviewsTab from './MyReviewsTab'
import MyCommentsTab from './MyCommentsTab'
import MyPostsTab from './MyPostsTab'
import MyShopsTab from './MyShopsTab'
import VerifyStatusTab from './VerifyStatusTab'
import styles from './ProfileDesktop.module.css'

type Sub =
  | 'saved' | 'savedroutes' | 'routes' | 'completed' | 'visited'
  | 'posts' | 'comments' | 'reviews' | 'shops' | 'verify'
  | 'badges' | 'growth' | 'chronicle' | 'collection'

const SUB_SET = new Set<Sub>([
  'saved', 'savedroutes', 'routes', 'completed', 'visited',
  'posts', 'comments', 'reviews', 'shops', 'verify',
  'badges', 'growth', 'chronicle', 'collection',
])

const SUB_TITLE: Record<Sub, string> = {
  saved: '저장한 샵', savedroutes: '저장한 루트', routes: '내 루트', completed: '완주한 루트', visited: '방문 기록',
  posts: '작성한 글', comments: '내 댓글', reviews: '내 후기', shops: '등록한 샵', verify: '인증 현황',
  badges: '배지', growth: '성장센터', chronicle: '연대기', collection: '컬렉션',
}

const STAT_TINT = ['rgba(255,86,146,.12)', 'rgba(247,169,40,.16)', 'rgba(34,197,94,.14)', 'rgba(59,155,232,.14)']
const ACT_ICON: Record<string, string> = { checkin: 'pushpin', event: 'event', route: 'route', star: 'medal', shop: 'shop', work: 'sparkle' }
// 활동 종류별 아이콘 색 (시안: 방문=파랑, 루트=핑크, 리뷰=노랑, 이벤트=민트, 작품=보라)
const ACT_COLOR: Record<string, string> = { checkin: '#3B9BE8', shop: '#3B9BE8', route: '#FF5692', star: '#F7A928', event: '#14B8A0', work: '#8B5CF6' }

// 빠른 메뉴에 넣을 수 있는 전체 항목 카탈로그. view = 마이페이지 하위 화면, href = 외부 페이지.
type QuickItem = { key: string; label: string; icon: string; view?: Sub; href?: string }
const QUICK_CATALOG: QuickItem[] = [
  { key: 'comments', label: '내 댓글', icon: 'commentbox', view: 'comments' },
  { key: 'saved', label: '저장한 샵', icon: 'shop', view: 'saved' },
  { key: 'savedroutes', label: '저장한 루트', icon: 'route', view: 'savedroutes' },
  { key: 'likedworks', label: '좋아요 작품', icon: 'heart', href: '/my-works' },
  { key: 'posts', label: '작성한 글', icon: 'pencil', view: 'posts' },
  { key: 'visited', label: '방문 기록', icon: 'pushpin', view: 'visited' },
  { key: 'reviews', label: '내 후기', icon: 'star', view: 'reviews' },
  { key: 'completed', label: '완주한 루트', icon: 'route', view: 'completed' },
  { key: 'routes', label: '내 루트', icon: 'map', view: 'routes' },
  { key: 'shops', label: '등록한 샵', icon: 'shop', view: 'shops' },
  { key: 'verify', label: '인증 현황', icon: 'check', view: 'verify' },
  { key: 'badges', label: '배지', icon: 'medal', view: 'badges' },
  { key: 'growth', label: '성장센터', icon: 'sparkle', view: 'growth' },
  { key: 'chronicle', label: '연대기', icon: 'calendar', view: 'chronicle' },
  { key: 'collection', label: '컬렉션', icon: 'collection', view: 'collection' },
]
const QUICK_BY_KEY = new Map<string, QuickItem>(QUICK_CATALOG.map(i => [i.key, i]))
const DEFAULT_QUICK = ['comments', 'saved', 'savedroutes', 'likedworks', 'posts', 'visited']
const MAX_QUICK = 6   // 빠른 메뉴는 최대 6개까지

const fmtDate = (s: string | null | undefined) => {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  passport: OtakuPassport | null
  userId: string
}

export default function ProfileDesktop({ passport, userId }: Props) {
  const router = useRouter()
  const { profile, isAdmin, signOut } = useAuth()
  const worn = useWorn(userId)
  const urlTab = useSearchParams().get('tab')

  const initialView: 'dashboard' | Sub = urlTab && SUB_SET.has(urlTab as Sub) ? (urlTab as Sub) : 'dashboard'
  const [view, setView] = useState<'dashboard' | Sub>(initialView)

  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null)
  const [follow, setFollow] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 })
  const [activities, setActivities] = useState<RecentActivity[]>([])
  const [feed, setFeed] = useState<FollowFeedItem[]>([])
  const [actTab, setActTab] = useState<'mine' | 'follow'>('mine')
  const [modal, setModal] = useState<null | { type: 'followers' | 'following'; list: FollowUser[] | null }>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  const [quickKeys, setQuickKeys] = useState<string[]>(DEFAULT_QUICK)
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const [savingMenu, setSavingMenu] = useState(false)

  useEffect(() => {
    if (!userId) return
    getMyLevelInfo(userId).then(setLevelInfo).catch(() => {})
    getFollowCounts(userId).then(setFollow).catch(() => {})
    getMyRecentActivities(userId, 8).then(setActivities).catch(() => {})
    getFollowFeed(userId, 12).then(setFeed).catch(() => {})
    getQuickMenu(userId).then(keys => {
      const valid = (keys ?? []).filter(k => QUICK_BY_KEY.has(k)).slice(0, MAX_QUICK)
      if (valid.length) setQuickKeys(valid)
    }).catch(() => {})
  }, [userId])

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(max-width: 640px)')
    const on = () => setIsMobile(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])

  function runQuick(item: QuickItem) {
    if (item.view) setView(item.view)
    else if (item.href) router.push(item.href)
  }
  function openMenuEditor() { setDraft([...quickKeys]); setEditOpen(true) }
  function removeDraft(key: string) { setDraft(prev => (prev.length <= 1 ? prev : prev.filter(k => k !== key))) }

  // ── 꾹 눌러서 드래그로 순서 바꾸기 (루트 등록과 동일한 포인터 방식, 카드 격자용) ──
  const cardRefs = useRef<(HTMLElement | null)[]>([])
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overIdx, setOverIdx] = useState<number>(-1)

  function startCardDrag(e: React.PointerEvent, key: string) {
    const downX = e.clientX, downY = e.clientY
    if (pressTimer.current) clearTimeout(pressTimer.current)
    const preMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - downX) > 12 || Math.abs(ev.clientY - downY) > 12) cancel()
    }
    const cancel = () => {
      if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
      window.removeEventListener('pointermove', preMove)
      window.removeEventListener('pointerup', cancel)
      window.removeEventListener('pointercancel', cancel)
    }
    window.addEventListener('pointermove', preMove)
    window.addEventListener('pointerup', cancel)
    window.addEventListener('pointercancel', cancel)
    pressTimer.current = setTimeout(() => {
      window.removeEventListener('pointermove', preMove)
      setDragKey(key)
      try { (navigator as any).vibrate?.(12) } catch { /* noop */ }
    }, 160)
  }

  useEffect(() => {
    if (!dragKey) return
    // 드래그 중엔 순서를 바꾸지 않고, 포인터에 가장 가까운 카드만 "놓을 자리"로 표시한다.
    const nearest = (x: number, y: number) => {
      let best = -1, bestD = Infinity
      for (let i = 0; i < draft.length; i++) {
        const el = cardRefs.current[i]
        if (!el) continue
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2
        const d = (x - cx) * (x - cx) + (y - cy) * (y - cy)
        if (d < bestD) { bestD = d; best = i }
      }
      return best
    }
    const onMove = (e: PointerEvent) => {
      e.preventDefault()
      setOverIdx(nearest(e.clientX, e.clientY))
    }
    // 놓는 순간, 드래그한 카드와 놓은 자리 카드의 위치만 맞바꾼다(스왑).
    const onUp = (e: PointerEvent) => {
      const target = nearest(e.clientX, e.clientY)
      setDraft(prev => {
        const from = prev.indexOf(dragKey)
        if (from === -1 || target < 0 || target === from) return prev
        const c = [...prev]
        ;[c[from], c[target]] = [c[target], c[from]]
        return c
      })
      setDragKey(null)
      setOverIdx(-1)
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragKey, draft.length])
  function addDraft(key: string) { setDraft(prev => (prev.includes(key) || prev.length >= MAX_QUICK ? prev : [...prev, key])) }
  async function saveMenu() {
    setSavingMenu(true)
    const res = await setQuickMenu(userId, draft)
    setSavingMenu(false)
    if (res.ok) { setQuickKeys(draft); setEditOpen(false) }
    else alert('저장에 실패했어요. 잠시 후 다시 시도해주세요.')
  }

  async function openFollowModal(type: 'followers' | 'following') {
    setModal({ type, list: null })
    const list = type === 'followers' ? await getFollowers(userId) : await getFollowing(userId)
    setModal({ type, list })
  }

  async function handleLogout() {
    setLoggingOut(true)
    await signOut()
    router.push('/')
  }

  const nickname = passport?.nickname ?? profile?.nickname ?? '사용자'
  const avatarUrl = passport?.avatarUrl ?? profile?.avatar_url ?? null
  const tagline = passport?.tagline ?? ''
  const level = levelInfo?.level ?? 1
  const titleName = worn.title?.name ?? null

  // EXP — 현재 레벨 구간 안에서의 진행
  const expCur = levelInfo ? Math.max(0, levelInfo.totalExp - levelInfo.currentLevelExp) : 0
  const expSpan = levelInfo?.nextLevelThreshold != null ? Math.max(1, levelInfo.nextLevelThreshold - levelInfo.currentLevelExp) : null
  const expPct = expSpan ? Math.min(100, Math.round((expCur / expSpan) * 100)) : 100
  const expLabel = expSpan ? `EXP ${expCur} / ${expSpan}` : `EXP ${levelInfo?.totalExp ?? 0}`

  const stats = [
    { icon: 'shop', label: '방문한 샵', value: passport?.visitedShopCount ?? 0, go: () => setView('visited') },
    { icon: 'pencil', label: '작성 리뷰', value: passport?.reviewCount ?? 0, go: () => setView('reviews') },
    { icon: 'medal', label: '획득 배지', value: passport?.totalBadgeCount ?? 0, go: () => setView('badges') },
    { icon: 'flag', label: '완주 루트', value: passport?.pilgrimageCount ?? 0, go: () => setView('completed') },
  ]

  const quickItems = quickKeys.map(k => QUICK_BY_KEY.get(k)).filter(Boolean) as QuickItem[]
  const addable = QUICK_CATALOG.filter(i => !draft.includes(i.key))

  const collection = passport?.topVisitedSeries?.[0] ?? null
  const featuredBadges = (passport?.featuredBadges ?? []).slice(0, 3)

  // ───────── 하위 화면 (빠른 메뉴/전체 보기에서 진입) ─────────
  if (view !== 'dashboard') {
    return (
      <div className={styles.subWrap}>
        <div className={styles.subHead}>
          <button className={styles.backBtn} onClick={() => setView('dashboard')}>
            <AppIcon name="arrow-left" size={18} />마이페이지
          </button>
          <span className={styles.subTitle}>{SUB_TITLE[view]}</span>
          {view === 'routes' && (
            <button className={styles.editLink} style={{ marginLeft: 'auto' }} onClick={() => router.push('/route/new')}>+ 루트 만들기</button>
          )}
        </div>
        <div className={styles.subBody}>
          {view === 'saved' && <SavedShopsTab userId={userId} />}
          {view === 'savedroutes' && <SavedRoutesTab userId={userId} />}
          {view === 'routes' && <MyRoutesTab userId={userId} />}
          {view === 'completed' && <CompletedRoutesTab userId={userId} />}
          {view === 'visited' && <VisitedShopsTab userId={userId} />}
          {view === 'posts' && <MyPostsTab userId={userId} />}
          {view === 'comments' && <MyCommentsTab userId={userId} />}
          {view === 'reviews' && <MyReviewsTab userId={userId} />}
          {view === 'shops' && <MyShopsTab userId={userId} />}
          {view === 'verify' && <VerifyStatusTab userId={userId} />}
          {view === 'badges' && <BadgesTab userId={userId} />}
          {view === 'growth' && <GrowthPage />}
          {view === 'chronicle' && <ChroniclePage />}
          {view === 'collection' && <CollectionTab userId={userId} />}
        </div>
      </div>
    )
  }

  // ───────── 대시보드 ─────────
  return (
    <div className={styles.wrap}>
      <div className={styles.dash}>

        {/* 프로필 요약 카드 */}
        <section className={styles.profileCard}>
          <div className={styles.profileMain}>
            <span className={styles.avatarWrap}>
              <UserAvatar userId={userId} src={avatarUrl} name={nickname} size={isMobile ? 68 : 96} />
            </span>
            <div className={styles.info}>
              <div className={styles.nameRow}>
                <h1 className={styles.name}>{nickname}</h1>
                <span className={styles.titleChip}>{titleName ? `${titleName} · ` : ''}Lv.{level}</span>
              </div>
              {tagline && <p className={styles.tagline}>{tagline}</p>}
              <div className={styles.followRow}>
                <button className={styles.followLink} onClick={() => openFollowModal('followers')}>팔로워<b>{follow.followers}</b></button>
                <span className={styles.followDot}>·</span>
                <button className={styles.followLink} onClick={() => openFollowModal('following')}>팔로잉<b>{follow.following}</b></button>
              </div>
              <div className={styles.expRow}>
                <span className={styles.expLabel}>{expLabel}</span>
                <span className={styles.expBar}><span className={styles.expFill} style={{ width: `${expPct}%` }} /></span>
              </div>
            </div>
            <div className={styles.actions}>
              <button className={styles.editBtn} onClick={() => router.push('/profile/settings')}>
                <AppIcon name="pencil" size={14} />프로필 편집
              </button>
              <button className={styles.iconBtn} aria-label="설정" onClick={() => router.push('/profile/settings')}>
                <AppIcon name="gear" size={18} />
              </button>
            </div>
          </div>
        </section>

        {/* 활동 통계 — 별도 카드, 가로 4칸 */}
        <section className={`${styles.card} ${styles.statsCard}`}>
          <div className={styles.stats}>
            {stats.map(s => (
              <button key={s.label} className={styles.stat} onClick={s.go}>
                <span className={styles.statIcon}><AppIcon name={s.icon} size={24} color="var(--accent)" /></span>
                <span className={styles.statText}>
                  <span className={styles.statLabel}>{s.label}</span>
                  <span className={styles.statValue}>{s.value}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 2열 */}
        <div className={styles.cols}>
          {/* 왼쪽 */}
          <div className={styles.colLeft}>
            {/* 빠른 메뉴 */}
            <section className={`${styles.card} ${styles.quickCard}`}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>빠른 메뉴</span>
                <button className={styles.editLink} onClick={openMenuEditor}>
                  <AppIcon name="pencil" size={13} />메뉴 편집
                </button>
              </div>
              {quickItems.length === 0 ? (
                <div className={styles.empty}>표시할 메뉴가 없어요. ‘메뉴 편집’에서 추가해보세요.</div>
              ) : (
                <div className={styles.quickGrid}>
                  {quickItems.map(m => (
                    <button key={m.key} className={styles.quickItem} onClick={() => runQuick(m)}>
                      <span className={styles.quickIcon}><AppIcon name={m.icon} size={22} /></span>
                      <span className={styles.quickLabel}>{m.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* 최근 활동 */}
            <section className={`${styles.card} ${styles.recentCard}`}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>최근 활동</span>
                <button className={styles.moreLink} onClick={() => setView('chronicle')}>전체 보기 ›</button>
              </div>
              <div className={styles.actTabs}>
                <button className={actTab === 'mine' ? styles.actTabOn : styles.actTab} onClick={() => setActTab('mine')}>내 활동</button>
                <button className={actTab === 'follow' ? styles.actTabOn : styles.actTab} onClick={() => setActTab('follow')}>팔로우 소식</button>
              </div>

              {actTab === 'mine' ? (
                activities.length === 0 ? (
                  <div className={styles.empty}>아직 활동 기록이 없어요.</div>
                ) : (
                  <div className={styles.actList}>
                    {activities.slice(0, isMobile ? 3 : 8).map(a => (
                      <button key={a.id} className={styles.actRow} onClick={() => a.href && router.push(a.href)} disabled={!a.href}>
                        <span className={styles.actIcon}><AppIcon name={ACT_ICON[a.icon] ?? 'sparkle'} size={18} color={ACT_COLOR[a.icon] ?? 'var(--accent)'} /></span>
                        <span className={styles.actBody}><span className={styles.actTitle}>{a.title}</span></span>
                        <span className={styles.actDate}>{fmtDate(a.occurredAt)}</span>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                feed.length === 0 ? (
                  <div className={styles.empty}>{follow.following > 0 ? '팔로우한 유저의 새 소식이 아직 없어요.' : '유저를 팔로우하면 새 소식이 여기에 모여요.'}</div>
                ) : (
                  <div className={styles.actList}>
                    {feed.slice(0, isMobile ? 3 : 8).map(f => (
                      <button key={f.id} className={styles.actRow} onClick={() => router.push(f.href)}>
                        <span className={styles.actIcon}><AppIcon name={f.kind === 'route' ? 'route' : 'pencil'} size={18} color={f.kind === 'route' ? '#FF5692' : '#3B9BE8'} /></span>
                        <span className={styles.actBody}>
                          <span className={styles.actTitle}>{f.title}</span>
                          <span className={styles.actSub}>{f.author} · {f.kind === 'route' ? '루트' : '커뮤니티 글'}</span>
                        </span>
                        <span className={styles.actDate}>{fmtDate(f.date)}</span>
                      </button>
                    ))}
                  </div>
                )
              )}
            </section>
          </div>

          {/* 오른쪽 */}
          <div className={styles.colRight}>
            {isMobile ? (
              /* 모바일: 내 컬렉션 + 대표 배지를 한 장의 카드에 */
              <section className={`${styles.card} ${styles.collBadgeMobile}`}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>내 컬렉션</span>
                  <button className={styles.moreLink} onClick={() => setView('collection')}>전체 보기 ›</button>
                </div>
                <div className={styles.mCollRow}>
                  {collection ? (
                    <button className={styles.mColl} onClick={() => collection.slug && router.push(`/tag/${collection.slug}`)}>
                      {collection.cover
                        ? <img className={styles.mCollThumb} src={collection.cover} alt="" />
                        : <span className={styles.mCollThumbPh}><Icon name="colorcollection" size={22} /></span>}
                      <span className={styles.mCollName}>{collection.name}</span>
                    </button>
                  ) : (
                    <span className={styles.mCollEmpty}>아직 컬렉션이 없어요.</span>
                  )}
                  {featuredBadges.length > 0 && (
                    <div className={styles.mBadges}>
                      {featuredBadges.map((b, i) => (
                        <button key={i} className={styles.mBadge} onClick={() => setView('badges')}>
                          <span className={styles.mBadgeIcon}>{b.iconUrl ? <img src={b.iconUrl} alt="" /> : <Icon name="colorcollection" size={22} />}</span>
                          <span className={styles.mBadgeName}>{b.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ) : (
            <div className={styles.collBadgeWrap}>
            {/* 나의 컬렉션 */}
            <section className={`${styles.card} ${styles.collCard}`}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>나의 컬렉션</span>
                <button className={styles.moreLink} onClick={() => setView('collection')}>전체 보기 ›</button>
              </div>
              {collection ? (
                <button className={styles.collItem} onClick={() => collection.slug && router.push(`/tag/${collection.slug}`)}>
                  {collection.cover
                    ? <img className={styles.collThumb} src={collection.cover} alt="" />
                    : <span className={styles.collThumbPh}><Icon name="colorcollection" size={26} /></span>}
                  <span className={styles.collMeta}>
                    <span className={styles.collName}>{collection.name}</span>
                    <span className={styles.collSub}>최애 작품</span>
                    <span className={styles.collCount}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20C5 15 3.5 10.5 5.5 7.8 7.1 5.9 10.2 6.1 12 8.4 13.8 6.1 16.9 5.9 18.5 7.8 20.5 10.5 19 15 12 20Z" /></svg>
                      {collection.count}
                    </span>
                  </span>
                </button>
              ) : (
                <div className={styles.empty}>아직 컬렉션이 없어요.</div>
              )}
            </section>

            {/* 대표 배지 */}
            <section className={`${styles.card} ${styles.badgeCard}`}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>대표 배지</span>
                <button className={styles.moreLink} onClick={() => setView('badges')}>전체 보기 ›</button>
              </div>
              {featuredBadges.length > 0 ? (
                <div className={styles.badgeRow}>
                  {featuredBadges.map((b, i) => (
                    <button key={i} className={styles.badgeItem} onClick={() => setView('badges')}>
                      <span className={styles.badgeIcon}>
                        {b.iconUrl ? <img src={b.iconUrl} alt="" /> : <Icon name="colorcollection" size={28} />}
                      </span>
                      <span className={styles.badgeName}>{b.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>대표 배지를 골라보세요.</div>
              )}
            </section>
            </div>
            )}

            {/* 계정 메뉴 */}
            <section className={`${styles.card} ${styles.accountCard}`}>
              <div className={styles.acctList}>
                <button className={styles.acctRow} onClick={() => router.push('/profile/settings')}>
                  <span className={styles.acctIcon}><AppIcon name="gear" size={17} /></span>
                  <span className={styles.acctLabel}>계정 설정</span>
                  <AppIcon name="chevron-right" size={15} color="var(--muted)" />
                </button>
                <button className={styles.acctRow} onClick={() => router.push('/profile/settings')}>
                  <span className={styles.acctIcon}><AppIcon name="bell" size={17} /></span>
                  <span className={styles.acctLabel}>알림 설정</span>
                  <AppIcon name="chevron-right" size={15} color="var(--muted)" />
                </button>
                <button className={styles.acctRow} onClick={() => router.push('/profile/settings')}>
                  <span className={styles.acctIcon}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>
                  </span>
                  <span className={styles.acctLabel}>공개 범위</span>
                  <AppIcon name="chevron-right" size={15} color="var(--muted)" />
                </button>
                {isAdmin && (
                  <button className={styles.acctRow} onClick={() => router.push('/admin')}>
                    <span className={styles.acctIcon}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    </span>
                    <span className={styles.acctLabel}>관리자 화면</span>
                    <AppIcon name="chevron-right" size={15} color="var(--muted)" />
                  </button>
                )}
                <button className={`${styles.acctRow} ${styles.logoutRow}`} onClick={handleLogout} disabled={loggingOut}>
                  <span className={styles.acctIcon}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
                  </span>
                  <span className={styles.acctLabel}>{loggingOut ? '로그아웃 중...' : '로그아웃'}</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* 팔로워/팔로잉 모달 */}
      {modal && (
        <div className={styles.modalScrim} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>{modal.type === 'followers' ? '팔로워' : '팔로잉'}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)} aria-label="닫기">✕</button>
            </div>
            {modal.list === null ? (
              <div className={styles.modalEmpty}>불러오는 중...</div>
            ) : modal.list.length === 0 ? (
              <div className={styles.modalEmpty}>{modal.type === 'followers' ? '아직 팔로워가 없어요.' : '아직 팔로우한 유저가 없어요.'}</div>
            ) : (
              <div className={styles.modalList}>
                {modal.list.map(u => (
                  <button key={u.id} className={styles.followUser} onClick={() => { setModal(null); router.push(`/user/${encodeURIComponent(u.nickname)}`) }}>
                    <UserAvatar userId={u.id} src={u.avatarUrl} name={u.nickname} size={40} showEffect={false} />
                    <span className={styles.fuName}>{u.nickname}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 빠른 메뉴 편집 모달 */}
      {editOpen && (
        <div className={styles.modalScrim} onClick={() => setEditOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>빠른 메뉴 편집</span>
              <button className={styles.modalClose} onClick={() => setEditOpen(false)} aria-label="닫기">✕</button>
            </div>
            <div className={styles.menuEditBody}>
              <div className={styles.meSectionTitle}>표시 중 · {draft.length} / {MAX_QUICK}개 (꾹 눌러 드래그로 순서 변경)</div>
              <div className={styles.meGrid}>
                {draft.map((k, i) => {
                  const it = QUICK_BY_KEY.get(k)
                  if (!it) return null
                  return (
                    <div
                      key={k}
                      ref={el => { cardRefs.current[i] = el }}
                      className={`${styles.meCard} ${styles.meCardDrag} ${dragKey === k ? styles.meCardDragging : ''} ${dragKey && dragKey !== k && overIdx === i ? styles.meCardTarget : ''}`}
                      style={{ touchAction: 'none' }}
                      onPointerDown={e => startCardDrag(e, k)}
                    >
                      <button
                        className={styles.meCardX}
                        onPointerDown={e => e.stopPropagation()}
                        onClick={() => removeDraft(k)}
                        disabled={draft.length <= 1}
                        aria-label="빼기"
                      >✕</button>
                      <span className={styles.quickIcon}><AppIcon name={it.icon} size={22} /></span>
                      <span className={styles.quickLabel}>{it.label}</span>
                    </div>
                  )
                })}
              </div>
              {addable.length > 0 && (
                <>
                  <div className={styles.meSectionTitle}>
                    추가할 수 있는 메뉴{draft.length >= MAX_QUICK && ' · 최대 6개까지 선택할 수 있어요'}
                  </div>
                  <div className={styles.meList}>
                    {addable.map(it => {
                      const full = draft.length >= MAX_QUICK
                      return (
                        <div key={it.key} className={styles.meRow}>
                          <span className={styles.meIcon}><AppIcon name={it.icon} size={18} /></span>
                          <span className={styles.meLabel}>{it.label}</span>
                          <div className={styles.meBtns}>
                            <button className={`${styles.meBtn} ${styles.meAdd}`} onClick={() => addDraft(it.key)} disabled={full} aria-label="추가">＋</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
            <div className={styles.menuEditFoot}>
              <button className={styles.meCancel} onClick={() => setEditOpen(false)}>취소</button>
              <button className={styles.meSave} onClick={saveMenu} disabled={savingMenu}>{savingMenu ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
