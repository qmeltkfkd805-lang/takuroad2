'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Shop } from '@/types/shop'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import { getTodayStatus, getPopupStatus } from '@/lib/utils/date'
import { ROUTES } from '@/lib/constants/routes'
import { useAuth } from '@/components/layout/AuthProvider'
import { useSaved } from '@/hooks/useSaved'
import { getShopAmenities } from '@/services/shopAmenityService'
import { getShopTags, getAllGoodsTypes, getShopGoodsCategories } from '@/services/shopProductService'
import { getReviews } from '@/services/reviewService'
import { deleteShop } from '@/services/shopService'
import { getMyLevelInfo } from '@/services/expService'
import KakaoMap, { KakaoMapRef } from '@/components/map/KakaoMap'
import { Review } from '@/types/review'
import { getActiveShopEvents } from '@/services/shopEventService'
import { getEventsByShop } from '@/services/eventService'
import { EventStatusBadge } from '@/components/tds/EventStatusBadge'
import ShopHighlights from './ShopHighlights'
import ShopProductAccordion from './ShopProductAccordion'
import ShopAmenityBadges from './ShopAmenityBadges'
import ReviewSection from './ReviewSection'
import VerifyRequestButton from './VerifyRequestButton'
import ReportIssueButton from './ReportIssueButton'
import CheckInButton from './CheckInButton'

interface Props {
  shop: Shop
  /** 루트 만들기 상태에 연결할 핸들러 (미연결 시 /routes로 이동) */
  onAddToRoute?: (shop: Shop) => void
}

type TabId = 'intro' | 'events' | 'works' | 'photos' | 'reviews'
const TABS: { id: TabId; label: string }[] = [
  { id: 'intro', label: '정보' },
  { id: 'events', label: '이벤트' },
  { id: 'works', label: '취급 작품' },
  { id: 'photos', label: '사진' },
  { id: 'reviews', label: '리뷰' },
]

const TIPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'package', title: '입고 정보', body: '신상품 입고 요일이나 재입고 소식은 샵 공식 SNS에서 확인하세요.' },
  { icon: 'point', title: '포인트 적립', body: '멤버십 가입 시 구매 금액의 일부를 포인트로 적립받을 수 있어요.' },
  { icon: 'reserve', title: '굿즈 예약', body: '인기 굿즈는 예약 판매가 진행돼요. 매장 또는 온라인으로 문의하세요.' },
  { icon: 'refund', title: '환불 / 교환', body: '교환·환불은 매장 정책에 따라 달라요. 방문 전 미리 확인하는 걸 추천해요.' },
]

function detectSns(url: string | null): { name: string; url: string } | null {
  if (!url) return null
  const u = url.toLowerCase()
  if (u.includes('instagram.com')) return { name: 'instagram', url }
  if (u.includes('x.com') || u.includes('twitter.com')) return { name: 'x', url }
  if (u.includes('youtube.com') || u.includes('youtu.be')) return { name: 'youtube', url }
  if (u.includes('kakao')) return { name: 'kakao', url }
  if (u.includes('naver')) return { name: 'naver', url }
  return { name: 'globe', url }
}

export default function ShopDetailPageDesktop({ shop }: Props) {
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const { isSaved, toggleSave } = useSaved()

  const catInfo = CATEGORY_NAME_MAP[shop.cat]
  const color = 'var(--accent)'
  const todayStatus = getTodayStatus(shop.hours)
  const popupStatus = getPopupStatus(shop.start_date, shop.end_date)
  const saved = isSaved(shop.id)
  const [bookmarkCount, setBookmarkCount] = useState(shop.bookmark_count)
  const [menuOpen, setMenuOpen] = useState(false)
  const canManage = isAdmin || (!!user && shop.owner_id === user.id)
  const region = [shop.region, shop.district ?? shop.city].filter(Boolean)

  const snsAll = (shop.sns_links?.length ? shop.sns_links : (shop.shop_link ? [shop.shop_link] : []))
    .map(detectSns).filter(Boolean) as { name: string; url: string }[]
  const homepage = snsAll.find(x => x.name === 'globe') ?? null
  const holidayClosed = (shop.hours as any)?.holiday === 'closed'
  const yearRound = (shop.hours as any)?.yearRound === true

  const [idx, setIdx] = useState(0)
  const images = shop.images ?? []
  const hasImages = images.length > 0
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  useEffect(() => {
    if (lightboxIdx === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null)
      else if (e.key === 'ArrowLeft') setLightboxIdx(i => i === null ? i : (i - 1 + images.length) % images.length)
      else if (e.key === 'ArrowRight') setLightboxIdx(i => i === null ? i : (i + 1) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIdx, images.length])
  const go = (d: number) => setIdx(i => (i + d + images.length) % images.length)

  const [highlights, setHighlights] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    getShopAmenities(shop.id).then(g => setHighlights((g['highlight'] as { id: string; name: string }[]) ?? []))
  }, [shop.id])

  const [works, setWorks] = useState<{ id: string; name: string; slug: string }[]>([])
  useEffect(() => { getShopTags(shop.id).then(setWorks) }, [shop.id])
  const [goodsTypes, setGoodsTypes] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    Promise.all([getAllGoodsTypes(), getShopGoodsCategories(shop.id)])
      .then(([all, ids]) => setGoodsTypes((all as any[]).filter(g => ids.includes(g.id)).map(g => ({ id: g.id, name: g.name }))))
  }, [shop.id])
  const [reviews, setReviews] = useState<Review[]>([])
  useEffect(() => { getReviews(shop.id).then(setReviews) }, [shop.id])
  const [levels, setLevels] = useState<Record<string, number>>({})
  useEffect(() => {
    const recent = [...reviews].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 2)
    const ids = Array.from(new Set(recent.map(r => r.user_id).filter(Boolean))) as string[]
    if (ids.length === 0) return
    Promise.all(ids.map(id => getMyLevelInfo(id).then(info => [id, info.level] as const).catch(() => [id, null] as const)))
      .then(pairs => setLevels(Object.fromEntries(pairs.filter(([, l]) => l != null) as [string, number][])))
  }, [reviews])
  const locMapRef = useRef<KakaoMapRef>(null)
  useEffect(() => {
    if (!shop.lat || !shop.lng) return
    let n = 0
    const id = setInterval(() => {
      locMapRef.current?.relayout()
      locMapRef.current?.moveCenter(shop.lat!, shop.lng!, 4)
      if (++n >= 10) clearInterval(id)
    }, 250)
    return () => clearInterval(id)
  }, [shop.lat, shop.lng])
  const [shopEvents, setShopEvents] = useState<any[]>([])
  useEffect(() => { getActiveShopEvents(shop.id).then(setShopEvents) }, [shop.id])
  const [workEvents, setWorkEvents] = useState<any[]>([])
  useEffect(() => { getEventsByShop(shop.id).then(setWorkEvents) }, [shop.id])
  const [eventsPage, setEventsPage] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const allEvents = [
    ...shopEvents.map((e: any) => ({ id: String(e.id), title: e.title, type: e.type, start: e.starts_at ?? null, end: e.ends_at ?? null, image: e.image_url ?? null, description: e.description ?? null })),
    ...workEvents.map((e: any) => ({ id: `work-${e.id}`, title: e.title, type: e.type, start: e.startDate ?? null, end: e.endDate ?? null, image: null, description: null })),
  ]
  const EVENTS_PER_PAGE = 4
  const eventsTotalPages = Math.max(1, Math.ceil(allEvents.length / EVENTS_PER_PAGE))
  const pagedEvents = allEvents.slice(eventsPage * EVENTS_PER_PAGE, eventsPage * EVENTS_PER_PAGE + EVENTS_PER_PAGE)
  const worksRef = useRef<HTMLDivElement>(null)
  const [worksPage, setWorksPage] = useState(0)
  const WORKS_PER_PAGE = 16 // 4열 × 4줄
  const worksTotalPages = Math.max(1, Math.ceil(works.length / WORKS_PER_PAGE))
  const pagedWorks = works.slice(worksPage * WORKS_PER_PAGE, worksPage * WORKS_PER_PAGE + WORKS_PER_PAGE)
  const worksPageWindow = (() => {
    const win = 5
    if (worksTotalPages <= win) return Array.from({ length: worksTotalPages }, (_, i) => i)
    const start = Math.max(0, Math.min(worksPage - 2, worksTotalPages - win))
    return Array.from({ length: win }, (_, i) => start + i)
  })()

  // ── 탭: 페이지 전환 방식(활성 탭 내용만 렌더) ──
  const [tab, setTab] = useState<TabId>('intro')
  const sp = useSearchParams()
  useEffect(() => { if (sp.get('review') || sp.get('comment')) setTab('reviews') }, [sp])

  // ── Quick Actions ──
  const handleSave = async () => {
    if (!user) { router.push(ROUTES.login); return }
    setBookmarkCount(c => saved ? Math.max(0, c - 1) : c + 1)
    await toggleSave(shop.id)
  }
  async function handleDelete() {
    setMenuOpen(false)
    if (!user) return
    if (!window.confirm('정말 이 샵을 삭제할까요? 되돌릴 수 없어요.')) return
    const ok = await deleteShop(shop.id, user.id)
    if (ok) router.push('/map')
    else window.alert('삭제에 실패했어요. 권한이 없거나 연결된 데이터가 있을 수 있어요.')
  }
  const handleDirections = () =>
    window.open(`https://map.kakao.com/link/search/${encodeURIComponent(shop.name)}`, '_blank', 'noopener')
  const handleShare = () => {
    if (navigator.share) navigator.share({ title: shop.name, url: window.location.href })
    else navigator.clipboard?.writeText(window.location.href)
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '20px 24px 64px' }}>
        <style>{`.taku-page-2col{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;align-items:start}@media (max-width:900px){.taku-page-2col{grid-template-columns:1fr}}`}</style>

        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          <Link href={ROUTES.home} style={{ color: 'inherit' }}>홈</Link>
          <span>›</span>
          <Link href="/map" style={{ color: 'inherit' }}>지도</Link>
          {region.map((r, i) => (
            <span key={i} style={{ display: 'inline-flex', gap: 8 }}><span>›</span><span>{r}</span></span>
          ))}
          <span>›</span>
          <span style={{ color: 'var(--text)', fontWeight: 700 }}>{shop.name}</span>
        </nav>

        {/* 2컬럼: 본문(히어로 포함) + Sticky 사이드바 (좁으면 세로로 쌓임) */}
        <div className="taku-page-2col">

          {/* ===== 왼쪽 ===== */}
          <main style={{ minWidth: 0 }}>

            {/* Hero */}
            <div style={{ position: 'relative', height: 300, borderRadius: 18, overflow: 'hidden', background: catInfo?.bgColor ?? 'var(--surface2)' }}>
              {hasImages ? (
                <img src={images[idx]} alt={shop.name} onClick={() => setLightboxIdx(idx)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 84 }}>
                  {catInfo?.icon ? <CatIcon name={catInfo.icon} color={color} size={80} /> : <svg width={72} height={72} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .5 }}><path d="M3 9l1-5h16l1 5" /><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M9 20v-6h6v6" /><path d="M3 9h18" /></svg>}
                </div>
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,.72) 0%, rgba(0,0,0,.25) 42%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }} />
              {canManage && (
                <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 6 }}>
                  <button onClick={() => setMenuOpen(o => !o)} aria-label="관리 메뉴" style={{ width: 36, height: 36, borderRadius: 9999, border: 'none', background: 'rgba(0,0,0,.45)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                  </button>
                  {menuOpen && (
                    <div style={{ position: 'absolute', top: 44, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.18)', overflow: 'hidden', minWidth: 150 }}>
                      {!!user && shop.owner_id === user.id && shop.is_claimed && (
                        <button onClick={() => { setMenuOpen(false); router.push('/shop/' + shop.slug + '/manage') }} style={{ ...menuItemStyle, fontWeight: 800, color: color }}>🏪 매장 관리</button>
                      )}
                      <button onClick={() => { setMenuOpen(false); router.push(ROUTES.shopEdit(shop.slug)) }} style={menuItemStyle}>수정하기</button>
                      <button onClick={handleDelete} style={{ ...menuItemStyle, color: '#e04343', borderTop: '1px solid var(--border)' }}>샵 삭제하기</button>
                    </div>
                  )}
                </div>
              )}
              <div style={{ position: 'absolute', left: 24, bottom: 22, right: 24, color: '#fff' }}>
                <h1 style={{ fontSize: 27, fontWeight: 900, lineHeight: 1.2, marginBottom: 10, textShadow: '0 2px 12px rgba(0,0,0,.4)' }}>
                  {shop.name}
                  {shop.is_claimed && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 10, verticalAlign: 'middle', fontSize: 12, fontWeight: 800, color: '#fff', background: color, padding: '4px 10px', borderRadius: 9999, textShadow: 'none' }}>🏪 인증된 사장님</span>
                  )}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
                  {shop.rating_count > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: color, color: '#fff', fontWeight: 800, fontSize: 12.5, padding: '4px 10px', borderRadius: 9999 }}>
                      <Ico name="star" size={13} /> {shop.rating_avg.toFixed(1)} <span style={{ opacity: .85, fontWeight: 600 }}>({shop.rating_count})</span>
                    </span>
                  )}
                  {bookmarkCount > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.18)', color: '#fff', fontWeight: 700, fontSize: 12.5, padding: '4px 10px', borderRadius: 9999 }}>
                      <Ico name="bookmark" size={12} filled /> 저장 {bookmarkCount}
                    </span>
                  )}
                </div>
                {shop.cats?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
                    {shop.cats.map(c => (
                      <span key={c} style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 9999, background: 'rgba(255,255,255,.16)', color: '#fff' }}>{c}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: 'rgba(255,255,255,.95)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 9999, background: todayStatus.isOpen ? '#3ddc97' : '#ff8a8a' }} />
                    <strong style={{ color: todayStatus.isOpen ? '#3ddc97' : '#ff8a8a' }}>{todayStatus.label}</strong>
                    {todayStatus.todayHours && <span>· {todayStatus.todayHours}</span>}
                    {holidayClosed && <span style={{ color: '#ffd0d0', fontWeight: 700 }}>· 공휴일 휴무</span>}
                    {yearRound && <span style={{ color: 'rgba(255,255,255,.9)' }}>· 연중무휴</span>}
                  </span>
                  {shop.temporary_holiday_end && new Date(shop.temporary_holiday_end) >= new Date(new Date().toDateString()) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.18)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontWeight: 800, fontSize: 12.5, alignSelf: 'flex-start', marginTop: 2, backdropFilter: 'blur(4px)' }}>
                      <span style={{ color: '#ffb3b3' }}>📢 임시 휴무</span>
                      <span style={{ fontWeight: 600, opacity: .95 }}>
                        {shop.temporary_holiday_start}{shop.temporary_holiday_end && shop.temporary_holiday_end !== shop.temporary_holiday_start ? ' ~ ' + shop.temporary_holiday_end : ''}
                        {shop.temporary_holiday_message ? ' · ' + shop.temporary_holiday_message : ''}
                      </span>
                    </span>
                  )}
                  {shop.addr && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Ico name="pin" size={14} /> {shop.addr}{shop.floor_info ? ` (${shop.floor_info})` : ''}
                    </span>
                  )}
                </div>
              </div>
              {images.length > 1 && (
                <>
                  <button onClick={() => go(-1)} aria-label="이전 사진" style={heroArrow('left')}>‹</button>
                  <button onClick={() => go(1)} aria-label="다음 사진" style={heroArrow('right')}>›</button>
                  <div style={{ position: 'absolute', right: 14, bottom: 14, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 9999 }}>
                    {idx + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: 10, margin: '16px 0 8px' }}>
              <QuickBtn onClick={handleSave} active={saved} activeColor={color} icon={<Ico name="bookmark" filled={saved} />} label="저장" />
              <QuickBtn onClick={handleShare} icon={<Ico name="share" />} label="공유" />
            </div>

            {/* 방문했어요 — 방문 기록(Activity) 생성 */}
            <div style={{ margin: '4px 0 16px' }}>
              <CheckInButton
                shopId={shop.id}
                shopName={shop.name}
                shopLat={shop.lat}
                shopLng={shop.lng}
                accentColor={color}
              />
            </div>

            {/* 탭 바 (클릭 시 내용 전환) */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 50, background: 'var(--surface)',
              borderBottom: '1px solid var(--border)', marginBottom: 24, display: 'flex', gap: 4,
            }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 14.5, fontWeight: tab === t.id ? 800 : 600,
                  color: tab === t.id ? color : 'var(--muted)',
                  borderBottom: `2px solid ${tab === t.id ? color : 'transparent'}`, marginBottom: -1,
                }}>{t.label}</button>
              ))}
            </div>

            {/* ── 탭 내용 ── */}

            {tab === 'intro' && (
              <div>
                {/* 소개 (+ 특징 칩) */}
                <Section title="샵 소개">
                  {shop.description
                    ? <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{shop.description}</p>
                    : <p style={{ color: 'var(--muted)' }}>아직 소개가 등록되지 않았어요.</p>}
                  {highlights.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                      {highlights.map(h => (
                        <span key={h.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 7,
                          padding: '8px 14px', borderRadius: 9999,
                          background: 'rgba(232,0,111,.08)', color, fontSize: 13, fontWeight: 800,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: 9999, background: color }} />
                          {h.name}
                        </span>
                      ))}
                    </div>
                  )}
                </Section>

                {/* 기본 정보 */}
                <Section title="기본 정보">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 40px' }}>
                    <InfoItem label="영업 상태" value={
                      shop.status === 'closed'
                        ? <span style={{ color: '#ef5a5a', fontWeight: 800 }}>폐점</span>
                        : shop.status === 'temporary_closed'
                          ? <span style={{ color: '#3e8fc9', fontWeight: 800 }}>임시 휴업</span>
                          : <span>
                              <span style={{ color: todayStatus.isOpen ? '#14b8a0' : '#ef5a5a', fontWeight: 800 }}>{todayStatus.label}</span>
                              {todayStatus.todayHours && <span style={{ color: 'var(--muted)' }}> · {todayStatus.todayHours}</span>}
                              {holidayClosed && <span style={{ color: '#c0392b', fontWeight: 800 }}> · 공휴일 휴무</span>}
                              {yearRound && <span style={{ color: 'var(--muted)', fontWeight: 700 }}> · 연중무휴</span>}
                            </span>
                    } />
                    <InfoItem label="공식 홈페이지" value={homepage
                      ? <a href={homepage.url} target="_blank" rel="noopener noreferrer" style={{ color }}>{homepage.url.replace(/^https?:\/\//, '')}</a>
                      : <span style={{ color: 'var(--muted)' }}>정보 없음</span>} />
                    <InfoItem label="전화번호" value={shop.phone ? <a href={`tel:${shop.phone}`} style={{ color }}>{shop.phone}</a> : <span style={{ color: 'var(--muted)' }}>정보 없음</span>} />
                    <InfoItem label="SNS" value={snsAll.length
                      ? <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
                          {snsAll.map((e, i) => (
                            <a key={i} href={e.url} target="_blank" rel="noopener noreferrer" aria-label={e.name} title={e.url}
                              style={{ display: 'inline-flex', color }}>
                              <SnsIcon name={e.name} size={24} />
                            </a>
                          ))}
                        </span>
                      : <span style={{ color: 'var(--muted)' }}>정보 없음</span>} />
                    <InfoItem label="주소" value={shop.addr ? `${shop.addr}${shop.floor_info ? ` (${shop.floor_info})` : ''}` : <span style={{ color: 'var(--muted)' }}>정보 없음</span>} />
                    {shop.place_slug && shop.place_name && (
                      <InfoItem label="장소" value={
                        <a href={`/place/${shop.place_slug}`} style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Ico name="pin" size={13} /> {shop.place_name} ›
                        </a>
                      } />
                    )}
                    <InfoItem label="주차" value={shop.parking === null
                      ? <span style={{ color: 'var(--muted)' }}>정보 없음</span>
                      : shop.parking
                        ? <span>주차 가능{shop.parking_note && <><br /><span style={{ color: 'var(--muted)', fontSize: 13 }}>{shop.parking_note}</span></>}</span>
                        : '주차 불가'} />
                  </div>
                  {holidayClosed && (
                    <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(239,90,90,.09)', color: '#c0392b', fontSize: 13, fontWeight: 700 }}>
                      영업 중으로 표시되어 있어도 공휴일은 휴무입니다.
                    </div>
                  )}
                  {!shop.is_claimed && <VerifyRequestButton shopId={shop.id} shopName={shop.name} slug={shop.slug} accentColor={color} />}
                  <ReportIssueButton shopId={shop.id} label="정보 수정 제안하기" variant="dashed" accentColor={color} />
                </Section>

                {/* 편의시설 / 서비스 */}
                <div style={cardStyle}>
                  <ShopAmenityBadges shopId={shop.id} />
                </div>

                {/* 이용 팁 */}
                <Section title="이용 팁">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {TIPS.map(t => (
                      <div key={t.title} style={{ background: 'var(--surface2)', borderRadius: 14, padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14.5, marginBottom: 8, color }}>
                          <Ico name={t.icon} size={19} /> <span style={{ color: 'var(--text)' }}>{t.title}</span>
                        </div>
                        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--muted)' }}>{t.body}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}

            {tab === 'events' && (
              <Section title="이벤트 · 소식">
                {popupStatus.status && (
                  <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: 'var(--surface2)', fontSize: 13.5, fontWeight: 700 }}>
                    팝업 {popupStatus.label}
                    {shop.start_date && shop.end_date && <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>{shop.start_date} ~ {shop.end_date}</span>}
                    {shop.event_info && <p style={{ marginTop: 6, fontWeight: 400, lineHeight: 1.6 }}>{shop.event_info}</p>}
                  </div>
                )}
                {allEvents.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>진행 중인 이벤트·소식이 없어요.</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {pagedEvents.map(e => {
                        const dateRange = [evFmt(e.start), evFmt(e.end)].filter(Boolean).join(' ~ ')
                        return (
                          <div key={e.id} onClick={() => setSelectedEvent(e)} style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', cursor: 'pointer' }}>
                            <div style={{ position: 'relative', width: 108, flexShrink: 0, background: e.image ? '#f5f2ee' : 'linear-gradient(135deg,#FFE3EC,#FFF0F5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {e.image
                                ? <img src={e.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .55 }}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.08))', padding: '2px 8px', borderRadius: 9999 }}>{evLabel(e.type)}</span>
                                <EventStatusBadge startDate={e.start} endDate={e.end} now={new Date()} />
                              </div>
                              <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.title}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c-4.5-5.5-6.6-9.4-6.6-12.5a6.6 6.6 0 0 1 13.2 0c0 3.1-2.1 7-6.6 12.5z" /><circle cx="12" cy="8.5" r="2.3" /></svg>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[shop.name, dateRange].filter(Boolean).join(' · ')}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {eventsTotalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 16 }}>
                        <button onClick={() => setEventsPage(pg => Math.max(0, pg - 1))} disabled={eventsPage === 0} aria-label="이전" style={{ border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 16, color: 'var(--muted)', padding: 2, cursor: eventsPage === 0 ? 'default' : 'pointer', opacity: eventsPage === 0 ? 0.3 : 1 }}>&lsaquo;</button>
                        {Array.from({ length: eventsTotalPages }).map((_, i) => (
                          <button key={i} onClick={() => setEventsPage(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: '2px 4px', color: i === eventsPage ? color : 'var(--muted)', fontWeight: i === eventsPage ? 800 : 600 }}>{i + 1}</button>
                        ))}
                        <button onClick={() => setEventsPage(pg => Math.min(eventsTotalPages - 1, pg + 1))} disabled={eventsPage === eventsTotalPages - 1} aria-label="다음" style={{ border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 16, color: 'var(--muted)', padding: 2, cursor: eventsPage === eventsTotalPages - 1 ? 'default' : 'pointer', opacity: eventsPage === eventsTotalPages - 1 ? 0.3 : 1 }}>&rsaquo;</button>
                      </div>
                    )}
                  </>
                )}
                <button onClick={() => router.push(`/event/new?shop=${shop.slug}`)} style={dashedBtn}>
                  <Ico name="plus" size={15} /> 이벤트 등록하기
                </button>

                {selectedEvent && (
                  <div onClick={() => setSelectedEvent(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                    <div onClick={ev => ev.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, maxWidth: 440, width: '100%', maxHeight: '86vh', overflow: 'auto' }}>
                      {selectedEvent.image ? (
                        <img src={selectedEvent.image} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ height: 140, background: 'linear-gradient(135deg,#FFE3EC,#FFF0F5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .55 }}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
                        </div>
                      )}
                      <div style={{ padding: '20px 22px 22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.08))', padding: '3px 10px', borderRadius: 9999 }}>{evLabel(selectedEvent.type)}</span>
                          <EventStatusBadge startDate={selectedEvent.start} endDate={selectedEvent.end} now={new Date()} />
                        </div>
                        <h3 style={{ fontSize: 19, fontWeight: 900, marginBottom: 14, lineHeight: 1.3 }}>{selectedEvent.title}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5, color: 'var(--muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
                            <span>{[evFmt(selectedEvent.start), evFmt(selectedEvent.end)].filter(Boolean).join(' ~ ') || '상시'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c-4.5-5.5-6.6-9.4-6.6-12.5a6.6 6.6 0 0 1 13.2 0c0 3.1-2.1 7-6.6 12.5z" /><circle cx="12" cy="8.5" r="2.3" /></svg>
                            <span>{shop.name}{shop.addr ? ` · ${shop.addr}` : ''}</span>
                          </div>
                        </div>
                        {selectedEvent.description && <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{selectedEvent.description}</p>}
                        <button onClick={() => setSelectedEvent(null)} style={{ marginTop: 20, width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>닫기</button>
                      </div>
                    </div>
                  </div>
                )}
              </Section>
            )}

            {tab === 'works' && (
              <Section title="취급 작품 · 굿즈">
                {works.length > 0 ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 180px)', justifyContent: 'start', gap: 12, marginBottom: worksTotalPages > 1 ? 16 : 24 }}>
                      {pagedWorks.map(w => (
                        <Link key={w.id} href={`/work/${w.slug}`} style={{
                          border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
                          background: 'var(--surface)', textDecoration: 'none', color: 'inherit', display: 'block',
                        }}>
                          <div style={{ height: 96, background: 'linear-gradient(135deg, var(--accent), #ff8fb1)' }} />
                          <div style={{ padding: '10px 12px 12px' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                    {worksTotalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        {worksTotalPages > 5 && (
                          <button onClick={() => setWorksPage(pg => Math.max(0, pg - 1))} disabled={worksPage === 0} aria-label="이전"
                            style={{ border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 16, color: 'var(--muted)', padding: 2, cursor: worksPage === 0 ? 'default' : 'pointer', opacity: worksPage === 0 ? 0.3 : 1 }}>‹</button>
                        )}
                        {worksPageWindow.map(i => (
                          <button key={i} onClick={() => setWorksPage(i)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: '2px 4px', color: i === worksPage ? color : 'var(--muted)', fontWeight: i === worksPage ? 800 : 600 }}>{i + 1}</button>
                        ))}
                        {worksTotalPages > 5 && (
                          <button onClick={() => setWorksPage(pg => Math.min(worksTotalPages - 1, pg + 1))} disabled={worksPage === worksTotalPages - 1} aria-label="다음"
                            style={{ border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 16, color: 'var(--muted)', padding: 2, cursor: worksPage === worksTotalPages - 1 ? 'default' : 'pointer', opacity: worksPage === worksTotalPages - 1 ? 0.3 : 1 }}>›</button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ color: 'var(--muted)', marginBottom: 8 }}>등록된 취급 작품이 없어요.</p>
                )}
                <ShopHighlights shopId={shop.id} />
                <ShopProductAccordion shopId={shop.id} />
              </Section>
            )}

            {tab === 'photos' && (
              <Section title={`사진${images.length ? ` ${images.length}` : ''}`}>
                {hasImages ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {images.map((src, i) => (
                      <div key={i} onClick={() => setLightboxIdx(i)} style={{ aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', cursor: 'zoom-in', background: 'var(--surface2)' }}>
                        <img src={src} alt={`${shop.name} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                ) : <p style={{ color: 'var(--muted)' }}>등록된 사진이 없어요.</p>}
              </Section>
            )}

            {tab === 'reviews' && (
              <Section title="리뷰">
                <ReviewSection shopId={shop.id} shopName={shop.name} accentColor={color} />
              </Section>
            )}


          </main>

          {/* ===== Sticky 사이드바 (히어로 옆) ===== */}
          <aside style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SideCard title="위치">
              <div style={{ height: 160, borderRadius: 12, overflow: 'hidden', marginBottom: 12, background: 'var(--surface2)' }}>
                {shop.lat && shop.lng ? (
                  <KakaoMap ref={locMapRef} shops={[shop]} activeShopId={shop.id} myLocation={null} onSelectShop={() => {}} onMapClick={() => {}} onSelectGroup={() => {}} />
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ color }}><Ico name="pin" size={32} /></span>
                    {shop.addr && <span style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center', padding: '0 12px' }}>{shop.addr}</span>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleDirections} style={sideBtn(false, color)}>길찾기</button>
                <Link href={`/map?shop=${shop.slug}`} style={{ ...sideBtn(true, color), textDecoration: 'none', textAlign: 'center' }}>지도 크게 보기</Link>
              </div>
            </SideCard>

            <SideCard
              title="취급 작품"
              action={works.length > 2 ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => worksRef.current?.scrollBy({ left: -180, behavior: 'smooth' })} aria-label="이전" style={headerArrow}>‹</button>
                  <button onClick={() => worksRef.current?.scrollBy({ left: 180, behavior: 'smooth' })} aria-label="다음" style={headerArrow}>›</button>
                </div>
              ) : undefined}
            >
              {works.length > 0 ? (
                <>
                  <style>{`.taku-noscroll::-webkit-scrollbar{display:none}`}</style>
                  <div ref={worksRef} className="taku-noscroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                    {works.map(w => (
                      <Link key={w.id} href={`/work/${w.slug}`} style={{
                        flex: '0 0 auto', width: 112, border: '1px solid var(--border)', borderRadius: 12,
                        overflow: 'hidden', background: 'var(--surface)', textDecoration: 'none', color: 'inherit',
                      }}>
                        <div style={{ height: 70, background: 'linear-gradient(135deg, var(--accent), #ff8fb1)' }} />
                        <div style={{ padding: '8px 10px 10px' }}>
                          <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>등록된 취급 작품이 없어요.</p>
              )}

              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 900, marginBottom: 12 }}>주요 취급 상품</h4>
                {goodsTypes.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {goodsTypes.map(g => (
                      <span key={g.id} style={{ padding: '6px 11px', borderRadius: 9999, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>{g.name}</span>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--muted)', fontSize: 13 }}>등록된 취급 상품이 없어요.</p>
                )}
              </div>
            </SideCard>

            <SideCard title="리뷰 요약">
              {shop.rating_count > 0 ? (
                <>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>{shop.rating_avg.toFixed(1)}</div>
                      <div style={{ marginTop: 6 }}><Stars value={shop.rating_avg} /></div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>({shop.rating_count}개 리뷰)</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                      {[5, 4, 3, 2, 1].map(n => {
                        const cnt = reviews.filter(r => r.stars === n).length
                        const pct = reviews.length ? Math.round((cnt / reviews.length) * 100) : 0
                        return (
                          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                            <span style={{ color: 'var(--muted)', width: 24, flexShrink: 0 }}>{n}점</span>
                            <div style={{ flex: 1, height: 6, borderRadius: 9999, background: 'var(--surface2)', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 9999 }} />
                            </div>
                            <span style={{ color: 'var(--muted)', width: 34, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <button onClick={() => setTab('reviews')} style={{ ...sideBtn(true, color), width: '100%', marginTop: 14 }}>리뷰 전체 보기</button>
                </>
              ) : (
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>리뷰가 아직 없습니다.</p>
              )}
            </SideCard>

            <SideCard
              title="최근 리뷰"
              action={reviews.length > 0 ? <button onClick={() => setTab('reviews')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>전체 보기 ›</button> : undefined}
            >
              {reviews.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[...reviews].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 2).map(r => (
                    <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.author?.avatar_url
                          ? <img src={r.author.avatar_url} alt="" width={30} height={30} style={{ borderRadius: 9999, objectFit: 'cover', flexShrink: 0 }} />
                          : <span style={{ width: 30, height: 30, borderRadius: 9999, flexShrink: 0, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>{(r.author?.nickname ?? '?').slice(0, 1)}</span>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.author?.nickname ?? '익명'}</span>
                            {r.user_id && levels[r.user_id] != null && (
                              <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.08))', padding: '1px 6px', borderRadius: 9999, flexShrink: 0 }}>Lv.{levels[r.user_id]}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Ico name="star" size={11} /> {r.stars.toFixed(1)} · {timeAgo(r.created_at)}
                          </div>
                        </div>
                      </div>
                      {r.content && <p style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.content}</p>}
                      {r.images?.[0] && <img src={r.images[0]} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover' }} />}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>아직 작성된 리뷰가 없습니다.</p>
              )}
            </SideCard>
          </aside>
        </div>
      </div>

      {lightboxIdx !== null && hasImages && (
        <div onClick={() => setLightboxIdx(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <button onClick={() => setLightboxIdx(null)} aria-label="닫기" style={{ position: 'absolute', top: 20, right: 24, width: 44, height: 44, borderRadius: 9999, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          {images.length > 1 && (
            <button onClick={e => { e.stopPropagation(); setLightboxIdx(i => i === null ? i : (i - 1 + images.length) % images.length) }} aria-label="이전" style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, borderRadius: 9999, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          )}
          <img src={images[lightboxIdx]} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '86vh', objectFit: 'contain', borderRadius: 8 }} />
          {images.length > 1 && (
            <button onClick={e => { e.stopPropagation(); setLightboxIdx(i => i === null ? i : (i + 1) % images.length) }} aria-label="다음" style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, borderRadius: 9999, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          )}
          {images.length > 1 && (
            <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,.9)', fontSize: 14, fontWeight: 700 }}>{lightboxIdx + 1} / {images.length}</div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── 헬퍼 ── */

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
  padding: '22px 24px', marginBottom: 18,
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={cardStyle}>
      <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16 }}>{title}</h2>
      {children}
    </section>
  )
}

function SideCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 900 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}


function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', wordBreak: 'break-all' }}>{value}</div>
    </div>
  )
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value)
  return (
    <div style={{ display: 'inline-flex', gap: 1 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill={i < full ? '#F5B100' : 'none'} stroke="#F5B100" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M12 4.5 14.2 9l5 .7-3.6 3.5.9 5-4.5-2.4L7.4 18l.9-5L4.7 9.7l5-.7z" />
        </svg>
      ))}
    </div>
  )
}

function QuickBtn({ onClick, icon, label, active, activeColor, primary, color }: {
  onClick: () => void; icon: React.ReactNode; label: string
  active?: boolean; activeColor?: string; primary?: boolean; color?: string
}) {
  const base: React.CSSProperties = {
    flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '13px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 14.5, fontWeight: 800,
  }
  const style: React.CSSProperties = primary
    ? { ...base, border: 'none', background: color ?? '#e8006f', color: '#fff' }
    : active
      ? { ...base, border: `1.5px solid ${activeColor ?? '#e8006f'}`, background: 'rgba(232,0,111,.08)', color: activeColor ?? '#e8006f' }
      : { ...base, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }
  return <button onClick={onClick} style={style}>{icon}{label}</button>
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '11px 15px',
  border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
  color: 'var(--text)', cursor: 'pointer',
}

const dashedBtn: React.CSSProperties = {
  width: '100%', marginTop: 16, padding: '12px', borderRadius: 12,
  border: '1.5px dashed var(--border)', background: 'transparent', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: 'var(--muted)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
}

function sideBtn(filled: boolean, color: string): React.CSSProperties {
  return {
    flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 800,
    border: filled ? 'none' : '1px solid var(--border)',
    background: filled ? color : 'var(--surface)',
    color: filled ? '#fff' : 'var(--text)',
  }
}

const headerArrow: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 9999, border: '1px solid var(--border)',
  background: 'var(--surface)', cursor: 'pointer', color: 'var(--muted)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 15, lineHeight: 1, padding: 0,
}

function heroArrow(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', [side]: 12, transform: 'translateY(-50%)',
    width: 36, height: 36, borderRadius: 9999, border: 'none', cursor: 'pointer',
    background: 'rgba(0,0,0,.4)', color: '#fff', fontSize: 22, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

/* ── SVG 아이콘 세트 ── */
type IconName =
  | 'bookmark' | 'routeAdd' | 'directions' | 'share' | 'star' | 'pin' | 'plus' | 'edit' | 'globe'
  | 'package' | 'point' | 'reserve' | 'refund' | 'instagram' | 'x' | 'kakao' | 'youtube'

function CatIcon({ name, color, size = 18 }: { name: string; color: string; size?: number }) {
  return (
    <span style={{
      width: size, height: size, display: 'inline-block', flexShrink: 0,
      backgroundColor: color,
      WebkitMaskImage: `url(/icons/${name}.png)`, maskImage: `url(/icons/${name}.png)`,
      WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
      WebkitMaskSize: 'contain', maskSize: 'contain',
      WebkitMaskPosition: 'center', maskPosition: 'center',
    }} />
  )
}

const SNS_ICON_FILES: Record<string, string[]> = {
  instagram: ['instagram', 'instargram'],
  x: ['x', 'X'],
  kakao: ['kakao', 'kakaotalk'],
  youtube: ['youtube'],
  naver: ['naver'],
  globe: ['homepage', 'globe'],
  homepage: ['homepage', 'globe'],
}

function SnsIcon({ name, size = 17 }: { name: string; size?: number }) {
  const files = SNS_ICON_FILES[name] ?? [name]
  const [idx, setIdx] = useState(0)
  if (idx < files.length) {
    return <img src={`/icons/${files[idx]}.png`} width={size} height={size} alt="" onError={() => setIdx(i => i + 1)} style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }} />
  }
  const known = ['instagram', 'x', 'kakao', 'youtube', 'globe']
  return <Ico name={(known.includes(name) ? name : 'globe') as IconName} size={size} />
}

function evLabel(type: string): string {
  const m: Record<string, string> = { popup: '팝업', collab_cafe: '콜라보 카페', exhibition: '전시', notice: '공지', event: '이벤트', restock: '재입고', new_arrival: '신상품', sold_out: '품절', discount: '할인', reservation: '예약', exchange_meet: '교환회', fan_meet: '팬모임' }
  return m[type] ?? '소식'
}

function evFmt(s: string | null | undefined): string {
  return s ? `${new Date(s).getMonth() + 1}.${String(new Date(s).getDate()).padStart(2, '0')}` : ''
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return '방금 전'
  const m = Math.floor(s / 60); if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24); if (d < 7) return `${d}일 전`
  const w = Math.floor(d / 7); if (w < 5) return `${w}주 전`
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo}개월 전`
  return `${Math.floor(d / 365)}년 전`
}

function Ico({ name, size = 18, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  const s = { width: size, height: size, viewBox: '0 0 24 24' as const, style: { display: 'block', flexShrink: 0 } }
  const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const solid = { fill: 'currentColor', stroke: 'none' }

  switch (name) {
    case 'bookmark':
      return <svg {...s} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.3L5 21V4a1 1 0 0 1 1-1z" /></svg>
    case 'routeAdd':
      return <svg {...s} {...line}><circle cx="6" cy="19" r="2.4" /><circle cx="18" cy="7" r="2.4" /><path d="M8.4 18.2 15 9m1 9h2.5a2.5 2.5 0 0 0 0-5H16m0 5v3.5m0-3.5v-3.5" /></svg>
    case 'directions':
      return <svg {...s} {...solid}><path d="M12 2 3 21l9-4 9 4z" /></svg>
    case 'share':
      return <svg {...s} {...line}><circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" /><path d="M8.3 13.3 15.7 17.6M15.7 6.4 8.3 10.7" /></svg>
    case 'star':
      return <svg {...s} {...solid}><path d="M12 4.5 14.2 9l5 .7-3.6 3.5.9 5-4.5-2.4L7.4 18l.9-5L4.7 9.7l5-.7z" /></svg>
    case 'pin':
      return <svg {...s} {...line}><path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" /><path d="M17.7 16.7 12 22l-5.7-5.3a8 8 0 1 1 11.4 0z" /></svg>
    case 'plus':
      return <svg {...s} {...line}><path d="M12 5v14M5 12h14" /></svg>
    case 'edit':
      return <svg {...s} {...line}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
    case 'globe':
      return <svg {...s} {...line}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.7 2.6 15 0 18M12 3c-2.6 2.7-2.6 15 0 18" /></svg>
    case 'package':
      return <svg {...s} {...line}><path d="M21 8 12 3 3 8l9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>
    case 'point':
      return <svg {...s} {...line}><circle cx="12" cy="12" r="9" /><path d="M9 8h4a2.2 2.2 0 0 1 0 4.4H9.5m0 0V16m0-3.6V8m-.5 4.4H14" /></svg>
    case 'reserve':
      return <svg {...s} {...line}><rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4M8.8 15l2 2 3.8-4" /></svg>
    case 'refund':
      return <svg {...s} {...line}><path d="M3 3v6h6" /><path d="M3.5 9a9 9 0 1 1-1 6" /></svg>
    case 'instagram':
      return <svg {...s} {...line}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" /></svg>
    case 'x':
      return <svg {...s} {...solid}><path d="M18.9 3H21l-6.6 7.6L22 21h-6.2l-4.9-6.4L5.3 21H3l7-8L2.5 3h6.3l4.4 5.9L18.9 3z" /></svg>
    case 'kakao':
      return <svg {...s} {...solid}><path d="M12 4.2C6.9 4.2 3 7.4 3 11.3c0 2.5 1.7 4.7 4.3 6-.2.7-.7 2.5-.8 2.9-.1.5.2.5.4.4.2-.1 2.7-1.8 3.8-2.5.4.1.9.1 1.3.1 5.1 0 9-3.2 9-7.1S17.1 4.2 12 4.2z" /></svg>
    case 'youtube':
      return <svg {...s} {...line}><rect x="3" y="6" width="18" height="12" rx="3.5" /><path d="M11 9.5 15 12l-4 2.5z" fill="currentColor" stroke="none" /></svg>
    default:
      return null
  }
}