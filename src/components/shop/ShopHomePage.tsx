'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { useDragScroll } from '@/hooks/useDragScroll'
import { CATEGORIES } from '@/lib/constants/categories'
import { Icon } from '@/components/tds'
import { EventIcon, EventIconName } from '@/components/event/EventIcon'
import ShopHomeCard, { ShopMiniCard, compact, placeLabel } from './ShopHomeCard'
import {
  ShopHomeItem, getShopHomeItems, getMyFavoriteTagIds,
  hotShops, newShops, eventShops, featuredShops, regionGroups, favoriteWorkGroups,
} from '@/services/shopHomeService'
import styles from './ShopHomePage.module.css'

// 샵 홈 = 발견. 지도 = 위치. 그래서 필터가 아니라 큐레이션 줄을 쌓는다.
export default function ShopHomePage() {
  const router = useRouter()
  const { user } = useAuth()

  const [items, setItems] = useState<ShopHomeItem[]>([])
  const [favTagIds, setFavTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getShopHomeItems()
      .then(rows => { if (alive) setItems(rows) })
      .catch(() => { if (alive) setItems([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!user) { setFavTagIds([]); return }
    getMyFavoriteTagIds(user.id).then(setFavTagIds).catch(() => {})
  }, [user])

  const hot = useMemo(() => hotShops(items), [items])
  const regions = useMemo(() => regionGroups(items), [items])
  const fresh = useMemo(() => newShops(items), [items])
  const events = useMemo(() => eventShops(items), [items])
  const featured = useMemo(() => featuredShops(items), [items])
  const favGroups = useMemo(() => favoriteWorkGroups(items, favTagIds), [items, favTagIds])

  const hotDrag = useDragScroll()
  const regionDrag = useDragScroll()
  const newDrag = useDragScroll()
  const eventDrag = useDragScroll()

  const go = (href: string) => router.push(href)

  if (loading) return <div className={styles.page}><div className={styles.skeleton} /></div>

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          {/* Hero */}
          <section className={styles.hero}>
            <div className={styles.heroText}>
              <h1>
                오늘 어디로<br />
                <span>굿즈 쇼핑 갈까요?</span>
              </h1>
              <p>전국의 애니 · 게임 · 캐릭터 굿즈샵을 타쿠로드에서 한눈에!</p>
              <button className={styles.heroBtn} onClick={() => go('/shop/new')}>+ 샵 등록하기</button>
            </div>
            <div className={styles.heroDeco} aria-hidden />
          </section>

          {/* 카테고리 바로가기 */}
          <h2 className={styles.blockTitle}>카테고리 바로가기</h2>
          <div className={styles.catGrid}>
            {CATEGORIES.slice(0, 7).map(c => (
              <button key={c.slug} className={styles.catTile} onClick={() => go(`/shops/all?cat=${c.slug}`)}>
                <span className={styles.catIcon} style={{ background: c.bgColor }}>
                  <Icon name={c.icon as any} size={22} />
                </span>
                <span className={styles.catName}>{c.name}</span>
              </button>
            ))}
            <button className={styles.catTile} onClick={() => go('/shops/all')}>
              <span className={styles.catIcon} style={{ background: 'var(--surface2)' }}>···</span>
              <span className={styles.catName}>전체</span>
            </button>
          </div>

          {/* 지금 핫한 샵 */}
          {hot.length > 0 && (
            <Section
              icon="fire" color="var(--accent)" title="지금 핫한 샵" desc="방문, 찜, 후기 기준으로 지금 가장 인기 있는 샵이에요"
              onSeeAll={() => go('/shops/all?section=hot')}
            >
              <div className={styles.hotRow} {...hotDrag}>
                {hot.map((s, i) => (
                  <div key={s.id} className={styles.hotItem}>
                    <ShopHomeCard shop={s} rank={i + 1} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 지역별 인기 샵 */}
          {regions.length > 0 && (
            <Section
              icon="pin" color="#3B9BE8" title="지역별 인기 샵" desc="지역별로 사랑받는 인기 샵들을 확인해보세요"
              onSeeAll={() => go('/shops/all?section=region')}
            >
              <div className={styles.regionRow} {...regionDrag}>
                {regions.map(g => (
                  <article
                    key={g.key}
                    className={styles.regionCard}
                    onClick={() => go(`/shops/all?region=${encodeURIComponent(g.key)}`)}
                  >
                    <div className={styles.regionThumb}>{g.district}</div>
                    <div className={styles.regionHead}>
                      <strong>{g.district}</strong>
                      <span>{g.count}개 샵</span>
                    </div>
                    <ol className={styles.regionList}>
                      {g.top.map((s, i) => (
                        <li key={s.id}><b>{i + 1}</b>{s.name}</li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            </Section>
          )}

          {/* 새로 등록된 샵 | 이벤트 있는 샵 */}
          <div className={styles.twoCol}>
            {fresh.length > 0 && (
              <Section
                icon="sparkle" color="#EF5A5A" title="새로 등록된 샵" desc="최근 등록된 따끈따끈한 샵이에요"
                onSeeAll={() => go('/shops/all?section=new')} compact
              >
                <div className={styles.miniRow} {...newDrag}>
                  {fresh.map(s => (
                    <div key={s.id} className={styles.miniItem}>
                      <ShopMiniCard shop={s} badge="NEW" sub={placeLabel(s)} />
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {events.length > 0 && (
              <Section
                icon="party" color="#7C5AC7" title="이벤트 있는 샵" desc="지금 팝업·콜라보 이벤트가 있는 샵이에요"
                onSeeAll={() => go('/shops/all?section=event')} compact
              >
                <div className={styles.miniRow} {...eventDrag}>
                  {events.map(s => (
                    <div key={s.id} className={styles.miniItem}>
                      <ShopMiniCard shop={s} badge="이벤트" badgeTone="event" sub={s.eventTitle ?? '이벤트 진행 중'} />
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {items.length === 0 && (
            <p className={styles.empty}>아직 등록된 샵이 없어요. 첫 샵을 등록해보세요!</p>
          )}
        </div>

        {/* 우측 레일 */}
        <aside className={styles.rail}>
          {favGroups.length > 0 && (
            <section className={styles.railCard}>
              <div className={styles.railHead}>
                <h3>내 최애 작품 취급샵</h3>
                <button onClick={() => go('/shops/all?section=favorite')}>더보기 ›</button>
              </div>

              {favGroups.map((g, gi) => (
                <div key={g.work.id} className={styles.favGroup}>
                  <button className={styles.favRow} onClick={() => go(`/shops/all?work=${g.work.slug}`)}>
                    <span className={styles.favName}>{g.work.name}</span>
                    <span className={styles.favCount}>취급샵 {g.count}개</span>
                    <span className={styles.chev}>›</span>
                  </button>

                  {/* 첫 작품만 샵 사진까지 펼친다 — 레일이 길어지면 아무도 안 본다 */}
                  {gi === 0 && (
                    <div className={styles.favThumbs}>
                      {g.top.map(s => (
                        <button key={s.id} className={styles.favThumb} onClick={() => go(`/shop/${s.slug}`)}>
                          {s.images[0]
                            ? <img src={s.images[0]} alt="" />
                            : <span className={styles.favNoImg} />}
                          <span className={styles.favShopName} title={s.name}>{s.name}</span>
                          <span className={styles.favHeart}>♥ {compact(s.bookmark_count)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {featured.length > 0 && (
            <section className={styles.railCard}>
              <div className={styles.railHead}>
                <h3>운영자 추천 샵</h3>
                <button onClick={() => go('/shops/all?section=featured')}>더보기 ›</button>
              </div>
              <ol className={styles.featList}>
                {featured.slice(0, 5).map((s, i) => (
                  <li key={s.id} onClick={() => go(`/shop/${s.slug}`)}>
                    <span className={styles.featRank}>{i + 1}</span>
                    {s.images[0] ? <img src={s.images[0]} alt="" /> : <span className={styles.featNoImg} />}
                    <span className={styles.featName} title={s.name}>{s.name}</span>
                    <span className={styles.featRating}>★ {s.rating_avg ? s.rating_avg.toFixed(1) : '-'}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className={styles.cta}>
            <h3>샵 정보를 제보해주세요!</h3>
            <p>새로운 굿즈샵, 팝업스토어 정보를 공유해주시면 타쿠로드가 확인 후 등록해드려요.</p>
            <button onClick={() => go('/shop/new')}>샵 등록하기</button>
          </section>
        </aside>
      </div>
    </div>
  )
}

/* ---- 섹션 껍데기 ---- */
function Section({
  icon, color, title, desc, onSeeAll, compact: isCompact, children,
}: {
  icon: EventIconName
  color: string
  title: string
  desc: string
  onSeeAll: () => void
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={isCompact ? styles.sectionCompact : styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h2><EventIcon name={icon} size={20} color={color} />{title}</h2>
          <p>{desc}</p>
        </div>
        <button onClick={onSeeAll}>전체 보기 ›</button>
      </div>
      {children}
    </section>
  )
}
