'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { formatDistance } from '@/hooks/useCurrentLocation'
import { getRouteDifficulty } from '@/lib/utils/routeDifficulty'
import { useAuth } from '@/components/layout/AuthProvider'
import { toggleRouteSave, getMySavedRouteIds, toggleRouteShare } from '@/services/routeService'
import { useRouter } from 'next/navigation'
import styles from './RouteDetailPage.module.css'

const RouteMap = dynamic(() => import('./RouteMap'), { ssr: false })

interface Props {
  route: any
}

type TabKey = 'intro' | 'spots' | 'course' | 'tips' | 'reviews' | 'related'

const TABS: { key: TabKey; label: string; ready: boolean }[] = [
  { key: 'intro', label: '루트 소개', ready: true },
  { key: 'spots', label: '스팟', ready: true },
  { key: 'course', label: '코스 정보', ready: false },
  { key: 'tips', label: '이용 팁', ready: false },
  { key: 'reviews', label: '리뷰', ready: false },
  { key: 'related', label: '관련 루트', ready: false },
]

const VISIBLE_SPOTS = 4

function formatDuration(min: number | null | undefined): string {
  if (min == null) return '-'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `약 ${h}시간 ${m}분`
  if (h) return `약 ${h}시간`
  return `약 ${m}분`
}

function resolveDifficulty(route: any): { label: string; color: string; icon: string } | null {
  const n = route.official_difficulty
  if (n === 1) return { label: '가볍게', color: '#0E7A63', icon: '🌤️' }
  if (n === 2) return { label: '반나절', color: '#835700', icon: '☀️' }
  if (n === 3) return { label: '하루코스', color: '#A23E18', icon: '🔥' }
  const d = getRouteDifficulty(route.total_duration_min)
  if (!d) return null
  const icon = d.level === 'light' ? '🌤️' : d.level === 'half' ? '☀️' : '🔥'
  return { label: d.label, color: d.color, icon }
}

export default function RouteDetailPage({ route }: Props) {
  const router = useRouter()
  const { user } = useAuth()

  const [tab, setTab] = useState<TabKey>('intro')
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savingBusy, setSavingBusy] = useState(false)
  const [shared, setShared] = useState(!!route.is_shared)
  const [publishBusy, setPublishBusy] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [showRouteMapMenu, setShowRouteMapMenu] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [showMapMenu, setShowMapMenu] = useState<any>(null)

  const isAuthor = !!user && user.id === route.user_id

  const sortedShops = (route.route_shops ?? [])
    .slice()
    .sort((a: any, b: any) => a.sort_order - b.sort_order)

  const shopsWithCoords = sortedShops
    .map((rs: any) => rs.shops)
    .filter((s: any) => s && s.lat && s.lng)

  const diff = resolveDifficulty(route)
  const spotCount = sortedShops.length
  const likes = route.likes ?? 0

  // 저장 여부 초기 로드
  useEffect(() => {
    if (!user) { setSaved(false); return }
    let alive = true
    getMySavedRouteIds(user.id)
      .then(ids => { if (alive) setSaved(ids.includes(route.id)) })
      .catch(() => {})
    return () => { alive = false }
  }, [user, route.id])

  async function handleSave() {
    if (!user) { router.push('/login'); return }
    if (savingBusy) return
    setSavingBusy(true)
    // 낙관적 토글
    setSaved(prev => !prev)
    try {
      const next = await toggleRouteSave(route.id, user.id)
      setSaved(next)
    } catch {
      setSaved(prev => !prev) // 롤백
    } finally {
      setSavingBusy(false)
    }
  }

  async function handleTogglePublish() {
    if (!user || publishBusy) return
    setPublishBusy(true)
    const next = !shared
    const ok = await toggleRouteShare(route.id, user.id, next)
    setPublishBusy(false)
    if (ok) setShared(next)
    setPublishOpen(false)
  }

  // ---- 지도 앱 길찾기 (기존 로직 흡수) ----
  function openRouteInKakao() {
    if (shopsWithCoords.length === 0) return
    const first = shopsWithCoords[0]
    const dest = shopsWithCoords[shopsWithCoords.length - 1]
    const url = `https://map.kakao.com/link/from/${encodeURIComponent(first.name)},${first.lat},${first.lng}/to/${encodeURIComponent(dest.name)},${dest.lat},${dest.lng}`
    window.open(url, '_blank')
    setShowRouteMapMenu(false)
  }

  function openRouteInGoogle() {
    if (shopsWithCoords.length === 0) return
    const origin = shopsWithCoords[0]
    const destination = shopsWithCoords[shopsWithCoords.length - 1]
    const waypoints = shopsWithCoords.slice(1, -1)
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin.name)}&destination=${encodeURIComponent(destination.name)}&travelmode=walking`
    if (waypoints.length > 0) {
      url += `&waypoints=${waypoints.map((w: any) => encodeURIComponent(w.name)).join('|')}`
    }
    window.open(url, '_blank')
    setShowRouteMapMenu(false)
  }

  function openSingleShop(shop: any, app: 'kakao' | 'naver' | 'google') {
    if (app === 'kakao') {
      window.open(`https://map.kakao.com/link/to/${encodeURIComponent(shop.name)},${shop.lat},${shop.lng}`, '_blank')
    } else if (app === 'naver') {
      window.open(`https://map.naver.com/p/search/${encodeURIComponent(shop.name)}`, '_blank')
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shop.name + ' ' + (shop.addr ?? ''))}&travelmode=walking`, '_blank')
    }
    setShowMapMenu(null)
  }

  // ---- 공유 ----
  function currentUrl() {
    return typeof window !== 'undefined' ? window.location.href : ''
  }
  async function shareNative() {
    const url = currentUrl()
    if (navigator.share) {
      try { await navigator.share({ title: route.title, url }) } catch {}
    }
    setShowShareMenu(false)
  }
  function shareX() {
    const url = currentUrl()
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(route.title)}&url=${encodeURIComponent(url)}`, '_blank')
    setShowShareMenu(false)
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(currentUrl())
      alert('링크를 복사했어요')
    } catch {
      alert('링크 복사에 실패했어요')
    }
    setShowShareMenu(false)
  }

  const shownSpots = expanded ? sortedShops : sortedShops.slice(0, VISIBLE_SPOTS)

  // ---- 스팟 타임라인 (재사용: intro 탭 하단 + spots 탭) ----
  function SpotTimeline() {
    return (
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>코스 스팟</h3>
        <div className={styles.spotList}>
          {shownSpots.map((rs: any, i: number) => {
            const shop = rs.shops
            if (!shop) return null
            const cats = shop.shop_categories ?? []
            const isLast = i === shownSpots.length - 1
            const walkMin = rs.duration_from_prev_min
            const walkM = rs.distance_from_prev_m
            return (
              <div key={rs.id} className={styles.spotRow}>
                <div className={styles.spotRail}>
                  <div className={styles.spotNum}>{i + 1}</div>
                  <div className={styles.spotRailInfo}>
                    {i === 0
                      ? '출발'
                      : (walkMin != null || walkM != null) && (
                          <>
                            {walkMin != null && <>도보 {walkMin}분<br /></>}
                            {walkM != null && formatDistance(walkM)}
                          </>
                        )}
                  </div>
                  {!isLast && <div className={styles.spotRailLine} />}
                </div>

                <div className={styles.spotCard}>
                  <div className={styles.spotThumb}>
                    {shop.shop_images?.[0]?.image_url
                      ? <img src={shop.shop_images[0].image_url} alt="" />
                      : (cats[0]?.categories?.icon ?? '🏪')}
                  </div>
                  <div className={styles.spotBody}>
                    <Link href={`/shop/${shop.slug}`} target="_blank" className={styles.spotName}>
                      {shop.name}
                    </Link>
                    {cats.length > 0 && (
                      <div className={styles.spotTags}>
                        {cats.map((c: any, ci: number) => {
                          const cat = c.categories
                          if (!cat) return null
                          const color = cat.color ?? 'var(--muted)'
                          return (
                            <span
                              key={ci}
                              className={styles.spotTag}
                              style={{ color, background: `${color}1a` }}
                            >
                              {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    {shop.addr && <div className={styles.spotAddr}>{shop.addr}</div>}
                  </div>
                  {shop.lat && shop.lng && (
                    <button className={styles.spotMapBtn} onClick={() => setShowMapMenu(shop)} aria-label="지도 앱으로 열기">
                      🗺️
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {sortedShops.length > VISIBLE_SPOTS && (
          <button className={styles.expandBtn} onClick={() => setExpanded(v => !v)}>
            {expanded ? '접기 ▲' : `전체 ${spotCount}개 스팟 보기 ▼`}
          </button>
        )}
      </div>
    )
  }

  function Placeholder({ icon, text }: { icon: string; text: string }) {
    return (
      <div className={styles.placeholder}>
        <div className={styles.placeholderIcon}>{icon}</div>
        <div className={styles.placeholderText}>{text}</div>
        <div className={styles.placeholderSub}>준비 중이에요</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* 브레드크럼 */}
      <nav className={styles.breadcrumb}>
        <Link href="/">홈</Link>
        <span className={styles.crumbSep}>›</span>
        <Link href="/routes">루트</Link>
        <span className={styles.crumbSep}>›</span>
        <span className={styles.crumbCurrent}>{route.title}</span>
      </nav>

      {/* 상단: 히어로 + 요약 */}
      <div className={styles.topGrid}>
        <div
          className={styles.hero}
          style={route.cover_image_url ? { backgroundImage: `url(${route.cover_image_url})` } : undefined}
        >
          <div className={styles.heroOverlay} />
          <div className={styles.heroInner}>
            {route.is_official ? (
              <span className={styles.officialBadge}>⭐ 공식 루트</span>
            ) : isAuthor ? (
              <div className={styles.publishWrap}>
                <button
                  type="button"
                  className={`${styles.statusBadge} ${shared ? styles.statusPublic : styles.statusDraft}`}
                  onClick={() => setPublishOpen(v => !v)}
                  aria-expanded={publishOpen}
                >
                  {shared ? '🟢 공개됨' : '🟡 작성중'}
                  <span className={styles.badgeCaret}>{publishOpen ? '▲' : '▼'}</span>
                </button>
                {publishOpen && (
                  <>
                    <div className={styles.publishBackdrop} onClick={() => setPublishOpen(false)} />
                    <div className={styles.publishMenu}>
                      <div className={styles.publishHint}>
                        {shared ? '지금 공개 상태예요. 누구나 볼 수 있어요.' : '지금은 나만 볼 수 있어요.'}
                      </div>
                      <button
                        type="button"
                        className={styles.publishAction}
                        onClick={handleTogglePublish}
                        disabled={publishBusy}
                      >
                        {publishBusy ? '처리 중…' : shared ? '🔒 비공개로 전환' : '🟢 공개하기'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
            <h1 className={styles.heroTitle}>{route.title}</h1>
            {route.description && <p className={styles.heroDesc}>{route.description}</p>}
            <div className={styles.heroStats}>
              <span className={styles.heroStat}><span className={styles.heroStatIcon}>📍</span>스팟 <b>{spotCount}곳</b></span>
              <span className={styles.heroStat}><span className={styles.heroStatIcon}>🚶</span>총 거리 <b>{formatDistance(route.total_distance_m)}</b></span>
              <span className={styles.heroStat}><span className={styles.heroStatIcon}>⏱</span>예상 시간 <b>{formatDuration(route.total_duration_min)}</b></span>
              {diff && <span className={styles.heroStat}><span className={styles.heroStatIcon}>{diff.icon}</span>난이도 <b>{diff.label}</b></span>}
            </div>
            <div className={styles.heroButtons}>
              <button className={styles.btnPrimary} onClick={() => setShowRouteMapMenu(true)}>
                🚶 루트 시작하기
              </button>
              <button
                className={`${styles.btnGhost} ${saved ? styles.btnGhostActive : ''}`}
                onClick={handleSave}
                disabled={savingBusy}
              >
                {saved ? '❤️ 저장됨' : '🤍 저장하기'}
              </button>
            </div>
          </div>
        </div>

        <aside className={styles.summaryCard}>
          <div className={styles.summaryMap}>
            {shopsWithCoords.length > 0
              ? <RouteMap shops={shopsWithCoords} />
              : <div className={styles.placeholder} style={{ height: '100%', border: 'none', borderRadius: 0 }}>
                  <div className={styles.placeholderIcon}>🗺️</div>
                  <div className={styles.placeholderText}>지도 정보가 없어요</div>
                </div>}
          </div>
          <div className={styles.summaryRight}>
            <h3 className={styles.summaryTitle}>루트 요약</h3>
            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryRowLabel}>🚶 총 거리</span>
                <span className={styles.summaryRowValue}>{formatDistance(route.total_distance_m)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryRowLabel}>⏱ 예상 시간</span>
                <span className={styles.summaryRowValue}>{formatDuration(route.total_duration_min)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryRowLabel}>📍 스팟</span>
                <span className={styles.summaryRowValue}>{spotCount}곳</span>
              </div>
              {diff && (
                <div className={styles.summaryRow}>
                  <span className={styles.summaryRowLabel}>{diff.icon} 난이도</span>
                  <span className={styles.summaryRowValue} style={{ color: diff.color }}>{diff.label}</span>
                </div>
              )}
            </div>
            <button className={styles.summaryBtn} onClick={() => setShowRouteMapMenu(true)}>
              🗺️ 지도로 전체 보기
            </button>
          </div>
        </aside>
      </div>

      {/* 탭 바 */}
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.key === 'spots' && <span className={styles.tabCount}>{spotCount}</span>}
            </button>
          ))}
        </div>
        <div className={styles.tabActions}>
          <button className={styles.iconBtn} onClick={() => setShowShareMenu(true)}>📤 공유하기</button>
        </div>
      </div>

      {/* 본문 2단 */}
      <div className={styles.contentGrid}>
        <div className={styles.mainCol}>
          {tab === 'intro' && (
            <>
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>루트 소개</h3>
                {route.description && <p className={styles.introText}>{route.description}</p>}
                <div className={styles.statBox}>
                  <div className={styles.statBoxItem}>
                    <span className={styles.statBoxLabel}>🚶 총 거리</span>
                    <span className={styles.statBoxValue}>{formatDistance(route.total_distance_m)}</span>
                  </div>
                  <div className={styles.statBoxItem}>
                    <span className={styles.statBoxLabel}>⏱ 예상 시간</span>
                    <span className={styles.statBoxValue}>{formatDuration(route.total_duration_min)}</span>
                  </div>
                  <div className={styles.statBoxItem}>
                    <span className={styles.statBoxLabel}>📍 스팟</span>
                    <span className={styles.statBoxValue}>{spotCount}곳</span>
                  </div>
                  {diff && (
                    <div className={styles.statBoxItem}>
                      <span className={styles.statBoxLabel}>{diff.icon} 난이도</span>
                      <span className={styles.statBoxValue} style={{ color: diff.color }}>{diff.label}</span>
                    </div>
                  )}
                </div>
              </div>
              <SpotTimeline />
            </>
          )}

          {tab === 'spots' && <SpotTimeline />}
          {tab === 'course' && <Placeholder icon="🧭" text="코스 정보" />}
          {tab === 'tips' && <Placeholder icon="💡" text="이용 팁" />}
          {tab === 'reviews' && <Placeholder icon="⭐" text="리뷰" />}
          {tab === 'related' && <Placeholder icon="🔗" text="관련 루트" />}
        </div>

        {/* 사이드 */}
        <div className={styles.sideCol}>
          {route.target_audience && (
            <div className={styles.sideCard}>
              <h4 className={styles.sideCardTitle}>🎯 이런 분들께 추천해요</h4>
              <div className={styles.audienceList}>
                {String(route.target_audience)
                  .split(/[\n·•]/)
                  .map((s: string) => s.trim())
                  .filter(Boolean)
                  .map((line: string, i: number) => (
                    <div key={i} className={styles.audienceItem}>
                      <span className={styles.audienceCheck}>✓</span>
                      <span>{line}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className={styles.sideCard}>
            <h4 className={styles.sideCardTitle}>💡 루트 TIP</h4>
            <Placeholder icon="💡" text="루트 팁" />
          </div>

          <div className={styles.sideCard}>
            <h4 className={styles.sideCardTitle}>🧡 함께 보면 좋은 루트</h4>
            <Placeholder icon="🔗" text="추천 루트" />
          </div>

          <div className={styles.sideCard}>
            <h4 className={styles.sideCardTitle}>👥 최근 다녀간 사람들</h4>
            <div className={styles.likeCard}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {likes > 0 ? `${likes}명이 이 루트를 좋아해요` : '아직 좋아요가 없어요'}
              </span>
              <span className={styles.likeCount}>
                <span className={styles.likeCountBig}>❤️</span>{likes}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 전체 루트 길찾기 시트 */}
      {showRouteMapMenu && (
        <div className={styles.sheetBackdrop} onClick={() => setShowRouteMapMenu(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <h3 className={styles.sheetTitle}>지도 앱으로 길찾기</h3>
            <div className={styles.sheetRow}>
              <button className={`${styles.sheetBtn} ${styles.sheetKakao}`} onClick={openRouteInKakao}>카카오맵</button>
              <button className={`${styles.sheetBtn} ${styles.sheetGoogle}`} onClick={openRouteInGoogle}>구글맵</button>
            </div>
          </div>
        </div>
      )}

      {/* 단일 샵 시트 */}
      {showMapMenu && (
        <div className={styles.sheetBackdrop} onClick={() => setShowMapMenu(null)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <h3 className={styles.sheetTitle}>{showMapMenu.name}</h3>
            <div className={styles.sheetRow}>
              <button className={`${styles.sheetBtn} ${styles.sheetKakao}`} onClick={() => openSingleShop(showMapMenu, 'kakao')}>카카오맵</button>
              <button className={`${styles.sheetBtn} ${styles.sheetNaver}`} onClick={() => openSingleShop(showMapMenu, 'naver')}>네이버맵</button>
              <button className={`${styles.sheetBtn} ${styles.sheetGoogle}`} onClick={() => openSingleShop(showMapMenu, 'google')}>구글맵</button>
            </div>
          </div>
        </div>
      )}

      {/* 공유 시트 */}
      {showShareMenu && (
        <div className={styles.sheetBackdrop} onClick={() => setShowShareMenu(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <h3 className={styles.sheetTitle}>루트 공유하기</h3>
            <div className={styles.sheetRow}>
              {typeof navigator !== 'undefined' && (navigator as any).share && (
                <button className={`${styles.sheetBtn} ${styles.sheetGoogle}`} onClick={shareNative}>공유</button>
              )}
              <button className={`${styles.sheetBtn} ${styles.sheetX}`} onClick={shareX}>X (트위터)</button>
              <button className={`${styles.sheetBtn} ${styles.sheetCopy}`} onClick={copyLink}>링크 복사</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
