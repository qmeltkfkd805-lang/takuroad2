'use client'

import { useState, useEffect, useMemo, useRef, CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistance, calcDistance, useCurrentLocation } from '@/hooks/useCurrentLocation'
import { getShopStatus, ShopStatusKind } from '@/lib/utils/shopStatus'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import { useAuth } from '@/components/layout/AuthProvider'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { toggleRouteSave, getMySavedRouteIds, toggleRouteShare, deleteRoute, adminDeleteRoute, adminSetRouteShared } from '@/services/routeService'
import { recordRouteStart, hasStartedRoute, getRouteTips, addRouteTip, deleteRouteTip, RouteTip } from '@/services/routeTipService'
import { getRelatedRoutes, RelatedRoute } from '@/services/routeRelatedService'
import { getVisitedShopIds, setShopVisited } from '@/services/routeVisitService'
import styles from './RouteDetailPage.module.css'

import AppIcon from '@/components/tds/AppIcon'
import RouteThumb from './RouteThumb'
import { rtStops } from './routeMeta'

/* ---- 아이콘 ---- */
function MaskIcon({ name, size = 16, color = 'currentColor', style }: { name: string; size?: number; color?: string; style?: CSSProperties }) {
  return <span aria-hidden style={{ width: size, height: size, display: 'inline-block', flexShrink: 0, verticalAlign: '-2px', backgroundColor: color, WebkitMaskImage: `url(/icons/${name}.png)`, maskImage: `url(/icons/${name}.png)`, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskPosition: 'center', maskPosition: 'center', ...style }} />
}
function ColorIcon({ name, size = 16, style }: { name: string; size?: number; style?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/icons/${name}.png`} width={size} height={size} alt="" aria-hidden style={{ display: 'inline-block', objectFit: 'contain', flexShrink: 0, verticalAlign: '-3px', ...style }} />
}
function Svg({ size = 16, color = 'currentColor', style, children }: { size?: number; color?: string; style?: CSSProperties; children: ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, verticalAlign: '-3px', ...style }}>{children}</svg>
}
const ShareIcon = (p: any) => <Svg {...p}><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="m8.2 10.9 7.6-3.5" /><path d="m8.2 13.1 7.6 3.5" /></Svg>
const PinIcon = (p: any) => <Svg {...p}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></Svg>
const CheckIcon = (p: any) => <Svg {...p}><path d="m5 12 5 5L20 6" /></Svg>
const MoreIcon = (p: any) => <Svg {...p}><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></Svg>
const TrashIcon = (p: any) => <Svg {...p}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></Svg>
const ExpandIcon = (p: any) => <Svg {...p}><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /></Svg>
const LockIcon = (p: any) => <Svg {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>
const GlobeIcon = (p: any) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" /></Svg>
const PencilIcon = (p: any) => <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>
const ChevronIcon = (p: any) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
function HeartIcon({ size = 16, color = 'currentColor', filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, verticalAlign: '-3px' }}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.04 3 5.5l7 7Z" /></svg>
}

function fmtDur(min: number | null | undefined): string | null {
  if (min == null) return null
  const h = Math.floor(min / 60), m = min % 60
  if (h && m) return `약 ${h}시간 ${m}분`
  if (h) return `약 ${h}시간`
  return `약 ${m}분`
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s); if (isNaN(+d)) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
const OFFICIAL_DIFF: Record<number, { label: string; color: string }> = { 1: { label: '가볍게', color: '#0E7A63' }, 2: { label: '반나절', color: '#835700' }, 3: { label: '하루코스', color: '#A23E18' } }
function statusPill(kind: ShopStatusKind): { text: string; tone: string } | null {
  switch (kind) {
    case 'open': return { text: '영업 중', tone: 'open' }
    case 'closing_soon': return { text: '곧 마감', tone: 'soon' }
    case 'before': return { text: '영업 전', tone: 'before' }
    case 'dayoff': return { text: '휴무', tone: 'off' }
    case 'temp_closed': return { text: '임시 휴무', tone: 'off' }
    case 'closed': return { text: '영업 종료', tone: 'off' }
    case 'permanently_closed': return { text: '폐점', tone: 'off' }
    default: return null
  }
}

const ANCHORS = [{ key: 'course', label: '코스 안내' }, { key: 'reviews', label: '후기' }, { key: 'related', label: '관련 루트' }]

export default function RouteDetailPage({ route }: { route: any }) {
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const { location } = useCurrentLocation()
  const isDesktop = useIsDesktop()

  const sortedStops = useMemo(() => (route.route_shops ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order), [route])
  const shopsWithCoords = useMemo(() => sortedStops.map((rs: any) => rs.shops).filter((s: any) => s && s.lat && s.lng).map((s: any) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })), [sortedStops])
  const spotCount = sortedStops.length
  const singleSpot = spotCount <= 1
  const region = useMemo(() => { for (const rs of sortedStops) if (rs.shops?.region) return rs.shops.region; return null }, [sortedStops])
  const tags = useMemo(() => Array.from(new Set([route.primary_tag?.name, ...(Array.isArray(route.themes) ? route.themes : [])].filter(Boolean))).slice(0, 3), [route])
  const authorNotes: string[] = useMemo(() => route.tips ? String(route.tips).split('\n').map((l: string) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean) : [], [route])
  const diff = route.official_difficulty ? OFFICIAL_DIFF[route.official_difficulty] : null
  const likes = route.likes ?? 0
  const author = route.profiles?.nickname
  const now = useMemo(() => new Date(), [])

  const [saved, setSaved] = useState(false)
  const [savingBusy, setSavingBusy] = useState(false)
  const [shared, setShared] = useState(!!route.is_shared)
  const [publishBusy, setPublishBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [routeTips, setRouteTips] = useState<RouteTip[]>([])
  const [started, setStarted] = useState(false)
  const [tipInput, setTipInput] = useState('')
  const [tipBusy, setTipBusy] = useState(false)
  const [related, setRelated] = useState<RelatedRoute[]>([])
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set())
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [activeAnchor, setActiveAnchor] = useState('course')
  const [courseOpen, setCourseOpen] = useState(true)   // 방문 코스 접기/펴기 (기본 펴짐)
  const [toast, setToast] = useState<string | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const celebratedRef = useRef(false)
  // 모바일 전용: 탭 + inline CTA 가시성(스크롤 시 sticky 시작버튼 표시)
  const [mobileTab, setMobileTab] = useState<'course' | 'reviews' | 'related'>('course')
  const ctaRef = useRef<HTMLDivElement>(null)
  const [ctaVisible, setCtaVisible] = useState(true)

  const isAuthor = !!user && user.id === route.user_id
  const canManage = isAuthor || isAdmin   // 관리자는 남의 루트도 관리 가능
  const sectionRefs = { course: useRef<HTMLElement>(null), reviews: useRef<HTMLElement>(null), related: useRef<HTMLElement>(null) }

  useEffect(() => {
    if (!user) { setSaved(false); setVisitedIds(new Set()); return }
    let alive = true
    getMySavedRouteIds(user.id).then(ids => { if (alive) setSaved(ids.includes(route.id)) }).catch(() => {})
    getVisitedShopIds(route.id, user.id).then(ids => { if (alive) setVisitedIds(new Set(ids)) }).catch(() => {})
    hasStartedRoute(route.id, user.id).then(s => { if (alive) setStarted(s) }).catch(() => {})
    return () => { alive = false }
  }, [user, route.id])

  useEffect(() => {
    let alive = true
    getRouteTips(route.id).then(t => { if (alive) setRouteTips(t) }).catch(() => {})
    const regions = Array.from(new Set(sortedStops.map((rs: any) => rs.shops?.region).filter(Boolean))) as string[]
    getRelatedRoutes(route.id, route.primary_tag_id ?? null, regions, 6).then(r => { if (alive) setRelated(r) }).catch(() => {})
    return () => { alive = false }
  }, [route.id])

  // 앵커 활성 감지
  useEffect(() => {
    const els = ANCHORS.map(a => sectionRefs[a.key as keyof typeof sectionRefs].current).filter(Boolean) as Element[]
    if (!els.length) return
    const io = new IntersectionObserver(entries => {
      const vis = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (vis) setActiveAnchor((vis.target as HTMLElement).dataset.anchor || 'course')
    }, { rootMargin: '-120px 0px -60% 0px', threshold: [0.05, 0.3] })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [related.length])

  const visitedCount = useMemo(() => sortedStops.filter((rs: any) => rs.shops && visitedIds.has(rs.shops.id)).length, [sortedStops, visitedIds])
  const firstShop = shopsWithCoords[0]
  const firstDist = location && firstShop ? calcDistance(location.lat, location.lng, firstShop.lat, firstShop.lng) : null

  async function handleSave() {
    if (!user) { router.push('/login'); return }
    if (savingBusy) return
    setSavingBusy(true); setSaved(p => !p)
    try { setSaved(await toggleRouteSave(route.id, user.id)) }
    catch { setSaved(p => !p) }
    finally { setSavingBusy(false) }
  }
  function handleStart() {
    // 시작 기록은 로그인 시에만(선택). 진행 모드(run=1)로 지도에 진입 — 모바일에서 자동 방문 감지 시작.
    if (user && !started) { recordRouteStart(route.id, user.id).catch(() => {}); setStarted(true) }
    router.push(`/map?routeId=${route.share_token}&run=1`)
  }
  async function toggleVisited(shopId: string) {
    if (!user) { router.push('/login'); return }
    const has = visitedIds.has(shopId)
    setVisitedIds(prev => { const n = new Set(prev); has ? n.delete(shopId) : n.add(shopId); return n })
    // 완주 판정 — 마지막 스팟을 체크해 전체 방문이 되면 축하 모달
    if (!has) {
      const allIds = sortedStops.map((rs: any) => rs.shops?.id).filter(Boolean)
      const projected = new Set(visitedIds); projected.add(shopId)
      if (allIds.length > 0 && allIds.every((id: string) => projected.has(id)) && !celebratedRef.current) {
        celebratedRef.current = true; setShowComplete(true)
      }
    } else {
      celebratedRef.current = false
    }
    const ok = await setShopVisited(route.id, shopId, user.id, !has)
    if (!ok) setVisitedIds(prev => { const n = new Set(prev); has ? n.add(shopId) : n.delete(shopId); return n })
  }
  async function submitTip() {
    if (!user || !tipInput.trim() || tipBusy) return
    setTipBusy(true)
    const ok = await addRouteTip(route.id, user.id, tipInput.trim())
    if (ok) { setTipInput(''); setRouteTips(await getRouteTips(route.id)) } else setToast('팁 등록에 실패했어요.')
    setTipBusy(false)
  }
  async function removeTip(id: string) {
    if (await deleteRouteTip(id)) setRouteTips(prev => prev.filter(t => t.id !== id))
  }
  async function handleTogglePublish() {
    if (!user || publishBusy) return
    setPublishBusy(true)
    const next = !shared
    const ok = isAuthor ? await toggleRouteShare(route.id, user.id, next) : await adminSetRouteShared(route.id, next)
    setPublishBusy(false)
    if (ok) { setShared(next); setToast(next ? '공개로 전환했어요.' : '비공개로 전환했어요.') }
    else setToast('변경에 실패했어요.')
    setMenuOpen(false)
  }
  async function handleDelete() {
    if (!user || deleteBusy) return
    setMenuOpen(false)
    if (!window.confirm(isAuthor ? '이 루트를 삭제할까요? 되돌릴 수 없어요.' : '관리자 권한으로 이 루트를 삭제할까요? 되돌릴 수 없어요.')) return
    setDeleteBusy(true)
    const ok = isAuthor ? await deleteRoute(route.id, user.id) : await adminDeleteRoute(route.id)
    setDeleteBusy(false)
    if (ok) router.push('/routes')
    else setToast('삭제에 실패했어요.')
  }
  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])
  async function doShare() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try { await navigator.share({ title: route.title, text: route.description ?? '', url }) } catch {}
      return
    }
    try { await navigator.clipboard.writeText(url); setToast('링크를 복사했어요') }
    catch { setToast('링크 복사에 실패했어요') }
  }
  // 지도 관련 액션은 모두 타쿠로드 내부 지도로 이동
  const openInternalMap = (spotId?: string) => router.push(`/map?routeId=${route.share_token}${spotId ? `&spotId=${spotId}` : ''}`)
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t) }, [toast])

  // 모바일: inline CTA가 화면에서 벗어나면 sticky 시작버튼 노출
  useEffect(() => {
    const el = ctaRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setCtaVisible(e.isIntersecting), { rootMargin: '-8px 0px -120px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [isDesktop])

  const scrollTo = (key: string) => {
    const el = sectionRefs[key as keyof typeof sectionRefs].current
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const SaveBtn = ({ cls }: { cls: string }) => (
    <button className={cls} onClick={handleSave} disabled={savingBusy} aria-pressed={saved}>
      <HeartIcon size={16} filled={saved} color={saved ? 'var(--accent)' : 'currentColor'} />{saved ? '저장됨' : '저장하기'}
    </button>
  )

  // 방문 코스 타임라인 (데스크톱·모바일 공용)
  const timelineOl = (
    <ol className={styles.timeline}>
      {sortedStops.map((rs: any, i: number) => {
        const shop = rs.shops
        if (!shop) return null
        const sel = selectedShopId === shop.id
        const st = shop.hours || shop.status ? statusPill(getShopStatus(shop, now).kind) : null
        const cats: string[] = Array.isArray(shop.cats) ? shop.cats : []
        const first = i === 0, last = i === sortedStops.length - 1
        const walkMin = rs.duration_from_prev_min, walkM = rs.distance_from_prev_m
        const visited = visitedIds.has(shop.id)
        return (
          <li key={rs.id} className={styles.stop}>
            {!first && !singleSpot && (walkMin != null || walkM != null) && (
              <div className={styles.travel}><AppIcon name="route" size={12} color="var(--muted)" />도보{walkMin != null ? ` ${walkMin}분` : ''}{walkM != null ? ` · ${formatDistance(walkM)}` : ''}</div>
            )}
            {!first && !singleSpot && sortedStops[i - 1]?.move_tip && (
              <div className={styles.travelTip}>{sortedStops[i - 1].move_tip}</div>
            )}
            <div className={`${styles.stopRow} ${sel ? styles.stopRowSel : ''}`}
              onClick={() => setSelectedShopId(sel ? null : shop.id)} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedShopId(sel ? null : shop.id) } }}>
              <div className={styles.stopRail}>
                <span className={`${styles.stopNum} ${visited ? styles.stopNumDone : ''}`}>{visited ? <CheckIcon size={14} color="#fff" /> : i + 1}</span>
                {!last && !singleSpot && <span className={styles.stopLine} />}
              </div>
              <div className={styles.stopThumb}>
                {shop.shop_images?.[0]?.image_url ? <img src={shop.shop_images[0].image_url} alt="" loading="lazy" /> : <MaskIcon name="shop" size={26} color="var(--muted)" />}
              </div>
              <div className={styles.stopBody}>
                <div className={styles.stopHead}>
                  <Link href={`/shop/${shop.slug}`} target="_blank" className={styles.stopName} onClick={e => e.stopPropagation()}>{shop.name}</Link>
                  {st && <span className={styles.statusPill} data-tone={st.tone}>{st.text}</span>}
                </div>
                {(() => {
                  const fl = shop.floor_info || [shop.floor, shop.unit].filter(Boolean).join(' ')
                  if (!shop.addr && !fl) return null
                  return (
                    <div className={styles.stopAddrRow}>
                      {shop.addr && <span className={styles.stopAddr}>{shop.addr}</span>}
                      {fl && <span className={styles.stopFloor}>{fl}</span>}
                    </div>
                  )
                })()}
                {cats.length > 0 && (
                  <div className={styles.stopTags}>
                    {cats.slice(0, 2).map(c => { const ci = CATEGORY_NAME_MAP[c]; return <span key={c} className={styles.stopTag} style={ci ? { color: ci.color, background: ci.bgColor } : undefined}>{c}</span> })}
                  </div>
                )}
              </div>
              <div className={styles.stopActions}>
                <Link href={`/shop/${shop.slug}`} target="_blank" className={styles.detailLink} onClick={e => e.stopPropagation()}>상세 보기 ›</Link>
                <div className={styles.stopBtns}>
                  {shop.lat && shop.lng && <button className={styles.mapAppBtn} onClick={e => { e.stopPropagation(); openInternalMap(shop.id) }} aria-label="타쿠로드 지도에서 보기" title="타쿠로드 지도에서 보기"><ColorIcon name="colormap" size={16} /></button>}
                  <button className={visited ? styles.visitOn : styles.visitBtn} onClick={e => { e.stopPropagation(); toggleVisited(shop.id) }} aria-pressed={visited}>
                    <CheckIcon size={13} color={visited ? '#fff' : 'var(--muted)'} />{visited ? '방문함' : '방문'}
                  </button>
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )

  const tipsBlock = (
    <div className={styles.block}>
      <h2 className={styles.blockTitle}>여행자 팁{routeTips.length ? ` ${routeTips.length}` : ''}</h2>
      {routeTips.length === 0 ? (
        <p className={styles.emptyLine}>아직 여행자 팁이 없어요. 루트를 다녀오고 꿀팁을 남겨주세요!</p>
      ) : (
        <ul className={styles.tipsList}>
          {routeTips.map(tp => (
            <li key={tp.id} className={styles.tipItem}>
              <div className={styles.tipContent}>{tp.content}</div>
              <div className={styles.tipFoot}>
                <span className={styles.tipAuthor}>{tp.nickname ?? '익명'} · {fmtDate(tp.created_at)}</span>
                {user && tp.user_id === user.id && <button className={styles.tipDelete} onClick={() => removeTip(tp.id)}>삭제</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {started ? (
        <div className={styles.tipForm}>
          <textarea className={styles.tipInput} value={tipInput} maxLength={300} onChange={e => setTipInput(e.target.value)} placeholder="이 루트 다녀온 꿀팁을 남겨주세요" rows={2} />
          <button className={styles.tipSubmit} onClick={submitTip} disabled={tipBusy || !tipInput.trim()}>{tipBusy ? '등록 중…' : '팁 등록'}</button>
        </div>
      ) : (
        <p className={styles.tipLocked}>{user ? '루트를 시작하면 팁을 남길 수 있어요.' : '로그인하고 루트를 시작하면 팁을 남길 수 있어요.'}</p>
      )}
    </div>
  )

  /* ───────────── 📱 모바일 루트 상세 ───────────── */
  if (!isDesktop) {
    const statusBadge = route.is_official
      ? <span className={styles.mStatusOfficial}><MaskIcon name="star" size={12} color="#fff" />추천</span>
      : canManage
        ? <span className={`${styles.mStatus} ${shared ? styles.mStatusPublic : styles.mStatusDraft}`}>{shared ? '공개됨' : '작성중'}</span>
        : null
    const MTABS = [
      { key: 'course', label: '코스 안내' },
      { key: 'reviews', label: '후기' },
      { key: 'related', label: '관련 루트' },
    ] as const
    return (
      <div className={styles.mPage}>
        {/* 앱바 */}
        <header className={styles.mAppbar}>
          <button className={styles.mAppIcon} onClick={() => router.back()} aria-label="뒤로"><Svg size={22}><path d="M15 18l-6-6 6-6" /></Svg></button>
          <div className={styles.mAppTitle}>루트 상세</div>
          <button className={styles.mAppIcon} onClick={doShare} aria-label="공유하기"><ShareIcon size={18} /></button>
          {canManage && (
            <div className={styles.mMenuWrap} ref={menuRef}>
              <button className={styles.mAppIcon} onClick={() => setMenuOpen(v => !v)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="더보기"><MoreIcon size={20} /></button>
              {menuOpen && (
                <div className={styles.kebabMenu} role="menu">
                  {isAuthor && !route.is_official && <Link href={`/route/${route.share_token}/edit`} className={styles.kebabItem} role="menuitem"><PencilIcon size={15} />수정하기</Link>}
                  <button className={styles.kebabItem} role="menuitem" onClick={handleTogglePublish} disabled={publishBusy}>{shared ? <><LockIcon size={15} />비공개로 전환</> : <><GlobeIcon size={15} />공개하기</>}</button>
                  {!isAuthor && isAdmin && <div className={styles.kebabNote}>관리자 권한</div>}
                  <button className={`${styles.kebabItem} ${styles.kebabDanger}`} role="menuitem" onClick={handleDelete} disabled={deleteBusy}><TrashIcon size={15} />삭제하기</button>
                </div>
              )}
            </div>
          )}
        </header>

        {/* 본문 정보 (외부 카드 없음) */}
        <div className={styles.mInfo}>
          {statusBadge && <div className={styles.mBadgeRow}>{statusBadge}</div>}
          <h1 className={styles.mTitle}>{route.title}</h1>
          <div className={styles.mAuthor}>{author ? `${author}의 루트` : '타쿠로드 루트'}{route.created_at && <> · {fmtDate(route.created_at)}</>}</div>
          {route.description && <p className={styles.mDesc}>{route.description}</p>}
          {tags.length > 0 && <div className={styles.mTags}>{tags.map(t => <span key={t as string} className={styles.mTag}>{t as string}</span>)}</div>}
          <div className={styles.mStats}>
            <span><MaskIcon name="shop" size={15} color="var(--accent)" />{spotCount}곳</span>
            {fmtDur(route.total_duration_min) && <span><MaskIcon name="clock" size={15} color="var(--accent)" />{fmtDur(route.total_duration_min)}</span>}
            {!singleSpot && route.total_distance_m ? <span><AppIcon name="route" size={15} color="var(--accent)" />도보 {formatDistance(route.total_distance_m)}</span> : null}
          </div>
        </div>

        {/* 상세 지도 — 탭 시 전체화면 */}
        {shopsWithCoords.length > 0 ? (
          <button className={styles.mMap} onClick={() => openInternalMap()} aria-label="전체화면 지도에서 보기">
            <RouteThumb stops={rtStops(route)} showEnds height={230} variant="detail" />
            <span className={styles.mMapExpand} aria-hidden><ExpandIcon size={16} /></span>
          </button>
        ) : (
          <div className={styles.mMapEmpty}><ColorIcon name="colormap" size={28} /><span>좌표 정보가 없어요</span></div>
        )}

        {/* CTA — 지도 아래 */}
        <div className={styles.mCta} ref={ctaRef}>
          <button className={styles.mStart} onClick={handleStart}><PinIcon size={17} color="#fff" />{started ? '이어서 따라가기' : '루트 시작하기'}</button>
          <button className={`${styles.mSave} ${saved ? styles.mSaveOn : ''}`} onClick={handleSave} disabled={savingBusy} aria-pressed={saved}><HeartIcon size={17} filled={saved} color={saved ? 'var(--accent)' : 'currentColor'} />저장</button>
        </div>

        {/* sticky 탭 */}
        <div className={styles.mTabs} role="tablist" aria-label="루트 정보">
          {MTABS.map(t => (
            <button key={t.key} role="tab" aria-selected={mobileTab === t.key} className={mobileTab === t.key ? styles.mTabOn : styles.mTab} onClick={() => setMobileTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className={styles.mTabBody}>
          {mobileTab === 'course' && (
            <>
              {authorNotes.length > 0 && (
                <div className={styles.block}>
                  <h2 className={styles.blockTitle}>여행 전 tip</h2>
                  <ul className={styles.notesList}>
                    {authorNotes.map((n, i) => <li key={i} className={styles.noteItem}><span className={styles.noteCheck}><CheckIcon size={13} color="var(--accent)" /></span>{n}</li>)}
                  </ul>
                </div>
              )}
              {singleSpot ? <p className={styles.singleNote}>한 곳으로 이루어진 루트예요. 이동 경로·거리는 표시하지 않아요.</p> : timelineOl}
              {tipsBlock}
            </>
          )}
          {mobileTab === 'reviews' && (
            <div className={styles.reviewEmpty}>
              <MaskIcon name="star" size={26} color="var(--muted)" />
              <p>완주 후기 기능은 준비 중이에요.<br />루트를 다녀왔다면 ‘코스 안내’의 여행자 팁으로 경험을 공유해주세요.</p>
            </div>
          )}
          {mobileTab === 'related' && (
            related.length > 0 ? (
              <div className={styles.mRelated}>
                {related.slice(0, 6).map(r => (
                  <Link key={r.id} href={`/route/${r.share_token}`} className={styles.mRelatedCard}>
                    <div className={styles.mRelatedThumb}>
                      {r.cover_image_url ? <img src={r.cover_image_url} alt="" loading="lazy" /> : <ColorIcon name="colormap" size={24} />}
                      <span className={styles.mRelatedReason}>{r.reason}</span>
                    </div>
                    <div className={styles.mRelatedInfo}>
                      <div className={styles.mRelatedTitle}>{r.title}</div>
                      <div className={styles.mRelatedMeta}>스팟 {r.shop_count}곳{r.distance_m != null ? ` · ${(r.distance_m / 1000).toFixed(1)}km` : ''}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <p className={styles.emptyLine}>관련 루트가 아직 없어요.</p>
          )}
        </div>

        {/* sticky 시작 버튼 — inline CTA가 화면 밖일 때만 */}
        {!ctaVisible && (
          <div className={styles.mStickyCta}>
            <button className={styles.mStart} onClick={handleStart}><PinIcon size={17} color="#fff" />{started ? '이어서 따라가기' : '루트 시작하기'}</button>
          </div>
        )}

        {toast && <div className={styles.toast} role="status">{toast}</div>}
        {showComplete && (
          <div className={styles.completeOverlay} role="dialog" aria-modal="true" onClick={() => setShowComplete(false)}>
            <div className={styles.completeCard} onClick={e => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/taku/taku-checkin.png" alt="" className={styles.completeChar} />
              <div className={styles.completeSub}>루트 완주</div>
              <div className={styles.completeTitle}>{route.title}</div>
              <p className={styles.completeMsg}>완주를 축하합니다!<br />{spotCount}곳을 모두 둘러봤어요.</p>
              <div className={styles.completeBtns}>
                <button className={styles.completeShare} onClick={() => { setShowComplete(false); openInternalMap() }}>지도에서 다시 보기</button>
                <button className={styles.completeClose} onClick={() => setShowComplete(false)}>확인</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="위치">
        <Link href="/">홈</Link><span className={styles.crumbSep}>›</span>
        <Link href="/routes">루트</Link><span className={styles.crumbSep}>›</span>
        <span className={styles.crumbCurrent} title={route.title}>{route.title}</span>
      </nav>

      <div className={styles.layout}>
        <div className={styles.main}>
          {/* 상단: 정보 40 + 지도 60 (한 박스 안에) */}
          <div className={styles.topBox}>
          <div className={styles.topGrid}>
            <div className={styles.infoCard}>
              <div className={styles.infoTop}>
                <div className={styles.badgeRow}>
                  {route.is_official
                    ? <span className={styles.officialBadge}><MaskIcon name="star" size={12} color="#fff" />추천</span>
                    : canManage
                      ? <span className={`${styles.statusBadge} ${shared ? styles.statusPublic : styles.statusDraft}`}>{shared ? '공개됨' : '작성중'}</span>
                      : null}
                </div>
                <div className={styles.infoTopActions}>
                  <button className={styles.topIconBtn} onClick={doShare} aria-label="공유하기" title="공유하기"><ShareIcon size={16} /></button>
                  {canManage && (
                    <div className={styles.kebabWrap} ref={menuRef}>
                      <button className={styles.topIconBtn} onClick={() => setMenuOpen(v => !v)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="더보기" title="더보기"><MoreIcon size={18} /></button>
                      {menuOpen && (
                        <div className={styles.kebabMenu} role="menu">
                          {isAuthor && !route.is_official && <Link href={`/route/${route.share_token}/edit`} className={styles.kebabItem} role="menuitem"><PencilIcon size={15} />수정하기</Link>}
                          <button className={styles.kebabItem} role="menuitem" onClick={handleTogglePublish} disabled={publishBusy}>
                            {shared ? <><LockIcon size={15} />비공개로 전환</> : <><GlobeIcon size={15} />공개하기</>}
                          </button>
                          {!isAuthor && isAdmin && <div className={styles.kebabNote}>관리자 권한</div>}
                          <button className={`${styles.kebabItem} ${styles.kebabDanger}`} role="menuitem" onClick={handleDelete} disabled={deleteBusy}><TrashIcon size={15} />삭제하기</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <h1 className={styles.infoTitle}>{route.title}</h1>
              <div className={styles.infoAuthor}>{author ? `${author}의 루트` : '타쿠로드 루트'}{route.created_at && <> · {fmtDate(route.created_at)}</>}</div>
              {route.description && <p className={styles.infoDesc}>{route.description}</p>}
              {tags.length > 0 && <div className={styles.tagRow}>{tags.map(t => <span key={t as string} className={styles.tag}>{t as string}</span>)}</div>}
              <div className={styles.metaRow}>
                {region && <span className={styles.metaItem}><MaskIcon name="map" size={14} color="var(--accent)" />{region}</span>}
                <span className={styles.metaItem}><MaskIcon name="shop" size={14} color="var(--accent)" />{spotCount}곳</span>
                {fmtDur(route.total_duration_min) && <span className={styles.metaItem}><MaskIcon name="clock" size={14} color="var(--accent)" />{fmtDur(route.total_duration_min)}</span>}
                {!singleSpot && route.total_distance_m ? <span className={styles.metaItem}><AppIcon name="route" size={14} color="var(--accent)" />도보 {formatDistance(route.total_distance_m)}</span> : null}
              </div>
              <div className={styles.actionRow}>
                <button className={styles.btnPrimary} onClick={handleStart}><PinIcon size={16} color="#fff" />루트 시작하기</button>
                <SaveBtn cls={`${styles.btnGhost} ${saved ? styles.btnGhostActive : ''}`} />
              </div>
            </div>

            <div className={styles.mapWrap}>
              {shopsWithCoords.length > 0 ? (
                <>
                  <RouteThumb stops={rtStops(route)} showEnds height={340} />
                  <button className={styles.bigMapBtn} onClick={() => router.push(`/map?routeId=${route.share_token}`)}><ExpandIcon size={15} />타쿠로드 지도에서 보기</button>
                </>
              ) : (
                <div className={styles.mapPlaceholder}><ColorIcon name="colormap" size={30} /><span>좌표 정보가 없어요</span></div>
              )}
            </div>
          </div>
          </div>

          {/* 앵커 내비 */}
          <nav className={styles.anchorNav} aria-label="섹션">
            {ANCHORS.map(a => (
              <button key={a.key} className={activeAnchor === a.key ? styles.anchorOn : styles.anchorBtn} aria-current={activeAnchor === a.key} onClick={() => scrollTo(a.key)}>
                {a.label}{a.key === 'reviews' && ''}
              </button>
            ))}
          </nav>

          {/* 코스 안내 */}
          <section id="course" data-anchor="course" ref={sectionRefs.course} className={styles.section}>
            {route.description && (
              <div className={styles.block}>
                <h2 className={styles.blockTitle}>루트 소개</h2>
                <p className={styles.introText}>{route.description}</p>
              </div>
            )}

            {authorNotes.length > 0 && (
              <div className={styles.block}>
                <h2 className={styles.blockTitle}>여행 전 tip</h2>
                <ul className={styles.notesList}>
                  {authorNotes.map((n, i) => <li key={i} className={styles.noteItem}><span className={styles.noteCheck}><CheckIcon size={13} color="var(--accent)" /></span>{n}</li>)}
                </ul>
              </div>
            )}

            <div className={styles.block}>
              <div className={styles.blockHead}>
                <h2 className={styles.blockTitle}>방문 코스</h2>
                <button className={styles.foldBtn} onClick={() => setCourseOpen(o => !o)} aria-expanded={courseOpen}>{courseOpen ? '접기' : '펼치기'}<ChevronIcon size={15} style={{ transform: courseOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} /></button>
              </div>
              {courseOpen && timelineOl}
              {courseOpen && singleSpot && <p className={styles.singleNote}>한 곳으로 이루어진 루트예요. 이동 경로·거리는 표시하지 않아요.</p>}
            </div>

            {tipsBlock}
          </section>

          {/* 후기 */}
          <section id="reviews" data-anchor="reviews" ref={sectionRefs.reviews} className={styles.section}>
            <div className={styles.block}>
              <h2 className={styles.blockTitle}>후기</h2>
              <div className={styles.reviewEmpty}>
                <MaskIcon name="star" size={26} color="var(--muted)" />
                <p>완주 후기 기능은 준비 중이에요.<br />루트를 다녀왔다면 위의 ‘여행자 팁’으로 경험을 공유해주세요.</p>
              </div>
            </div>
          </section>

          {/* 관련 루트 */}
          {related.length > 0 && (
            <section id="related" data-anchor="related" ref={sectionRefs.related} className={styles.section}>
              <div className={styles.block}>
                <h2 className={styles.blockTitle}>관련 루트</h2>
                <div className={styles.relatedGrid}>
                  {related.slice(0, 3).map(r => (
                    <Link key={r.id} href={`/route/${r.share_token}`} className={styles.relatedCard}>
                      <div className={styles.relatedThumb}>
                        {r.cover_image_url ? <img src={r.cover_image_url} alt="" loading="lazy" /> : <ColorIcon name="colormap" size={26} />}
                        <span className={styles.relatedReason}>{r.reason}</span>
                      </div>
                      <div className={styles.relatedTitle}>{r.title}</div>
                      <div className={styles.relatedMeta}>스팟 {r.shop_count}곳{r.distance_m != null ? ` · ${(r.distance_m / 1000).toFixed(1)}km` : ''}</div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* 우측 sticky */}
        <aside className={styles.rail}>
          <div className={styles.railCard}>
            <h3 className={styles.followTitle}><PinIcon size={17} color="var(--accent)" />이 루트 따라가기</h3>
            {firstDist != null && <div className={styles.firstDist}><MaskIcon name="pin" size={14} color="var(--accent)" />첫 장소까지 {formatDistance(firstDist)}</div>}
            {started && spotCount > 0 && (
              <div className={styles.progress}>
                <div className={styles.progressBar}><span style={{ width: `${Math.round((visitedCount / spotCount) * 100)}%` }} /></div>
                <span className={styles.progressPct}>{visitedCount}/{spotCount} 방문</span>
              </div>
            )}
            <button className={styles.railPrimary} onClick={handleStart}><PinIcon size={16} color="#fff" />{started ? '이어서 따라가기' : '루트 시작하기'}</button>
            <SaveBtn cls={`${styles.railGhost} ${saved ? styles.railGhostOn : ''}`} />
            {shopsWithCoords.length > 0 && <button className={styles.railLink} onClick={() => openInternalMap()}><ExpandIcon size={13} />타쿠로드 지도에서 보기</button>}
          </div>

          <div className={styles.railCard}>
            <h3 className={styles.railCardTitle}>루트 요약</h3>
            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}><span className={styles.summaryLabel}><MaskIcon name="shop" size={15} color="var(--muted)" />장소</span><b>{spotCount}곳</b></div>
              {fmtDur(route.total_duration_min) && <div className={styles.summaryRow}><span className={styles.summaryLabel}><MaskIcon name="clock" size={15} color="var(--muted)" />소요 시간</span><b>{fmtDur(route.total_duration_min)}</b></div>}
              {!singleSpot && route.total_distance_m ? <div className={styles.summaryRow}><span className={styles.summaryLabel}><AppIcon name="route" size={15} color="var(--muted)" />이동 거리</span><b>도보 {formatDistance(route.total_distance_m)}</b></div> : null}
              {diff && <div className={styles.summaryRow}><span className={styles.summaryLabel}><MaskIcon name="fire" size={15} color={diff.color} />난이도</span><b style={{ color: diff.color }}>{diff.label}</b></div>}
            </div>
          </div>

          {routeTips.length > 0 && (
            <div className={styles.railCard}>
              <div className={styles.railCardHead}>
                <h3 className={styles.railCardTitle}>여행자 팁 {routeTips.length}</h3>
                <button className={styles.railMore} onClick={() => scrollTo('course')}>전체 보기 ›</button>
              </div>
              <ul className={styles.tipPreview}>
                {routeTips.slice(0, 2).map(tp => (
                  <li key={tp.id} className={styles.tipPreviewItem}>
                    <p>{tp.content}</p>
                    <span>{tp.nickname ?? '익명'} · {fmtDate(tp.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {/* 모바일 하단 고정 액션 */}
      <div className={styles.mobileBar}>
        <SaveBtn cls={styles.mobileSave} />
        <button className={styles.mobileStart} onClick={handleStart}><PinIcon size={16} color="#fff" />{started ? '이어서 따라가기' : '루트 시작하기'}</button>
      </div>

      {toast && <div className={styles.toast} role="status">{toast}</div>}

      {showComplete && (
        <div className={styles.completeOverlay} role="dialog" aria-modal="true" onClick={() => setShowComplete(false)}>
          <div className={styles.completeCard} onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/taku/taku-checkin.png" alt="" className={styles.completeChar} />
            <div className={styles.completeSub}>루트 완주</div>
            <div className={styles.completeTitle}>{route.title}</div>
            <p className={styles.completeMsg}>완주를 축하합니다!<br />{spotCount}곳을 모두 둘러봤어요.</p>
            <div className={styles.completeBtns}>
              <button className={styles.completeShare} onClick={() => { setShowComplete(false); openInternalMap() }}>지도에서 다시 보기</button>
              <button className={styles.completeClose} onClick={() => setShowComplete(false)}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
