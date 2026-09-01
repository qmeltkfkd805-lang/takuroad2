'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { EventCard } from '@/components/tds'
import { getEventStatus } from '@/lib/utils/eventStatus'
import { daysUntil } from '@/lib/event/rankEvents'
import { TYPE_LABEL } from './EventFilterBar'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  EventDetail, RelatedEvent,
  getEventDetail, getRelatedEvents, deleteEvent,
} from '@/services/eventDetailService'
import { getMySavedEventIds, saveEvent, unsaveEvent } from '@/services/eventSaveService'
import { getSeriesSiblings, type SeriesSibling } from '@/services/eventService'
import EventReviewTab from './EventReviewTab'
import EventVisitButton from './EventVisitButton'
import EventQnaTab from './EventQnaTab'
import EventGoodsTab from './EventGoodsTab'
import dynamic from 'next/dynamic'
const EventMiniMap = dynamic(() => import('./EventMiniMap'), { ssr: false })
import { summarizeHoursLines, hoursRows, closedDaysLabel } from '@/lib/event/eventHours'
import { getEventReviewSummary } from '@/services/eventReviewService'
import { getEventQnaCount } from '@/services/eventQnaService'
import { EventIcon, EventIconName, snsMeta } from './EventIcon'
import styles from './EventDetailPage.module.css'

type Tab = 'about' | 'place' | 'goods' | 'info' | 'review' | 'qna'

/** 링크를 도메인 이름으로 짧게 — "instagram.com" 처럼 보인다 */
function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '바로가기' }
}

function ticketButtonLabel(event: EventDetail, index: number, fallback: string): string {
  return event.ticketLabels[index]?.trim() || fallback
}

const fmtFull = (s: string | null) => {
  if (!s) return ''
  const d = new Date(s)
  const w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${w})`
}


/** 카카오맵 길찾기 — 좌표가 있으면 목적지 지정, 없으면 주소 검색 */
function directionsUrl(ev: EventDetail): string | null {
  const s = ev.shop
  if (s?.lat && s?.lng) return `https://map.kakao.com/link/to/${encodeURIComponent(s.name)},${s.lat},${s.lng}`
  // 샵이 없어도 장소 검색으로 좌표가 잡혀 있으면 길찾기가 된다
  if (ev.placeLat && ev.placeLng && ev.placeSnapshot) {
    return `https://map.kakao.com/link/to/${encodeURIComponent(ev.placeSnapshot)},${ev.placeLat},${ev.placeLng}`
  }
  const addr = s?.addr ?? ev.placeAddr ?? ev.placeSnapshot
  return addr ? `https://map.kakao.com/link/search/${encodeURIComponent(addr)}` : null
}

/* 가로로 넘겨 보는 카드 레일.
   데스크톱은 화살표, 모바일은 손가락 스크롤. 양 끝에 닿으면 해당 화살표가 사라진다. */
function CardRail({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  const sync = () => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setAtStart(el.scrollLeft <= 1)
    setAtEnd(el.scrollLeft >= max - 1)
  }

  useEffect(() => {
    sync()
    const el = ref.current
    if (!el) return
    // 카드 이미지가 늦게 들어오면 폭이 바뀌므로 다시 잰다
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    for (const c of Array.from(el.children)) ro.observe(c)
    window.addEventListener('resize', sync)
    return () => { ro.disconnect(); window.removeEventListener('resize', sync) }
  }, [children])

  // 한 번에 보이는 만큼(끝 카드가 살짝 걸치게) 넘긴다
  const page = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth - 60, 180), behavior: 'smooth' })
  }

  return (
    <div className={styles.relWrap}>
      <button
        type="button" aria-label="이전"
        className={`${styles.relNav} ${styles.relPrev}`}
        disabled={atStart} onClick={() => page(-1)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
      </button>

      <div className={styles.relRail} ref={ref} onScroll={sync}>{children}</div>

      <button
        type="button" aria-label="다음"
        className={`${styles.relNav} ${styles.relNext}`}
        disabled={atEnd} onClick={() => page(1)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
      </button>
    </div>
  )
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const eventId = params?.id

  const [event, setEvent] = useState<EventDetail | null>(null)
  const [related, setRelated] = useState<RelatedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('about')
  const [copied, setCopied] = useState(false)
  const [reviewCount, setReviewCount] = useState(0)
  const [qnaCount, setQnaCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [saved, setSaved] = useState(false)
  // 같은 이벤트의 다른 지점 (events.series_key)
  const [siblings, setSiblings] = useState<SeriesSibling[]>([])

  useEffect(() => {
    if (!user || !eventId) { setSaved(false); return }
    getMySavedEventIds(user.id).then(ids => setSaved(ids.includes(eventId))).catch(() => {})
  }, [user, eventId])

  async function toggleSaveEvent() {
    if (!user) { router.push(`/login?redirect=/event/${eventId}`); return }
    if (!eventId) return
    if (saved) { setSaved(false); await unsaveEvent(user.id, eventId) }
    else { setSaved(true); await saveEvent(user.id, eventId) }
  }

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  useEffect(() => {
    if (!eventId) return
    // 상세 → 상세로 넘어가면 같은 컴포넌트가 그대로 살아 있어서 스크롤 위치가 남는다.
    // ("다른 이벤트"를 눌렀는데 다음 글도 그 자리부터 보이는 문제)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    let alive = true
    setLoading(true)
    getEventDetail(eventId)
      .then(async ev => {
        if (!alive) return
        setEvent(ev)
        setTab('about')
        setSiblings([])
        if (ev?.seriesKey) {
          const sb = await getSeriesSiblings(ev.seriesKey, ev.id)
          if (alive) setSiblings(sb)
        }
        if (ev?.work) {
          // 지금 이벤트의 다른 지점은 위 "다른 지점" 섹션이 보여주므로 여기선 뺀다
          const rel = await getRelatedEvents(ev.work.id, ev.id, { excludeSeriesKey: ev.seriesKey })
          if (alive) setRelated(rel)   // 커버는 서비스가 각자 채운다
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    getEventReviewSummary(eventId).then(s => setReviewCount(s.count)).catch(() => {})
    getEventQnaCount(eventId).then(setQnaCount).catch(() => {})
  }, [eventId])

  const isOwner = !!user && !!event?.createdBy && user.id === event.createdBy
  // 위키 방식 — 수정은 로그인한 누구나, 삭제만 글쓴 사람 (굿즈와 같은 규칙)
  const canEdit = !!user
  const canDelete = isOwner || isAdmin

  const remove = async () => {
    if (!event) return
    if (!confirm('이 이벤트를 삭제할까요?\n등록된 굿즈·후기·Q&A도 함께 사라지고, 되돌릴 수 없어요.')) return
    const res = await deleteEvent(event.id)
    if (!res.ok) { alert(`삭제 실패: ${res.message ?? '권한이 없어요'}`); return }
    router.push('/events')
  }

  const share = async () => {
    const url = `${window.location.origin}/event/${eventId}`
    if (navigator.share) {
      try { await navigator.share({ title: event?.title ?? '이벤트', url }) } catch { /* 취소 */ }
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const status = useMemo(() => (event ? getEventStatus(event) : null), [event])

  if (loading) return <div className={styles.layout}><div className={styles.skeleton} /></div>
  if (!event || !status) {
    return (
      <div className={styles.layout}>
        <div className={styles.notFound}>
          <p>이벤트를 찾을 수 없어요.</p>
          <button className={styles.ghostBtn} onClick={() => router.push('/events')}>이벤트 홈으로</button>
        </div>
      </div>
    )
  }

  const ended = status.kind === 'ended'
  const dLeft = event.endDate ? daysUntil(event.endDate) : null
  const place = event.shop?.name ?? event.placeSnapshot
  const dir = directionsUrl(event)

  // 지도에 찍을 좌표 — 샵이 있으면 샵, 없으면 장소 검색으로 저장된 좌표
  const mapLat = event.shop?.lat ?? event.placeLat
  const mapLng = event.shop?.lng ?? event.placeLng

  // 사전예약 진행 여부 (오늘이 예약 기간 안인지)
  const todayStr = new Date().toISOString().slice(0, 10)
  const reserveOpen = !!event.reserveStart && !!event.reserveEnd
    && event.reserveStart <= todayStr && todayStr <= event.reserveEnd

  return (
    <div className={styles.page}>
      {/* 브레드크럼 */}
      <nav className={styles.crumbs}>
        <Link href="/">홈</Link><span>›</span>
        <Link href="/events">이벤트</Link><span>›</span>
        <span>{TYPE_LABEL[event.type]}</span><span>›</span>
        <strong>{event.title}</strong>
      </nav>

      <div className={styles.layout}>
        <div className={styles.main}>

          {/* Hero */}
          <div className={`${styles.hero} ${ended ? styles.heroEnded : ''} ${event.coverUrl ? styles.heroPhoto : ''}`}>
            {event.coverUrl && (
              <>
                <img className={styles.heroBg} src={event.coverUrl} alt="" />
                <span className={styles.heroScrim} />
              </>
            )}
            {/* 좌측 상단 저장 버튼 */}
            <button
              onClick={toggleSaveEvent}
              aria-label={saved ? '저장 해제' : '저장'}
              style={{ position: 'absolute', top: 12, left: 12, zIndex: 6, width: 40, height: 40, borderRadius: 9999, border: 'none', cursor: 'pointer', background: saved ? 'var(--accent)' : 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,.18)' }}
            >
              <EventIcon name="heart" size={20} color={saved ? '#fff' : 'var(--muted)'} />
            </button>
            {canEdit && (
              <div className={styles.heroMenu} ref={menuRef}>
                <button
                  className={styles.menuBtn}
                  onClick={() => setMenuOpen(o => !o)}
                  aria-label="더보기"
                  aria-expanded={menuOpen}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className={styles.menuPop}>
                    <button onClick={() => router.push(`/event/${event.id}/edit`)}>수정하기</button>
                    {canDelete && <button className={styles.danger} onClick={() => { setMenuOpen(false); remove() }}>삭제하기</button>}
                  </div>
                )}
              </div>
            )}
            <div className={styles.heroText}>
              <div className={styles.badges}>
                <span className={`${styles.badge} ${styles.badgeStatus}`}>
                  {status.kind === 'ended' ? '종료' : status.label}
                </span>
                <span className={`${styles.badge} ${styles.badgeType}`}>{TYPE_LABEL[event.type]}</span>
                {event.work && <span className={`${styles.badge} ${styles.badgeWork}`}>{event.work.name}</span>}
              </div>

              <h1 className={styles.title}>{event.title}</h1>

              <div className={styles.period}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <EventIcon name="calendar" size={16} color="var(--accent)" />
                  {fmtFull(event.startDate)} ~ {fmtFull(event.endDate)}
                </span>
                {!ended && dLeft !== null && (
                  <span className={styles.dday}>{dLeft === 0 ? 'D-DAY' : `D-${dLeft}`}</span>
                )}
              </div>

              {event.reserveStart && (
                <div className={styles.reserve}>
                  <EventIcon name="ticket" size={15} color="#7C5AC7" />
                  사전예약 {fmtFull(event.reserveStart)} ~ {fmtFull(event.reserveEnd)}
                  {reserveOpen && <span className={styles.reserveBadge}>예약 중</span>}
                </div>
              )}

              {event.description && (
                <p className={styles.heroDesc}>{event.description.split(/\n\s*\n/)[0]}</p>
              )}

              {event.work && (
                <div className={styles.tags}>
                  <Link href={`/work/${event.work.slug}`} className={styles.tag}>#{event.work.name}</Link>
                  <span className={styles.tag}>#{TYPE_LABEL[event.type]}</span>
                  {place && <span className={styles.tag}>#{place}</span>}
                </div>
              )}

              <div className={styles.heroActions}>
                {!ended && (event.ticketUrls ?? []).length > 0 && (
                  <a
                    className={styles.heroTicketBtn}
                    href={event.ticketUrls[0]}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <EventIcon name="ticket" size={16} />
                    {ticketButtonLabel(event, 0, reserveOpen ? '사전예약 하기' : '예매하기')}
                  </a>
                )}
                <EventVisitButton eventId={event.id} eventTitle={event.title} ended={ended} />
                <button className={styles.shareBtn} onClick={share}>
                  {copied ? '링크 복사됨' : '공유하기'}
                </button>
              </div>
            </div>

          </div>

          {/* 탭 — 있는 것만 */}
          <div className={styles.tabs}>
            {([
              ['about', '소개'],
              ['place', '장소 정보'],
              ['goods', '메뉴 & 굿즈'],
              ['info', '이벤트 정보'],
              ['review', `후기 (${reviewCount})`],
              ['qna', `Q&A (${qnaCount})`],
            ] as [Tab, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`${styles.tab} ${tab === k ? styles.tabOn : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'about' && (
            <>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}><EventIcon name="sparkle" size={18} color="var(--accent)" />이벤트 소개</h2>
                {event.description
                  ? <p className={styles.desc}>{event.description}</p>
                  : <p className={styles.empty}>아직 등록된 소개 글이 없어요.</p>}

                <div className={styles.metaGrid}>
                  <Meta label="이벤트 종류" value={TYPE_LABEL[event.type]} />
                  <Meta label="참여 작품" value={event.work?.name ?? '미연결'} />
                  <Meta label="장소" value={place ?? '미정'} />
                  {event.sourceUrls.length > 0 && (
                    <Meta
                      label={event.sourceUrls.length > 1 ? "공식 사이트 & SNS" : "공식 사이트"}
                      value={
                        <span className={styles.sourceLinks}>
                          {event.sourceUrls.map(u => {
                            const m = snsMeta(u)
                            return (
                              <a
                                key={u}
                                href={u}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.sourceIcon}
                                title={hostOf(u)}
                                aria-label={`${m.label} 바로가기`}
                              >
                                <img src={m.src} alt="" width={22} height={22} />
                              </a>
                            )
                          })}
                        </span>
                      }
                    />
                  )}
                </div>
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}><EventIcon name="sparkle" size={18} color="var(--accent)" />핵심 정보 요약</h2>
                <div className={styles.tiles}>
                  <Tile icon="calendar" label="기간" lines={[`${fmtFull(event.startDate).slice(0, 10)} ~ ${fmtFull(event.endDate).slice(5, 10)}`]} />
                  <Tile icon="clock" label="운영 시간" lines={[...(summarizeHoursLines(event.hours).length ? summarizeHoursLines(event.hours) : ['등록된 정보 없음']), closedDaysLabel(event.hours) ?? '']} />
                  <Tile icon="pin" label="장소" lines={[place ?? '미정', event.placeDetail ?? '']} />
                  <Tile icon="ticket" label="입장 방법" lines={[event.entryInfo ?? '등록된 정보 없음']} />
                </div>
              </section>

              {/* 다른 지점 — 같은 이벤트가 여러 곳에서 열릴 때 */}
              {siblings.length > 0 && (
                <section className={styles.card}>
                  <h2 className={styles.cardTitle}><EventIcon name="pin" size={18} color="var(--accent)" />다른 지점</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {siblings.map(sb => (
                      <Link key={sb.id} href={`/event/${sb.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', color: 'inherit' }}>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sb.placeName ?? '장소 미정'}</span>
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            {[sb.startDate, sb.endDate].filter(Boolean).map(d => String(d).slice(5).replace('-', '.')).join(' ~ ')}
                          </span>
                        </span>
                        <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>보기 ›</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {tab === 'place' && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}><EventIcon name="pin" size={18} color="var(--accent)" />장소 정보</h2>
              {event.shop ? (
                <>
                  <div className={styles.shopName}>{event.shop.name}</div>
                  {event.shop.ratingCount ? (
                    <div className={styles.rating}>
                      <EventIcon name="starFill" size={15} color="#FFB020" />
                      {event.shop.ratingAvg?.toFixed(1)} <span>(후기 {event.shop.ratingCount}개)</span>
                    </div>
                  ) : null}
                  <p className={styles.addr}>{event.shop.addr ?? '주소 미등록'}</p>
                  {event.placeDetail && <p className={styles.placeDetail}>{event.placeDetail}</p>}
                  {event.parking !== null && (
                    <div className={styles.parking}>
                      <EventIcon name="pin" size={15} color="var(--accent)" />
                      주차 {event.parking ? '가능' : '불가'}
                      {event.parkingNote && <span className={styles.parkingNote}>{event.parkingNote}</span>}
                    </div>
                  )}
                  {mapLat && mapLng && (
                    <div className={styles.mapBox}>
                      <EventMiniMap lat={mapLat} lng={mapLng} name={place ?? event.shop!.name} />
                    </div>
                  )}

                  <div className={styles.btnRow}>
                    <button className={styles.primaryBtn} onClick={() => router.push(`/shop/${event.shop!.slug}`)}>샵 정보 보기</button>
                    <button className={styles.ghostBtn} onClick={() => router.push(`/map?shop=${event.shop!.slug}`)}>지도에서 보기</button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.shopName}>{event.placeSnapshot ?? '장소 미정'}</div>
                  {event.placeAddr && <p className={styles.addr}>{event.placeAddr}</p>}
                  {event.placeDetail && <p className={styles.placeDetail}>{event.placeDetail}</p>}
                  {event.parking !== null && (
                    <div className={styles.parking}>
                      <EventIcon name="pin" size={15} color="var(--accent)" />
                      주차 {event.parking ? '가능' : '불가'}
                      {event.parkingNote && <span className={styles.parkingNote}>{event.parkingNote}</span>}
                    </div>
                  )}

                  {mapLat && mapLng ? (
                    <>
                      <div className={styles.mapBox}>
                        <EventMiniMap lat={mapLat} lng={mapLng} name={event.placeSnapshot ?? '이벤트 장소'} />
                      </div>
                      {dir && (
                        <a className={styles.ghostBtn} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }} href={dir} target="_blank" rel="noreferrer">
                          길찾기
                        </a>
                      )}
                    </>
                  ) : (
                    <p className={styles.empty}>등록된 좌표가 없어 지도를 표시할 수 없어요.</p>
                  )}
                </>
              )}
            </section>
          )}

          {tab === 'info' && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}><EventIcon name="calendar" size={18} color="var(--accent)" />이벤트 일정</h2>
              <div className={styles.timeline}>
                {event.reserveStart && <TimeRow date={fmtFull(event.reserveStart)} label="사전예약 시작" muted />}
                {event.reserveEnd && <TimeRow date={fmtFull(event.reserveEnd)} label="사전예약 종료" muted />}
                <TimeRow date={fmtFull(event.startDate)} label="이벤트 시작" />
                <TimeRow date={fmtFull(event.endDate)} label="이벤트 종료" />
              </div>
              {hoursRows(event.hours).length > 0 ? (
                <>
                  <h2 className={styles.cardTitle} style={{ marginTop: 26 }}>
                    <EventIcon name="clock" size={18} color="var(--accent)" />운영 시간
                  </h2>
                  <div className={styles.hoursTable}>
                    {hoursRows(event.hours).map(r => (
                      <div key={r.day} className={styles.hoursRow}>
                        <span className={styles.hoursDay}>{r.label}</span>
                        <span className={r.open ? styles.hoursTime : styles.hoursClosed}>
                          {r.open ? `${r.open} ~ ${r.close}` : '휴무'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {event.hoursInfo && <p className={styles.note}>{event.hoursInfo}</p>}
                </>
              ) : (
                <p className={styles.note}>
                  {event.hoursInfo ?? '운영 시간은 아직 등록된 정보가 없어요. 샵의 영업시간을 확인해주세요.'}
                </p>
              )}
            </section>
          )}

          {tab === 'goods' && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}><EventIcon name="bag" size={18} color="var(--accent)" />메뉴 &amp; 굿즈</h2>
              <EventGoodsTab eventId={event.id} />
            </section>
          )}

          {tab === 'review' && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}><EventIcon name="starFill" size={18} color="#FFB020" />이벤트 후기</h2>
              <EventReviewTab eventId={event.id} onCountChange={setReviewCount} />
            </section>
          )}

          {tab === 'qna' && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}><EventIcon name="chat" size={18} color="#8B6BD9" />Q&amp;A</h2>
              <EventQnaTab eventId={event.id} onCountChange={setQnaCount} />
            </section>
          )}

          {related.length > 0 && event.work && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>{event.work.name}의 다른 이벤트</h2>
              <CardRail>
                {related.map(r => (
                  <div className={styles.relItem} key={r.id}>
                    <EventCard
                      style={{ height: '100%' }}
                      event={{
                        id: r.id, title: r.title, type: r.type,
                        workName: event.work?.name,
                        place: r.branchCount > 1 && r.shopName
                          ? `${r.shopName} 외 ${r.branchCount - 1}곳`
                          : r.shopName,
                        startDate: r.startDate, endDate: r.endDate, coverUrl: r.coverUrl,
                      }}
                      onClick={() => router.push(`/event/${r.id}`)}
                    />
                  </div>
                ))}
              </CardRail>
            </section>
          )}

          {/* 위키라서 마지막으로 고친 사람을 남긴다 */}
          {event.updatedByName && (
            <p className={styles.editedBy}>
              마지막 수정: <strong>{event.updatedByName}</strong>
              {event.updatedAt && ` · ${fmtFull(event.updatedAt.slice(0, 10))}`}
              <span className={styles.editedHint}>누구나 잘못된 정보를 고칠 수 있어요</span>
            </p>
          )}
        </div>

        {/* 우측 레일 */}
        <aside className={styles.rail}>
          <section className={styles.railCard}>
            <div className={styles.railHead}>
              <h3><EventIcon name="pin" size={16} color="var(--accent)" />장소 정보</h3>
              {dir && <a className={styles.railAction} href={dir} target="_blank" rel="noreferrer">길찾기</a>}
            </div>
            {event.shop ? (
              <>
                <div className={styles.shopName}>{event.shop.name}</div>
                {event.shop.ratingCount ? (
                  <div className={styles.rating}>
                    <EventIcon name="starFill" size={15} color="#FFB020" />
                    {event.shop.ratingAvg?.toFixed(1)} <span>(후기 {event.shop.ratingCount}개)</span>
                  </div>
                ) : null}
                <p className={styles.addr}>{event.shop.addr ?? '주소 미등록'}</p>
                <button className={styles.ghostBtn} onClick={() => router.push(`/map?shop=${event.shop!.slug}`)}>지도에서 보기</button>
              </>
            ) : (
              <>
                <div className={styles.shopName}>{event.placeSnapshot ?? '장소 미정'}</div>
                {event.placeAddr && <p className={styles.addr}>{event.placeAddr}</p>}
              </>
            )}
          </section>

          {!ended && (event.ticketUrls ?? []).length > 0 && (
            <section className={styles.railCard}>
              <div className={styles.railHead}>
                <h3><EventIcon name="ticket" size={16} color="var(--accent)" />{reserveOpen ? '사전예약' : '예매·예약'}</h3>
              </div>
              {reserveOpen && event.reserveEnd && (
                <p className={styles.ticketNote}>{fmtFull(event.reserveEnd)}까지 예약할 수 있어요.</p>
              )}
              {(event.ticketUrls ?? []).map((u, index) => (
                <a key={u} className={styles.ticketBtn} href={u} target="_blank" rel="noreferrer">
                  <EventIcon name="ticket" size={16} />
                  {ticketButtonLabel(event, index, reserveOpen ? '사전예약 하러 가기' : '예매하러 가기')}
                </a>
              ))}
            </section>
          )}

          <section className={styles.railCard}>
            <div className={styles.railHead}><h3><EventIcon name="calendar" size={16} color="var(--accent)" />이벤트 일정</h3></div>
            <div className={styles.timeline}>
              {event.reserveStart && <TimeRow date={fmtFull(event.reserveStart)} label="사전예약 시작" muted />}
              {event.reserveEnd && <TimeRow date={fmtFull(event.reserveEnd)} label="사전예약 종료" muted />}
              <TimeRow date={fmtFull(event.startDate)} label="이벤트 시작" />
              <TimeRow date={fmtFull(event.endDate)} label="이벤트 종료" />
            </div>
            <button
              className={styles.calBtn}
              onClick={toggleSaveEvent}
              style={{ width: '100%', boxSizing: 'border-box', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit', ...(saved ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}) }}
            >
              <EventIcon name={saved ? 'starFill' : 'calendarPlus'} size={16} color={saved ? '#fff' : undefined} />
              {saved ? '저장됨 · 내 캘린더' : '내 캘린더에 저장'}
            </button>

          </section>

          {event.shop && (event.shop.snsLinks.length > 0 || event.shop.shopLink) && (
            <section className={styles.railCard}>
              <div className={styles.railHead}><h3><EventIcon name="link" size={16} color="var(--accent)" />공식 SNS</h3></div>
              <div className={styles.snsRow}>
                {event.shop.snsLinks.map(url => {
                  const m = snsMeta(url)
                  return (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className={styles.snsLink}>
                      <img src={m.src} alt="" width={18} height={18} />{m.label}
                    </a>
                  )
                })}
                {event.shop.shopLink && (
                  <a href={event.shop.shopLink} target="_blank" rel="noreferrer" className={styles.snsLink}>
                    <img src="/icons/homepage.png" alt="" width={18} height={18} />공식 사이트
                  </a>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.meta}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={styles.metaValue}>{value}</span>
    </div>
  )
}

function Tile({ icon, label, lines }: { icon: EventIconName; label: string; lines: string[] }) {
  return (
    <div className={styles.tile}>
      <div className={styles.tileLabel}>
        <EventIcon name={icon} size={15} color="var(--muted)" />{label}
      </div>
      {lines.filter(Boolean).map((l, i) => <div key={i} className={styles.tileLine}>{l}</div>)}
    </div>
  )
}

function TimeRow({ date, label, muted }: { date: string; label: string; muted?: boolean }) {
  return (
    <div className={styles.timeRow}>
      <span className={styles.dot} style={muted ? { background: '#7C5AC7' } : undefined} />
      <span className={styles.timeDate}>{date || '미정'}</span>
      <span className={styles.timeLabel}>{label}</span>
    </div>
  )
}
