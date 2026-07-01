'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import WorkAffinityButton from './WorkAffinityButton'
import WorkStateButton from './WorkStateButton'
import { SectionHeader, EventCard, ShopCard, RouteCard, Icon } from '@/components/tds'
import HomeFeedCard from '@/components/home/HomeFeedCard'
import type { FeedItem } from '@/lib/feed/types'
import { AVAILABILITY_LABEL, type Availability } from '@/services/shopProductService'
import styles from './WorkHomePage.module.css'

const AVAIL_COLOR: Record<string, string> = {
  many: 'var(--green)', normal: 'var(--accent)', few: '#EAB308',
  sold_out: 'var(--red)', not_sold: 'var(--muted)', unknown: 'var(--muted)',
}

const EVENT_TYPES = ['popup', 'collab_cafe', 'exhibition']

interface WorkTag {
  id: string; name: string; slug: string
  cover_url?: string | null
  banner_image?: string | null
  english_name?: string | null
  ip_type?: string | null
  release_year?: number | null
  genres?: string[] | null
  description?: string | null
}

interface Props {
  tag: WorkTag
  feed: FeedItem[]
  events: any[]
  shops: any[]
  goods: any[]
  routes: any[]
  communityPosts: any[]
  favoriteCount: number
}

const TABS = [
  { id: 'feed', label: '홈' },
  { id: 'events', label: '이벤트' },
  { id: 'goods', label: '굿즈' },
  { id: 'shops', label: '샵' },
  { id: 'routes', label: '루트' },
  { id: 'community', label: '커뮤니티' },
]

export default function WorkHomePage({ tag, feed, events, shops, goods, routes, communityPosts, favoriteCount }: Props) {
  const router = useRouter()
  const now = new Date()

  const [activeId, setActiveId] = useState('feed')
  useEffect(() => {
    const els = TABS.map(t => document.getElementById(t.id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) setActiveId((vis[0].target as HTMLElement).id)
    }, { rootMargin: '-120px 0px -55% 0px', threshold: 0 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const eventCards = (events ?? []).filter((e: any) => EVENT_TYPES.includes(e.type))

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    setActiveId(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if ((navigator as any).share) await (navigator as any).share({ title: tag.name, url })
      else { await navigator.clipboard.writeText(url); alert('링크를 복사했어요') }
    } catch { /* 취소 무시 */ }
  }

  const chips: string[] = []
  if (tag.ip_type) chips.push(tag.ip_type)
  if (tag.release_year) chips.push(`${tag.release_year}~`)
  if (tag.genres) chips.push(...tag.genres)

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero} style={tag.banner_image ? { backgroundImage: `url(${tag.banner_image})` } : undefined}>

        <div className={styles.heroInner}>
          <div className={styles.poster}>
            {tag.cover_url ? <img src={tag.cover_url} alt={tag.name} /> : <span style={{ fontSize: 26 }}>🎬</span>}
          </div>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>{tag.name}</h1>
            {tag.english_name && <div className={styles.heroEn}>{tag.english_name}</div>}
            {chips.length > 0 && (
              <div className={styles.heroChips}>
                {chips.map((c, i) => <span key={i} className={styles.heroChip}>{c}</span>)}
              </div>
            )}
            <div className={styles.heroActions}>
              <WorkAffinityButton tagId={tag.id} />
              <WorkStateButton tagId={tag.id} />
            </div>
            {favoriteCount > 0 && (
              <div className={styles.favCount}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" stroke="none"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0z" /><circle cx="16.6" cy="8.6" r="2.5" opacity=".85" /><path d="M14.5 19a5 5 0 0 1 7-4.4A5 5 0 0 1 21.5 19z" opacity=".85" /></svg>
                <span><b>{favoriteCount.toLocaleString()}</b>명이 최애로 등록했어요</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <nav className={styles.tabs}>
        {TABS.map(t => (
          <a key={t.id} href={`#${t.id}`} className={`${styles.tab} ${activeId === t.id ? styles.tabActive : ''}`} onClick={scrollTo(t.id)}>
            <TabIcon id={t.id} />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>

      {/* 본문 + 우측 광고칸 */}
      <div className={styles.layout}>
        <div className={styles.main}>
          {/* 1) Feed */}
          <section id="feed" className={styles.section}>
            <SectionHeader title="새 소식 (Feed)" icon={<Icon name="colorfire" size={24} />} plainIcon />
            {feed.length > 0 ? (
              <div className={styles.rowScroll}>
                {feed.map((item, i) => (<div key={i} className={styles.rowItem}><HomeFeedCard item={item} /></div>))}
              </div>
            ) : <Empty text="아직 새 소식이 없어요" />}
          </section>

          {/* 2) 이벤트 */}
          <section id="events" className={styles.section}>
            <SectionHeader title="진행 중 이벤트" icon={<Icon name="colorevent" size={24} />} plainIcon />
            <div className={styles.rowScroll}>
              {eventCards.map((e: any) => (
                <div key={e.id} className={styles.rowItem}>
                  <EventCard event={{ id: e.id, title: e.title, type: e.type, workName: tag.name, place: e.shopName, startDate: e.startDate, endDate: e.endDate, coverUrl: null }} now={now} onClick={() => e.shopSlug && router.push(`/shop/${e.shopSlug}`)} />
                </div>
              ))}
              <Link href={`/event/submit?tag=${tag.id}`} className={styles.report}>+ 이벤트 제보하기</Link>
            </div>
          </section>

          {/* 3) 굿즈샵 */}
          <section id="shops" className={styles.section}>
            <SectionHeader title="굿즈샵" icon={<Icon name="colorshop" size={24} />} plainIcon actionLabel={shops.length > 0 ? '지도에서 보기' : undefined} onAction={() => router.push('/map')} />
            {shops.length > 0 ? (
              <div className={styles.rowScroll}>
                {shops.map((s: any) => (<div key={s.id} className={styles.rowItem}><ShopCard shop={s} meta="region" onClick={() => router.push(`/shop/${s.slug}`)} /></div>))}
              </div>
            ) : <Empty text="아직 등록된 샵이 없어요" />}
          </section>

          {/* 4) 굿즈 */}
          <section id="goods" className={styles.section}>
            <SectionHeader title="굿즈" icon={<Icon name="colorgift" size={24} />} plainIcon />
            {goods.length > 0 ? (
              <div className={styles.rowScroll}>
                {goods.map((g: any) => {
                  const inner = (
                    <>
                      <span className={styles.goodsIcon}>{g.goodsIcon}</span>
                      <span className={styles.goodsName}>{g.character ? `${g.character} ` : ''}{g.goodsType}</span>
                      <span className={styles.goodsShop}>📍 {g.shopName}</span>
                      <span className={styles.goodsAvail} style={{ color: AVAIL_COLOR[g.availability] }}>{AVAILABILITY_LABEL[g.availability as Availability]}</span>
                    </>
                  )
                  return g.shopSlug
                    ? <Link key={g.id} href={`/shop/${g.shopSlug}`} className={styles.goodsCard}>{inner}</Link>
                    : <div key={g.id} className={styles.goodsCard}>{inner}</div>
                })}
              </div>
            ) : <Empty text="아직 등록된 굿즈가 없어요" />}
          </section>

          {/* 5) 루트 */}
          <section id="routes" className={styles.section}>
            <SectionHeader title="성지순례 루트" icon={<Icon name="colorroute" size={24} />} plainIcon actionLabel={routes.length > 0 ? '전체 보기' : undefined} onAction={() => router.push('/routes')} />
            {routes.length > 0 ? (
              <div className={styles.list}>
                {routes.map((r: any) => (
                  <RouteCard key={r.id} route={{ id: r.id, title: r.title, summary: r.description ?? null, shopCount: r.route_shops?.length ?? 0, distanceM: r.total_distance_m, durationMin: r.total_duration_min }} onClick={() => router.push(`/route/${r.share_token}`)} />
                ))}
              </div>
            ) : <Empty text="아직 추천 루트가 없어요" />}
          </section>

          {/* 6) 커뮤니티 */}
          <section id="community" className={styles.section}>
            <SectionHeader title="커뮤니티" icon={<span style={{ width: 22, height: 22, display: "inline-block", backgroundColor: "#3B9BE8", WebkitMaskImage: "url(/icons/news.png)", maskImage: "url(/icons/news.png)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />} plainIcon />
            <div className={styles.typeChips}>
              {['자유', '질문', '후기', '교환', '공동구매', '동행', '굿즈자랑'].map(t => (<span key={t} className={styles.typeChip}>#{t}</span>))}
            </div>
            {communityPosts.length > 0 ? <div className={styles.list} /> : <Empty strong="커뮤니티가 곧 열려요" text="이 작품 팬들과 후기·교환·동행을 나눠보세요" />}
          </section>
        </div>

        {/* 우측 광고칸 (데스크톱) */}
        <aside className={styles.adCol}>
          {tag.description && (
            <div className={styles.aboutCard}>
              <div className={styles.aboutTitle}>작품 소개</div>
              <p className={styles.aboutText}>{tag.description}</p>
            </div>
          )}
          <div className={styles.adSlot}>광고</div>
        </aside>
      </div>
    </div>
  )
}

// 탭 아이콘 6개 — 굵고 둥근 라인아트 SVG 통일. stroke=currentColor라 활성시 핑크 자동.
function TabIcon({ id }: { id: string }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (id === 'feed') return <svg {...p}><path d="M3.5 11.5l8.5-7.5 8.5 7.5" /><path d="M5.5 10.5V20h13v-9.5" /><path d="M10 20v-5.5h4V20" /></svg>
  if (id === 'events') return <svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 9.5h17" /><path d="M8 3v3.5" /><path d="M16 3v3.5" /></svg>
  if (id === 'goods') return <svg {...p}><path d="M4.5 8h15l-1.2 11.5a1.5 1.5 0 0 1-1.5 1.3H7.2a1.5 1.5 0 0 1-1.5-1.3z" /><path d="M8.5 8a3.5 3.5 0 0 1 7 0" /></svg>
  if (id === 'shops') return <svg {...p}><path d="M4 9.5l1.6-5h12.8L20 9.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /><path d="M4 9.5a2.4 2.4 0 0 0 4.7 0 2.4 2.4 0 0 0 4.6 0 2.4 2.4 0 0 0 4.7 0" /></svg>
  if (id === 'routes') return <svg {...p}><path d="M12 21c-4.6-5.6-6.8-9.6-6.8-12.8a6.8 6.8 0 0 1 13.6 0c0 3.2-2.2 7.2-6.8 12.8z" /><circle cx="12" cy="8.4" r="2.5" /></svg>
  return <svg {...p}><path d="M20.5 11.4a7.7 7.7 0 0 1-11.1 6.9L4.5 20l1.4-4.7a7.7 7.7 0 1 1 14.6-3.9z" /><circle cx="8.6" cy="11.5" r="1.05" fill="currentColor" stroke="none" /><circle cx="12" cy="11.5" r="1.05" fill="currentColor" stroke="none" /><circle cx="15.4" cy="11.5" r="1.05" fill="currentColor" stroke="none" /></svg>
}

function SectionIcon({ kind }: { kind: string }) {
  const COLOR: Record<string, string> = { feed: 'var(--accent)', events: '#8B6BD9', shops: '#FF6B6B', goods: '#F5A300', routes: '#1FAE8C', community: '#3B9BE8' }
  const c = COLOR[kind] ?? 'var(--accent)'
  const p = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (kind === 'feed') return <svg {...p}><path d="M12 3l2.2 5.5L20 10l-5.8 1.5L12 17l-2.2-5.5L4 10l5.8-1.5z" fill={c} stroke="none" /></svg>
  if (kind === 'events') return <svg {...p}><rect x="3" y="4" width="18" height="17" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></svg>
  if (kind === 'shops') return <svg {...p}><path d="M3 9l1.5-5h15L21 9" /><path d="M5 9v11h14V9" /><path d="M10 20v-6h4v6" /></svg>
  if (kind === 'goods') return <svg {...p}><path d="M6 8h12l-1 12H7L6 8z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>
  if (kind === 'routes') return <svg {...p}><path d="M12 21c-4.5-5.5-6.6-9.4-6.6-12.5a6.6 6.6 0 0 1 13.2 0c0 3.1-2.1 7-6.6 12.5z" /><circle cx="12" cy="8.5" r="2.3" /></svg>
  return <svg {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" /></svg>
}

function Empty({ strong, text }: { strong?: string; text: string }) {
  return (
    <div className={styles.empty}>
      {strong && <div className={styles.emptyStrong}>{strong}</div>}
      {text}
    </div>
  )
}
