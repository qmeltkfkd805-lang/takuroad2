'use client'

import { useState, useEffect, CSSProperties, ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { formatDistance } from '@/hooks/useCurrentLocation'
import { getRouteDifficulty } from '@/lib/utils/routeDifficulty'
import { useAuth } from '@/components/layout/AuthProvider'
import { toggleRouteSave, getMySavedRouteIds, toggleRouteShare } from '@/services/routeService'
import { recordRouteStart, hasStartedRoute, getRouteTips, addRouteTip, deleteRouteTip, RouteTip } from '@/services/routeTipService'
import { useRouter } from 'next/navigation'
import styles from './RouteDetailPage.module.css'

const RouteMap = dynamic(() => import('./RouteMap'), { ssr: false })

interface Props {
  route: any
}

/* ---- 아이콘 (프로젝트 공용 /icons/*.png 을 mask로 색칠) ---- */
function MaskIcon({ name, size = 16, color = 'currentColor', style }: { name: string; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, display: 'inline-block', flexShrink: 0, verticalAlign: '-2px',
        backgroundColor: color,
        WebkitMaskImage: `url(/icons/${name}.png)`,
        maskImage: `url(/icons/${name}.png)`,
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain', maskSize: 'contain',
        WebkitMaskPosition: 'center', maskPosition: 'center',
        ...style,
      }}
    />
  )
}

/* ---- 세트에 없는 아이콘은 인라인 SVG ---- */
function Svg({ size = 16, color = 'currentColor', style, children }: { size?: number; color?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={{ flexShrink: 0, verticalAlign: '-3px', ...style }}>
      {children}
    </svg>
  )
}
const ShareIcon = (p: { size?: number; color?: string; style?: CSSProperties }) => <Svg {...p}><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="m8.2 10.9 7.6-3.5" /><path d="m8.2 13.1 7.6 3.5" /></Svg>
const BulbIcon = (p: { size?: number; color?: string; style?: CSSProperties }) => <Svg {...p}><path d="M9 18h6" /><path d="M10 21h4" /><path d="M8.5 14a5 5 0 1 1 7 0c-.6.6-1 1.3-1 2.2h-5c0-.9-.4-1.6-1-2.2Z" /></Svg>
const LockIcon = (p: { size?: number; color?: string; style?: CSSProperties }) => <Svg {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>
const GlobeIcon = (p: { size?: number; color?: string; style?: CSSProperties }) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" /></Svg>
const CheckIcon = (p: { size?: number; color?: string; style?: CSSProperties }) => <Svg {...p}><path d="m5 12 5 5L20 6" /></Svg>
const ChevIcon = (p: { size?: number; color?: string; style?: CSSProperties }) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
const PinIcon = (p: { size?: number; color?: string; style?: CSSProperties }) => <Svg {...p}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></Svg>
const PencilIcon = (p: { size?: number; color?: string; style?: CSSProperties }) => <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>
function ColorIcon({ name, size = 16, style }: { name: string; size?: number; style?: CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/icons/${name}.png`} width={size} height={size} alt="" aria-hidden style={{ display: 'inline-block', objectFit: 'contain', flexShrink: 0, verticalAlign: '-3px', ...style }} />
  )
}
function HeartIcon({ size = 16, color = 'currentColor', filled = false, style }: { size?: number; color?: string; filled?: boolean; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, verticalAlign: '-3px', ...style }}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.04 3 5.5l7 7Z" />
    </svg>
  )
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

function resolveDifficulty(route: any): { label: string; color: string } | null {
  const n = route.official_difficulty
  if (n === 1) return { label: '가볍게', color: '#0E7A63' }
  if (n === 2) return { label: '반나절', color: '#835700' }
  if (n === 3) return { label: '하루코스', color: '#A23E18' }
  const d = getRouteDifficulty(route.total_duration_min)
  if (!d) return null
  return { label: d.label, color: d.color }
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
  const tipLines: string[] = route.tips ? String(route.tips).split('\n').map((l: string) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean) : []

  const [routeTips, setRouteTips] = useState<RouteTip[]>([])
  const [started, setStarted] = useState(false)
  const [tipInput, setTipInput] = useState('')
  const [tipBusy, setTipBusy] = useState(false)

  useEffect(() => {
    let alive = true
    getRouteTips(route.id).then((t) => { if (alive) setRouteTips(t) }).catch(() => {})
    if (user) hasStartedRoute(route.id, user.id).then((s) => { if (alive) setStarted(s) }).catch(() => {})
    return () => { alive = false }
  }, [route.id, user])

  async function submitTip() {
    if (!user || !tipInput.trim() || tipBusy) return
    setTipBusy(true)
    const ok = await addRouteTip(route.id, user.id, tipInput)
    if (ok) { setTipInput(''); const t = await getRouteTips(route.id); setRouteTips(t) }
    setTipBusy(false)
  }
  async function removeTip(id: string) {
    const ok = await deleteRouteTip(id)
    if (ok) setRouteTips((prev) => prev.filter((t) => t.id !== id))
  }
  const heroIcon = 'rgba(255,255,255,.9)'

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
    setSaved(prev => !prev)
    try {
      const next = await toggleRouteSave(route.id, user.id)
      setSaved(next)
    } catch {
      setSaved(prev => !prev)
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

  // ---- 지도 앱 길찾기 ----
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
  async function doShare() {
    const url = currentUrl()
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try { await navigator.share({ title: route.title, url }) } catch {}
      return
    }
    // 기기 공유 미지원(주로 데스크톱) → 링크 복사로 대체
    try {
      await navigator.clipboard.writeText(url)
      alert('링크를 복사했어요')
    } catch {
      alert('링크 복사에 실패했어요')
    }
  }

  const shownSpots = expanded ? sortedShops : sortedShops.slice(0, VISIBLE_SPOTS)

  // ---- 스팟 타임라인 ----
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
                      : <MaskIcon name="shop" size={28} color="var(--muted)" />}
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
                              {cat.name}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    {shop.addr && <div className={styles.spotAddr}>{shop.addr}</div>}
                  </div>
                  {shop.lat && shop.lng && (
                    <button className={styles.spotMapBtn} onClick={() => setShowMapMenu(shop)} aria-label="지도 앱으로 열기">
                      <ColorIcon name="colormap" size={18} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {sortedShops.length > VISIBLE_SPOTS && (
          <button className={styles.expandBtn} onClick={() => setExpanded(v => !v)}>
            {expanded ? '접기' : `전체 ${spotCount}개 스팟 보기`}
            <ChevIcon size={15} color="currentColor" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
          </button>
        )}
      </div>
    )
  }

  function Placeholder({ icon, text }: { icon: ReactNode; text: string }) {
    return (
      <div className={styles.placeholder}>
        <span className={styles.placeholderIcon}>{icon}</span>
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
              <span className={styles.officialBadge}><MaskIcon name="star" size={13} color="#fff" />공식 루트</span>
            ) : isAuthor ? (
              <div className={styles.publishWrap}>
                <button
                  type="button"
                  className={`${styles.statusBadge} ${shared ? styles.statusPublic : styles.statusDraft}`}
                  onClick={() => setPublishOpen(v => !v)}
                  aria-expanded={publishOpen}
                >
                  {shared ? '공개됨' : '작성중'}
                  <ChevIcon size={12} color="currentColor" style={{ transform: publishOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
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
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        {publishBusy
                          ? '처리 중…'
                          : shared
                            ? <><LockIcon size={14} color="currentColor" />비공개로 전환</>
                            : <><GlobeIcon size={14} color="currentColor" />공개하기</>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
            <h1 className={styles.heroTitle}>{route.title}</h1>
            {route.description && <p className={styles.heroDesc}>{route.description}</p>}
            <div className={styles.heroStats}>
              <span className={styles.heroStat}><MaskIcon name="shop" size={14} color={heroIcon} />스팟 <b>{spotCount}곳</b></span>
              <span className={styles.heroStat}><MaskIcon name="route" size={14} color={heroIcon} />총 거리 <b>{formatDistance(route.total_distance_m)}</b></span>
              <span className={styles.heroStat}><MaskIcon name="clock" size={14} color={heroIcon} />예상 시간 <b>{formatDuration(route.total_duration_min)}</b></span>
              {diff && <span className={styles.heroStat}><MaskIcon name="fire" size={14} color={heroIcon} />난이도 <b>{diff.label}</b></span>}
            </div>
            <div className={styles.heroButtons}>
              <button className={styles.btnPrimary} onClick={() => { setShowRouteMapMenu(true); if (user) { recordRouteStart(route.id, user.id); setStarted(true) } }}>
                <PinIcon size={16} color="#fff" />루트 시작하기
              </button>
              <button
                className={`${styles.btnGhost} ${saved ? styles.btnGhostActive : ''}`}
                onClick={handleSave}
                disabled={savingBusy}
              >
                <HeartIcon size={16} filled={saved} color={saved ? 'var(--accent)' : 'var(--text)'} />{saved ? '저장됨' : '저장하기'}
              </button>
              {isAuthor && !route.is_official && (
                <Link href={`/route/${route.share_token}/edit`} className={styles.btnGhost} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}><PencilIcon size={16} color="var(--text)" />수정</Link>
              )}
            </div>
          </div>
        </div>

        <aside className={styles.summaryCard}>
          <div className={styles.summaryMap}>
            {shopsWithCoords.length > 0
              ? <RouteMap shops={shopsWithCoords} />
              : <div className={styles.placeholder} style={{ height: '100%', border: 'none', borderRadius: 0 }}>
                  <span className={styles.placeholderIcon}><ColorIcon name="colormap" size={26} /></span>
                  <div className={styles.placeholderText}>지도 정보가 없어요</div>
                </div>}
          </div>
          <div className={styles.summaryRight}>
            <h3 className={styles.summaryTitle}>루트 요약</h3>
            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryRowLabel}><MaskIcon name="route" size={15} />총 거리</span>
                <span className={styles.summaryRowValue}>{formatDistance(route.total_distance_m)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryRowLabel}><MaskIcon name="clock" size={15} />예상 시간</span>
                <span className={styles.summaryRowValue}>{formatDuration(route.total_duration_min)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryRowLabel}><MaskIcon name="shop" size={15} />스팟</span>
                <span className={styles.summaryRowValue}>{spotCount}곳</span>
              </div>
              {diff && (
                <div className={styles.summaryRow}>
                  <span className={styles.summaryRowLabel}><MaskIcon name="fire" size={15} color={diff.color} />난이도</span>
                  <span className={styles.summaryRowValue} style={{ color: diff.color }}>{diff.label}</span>
                </div>
              )}
            </div>
            <button className={styles.summaryBtn} onClick={() => setShowRouteMapMenu(true)}>
              <ColorIcon name="colormap" size={18} />지도로 전체 보기
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
          <button className={styles.iconBtn} onClick={doShare}><ShareIcon size={15} color="currentColor" />공유하기</button>
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
                    <span className={styles.statBoxLabel}><MaskIcon name="route" size={14} />총 거리</span>
                    <span className={styles.statBoxValue}>{formatDistance(route.total_distance_m)}</span>
                  </div>
                  <div className={styles.statBoxItem}>
                    <span className={styles.statBoxLabel}><MaskIcon name="clock" size={14} />예상 시간</span>
                    <span className={styles.statBoxValue}>{formatDuration(route.total_duration_min)}</span>
                  </div>
                  <div className={styles.statBoxItem}>
                    <span className={styles.statBoxLabel}><MaskIcon name="shop" size={14} />스팟</span>
                    <span className={styles.statBoxValue}>{spotCount}곳</span>
                  </div>
                  {diff && (
                    <div className={styles.statBoxItem}>
                      <span className={styles.statBoxLabel}><MaskIcon name="fire" size={14} color={diff.color} />난이도</span>
                      <span className={styles.statBoxValue} style={{ color: diff.color }}>{diff.label}</span>
                    </div>
                  )}
                </div>
              </div>
              <SpotTimeline />
            </>
          )}

          {tab === 'spots' && <SpotTimeline />}
          {tab === 'course' && <Placeholder icon={<ColorIcon name="colormap" size={26} />} text="코스 정보" />}
          {tab === 'tips' && <Placeholder icon={<BulbIcon size={22} color="var(--muted)" />} text="이용 팁" />}
          {tab === 'reviews' && <Placeholder icon={<MaskIcon name="star" size={22} color="var(--muted)" />} text="리뷰" />}
          {tab === 'related' && <Placeholder icon={<MaskIcon name="route" size={22} color="var(--muted)" />} text="관련 루트" />}
        </div>

        {/* 사이드 */}
        <div className={styles.sideCol}>
          {route.target_audience && (
            <div className={styles.sideCard}>
              <h4 className={styles.sideCardTitle}><MaskIcon name="people" size={16} color="var(--accent)" />이런 분들께 추천해요</h4>
              <div className={styles.audienceList}>
                {String(route.target_audience)
                  .split(/[\n·•]/)
                  .map((s: string) => s.trim())
                  .filter(Boolean)
                  .map((line: string, i: number) => (
                    <div key={i} className={styles.audienceItem}>
                      <span className={styles.audienceCheck}><CheckIcon size={14} color="var(--accent)" /></span>
                      <span>{line}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className={styles.sideCard}>
            <h4 className={styles.sideCardTitle}><BulbIcon size={20} color="var(--accent)" />루트 TIP</h4>
            {tipLines.length === 0 && routeTips.length === 0 ? (
              <div style={{ padding: '14px 4px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
                아직 팁이 없어요.<br />방문하고 꿀팁이 있다면 알려주세요!
              </div>
            ) : (
              <>
                {tipLines.length > 0 && (
                  <div className={styles.audienceList}>
                    {tipLines.map((line, i) => (
                      <div key={`a${i}`} className={styles.audienceItem}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', marginTop: 7, flexShrink: 0 }} />
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                )}
                {routeTips.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: tipLines.length > 0 ? 12 : 0, maxHeight: routeTips.length > 3 ? 246 : undefined, overflowY: routeTips.length > 3 ? 'auto' : undefined, paddingRight: routeTips.length > 3 ? 4 : 0 }}>
                    {routeTips.map((tp) => (
                      <div key={tp.id} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{tp.content}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{tp.nickname ?? '익명'}</span>
                          {user && tp.user_id === user.id && (
                            <button onClick={() => removeTip(tp.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>삭제</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {started ? (
              <div style={{ marginTop: 12 }}>
                <textarea value={tipInput} onChange={(e) => setTipInput(e.target.value)} placeholder="이 루트 다녀온 꿀팁을 남겨주세요" rows={2}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', resize: 'vertical' }} />
                <button onClick={submitTip} disabled={tipBusy || !tipInput.trim()} style={{ width: '100%', marginTop: 6, padding: '9px', borderRadius: 10, border: 'none', background: tipInput.trim() ? 'var(--accent)' : 'var(--border)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: tipInput.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>{tipBusy ? '등록 중…' : '팁 등록'}</button>
              </div>
            ) : (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>
                {user ? '루트를 시작하면 팁을 남길 수 있어요' : '로그인하고 루트를 시작하면 팁을 남길 수 있어요'}
              </div>
            )}
          </div>

          <div className={styles.sideCard}>
            <h4 className={styles.sideCardTitle}><MaskIcon name="route" size={16} color="var(--accent)" />함께 보면 좋은 루트</h4>
            <Placeholder icon={<MaskIcon name="route" size={22} color="var(--muted)" />} text="추천 루트" />
          </div>

          <div className={styles.sideCard}>
            <h4 className={styles.sideCardTitle}><MaskIcon name="people" size={16} color="var(--accent)" />최근 다녀간 사람들</h4>
            <div className={styles.likeCard}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {likes > 0 ? `${likes}명이 이 루트를 좋아해요` : '아직 좋아요가 없어요'}
              </span>
              <span className={styles.likeCount}>
                <HeartIcon size={18} filled color="var(--accent)" />{likes}
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

    </div>
  )
}
