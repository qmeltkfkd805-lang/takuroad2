'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyWorkRelationships } from '@/services/workRelationshipService'
import { WorkRelationship } from '@/types/work-relationship'
import { AFFINITY_LABEL } from '@/lib/constants/workRelationship'
import { pickHeroRelationship } from '@/lib/home/pickHeroRelationship'
import HeroSlot from './HeroSlot'
import { getProductsByTag } from '@/services/shopProductService'
import { getShopsByTag } from '@/services/shopService'
import { ShopCard } from '@/components/tds'
import { useSaved } from '@/hooks/useSaved'
import { useDragScroll } from '@/hooks/useDragScroll'
import { useRouter } from 'next/navigation'
import type { Shop } from '@/types/shop'
import { ROUTES } from '@/lib/constants/routes'
import { getEventsByTag } from '@/services/eventService'
import { getMySavedEventIds, saveEvent, unsaveEvent } from '@/services/eventSaveService'
import { pickWorkNews } from '@/lib/home/pickWorkNews'
import { FeedItem, FeedKind } from '@/lib/feed/types'
import { WorkIcon } from '@/components/tds/WorkIcon'
import HomeFeedCard from './HomeFeedCard'
import { SectionHeader, Icon } from '@/components/tds'
import styles from './HomeFeed.module.css'
import RankList from './RankList'
import { EventCard, RouteCard } from '@/components/tds'

const PALETTE = [
  { bg: '#EEEDFE', fg: '#3C3489' }, { bg: '#E1F5EE', fg: '#0F6E56' },
  { bg: '#FAECE7', fg: '#993C1D' }, { bg: '#E6F1FB', fg: '#185FA5' },
  { bg: '#FBEAF0', fg: '#993556' }, { bg: '#FAEEDA', fg: '#854F0B' },
  { bg: '#EAF3DE', fg: '#3B6D11' }, { bg: '#FCEBEB', fg: '#A32D2D' },
]
function workColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/* 나를 위한 소식 — 필터 + 소식 종류 매핑 */
const NEWS_FILTERS = [
  { key: 'all', label: '전체' }, { key: 'work', label: '작품' },
  { key: 'event', label: '이벤트' }, { key: 'shop', label: '샵' },
] as const
function newsGroup(k: FeedKind): 'work' | 'event' | 'shop' {
  if (k === 'event' || k === 'popup') return 'event'
  if (k === 'goods' || k === 'checkin') return 'shop'
  return 'work'
}
const NEWS_KIND: Record<string, { label: string; dot: string }> = {
  event: { label: '새 이벤트', dot: '#FF5692' },
  popup: { label: '팝업 진행', dot: '#3B9BE8' },
  goods: { label: '굿즈 입고', dot: '#F5A300' },
  route: { label: '새 루트', dot: '#1FAE8C' },
  collection: { label: '컬렉션', dot: '#8B6BD9' },
  checkin: { label: '체크인', dot: '#3B9BE8' },
  notice: { label: '소식', dot: '#1FAE8C' },
}
const kindMeta = (k: string) => NEWS_KIND[k] ?? { label: '소식', dot: '#C7C2BA' }

function NewsHero({ item, eventId, saved, onToggleSave }: { item: FeedItem; eventId: string | null; saved: boolean; onToggleSave: (id: string) => void }) {
  const m = kindMeta(item.kind)
  const body = (
    <>
      <div className={styles.newsHeroThumb} style={{ background: item.imageUrl ? undefined : '#F1EFEA' }}>
        {item.imageUrl ? <img src={item.imageUrl} alt="" draggable={false} /> : <WorkIcon size={28} style={{ opacity: 0.4 }} />}
      </div>
      <div className={styles.newsHeroBody}>
        <div className={styles.newsHeroTop}>
          {item.contextLabel && <span className={styles.newsWork}>{item.contextLabel}</span>}
          {item.contextLabel && <span className={styles.newsSep}>·</span>}
          <span className={styles.newsKind} style={{ color: m.dot }}>{m.label}</span>
        </div>
        <div className={styles.newsHeroTitle}>{item.title}</div>
        {item.subtitle && <div className={styles.newsHeroSub}>{item.subtitle}</div>}
      </div>
    </>
  )
  return (
    <div className={styles.newsHero}>
      {item.href
        ? <Link href={item.href} className={styles.newsHeroMain}>{body}</Link>
        : <div className={styles.newsHeroMain}>{body}</div>}
      {eventId && (
        <button className={styles.newsHeart} onClick={() => onToggleSave(eventId)} aria-pressed={saved} aria-label={saved ? '저장 해제' : '저장'}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={saved ? '#FF5692' : 'none'} stroke={saved ? '#FF5692' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.04 3 5.5l7 7Z" /></svg>
        </button>
      )}
    </div>
  )
}

function NewsRow({ item }: { item: FeedItem }) {
  const m = kindMeta(item.kind)
  const inner = (
    <div className={styles.newsRow}>
      <span className={styles.newsDot} style={{ background: m.dot }} />
      <span className={styles.newsRowText}>
        <b className={styles.newsRowTitle}>{item.title}</b>
        {item.subtitle && <span className={styles.newsRowMeta}> · {item.subtitle}</span>}
      </span>
      <svg className={styles.newsChev} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
    </div>
  )
  return item.href ? <Link href={item.href} className={styles.newsRowLink}>{inner}</Link> : <div className={styles.newsRowLink}>{inner}</div>
}

interface HomeFeedProps {
  popularShops: any[]
  routes: any[]
  events: any[]
  activeWorks: any[]
}

export default function HomeFeed({ popularShops, routes, activeWorks, events }: HomeFeedProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { isSaved, toggleSave } = useSaved()

  // 가로 줄 4개 — 마우스로 밀어서 스크롤
  const worksDrag = useDragScroll()
  const eventsDrag = useDragScroll()
  const shopsDrag = useDragScroll()
  const routesDrag = useDragScroll()
  const [rels, setRels] = useState<WorkRelationship[]>([])
  const [loading, setLoading] = useState(true)
  const [newsFilter, setNewsFilter] = useState<'all' | 'work' | 'event' | 'shop'>('all')
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getMyWorkRelationships(user.id).then(setRels).finally(() => setLoading(false))
  }, [user])

  // 최애 먼저, 그다음 좋아하는 작품 (관계 있는 것만)
  const myWorks = rels
    .filter(r => r.affinity)
    .sort((a, b) => (a.affinity === 'favorite' ? 0 : 1) - (b.affinity === 'favorite' ? 0 : 1))
  // 추천 이벤트 — EventCard가 아는 type만 (모르는 type이 오면 TYPE_META 조회에서 터진다)
  const eventCards = (events ?? []).filter((ev: any) =>
    ['popup', 'collab_cafe', 'exhibition', 'official_event'].includes(ev.type))

  // 활발한 작품에 ❤️/⭐ 붙이기용
  const myAffinity = new Map(
    rels.filter(r => r.affinity).map(r => [r.work.id, r.affinity!])
  )

  // Hero — 오늘 가장 중요한 관계
  const heroPick = pickHeroRelationship(rels)
  const [heroCounts, setHeroCounts] = useState<{ goods: number; shops: number } | null>(null)

  useEffect(() => {
    if (!heroPick) { setHeroCounts(null); return }
    const { slug, id } = heroPick.relationship.work
    Promise.all([getProductsByTag(id), getShopsByTag(slug)])
      .then(([goods, shops]) => setHeroCounts({ goods: goods.length, shops: shops.length }))
  }, [heroPick?.relationship.work.id])

  // 내 작품들의 새 소식 (작품별 이벤트 → pickWorkNews → FeedItem)
  const [newsItems, setNewsItems] = useState<FeedItem[]>([])
  useEffect(() => {
    if (myWorks.length === 0) { setNewsItems([]); return }
    Promise.all(
      myWorks.map(r =>
        getEventsByTag(r.work.id)
          .then(events => pickWorkNews(r.work, events, r.affinity))
          .catch(() => pickWorkNews(r.work, [], r.affinity))
      )
    ).then(items => {
      // 새 소식 있는 작품(none 아님)을 앞으로 정렬
      const sorted = [...items].sort((a, b) => (a.kind === 'none' ? 1 : 0) - (b.kind === 'none' ? 1 : 0))
      setNewsItems(sorted)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWorks.map(r => r.work.id).join(',')])

  // 나를 위한 소식 — 필터별 목록 (대표 1 + 목록)
  const allNews = newsItems.filter(n => n.kind !== 'none')
  const activeNews = allNews.filter(n => newsFilter === 'all' || newsGroup(n.kind) === newsFilter)

  // 이벤트 소식 저장(하트)
  useEffect(() => {
    if (!user) { setSavedEventIds(new Set()); return }
    getMySavedEventIds(user.id).then(ids => setSavedEventIds(new Set(ids))).catch(() => {})
  }, [user])
  const eventIdOf = (item?: FeedItem) =>
    item && (item.kind === 'event' || item.kind === 'popup') && item.href?.startsWith('/event/')
      ? item.href.slice('/event/'.length) : null
  const toggleSaveEvent = (eventId: string) => {
    if (!user) { router.push(ROUTES.login); return }
    const was = savedEventIds.has(eventId)
    setSavedEventIds(prev => { const n = new Set(prev); was ? n.delete(eventId) : n.add(eventId); return n })
    ;(was ? unsaveEvent(user.id, eventId) : saveEvent(user.id, eventId)).catch(() => {
      setSavedEventIds(prev => { const n = new Set(prev); was ? n.add(eventId) : n.delete(eventId); return n })
    })
  }

  return (
    <div>
      {/* 📰 나를 위한 소식 */}
      <section className={styles.sectionCard}>
        <SectionHeader title="나를 위한 소식" plainIcon icon={<Icon name="colorheart" size={28} />} actionLabel="전체 보기" onAction={() => { window.location.href = "/my-works" }} />
        {loading ? (
          <Muted>불러오는 중...</Muted>
        ) : !user ? (
          <PromptBox text="로그인하면 좋아하는 작품·이벤트 소식을 모아볼 수 있어요" href="/login" cta="로그인" />
        ) : myWorks.length === 0 ? (
          <PromptBox text="아직 최애 작품이 없어요. 작품홈에서 골라보세요" href="/my-works" cta="작품홈 가기" />
        ) : allNews.length === 0 ? (
          <Muted>아직 소식이 없어요</Muted>
        ) : (
          <>
            <div className={styles.newsFilters}>
              {NEWS_FILTERS.map(f => (
                <button
                  key={f.key}
                  className={newsFilter === f.key ? styles.newsChipOn : styles.newsChip}
                  onClick={() => setNewsFilter(f.key)}
                >{f.label}</button>
              ))}
            </div>
            {activeNews.length === 0 ? (
              <Muted>이 분류의 소식이 아직 없어요</Muted>
            ) : (
              <div className={styles.newsWrap}>
                <div className={styles.newsCard}>
                  <NewsHero
                    item={activeNews[0]}
                    eventId={eventIdOf(activeNews[0])}
                    saved={(() => { const id = eventIdOf(activeNews[0]); return !!id && savedEventIds.has(id) })()}
                    onToggleSave={toggleSaveEvent}
                  />
                  {activeNews.slice(1, 4).map((item, i) => <NewsRow key={i} item={item} />)}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* 🧭 추천 루트 */}
      {routes.length > 0 && (
        <section className={styles.sectionCard}>
          <SectionHeader
            title="추천 루트"
            plainIcon
            icon={<Icon name="colorroute" size={28} />}
            actionLabel="전체 보기"
            onAction={() => { window.location.href = ROUTES.routes }}
          />
          <div className={styles.eventRow} {...routesDrag}>
            {routes.map((r: any) => (
              <div key={r.id} className={styles.eventItem}>
                <RouteCard
                  route={{
                    id: r.id,
                    title: r.title,
                    summary: r.description,
                    shopCount: r.route_shops?.length ?? 0,
                    distanceM: r.total_distance_m,
                    durationMin: r.total_duration_min,
                  }}
                  onClick={() => { window.location.href = `/route/${r.share_token}` }}
                  onStart={() => { window.location.href = `/route/${r.share_token}` }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 🏪 많이 찾는 굿즈샵 */}
      {eventCards.length > 0 && (
        <section className={routes.length > 0 ? styles.sectionCard + ' ' + styles.tightTop : styles.sectionCard}>
          <SectionHeader
            title="지금 가볼 만한 이벤트"
            plainIcon
            icon={<Icon name="colorevent" size={28} />}
            actionLabel="전체 보기"
            onAction={() => { window.location.href = '/events' }}
          />
          <div className={styles.eventRow} {...eventsDrag}>
            {eventCards.map((ev: any) => (
              <div key={ev.id} className={styles.eventItem}>
                <EventCard
                  event={{
                    id: ev.id,
                    title: ev.title ?? '이벤트',
                    type: ev.type,
                    workName: ev.workName,
                    place: ev.placeName ?? ev.shopName,
                    startDate: ev.startDate,
                    endDate: ev.endDate,
                    coverUrl: ev.coverUrl ?? null,
                  }}
                  now={new Date()}
                  onClick={() => { window.location.href = `/event/${ev.id}` }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {popularShops.length > 0 && (
        <section className={styles.sectionCard}>
          <SectionHeader title="샵 둘러보기" plainIcon icon={<Icon name="colorshop" size={28} />} />
          {/* 지도 바텀시트와 같은 가로 줄 (200x280 카드) */}
          <div className={styles.shopRow} {...shopsDrag}>
            {popularShops.map(shop => (
              <div key={shop.id} className={styles.shopItem}>
                <ShopCard
                  shop={{ ...shop, isSaved: isSaved(shop.id) } as Shop}
                  onClick={(sh) => router.push(ROUTES.shop(sh.slug))}
                  onToggleSave={(sh) => {
                    if (!user) { router.push(ROUTES.login); return }
                    toggleSave(sh.id)
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}

function SectionTitle({ children, inset }: { children: React.ReactNode; inset?: boolean }) {
  return (
    <h2 style={{
      fontSize: '16px', fontWeight: 700, color: 'var(--text)',
      margin: '0 0 12px', padding: inset ? 0 : '0 16px',
    }}>
      {children}
    </h2>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div className={styles.mutedFlush} style={{ padding: '20px 16px', color: 'var(--muted)', fontSize: '14px' }}>{children}</div>
}

function PromptBox({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className={styles.promptFlush} style={{ margin: '0 16px', padding: '20px', borderRadius: 'var(--r-sm)', background: 'var(--surface2)', textAlign: 'center' }}>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 12px' }}>{text}</p>
      <Link href={href} style={{
        display: 'inline-block', padding: '9px 20px', borderRadius: 'var(--r-sm)',
        background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 700, textDecoration: 'none',
      }}>
        {cta}
      </Link>
    </div>
  )
}