'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { useDragScroll } from '@/hooks/useDragScroll'
import { CATEGORIES } from '@/lib/constants/categories'
import { ROUTES } from '@/lib/constants/routes'
import { shopDistrict } from '@/lib/utils/region'
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
  const [error, setError] = useState(false)
  const [regionIdx, setRegionIdx] = useState(0)

  useEffect(() => {
    let alive = true
    getShopHomeItems()
      .then(rows => { if (alive) { setItems(rows); setError(false) } })
      .catch(() => { if (alive) { setItems([]); setError(true) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!user) { setFavTagIds([]); return }
    getMyFavoriteTagIds(user.id).then(setFavTagIds).catch(() => {})
  }, [user])

  const hot = useMemo(() => hotShops(items).slice(0, 3), [items])
  const regions = useMemo(() => regionGroups(items, 20, 30), [items])
  const fresh = useMemo(() => newShops(items), [items])
  const events = useMemo(() => eventShops(items), [items])
  const featured = useMemo(() => featuredShops(items), [items])
  const favGroups = useMemo(() => favoriteWorkGroups(items, favTagIds), [items, favTagIds])

  const eventDrag = useDragScroll()
  const regionDrag = useDragScroll()

  const go = (href: string) => router.push(href)
  const topRegion = regions[0]
  const activeRegion = regions[regionIdx] ?? regions[0]

  if (loading) return <div className={styles.page}><div className={styles.skeleton} /></div>

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          {/* Hero */}
          <section className={styles.hero}>
            <div className={styles.heroMapWrap} aria-hidden>
              <MapArt />
            </div>
            <div className={styles.heroText}>
              <h1>오늘 어디로<br /><span>굿즈 쇼핑 갈까요?</span></h1>
              <p>전국의 애니 · 게임 · 캐릭터 굿즈샵을 타쿠로드에서 한눈에!</p>
              <div className={styles.heroBtns}>
                <button className={styles.heroBtnPrimary} onClick={() => go('/map')}>
                  <EventIcon name="pin" size={15} color="#fff" />내 주변 샵 찾기
                </button>
                <button className={styles.heroBtnGhost} onClick={() => go('/shop/new')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  샵 등록하기
                </button>
              </div>
            </div>
            {topRegion && (
              <button className={styles.heroRegion} onClick={() => go(`/shops/all?region=${encodeURIComponent(topRegion.key)}`)}>
                <img src="/icons/colorfire.png" alt="" width={20} height={20} style={{ display: 'block', flexShrink: 0 }} />
                <span>
                  <small>이번 주 인기 지역</small>
                  <b>{topRegion.district}</b>
                </span>
                <span className={styles.chev} aria-hidden>›</span>
              </button>
            )}
          </section>

          {/* 카테고리 바로가기 */}
          <div>
            <div className={styles.catHead}>
              <h2 className={styles.blockTitle}>카테고리 바로가기</h2>
              <button className={styles.catFilterLink} onClick={() => go('/shops/all?filter=1')}>
                <EventIcon name="tag" size={14} color="var(--accent)" />필터로 찾기
              </button>
            </div>
            <div className={styles.catGrid}>
              {CATEGORIES.slice(0, 7).map(c => (
                <button key={c.slug} className={styles.catTile} onClick={() => go(`/shops/all?cat=${c.slug}`)}>
                  <span className={styles.catIcon} style={{ background: c.bgColor }}>
                    <Icon name={c.icon as any} size={22} />
                  </span>
                  <span className={styles.catName}>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 지금 핫한 샵 — 3열 */}
          {hot.length > 0 && (
            <Section icon="fire" color="var(--accent)" title="지금 핫한 샵" desc="방문, 찜, 후기 기준으로 지금 가장 인기 있는 샵이에요" onSeeAll={() => go('/shops/all?section=hot')}>
              <div className={styles.hotGrid}>
                {hot.map((s, i) => <ShopHomeCard key={s.id} shop={s} rank={i + 1} />)}
              </div>
            </Section>
          )}

          {/* 지역별 인기 샵 — 탭 */}
          {regions.length > 0 && (
            <Section icon="pin" color="#3B9BE8" title="지역별 인기 샵" desc="지역을 골라 인기 샵을 확인해보세요"
              onSeeAll={() => go(activeRegion ? `/shops/all?region=${encodeURIComponent(activeRegion.key)}` : '/shops/all?section=region')}
              headerExtra={<RegionSelect regions={regions} value={Math.min(regionIdx, regions.length - 1)} onChange={setRegionIdx} />}
            >
              {activeRegion && activeRegion.top.length > 0 ? (
                <div className={styles.regionCards} {...regionDrag}>
                  {activeRegion.top.map(s => <RegionShopCard key={s.id} shop={s} onClick={() => go(ROUTES.shop(s.slug))} />)}
                </div>
              ) : (
                <div className={styles.stateMsg}>이 지역에 표시할 샵이 없어요</div>
              )}
            </Section>
          )}

          {/* 새로 등록된 샵 — 캐러셀 */}
          {fresh.length > 0 && (
            <Section icon="sparkle" color="#EF5A5A" title="새로 등록된 샵" desc="최근 등록된 따끈따끈한 샵이에요" onSeeAll={() => go('/shops/all?section=new')}>
              <Carousel>
                {fresh.map(s => (
                  <div key={s.id} className={styles.carItem}><ShopMiniCard shop={s} badge="NEW" sub={placeLabel(s)} /></div>
                ))}
              </Carousel>
            </Section>
          )}

          {/* 이벤트 있는 샵 */}
          {events.length > 0 && (
            <Section icon="party" color="#7C5AC7" title="이벤트 있는 샵" desc="지금 팝업·콜라보 이벤트가 있는 샵이에요" onSeeAll={() => go('/shops/all?section=event')}>
              <div className={styles.miniRow} {...eventDrag}>
                {events.map(s => <div key={s.id} className={styles.miniItem}><ShopMiniCard shop={s} badge="이벤트" badgeTone="event" sub={s.eventTitle ?? '이벤트 진행 중'} image={s.eventCover} /></div>)}
              </div>
            </Section>
          )}

          {error && items.length === 0 && <p className={styles.empty}>샵 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p>}
          {!error && items.length === 0 && <p className={styles.empty}>아직 등록된 샵이 없어요. 첫 샵을 등록해보세요!</p>}
        </div>

        {/* 우측 개인화 레일 */}
        <aside className={styles.rail}>
          <section className={styles.railCard}>
            <div className={styles.railHead}>
              <h3>내 최애 작품 취급샵</h3>
              {favGroups.length > 0 && <button onClick={() => go('/shops/all?section=favorite')}>전체 보기 ›</button>}
            </div>
            {favGroups.length === 0 ? (
              <div className={styles.railEmpty}>{user ? '최애 작품을 정하면 취급샵을 모아드려요' : '로그인하면 최애 작품 취급샵이 보여요'}</div>
            ) : (
              <>
                {/* 대표 작품 1개 — 이미지 강조 */}
                <div className={styles.favFeature}>
                  <button className={styles.favFeatureHead} onClick={() => go(`/shops/all?work=${favGroups[0].work.slug}`)}>
                    <b>{favGroups[0].work.name}</b>
                    <span>취급샵 {favGroups[0].count}곳 ›</span>
                  </button>
                  <div className={styles.favThumbs}>
                    {favGroups[0].top.slice(0, 3).map(s => (
                      <button key={s.id} className={styles.favThumb} onClick={() => go(ROUTES.shop(s.slug))} title={s.name}>
                        {s.images[0] ? <img src={s.images[0]} alt={s.name} loading="lazy" /> : <span className={styles.favNoImg} />}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 나머지 작품 — 텍스트 행 */}
                {favGroups.length > 1 && (
                  <ul className={styles.favRows}>
                    {favGroups.slice(1).map(g => (
                      <li key={g.work.id}>
                        <button className={styles.favRow} onClick={() => go(`/shops/all?work=${g.work.slug}`)}>
                          <span className={styles.favName}>{g.work.name}</span>
                          <span className={styles.favCount}>취급샵 {g.count}곳</span>
                          <span className={styles.chev} aria-hidden>›</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          <section className={styles.cta}>
            <h3>새로운 샵을 알고 있나요?</h3>
            <p>숨겨진 굿즈샵, 팝업스토어 정보를 공유해주시면 타쿠로드가 확인 후 등록해드려요.</p>
            <button onClick={() => go('/shop/new')}>샵 제보하기</button>
          </section>

          {featured.length > 0 && (
            <section className={styles.railCard}>
              <div className={styles.railHead}>
                <h3>운영자 추천 샵</h3>
                <button onClick={() => go('/shops/all?section=featured')}>전체 보기 ›</button>
              </div>
              <ol className={styles.featList}>
                {featured.slice(0, 5).map((s, i) => (
                  <li key={s.id} onClick={() => go(ROUTES.shop(s.slug))}>
                    <span className={styles.featRank}>{i + 1}</span>
                    {s.images[0] ? <img src={s.images[0]} alt="" loading="lazy" /> : <span className={styles.featNoImg} />}
                    <span className={styles.featName} title={s.name}>{s.name}</span>
                    {s.rating_count > 0 && <span className={styles.featRating}>★ {(s.rating_avg ?? 0).toFixed(1)}</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

/* ── 지역 선택 드롭다운 (지역이 많아져도 감당 가능) ── */
function RegionSelect({ regions, value, onChange }: {
  regions: { key: string; district: string; count: number }[]
  value: number
  onChange: (i: number) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  const cur = regions[value] ?? regions[0]
  return (
    <div className={styles.regionSelect} ref={ref}>
      <button className={styles.regionSelectBtn} onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <EventIcon name="pin" size={14} color="var(--accent)" />
        {cur?.district ?? '지역 선택'}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className={styles.regionMenu} role="listbox">
          {regions.map((g, i) => (
            <button key={g.key} role="option" aria-selected={i === value} className={styles.regionMenuItem} onClick={() => { onChange(i); setOpen(false) }}>
              <span>{g.district}</span>
              <em>{g.count}</em>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── 지역 탭용 가로형 샵 카드 ── */
function RegionShopCard({ shop, onClick }: { shop: ShopHomeItem; onClick: () => void }) {
  const district = shopDistrict(shop) || placeLabel(shop)
  return (
    <button className={styles.regionShop} onClick={onClick}>
      {shop.images[0] ? <img src={shop.images[0]} alt="" loading="lazy" /> : <span className={styles.regionShopNo} />}
      <span className={styles.regionShopBody}>
        <span className={styles.regionShopName} title={shop.name}>{shop.name}</span>
        <span className={styles.regionShopMeta}>
          {district}
          {shop.rating_count > 0 && <> · <span className={styles.regionShopRate}>★ {(shop.rating_avg ?? 0).toFixed(1)}</span> ({compact(shop.rating_count)})</>}
        </span>
      </span>
    </button>
  )
}

/* ── 캐러셀 (드래그 + 좌우 버튼 · 키보드 접근) ── */
function Carousel({ children }: { children: React.ReactNode }) {
  const drag = useDragScroll()
  const ref = drag.ref
  const [ends, setEnds] = useState({ start: true, end: false })
  const update = () => {
    const el = ref.current
    if (!el) return
    setEnds({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 })
  }
  useEffect(() => { update(); const el = ref.current; if (!el) return; const on = () => update(); el.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on); return () => { el.removeEventListener('scroll', on); window.removeEventListener('resize', on) } }, [])
  const scroll = (dir: -1 | 1) => { const el = ref.current; if (el) el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 300), behavior: 'smooth' }) }
  return (
    <div className={styles.carousel}>
      <button className={`${styles.carBtn} ${styles.carPrev}`} onClick={() => scroll(-1)} disabled={ends.start} aria-label="이전">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <div className={styles.carRow} {...drag}>{children}</div>
      <button className={`${styles.carBtn} ${styles.carNext}`} onClick={() => scroll(1)} disabled={ends.end} aria-label="다음">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  )
}

/* ── 히어로 지도 일러스트 (외부 지도 API 미사용) — 핑크 배경에 녹아드는 톤 ── */
function MapArt() {
  return (
    <svg viewBox="0 0 720 230" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {/* 히어로 핑크와 이어지는 옅은 핑크 베이스 */}
      <rect width="720" height="230" fill="#FBE4EE" />
      {/* 도로 — 반투명 흰색이라 배경 위에 부드럽게 */}
      <g stroke="#ffffff" strokeLinecap="round" opacity="0.6">
        <line x1="0" y1="58" x2="720" y2="50" strokeWidth="9" />
        <line x1="0" y1="150" x2="720" y2="160" strokeWidth="9" />
        <line x1="150" y1="0" x2="132" y2="230" strokeWidth="9" />
        <line x1="380" y1="0" x2="392" y2="230" strokeWidth="9" />
        <line x1="566" y1="0" x2="548" y2="230" strokeWidth="9" />
      </g>
      <g stroke="#ffffff" strokeLinecap="round" opacity="0.4">
        <line x1="0" y1="106" x2="720" y2="108" strokeWidth="4" />
        <line x1="266" y1="0" x2="274" y2="230" strokeWidth="4" />
        <line x1="470" y1="0" x2="462" y2="230" strokeWidth="4" />
        <line x1="650" y1="0" x2="640" y2="230" strokeWidth="4" />
      </g>
      {/* 옅은 블록·공원 */}
      <rect x="410" y="20" width="52" height="40" rx="9" fill="#ffffff" opacity="0.3" />
      <rect x="600" y="18" width="58" height="44" rx="9" fill="#D9EBD3" opacity="0.6" />
      <rect x="500" y="168" width="66" height="48" rx="9" fill="#ffffff" opacity="0.28" />
      <rect x="298" y="172" width="60" height="44" rx="9" fill="#D9EBD3" opacity="0.5" />
      {/* 핀 — 텍스트 페이드가 걷히는 우측에 배치 */}
      {[[452, 78], [604, 60], [520, 140]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x},${y})`}>
          <ellipse cx="0" cy="4" rx="8" ry="3.5" fill="rgba(0,0,0,.12)" />
          <path d="M0 0 C-9 -14 -14 -21 -14 -28 A14 14 0 1 1 14 -28 C14 -21 9 -14 0 0 Z" fill="#e8006f" stroke="#fff" strokeWidth="3" />
          <circle cx="0" cy="-28" r="5.5" fill="#fff" />
        </g>
      ))}
    </svg>
  )
}

/* ── 섹션 껍데기 ── */
function Section({ icon, color, title, desc, onSeeAll, compact: isCompact, headerExtra, children }: {
  icon: EventIconName; color: string; title: string; desc: string; onSeeAll: () => void; compact?: boolean; headerExtra?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section className={isCompact ? styles.sectionCompact : styles.section}>
      <div className={styles.sectionHead}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.titleRow}>
            <h2><EventIcon name={icon} size={20} color={color} />{title}</h2>
            {headerExtra}
          </div>
          <p>{desc}</p>
        </div>
        <button onClick={onSeeAll}>전체 보기 ›</button>
      </div>
      {children}
    </section>
  )
}
