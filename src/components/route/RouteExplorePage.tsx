'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getPublicRoutes, toggleRouteSave, getMySavedRouteIds, getSavedRoutes } from '@/services/routeService'
import { getMyFavoriteTagIds } from '@/services/shopHomeService'
import { formatDistance, calcDistance, useCurrentLocation } from '@/hooks/useCurrentLocation'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import AppIcon from '@/components/tds/AppIcon'
import RouteThumb from './RouteThumb'
import RouteResultCard, { HeartIcon } from './RouteResultCard'
import { rtStops, rtRegions, fmtDur, metaShort } from './routeMeta'
import { buildRouteHero, byRoutePopularity, routeInfoScore, ROUTE_HERO_MAX } from '@/lib/route/heroOrder'
import styles from './RouteExplorePage.module.css'

/* 마스크 아이콘 (히어로 메타용) */
function MaskIcon({ name, size = 15, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  return (
    <span aria-hidden style={{
      width: size, height: size, display: 'inline-block', flexShrink: 0, verticalAlign: '-2px', backgroundColor: color,
      WebkitMaskImage: `url(/icons/${name}.png)`, maskImage: `url(/icons/${name}.png)`,
      WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskSize: 'contain', maskSize: 'contain',
      WebkitMaskPosition: 'center', maskPosition: 'center',
    }} />
  )
}
const ChevR = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
)
const SearchSvg = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
)

/* 소개문: 작성자 소개가 있으면 그대로, 없으면 실제 지역+스팟수로 짧은 문구, 둘 다 없으면 숨김 */
function heroIntro(r: any): string | null {
  if (r.description && String(r.description).trim()) return String(r.description).trim()
  const region = rtRegions(r)[0]
  const n = r.route_shops?.length ?? 0
  if (region && n > 0) return `${region} 일대의 스팟 ${n}곳을 둘러보는 코스예요.`
  return null
}

/* 필터 칩 — 아래 메인 목록의 조회·정렬 기준 */
type SortKey = 'recommended' | 'popular' | 'new' | 'nearby'
const SORT_TABS: { key: SortKey; label: string }[] = [
  { key: 'recommended', label: '추천' },
  { key: 'popular', label: '인기' },
  { key: 'new', label: '신규' },
  { key: 'nearby', label: '내 주변' },
]
const SORT_TITLE: Record<SortKey, string> = {
  recommended: '추천 루트', popular: '지금 인기 있는 루트', new: '새로 등록된 루트', nearby: '내 주변 루트',
}

export default function RouteExplorePage() {
  const router = useRouter()
  const params = useSearchParams()
  const isDesktop = useIsDesktop()
  const { user } = useAuth()
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savedRoutes, setSavedRoutes] = useState<any[]>([])
  const [favTagIds, setFavTagIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  // 위치 (내 주변 필터용)
  const { location, error: locError, requestLocation } = useCurrentLocation()
  const nearbyReqRef = useRef(false)

  useEffect(() => {
    setLoading(true); setError(false)
    getPublicRoutes().then(setRoutes).catch(() => setError(true)).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    if (!user) { setSavedIds(new Set()); setSavedRoutes([]); setFavTagIds(new Set()); return }
    getMySavedRouteIds(user.id).then(ids => setSavedIds(new Set(ids))).catch(() => {})
    getSavedRoutes(user.id).then(setSavedRoutes).catch(() => {})
    getMyFavoriteTagIds(user.id).then(ids => setFavTagIds(new Set(ids))).catch(() => {})
  }, [user])

  // 인기 정렬 규칙은 lib/route/heroOrder 한 곳에만 둔다 (관리자 미리보기와 같은 결과를 내야 해서)
  const infoScore = routeInfoScore
  const popular = useMemo(() => [...routes].sort(byRoutePopularity), [routes])
  const recent = useMemo(() => [...routes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [routes])
  // (히어로는 buildRouteHero가 추천 우선 배치까지 함께 처리한다)
  const taste = useMemo(() => routes.filter(r => r.primary_tag_id && favTagIds.has(r.primary_tag_id)), [routes, favTagIds])

  // 추천: 운영추천(is_official) + 내 관심작품 우선, 그 뒤 저장수. (임의 점수 없이 실제 필드만)
  const recommended = useMemo(() => {
    const rank = (r: any) => (r.is_official ? 2 : 0) + (r.primary_tag_id && favTagIds.has(r.primary_tag_id) ? 1 : 0)
    return [...routes].sort((a, b) => (rank(b) - rank(a)) || ((b.likes ?? 0) - (a.likes ?? 0)) || (infoScore(b) - infoScore(a)))
  }, [routes, favTagIds])
  // 내 주변: 현재 위치 ↔ 루트 첫 스팟 좌표 거리순
  const nearby = useMemo(() => {
    if (!location) return []
    const dist = (r: any) => { const s = rtStops(r)[0]; return s ? calcDistance(location.lat, location.lng, s.lat, s.lng) : Infinity }
    return [...routes].map(r => [r, dist(r)] as const).sort((a, b) => a[1] - b[1]).map(x => x[0])
  }, [routes, location])

  /* 히어로: 추천 루트를 앞에 두고 남는 자리를 인기순으로 채운다 (id 중복 제거, 최대 5).
     예전에는 추천이 하나라도 있으면 그것만 보여줘서, 한 개만 지정해도 히어로가
     한 장으로 줄고 자동 회전이 멈췄다.
     계산은 buildRouteHero 하나로 모았다 — 관리자 미리보기가 같은 함수를 쓴다. */
  const heroList = useMemo(() => buildRouteHero(routes, ROUTE_HERO_MAX), [routes])
  const [heroIdx, setHeroIdx] = useState(0)
  useEffect(() => { setHeroIdx(0) }, [heroList.length])
  useEffect(() => {
    if (heroList.length <= 1) return
    const id = setInterval(() => setHeroIdx(i => (i + 1) % heroList.length), 6000)
    return () => clearInterval(id)
  }, [heroList.length])
  const hero = heroList[heroIdx] ?? heroList[0]

  // 현재 정렬 (URL ?sort= 유지)
  const sortParam = params?.get('sort')
  const sort: SortKey = (['popular', 'new', 'nearby'] as string[]).includes(sortParam ?? '') ? (sortParam as SortKey) : 'recommended'
  const setSort = (next: SortKey) => {
    if (next === sort) return   // 같은 칩 재클릭 → 무시
    const p = new URLSearchParams(params?.toString() ?? '')
    if (next === 'recommended') p.delete('sort'); else p.set('sort', next)
    router.replace(p.toString() ? `/routes?${p}` : '/routes', { scroll: false })
    if (next === 'nearby' && !location) { nearbyReqRef.current = true; requestLocation() }
  }
  // 내 주변 첫 진입(새로고침/딥링크) 시 위치 1회 요청
  useEffect(() => {
    if (sort === 'nearby' && !location && !locError && !nearbyReqRef.current) { nearbyReqRef.current = true; requestLocation() }
  }, [sort, location, locError, requestLocation])

  const byTag = useMemo(() => {
    const m = new Map<string, number>()
    routes.forEach(r => { const n = r.primary_tag?.name; if (n) m.set(n, (m.get(n) ?? 0) + 1) })
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [routes])
  const byRegion = useMemo(() => {
    const m = new Map<string, number>()
    routes.forEach(r => rtRegions(r).forEach(x => m.set(x, (m.get(x) ?? 0) + 1)))
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [routes])
  const tasteRecos = useMemo(() => (taste.length ? taste : popular).slice(0, 3), [taste, popular])
  const recentTop = useMemo(() => recent.slice(0, 4), [recent])

  function go(r: any) { const t = r.share_token ?? r.shareToken; if (t) router.push(`/route/${t}`) }
  async function onSave(e: React.MouseEvent, r: any) {
    e.stopPropagation()
    if (!user) { router.push('/login'); return }
    const was = savedIds.has(r.id); const d = was ? -1 : 1
    setSavedIds(prev => { const n = new Set(prev); was ? n.delete(r.id) : n.add(r.id); return n })
    setRoutes(prev => prev.map(x => x.id === r.id ? { ...x, likes: Math.max(0, (x.likes ?? 0) + d) } : x))
    await toggleRouteSave(r.id, user.id).catch(() => {
      setSavedIds(prev => { const n = new Set(prev); was ? n.add(r.id) : n.delete(r.id); return n })
      setRoutes(prev => prev.map(x => x.id === r.id ? { ...x, likes: Math.max(0, (x.likes ?? 0) - d) } : x))
    })
  }
  const toAll = (qs?: string) => router.push(qs ? `/routes/all?${qs}` : '/routes/all')
  const submitSearch = (e: React.FormEvent) => { e.preventDefault(); toAll(search.trim() ? `q=${encodeURIComponent(search.trim())}` : undefined) }

  if (loading) return <div className={styles.loading}>루트 불러오는 중…</div>

  /* ───────────── 📱 모바일: 탐색 중심 홈 ───────────── */
  if (!isDesktop) {
    const mainRaw = sort === 'popular' ? popular : sort === 'new' ? recent : sort === 'nearby' ? nearby : recommended
    const mainList = sort === 'recommended' && hero ? mainRaw.filter(r => r.id !== hero.id) : mainRaw
    const nearbyWaiting = sort === 'nearby' && !location
    return (
      <div className={styles.mwrap}>
        <div className={styles.mhead}>
          <h1 className={styles.mtitle}>
            <img src="/icons/colormap.png" alt="" width={24} height={24} style={{ display: 'block' }} />루트
          </h1>
          <button className={styles.mcreate} onClick={() => router.push('/route/new')}>+ 루트 만들기</button>
        </div>
        <p className={styles.msub}>나에게 맞는 굿즈 코스를 찾아보세요</p>

        <form className={styles.msearch} onSubmit={submitSearch}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="지역 · 작품 · 루트 검색" aria-label="루트 검색" />
          <button type="submit" className={styles.msearchBtn} aria-label="검색"><SearchSvg /></button>
        </form>

        <div className={styles.mchips} role="tablist" aria-label="루트 정렬">
          {SORT_TABS.map(t => (
            <button key={t.key} role="tab" aria-selected={t.key === sort}
              className={t.key === sort ? styles.mchipOn : styles.mchip} onClick={() => setSort(t.key)}>{t.label}</button>
          ))}
        </div>

        {error ? (
          <div className={styles.mempty}>루트를 불러오지 못했어요.</div>
        ) : routes.length === 0 ? (
          <div className={styles.mempty}>아직 공개된 루트가 없어요.</div>
        ) : (
          <>
            {sort === 'recommended' && hero && (
              <section className={styles.mhero} aria-label="이번 주 추천 루트">
                <button className={styles.mheroMap} onClick={() => go(hero)} aria-label={`${hero.title} 지도 미리보기`}>
                  <RouteThumb stops={rtStops(hero)} showEnds height={184} variant="preview" />
                </button>
                <div className={styles.mheroBody}>
                  <span className={styles.mheroBadge}>이번 주 추천</span>
                  <h2 className={styles.mheroTitle}>{hero.title}</h2>
                  {heroIntro(hero) && <p className={styles.mheroDesc}>{heroIntro(hero)}</p>}
                  <div className={styles.mheroMeta}>
                    {rtRegions(hero)[0] && <span><MaskIcon name="map" size={14} color="var(--accent)" />{rtRegions(hero)[0]}</span>}
                    <span><MaskIcon name="shop" size={14} color="var(--accent)" />{hero.route_shops?.length ?? 0}곳</span>
                    {fmtDur(hero.total_duration_min) && <span><MaskIcon name="clock" size={14} color="var(--accent)" />{fmtDur(hero.total_duration_min)}</span>}
                    {hero.total_distance_m ? <span><AppIcon name="route" size={14} color="var(--accent)" />{formatDistance(hero.total_distance_m)}</span> : null}
                  </div>
                  <div className={styles.mheroBtns}>
                    <button className={styles.mheroPrimary} onClick={() => go(hero)}>루트 보기 <ChevR /></button>
                    <button className={styles.mheroSave} onClick={e => onSave(e, hero)} aria-pressed={savedIds.has(hero.id)} aria-label={savedIds.has(hero.id) ? '저장됨' : '저장'}>
                      <HeartIcon size={18} filled={savedIds.has(hero.id)} color={savedIds.has(hero.id) ? 'var(--accent)' : 'var(--muted)'} />
                    </button>
                  </div>
                </div>
              </section>
            )}

            <section className={styles.mlist}>
              <h2 className={styles.mlistTitle}>{SORT_TITLE[sort]}</h2>
              {nearbyWaiting ? (
                locError ? (
                  <div className={styles.mlocFail}>
                    <p>위치를 확인할 수 없어요.</p>
                    <span>위치 권한을 허용하거나 지역을 직접 골라 둘러보세요.</span>
                    <div className={styles.mlocBtns}>
                      <button className={styles.mlocRetry} onClick={() => { nearbyReqRef.current = true; requestLocation() }}>다시 시도</button>
                      <button className={styles.mlocRegion} onClick={() => toAll()}>지역 선택</button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.mcards} aria-busy="true">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.mskeleton} />)}
                  </div>
                )
              ) : mainList.length === 0 ? (
                <div className={styles.mempty}>
                  <p>표시할 루트가 없어요.</p>
                  <div className={styles.memptyChips}>
                    {SORT_TABS.filter(t => t.key !== sort).map(t => (
                      <button key={t.key} onClick={() => setSort(t.key)}>{t.label} 보기</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.mcards}>
                  {mainList.map(r => (
                    <RouteResultCard key={r.id} route={r} view="list" mapVariant="preview" saved={savedIds.has(r.id)} onOpen={() => go(r)} onToggleSave={e => onSave(e, r)} />
                  ))}
                </div>
              )}
            </section>

            {byTag.length > 0 && (
              <section className={styles.mDiscover}>
                <h2 className={styles.mlistTitle}>작품으로 찾아보기</h2>
                <div className={styles.tileRow}>
                  {byTag.slice(0, 4).map(([t, n]) => (
                    <button key={t} className={styles.tile} onClick={() => toAll(`work=${encodeURIComponent(t)}`)}>
                      <span className={styles.tileName}>{t}</span><span className={styles.tileSub}>루트 {n}개</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {byRegion.length > 0 && (
              <section className={styles.mDiscover}>
                <h2 className={styles.mlistTitle}>지역으로 떠나기</h2>
                <div className={styles.tileRow}>
                  {byRegion.slice(0, 4).map(([r, n]) => (
                    <button key={r} className={styles.tile} onClick={() => toAll(`region=${encodeURIComponent(r)}`)}>
                      <span className={styles.tileName}>{r}</span><span className={styles.tileSub}>루트 {n}개</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    )
  }

  /* ───────────── 💻 데스크톱: 기존 레이아웃 (미변경) ───────────── */
  return (
    <div className={styles.wrap}>
      <div className={styles.main}>
        <div className={styles.head}>
          <h1 className={styles.title}>
            <img src="/icons/colormap.png" alt="" width={26} height={26} style={{ display: 'block' }} />루트
          </h1>
          <div className={styles.headBtns}>
            <button className={styles.allLink} onClick={() => toAll()}>전체 루트 보기<ChevR /></button>
            <button className={styles.createBtn} onClick={() => router.push('/route/new')}>+ 루트 만들기</button>
          </div>
        </div>

        <form className={styles.searchRow} onSubmit={submitSearch}>
          <div className={styles.search}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="루트·지역·작품 검색" aria-label="루트 검색" />
          </div>
          <button type="submit" className={styles.searchBtn}>검색</button>
        </form>

        {error ? (
          <div className={styles.empty}>루트를 불러오지 못했어요.</div>
        ) : routes.length === 0 ? (
          <div className={styles.empty}>아직 공개된 루트가 없어요.</div>
        ) : (
          <>
            {hero && (
              <div className={styles.hero}>
                <div className={styles.heroText}>
                  <span className={styles.heroBadge}>이번 주 추천 루트</span>
                  <h2 className={styles.heroTitle}>{hero.title}</h2>
                  {heroIntro(hero) && <p className={styles.heroDesc}>{heroIntro(hero)}</p>}
                  <div className={styles.heroMeta}>
                    {rtRegions(hero)[0] && <span><MaskIcon name="map" size={15} color="var(--accent)" />{rtRegions(hero)[0]}</span>}
                    <span><MaskIcon name="shop" size={15} color="var(--accent)" />{hero.route_shops?.length ?? 0}곳</span>
                    {fmtDur(hero.total_duration_min) && <span title="스팟 간 도보 이동 시간이에요. 방문 체류 시간은 별도예요."><MaskIcon name="clock" size={15} color="var(--accent)" />이동 {fmtDur(hero.total_duration_min)}</span>}
                    {hero.total_distance_m ? <span title="스팟 간 직선 거리 합계예요."><AppIcon name="route" size={15} color="var(--accent)" />{formatDistance(hero.total_distance_m)}</span> : null}
                  </div>
                  <div className={styles.heroBtns}>
                    <button className={styles.heroPrimary} onClick={() => go(hero)}>루트 보기 <ChevR /></button>
                    <button className={styles.heroGhost} onClick={e => onSave(e, hero)}>
                      <HeartIcon size={15} filled={savedIds.has(hero.id)} color="var(--accent)" />{savedIds.has(hero.id) ? '저장됨' : '저장하기'}
                    </button>
                  </div>
                </div>
                <div className={styles.heroMap}>
                  <RouteThumb stops={rtStops(hero)} showEnds height={280} />
                  {heroList.length > 1 && (
                    <div className={styles.heroDots}>
                      {heroList.map((_, i) => (
                        <button key={i} aria-label={`${i + 1}번째 추천`} className={i === heroIdx ? styles.heroDotOn : styles.heroDot} onClick={() => setHeroIdx(i)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tasteRecos.length > 0 && (
              <Section title={taste.length ? '취향에 맞는 추천 루트' : '지금 인기 있는 루트'} desc={taste.length ? '회원님의 취향을 반영한 맞춤 루트예요.' : undefined} onMore={() => toAll(taste.length ? undefined : 'sort=popular')}>
                <div className={styles.grid3}>
                  {tasteRecos.map(r => <RouteResultCard key={r.id} route={r} saved={savedIds.has(r.id)} onOpen={() => go(r)} onToggleSave={e => onSave(e, r)} />)}
                </div>
              </Section>
            )}

            {recentTop.length > 0 && (
              <Section title="새로 등록된 루트" onMore={() => toAll('sort=latest')}>
                <div className={styles.grid3}>
                  {recentTop.map(r => <RouteResultCard key={r.id} route={r} saved={savedIds.has(r.id)} onOpen={() => go(r)} onToggleSave={e => onSave(e, r)} />)}
                </div>
              </Section>
            )}

            {byTag.length > 0 && (
              <Section title="작품으로 찾아보기">
                <div className={styles.tileRow}>
                  {byTag.slice(0, 4).map(([t, n]) => (
                    <button key={t} className={styles.tile} onClick={() => toAll(`work=${encodeURIComponent(t)}`)}>
                      <span className={styles.tileName}>{t}</span><span className={styles.tileSub}>루트 {n}개</span>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {byRegion.length > 0 && (
              <Section title="지역으로 떠나기">
                <div className={styles.tileRow}>
                  {byRegion.slice(0, 4).map(([r, n]) => (
                    <button key={r} className={styles.tile} onClick={() => toAll(`region=${encodeURIComponent(r)}`)}>
                      <span className={styles.tileName}>{r}</span><span className={styles.tileSub}>루트 {n}개</span>
                    </button>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>

      {/* 우측 레일 */}
      <aside className={styles.rail}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>오늘의 인기 루트</h3>
            <button className={styles.panelMore} onClick={() => toAll('sort=popular')}>전체 보기<ChevR size={12} /></button>
          </div>
          {popular.slice(0, 5).map((r, i) => (
            <button key={r.id} className={styles.railItem} onClick={() => go(r)}>
              <div className={styles.railThumb}>
                <RouteThumb stops={rtStops(r)} height={58} />
                <span className={`${styles.railRank} ${i < 3 ? styles.railRankTop : styles.railRankNorm}`}>{i + 1}</span>
              </div>
              <div className={styles.railInfo}>
                <div className={styles.railTitle}>{r.title}</div>
                <div className={styles.railMeta}>{metaShort(r)}</div>
                <div className={styles.railLikes}><HeartIcon size={11} filled color="var(--accent)" />{r.likes ?? 0}</div>
              </div>
            </button>
          ))}
          {popular.length === 0 && <p className={styles.railEmpty}>아직 루트가 없어요</p>}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>저장한 루트</h3>
            {user && savedRoutes.length > 0 && <button className={styles.panelMore} onClick={() => router.push('/profile?tab=savedroutes')}>전체 보기<ChevR size={12} /></button>}
          </div>
          {!user ? (
            <>
              <p className={styles.railEmpty}>로그인하면 저장한 루트를 모아볼 수 있어요.</p>
              <button className={styles.railLogin} onClick={() => router.push('/login')}>로그인</button>
            </>
          ) : savedRoutes.length === 0 ? (
            <p className={styles.railEmpty}>마음에 드는 루트를 저장해보세요!</p>
          ) : (
            savedRoutes.slice(0, 4).map(r => (
              <button key={r.id} className={styles.railItem} onClick={() => go(r)}>
                <div className={styles.railThumb}><RouteThumb stops={rtStops(r)} height={58} /></div>
                <div className={styles.railInfo}>
                  <div className={styles.railTitle}>{r.title}</div>
                  <div className={styles.railMeta}>{metaShort(r)}</div>
                  <div className={styles.railLikes}><HeartIcon size={11} filled color="var(--accent)" />{r.likes ?? 0}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  )
}

function Section({ title, desc, children, onMore, moreLabel }: {
  title: string; desc?: string; children: React.ReactNode; onMore?: () => void; moreLabel?: string
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {desc && <p className={styles.sectionDesc}>{desc}</p>}
        </div>
        {onMore && <button className={styles.more} onClick={onMore}>{moreLabel ?? '전체 보기'}<ChevR /></button>}
      </div>
      {children}
    </div>
  )
}
