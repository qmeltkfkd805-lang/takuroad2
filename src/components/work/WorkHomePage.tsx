'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import WorkAffinityButton from './WorkAffinityButton'
import WorkStateButton from './WorkStateButton'
import { SectionHeader, EventCard, ShopCard, RouteCard } from '@/components/tds'
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
}

const TABS = [
  { id: 'feed', label: '홈' },
  { id: 'events', label: '이벤트' },
  { id: 'goods', label: '굿즈' },
  { id: 'shops', label: '샵' },
  { id: 'routes', label: '루트' },
  { id: 'community', label: '커뮤니티' },
]

export default function WorkHomePage({ tag, feed, events, shops, goods, routes, communityPosts }: Props) {
  const router = useRouter()
  const now = new Date()

  const eventCards = (events ?? []).filter((e: any) => EVENT_TYPES.includes(e.type))

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
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
      <section
        className={styles.hero}
        style={tag.banner_image ? { backgroundImage: `url(${tag.banner_image})` } : undefined}
      >
        <div className={styles.heroTop}>
          <button className={styles.iconBtn} aria-label="뒤로"
            onClick={() => (window.history.length > 1 ? router.back() : router.push('/my-works'))}>←</button>
          <button className={styles.iconBtn} aria-label="공유" onClick={share}>↗</button>
        </div>
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
          </div>
        </div>
      </section>

      {/* Tabs */}
      <nav className={styles.tabs}>
        {TABS.map(t => (
          <a key={t.id} href={`#${t.id}`} className={styles.tab} onClick={scrollTo(t.id)}>{t.label}</a>
        ))}
      </nav>

      <div className={styles.body}>
        {/* 1) Feed */}
        <section id="feed" className={styles.section}>
          <SectionHeader title="새 소식 (Feed)" plainIcon />
          {feed.length > 0 ? (
            <div className={styles.rowScroll}>
              {feed.map((item, i) => (
                <div key={i} className={styles.rowItem}><HomeFeedCard item={item} /></div>
              ))}
            </div>
          ) : <Empty text="아직 새 소식이 없어요" />}
        </section>

        {/* 2) 이벤트 */}
        <section id="events" className={styles.section}>
          <SectionHeader title="진행 중 이벤트" plainIcon />
          <div className={styles.rowScroll}>
            {eventCards.map((e: any) => (
              <div key={e.id} className={styles.rowItem}>
                <EventCard
                  event={{ id: e.id, title: e.title, type: e.type, workName: tag.name, place: e.shopName, startDate: e.startDate, endDate: e.endDate, coverUrl: null }}
                  now={now}
                  onClick={() => e.shopSlug && router.push(`/shop/${e.shopSlug}`)}
                />
              </div>
            ))}
            <Link href={`/event/submit?tag=${tag.id}`} className={styles.report}>+ 이벤트 제보하기</Link>
          </div>
        </section>

        {/* 3) 굿즈샵 */}
        <section id="shops" className={styles.section}>
          <SectionHeader title="굿즈샵" plainIcon actionLabel={shops.length > 0 ? '지도에서 보기' : undefined} onAction={() => router.push('/map')} />
          {shops.length > 0 ? (
            <div className={styles.rowScroll}>
              {shops.map((s: any) => (
                <div key={s.id} className={styles.rowItem}>
                  <ShopCard shop={s} meta="region" onClick={() => router.push(`/shop/${s.slug}`)} />
                </div>
              ))}
            </div>
          ) : <Empty text="아직 등록된 샵이 없어요" />}
        </section>

        {/* 4) 굿즈 */}
        <section id="goods" className={styles.section}>
          <SectionHeader title="굿즈" plainIcon />
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
          <SectionHeader title="성지순례 루트" plainIcon actionLabel={routes.length > 0 ? '전체 보기' : undefined} onAction={() => router.push('/routes')} />
          {routes.length > 0 ? (
            <div className={styles.list}>
              {routes.map((r: any) => (
                <RouteCard key={r.id}
                  route={{ id: r.id, title: r.title, summary: r.description ?? null, shopCount: r.route_shops?.length ?? 0, distanceM: r.total_distance_m, durationMin: r.total_duration_min }}
                  onClick={() => router.push(`/route/${r.share_token}`)} />
              ))}
            </div>
          ) : <Empty text="아직 추천 루트가 없어요" />}
        </section>

        {/* 6) 커뮤니티 (미구현 — Empty만, 연결 지점은 communityPosts) */}
        <section id="community" className={styles.section}>
          <SectionHeader title="커뮤니티" plainIcon />
          <div className={styles.typeChips}>
            {['자유', '질문', '후기', '교환', '공동구매', '동행', '굿즈자랑'].map(t => (
              <span key={t} className={styles.typeChip}>#{t}</span>
            ))}
          </div>
          {communityPosts.length > 0 ? (
            <div className={styles.list} />
          ) : <Empty strong="커뮤니티가 곧 열려요" text="이 작품 팬들과 후기·교환·동행을 나눠보세요" />}
        </section>
      </div>
    </div>
  )
}

function Empty({ strong, text }: { strong?: string; text: string }) {
  return (
    <div className={styles.empty}>
      {strong && <div className={styles.emptyStrong}>{strong}</div>}
      {text}
    </div>
  )
}
