'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getPublicRoutes, toggleRouteSave, getMySavedRouteIds, getSavedRoutes } from '@/services/routeService'
import { getMyFavoriteTagIds } from '@/services/shopHomeService'
import { formatDistance } from '@/hooks/useCurrentLocation'
import RouteThumb from './RouteThumb'
import RouteResultCard, { HeartIcon } from './RouteResultCard'
import { rtStops, rtRegions, fmtDur, metaShort } from './routeMeta'
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

/* 소개문: 작성자 소개가 있으면 그대로, 없으면 실제 지역+스팟수로 짧은 문구, 둘 다 없으면 숨김 */
function heroIntro(r: any): string | null {
  if (r.description && String(r.description).trim()) return String(r.description).trim()
  const region = rtRegions(r)[0]
  const n = r.route_shops?.length ?? 0
  if (region && n > 0) return `${region} 일대의 스팟 ${n}곳을 둘러보는 코스예요.`
  return null
}

export default function RouteExplorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savedRoutes, setSavedRoutes] = useState<any[]>([])
  const [favTagIds, setFavTagIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

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

  const infoScore = (r: any) => (r.route_shops?.length ?? 0) + (r.route_tips?.[0]?.count ?? 0)
  const popular = useMemo(() => [...routes].sort((a, b) => ((b.likes ?? 0) - (a.likes ?? 0)) || (infoScore(b) - infoScore(a))), [routes])
  const recent = useMemo(() => [...routes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [routes])
  const official = useMemo(() => routes.filter(r => r.is_official), [routes])
  const taste = useMemo(() => routes.filter(r => r.primary_tag_id && favTagIds.has(r.primary_tag_id)), [routes, favTagIds])

  const heroList = useMemo(() => (official.length ? official : popular).slice(0, 5), [official, popular])
  const [heroIdx, setHeroIdx] = useState(0)
  useEffect(() => { setHeroIdx(0) }, [heroList.length])
  useEffect(() => {
    if (heroList.length <= 1) return
    const id = setInterval(() => setHeroIdx(i => (i + 1) % heroList.length), 6000)
    return () => clearInterval(id)
  }, [heroList.length])
  const hero = heroList[heroIdx] ?? heroList[0]

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
                    {hero.total_distance_m ? <span title="스팟 간 직선 거리 합계예요."><MaskIcon name="route" size={15} color="var(--accent)" />{formatDistance(hero.total_distance_m)}</span> : null}
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
