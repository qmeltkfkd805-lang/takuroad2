'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { Icon } from '@/components/tds'
import { EventStatusBadge } from '@/components/tds/EventStatusBadge'
import { getEventStatus, EventStatusKind } from '@/lib/utils/eventStatus'
import { rankEvents, daysUntil } from '@/lib/event/rankEvents'
import { getEventHomeItems, getRecentlyEndedEventItems, getMyAffinityTagIds, EventHomeItem } from '@/services/eventHomeService'
import { getMySavedEventIds, saveEvent, unsaveEvent } from '@/services/eventSaveService'
import { monthCells, eventOnDay, ymd, addDays, WEEKDAY_KO } from '@/lib/event/calendar'
import styles from './EventHomePage.module.css'

const MINT = '#14B8A0', BLUE = '#3B9BE8', PINK = '#FF5692'
const TYPE_LABEL: Record<string, string> = { popup: '팝업스토어', collab_cafe: '콜라보 카페', exhibition: '전시', official_event: '행사' }
const TYPE_ICON: Record<string, string> = { popup: 'event', collab_cafe: 'cafe', exhibition: 'exhibition', official_event: 'calendar' }

const md = (s: string | null) => (s ? `${new Date(s).getMonth() + 1}.${String(new Date(s).getDate()).padStart(2, '0')}` : '')
const periodText = (s: string | null, e: string | null) => [md(s), md(e)].filter(Boolean).join(' ~ ')

type StatusTab = 'all' | 'ongoing' | 'upcoming' | 'ending' | 'fav' | 'ended'
type Period = 'all' | 'week' | 'month'

/** 종료 탭 노출 기간 — 끝난 뒤 이 일수까지만 목록에 남는다(DB에서 지우진 않음) */
const ENDED_WINDOW_DAYS = 30

// 이벤트가 목록에 뜰 수 있는 상태인지 (종료·불명은 제외)
function bucketOf(kind: EventStatusKind): 'ongoing' | 'upcoming' | 'ending' | null {
  if (kind === 'ended' || kind === 'unknown') return null
  if (kind === 'upcoming') return 'upcoming'
  if (kind === 'ending_soon' || kind === 'ends_today') return 'ending'
  return 'ongoing' // ongoing, starts_today
}
// 탭 소속 판정 — 버킷과 달리 겹칠 수 있다.
// 종료 임박·오늘 종료 이벤트도 "지금 진행 중"이므로 진행 중 탭에도 함께 보인다.
function inTab(kind: EventStatusKind, tab: 'ongoing' | 'upcoming' | 'ending'): boolean {
  if (tab === 'upcoming') return kind === 'upcoming'
  if (tab === 'ending') return kind === 'ending_soon' || kind === 'ends_today'
  return kind === 'ongoing' || kind === 'starts_today' || kind === 'ending_soon' || kind === 'ends_today'
}
// 지역: DB region이 비어있으면 장소·샵 이름의 키워드를 상위 지역으로 매핑해 보완
const REGION_MAP: [string, string][] = [
  // 서울 (구·랜드마크 → 서울)
  ['서울', '서울'], ['홍대', '서울'], ['강남', '서울'], ['명동', '서울'], ['건대', '서울'], ['신촌', '서울'], ['대학로', '서울'], ['혜화', '서울'], ['성수', '서울'], ['잠실', '서울'], ['용산', '서울'], ['이태원', '서울'], ['여의도', '서울'], ['영등포', '서울'], ['더현대', '서울'], ['코엑스', '서울'], ['삼성동', '서울'], ['신사', '서울'], ['가로수길', '서울'], ['덕수궁', '서울'], ['시청', '서울'], ['종로', '서울'], ['을지로', '서울'], ['덕스', '서울'], ['DUEX', '서울'],
  // 경기·인천
  ['경기', '경기'], ['수원', '경기'], ['성남', '경기'], ['용인', '경기'], ['고양', '경기'], ['부천', '경기'], ['안양', '경기'], ['일산', '경기'], ['판교', '경기'], ['인천', '인천'], ['송도', '인천'],
  // 광역시·도
  ['부산', '부산'], ['대구', '대구'], ['대전', '대전'], ['광주', '광주'], ['울산', '울산'], ['세종', '세종'], ['강원', '강원'], ['충북', '충북'], ['충남', '충남'], ['전북', '전북'], ['전남', '전남'], ['경북', '경북'], ['경남', '경남'], ['제주', '제주'],
]
function regionOf(i: EventHomeItem): string | null {
  if (i.region) return i.region
  const hay = `${i.placeName ?? ''} ${i.shopName ?? ''}`
  for (const [kw, region] of REGION_MAP) if (hay.includes(kw)) return region
  return null
}
// 캘린더 점 색 (오늘 기준 상태)
function dayColor(kind: EventStatusKind): string | null {
  const b = bucketOf(kind)
  return b === 'ending' ? PINK : b === 'upcoming' ? BLUE : b === 'ongoing' ? MINT : null
}

/* ================= 포스터 카드 ================= */
function PosterCard({ ev, saved, onToggleSave, onOpen, ended = false }: {
  ev: EventHomeItem; saved: boolean; onToggleSave: (id: string) => void; onOpen: (ev: EventHomeItem) => void
  /** 종료된 이벤트 — 포스터를 흑백 처리 */
  ended?: boolean
}) {
  const [imgErr, setImgErr] = useState(false)
  const showImg = ev.coverUrl && !imgErr
  const grey = ended ? ` ${styles.posterEnded}` : ''
  const place = ev.placeName ?? ev.shopName
  const period = periodText(ev.startDate, ev.endDate)
  const heart = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onToggleSave(ev.id) }
  return (
    <div className={styles.card} onClick={() => onOpen(ev)}>
      <div className={styles.poster}>
        {showImg
          ? <img className={styles.posterImg + grey} src={ev.coverUrl!} alt="" draggable={false} onError={() => setImgErr(true)} />
          : <div className={styles.posterPh + grey}><Icon name={TYPE_ICON[ev.type] ?? 'calendar'} size={44} style={{ opacity: .4 }} /></div>}
        <span className={styles.badgeTL}><EventStatusBadge startDate={ev.startDate} endDate={ev.endDate} /></span>
        <button className={styles.heart} onClick={heart} aria-pressed={saved} aria-label={saved ? '저장 해제' : '저장'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? PINK : 'none'} stroke={saved ? PINK : '#8A857C'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20C5 15 3.5 10.5 5.5 7.8 7.1 5.9 10.2 6.1 12 8.4 13.8 6.1 16.9 5.9 18.5 7.8 20.5 10.5 19 15 12 20Z" /></svg>
        </button>
      </div>
      <div className={styles.cardBody}>
        {ev.workName && <div className={styles.cWork}>{ev.workName}</div>}
        <div className={styles.cTitle}>{ev.title}</div>
        {period && <div className={styles.cMeta}><CalIcon />{period}</div>}
        {place && <div className={styles.cMeta}><PinIcon /><span className={styles.cMetaText}>{place}</span></div>}
      </div>
    </div>
  )
}
const CalIcon = () => <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3.5v3M16 3.5v3" /></svg>
const PinIcon = () => <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 21c-4.5-5.5-6.6-9.4-6.6-12.5a6.6 6.6 0 0 1 13.2 0c0 3.1-2.1 7-6.6 12.5z" /><circle cx="12" cy="8.5" r="2.3" /></svg>

/* ================= 월간 캘린더 ================= */
function MonthCalendar({ items, selectedDay, onSelectDay }: {
  items: EventHomeItem[]; selectedDay: string | null; onSelectDay: (d: string | null) => void
}) {
  const router = useRouter()
  const now = new Date()
  const todayStr = ymd(now)
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const cells = useMemo(() => monthCells(view.y, view.m), [view])

  const colorsByDay = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const c of cells) {
      if (!c) continue
      const set: string[] = []
      for (const it of items) {
        if (!eventOnDay(it.startDate, it.endDate, c)) continue
        const col = dayColor(getEventStatus(it).kind)
        if (col && !set.includes(col)) set.push(col)
      }
      if (set.length) {
        // 우선순위 핑크 > 파랑 > 민트, 최대 2개
        set.sort((a, b) => order(a) - order(b))
        map.set(c, set.slice(0, 2))
      }
    }
    return map
  }, [cells, items])

  const focusDay = selectedDay ?? todayStr
  const focusCount = useMemo(
    () => items.filter(it => eventOnDay(it.startDate, it.endDate, focusDay)).length,
    [items, focusDay])

  const shiftMonth = (delta: number) => setView(v => {
    const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }
  })

  return (
    <div className={styles.cal}>
      <div className={styles.calHead}>
        <button className={styles.calNav} onClick={() => shiftMonth(-1)} aria-label="이전 달"><Chevron dir="left" /></button>
        <span className={styles.calTitle}>{view.m + 1}월 이벤트 캘린더</span>
        <button className={styles.calNav} onClick={() => shiftMonth(1)} aria-label="다음 달"><Chevron dir="right" /></button>
      </div>
      <div className={styles.calGrid}>
        {WEEKDAY_KO.map((w, i) => (
          <div key={w} className={styles.calDow} style={{ color: i === 0 ? PINK : i === 6 ? BLUE : 'var(--muted)' }}>{w}</div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={`e${i}`} />
          const day = Number(c.slice(8, 10))
          const isToday = c === todayStr
          const isSel = c === selectedDay
          const dots = colorsByDay.get(c) ?? []
          const dow = i % 7
          return (
            <button
              key={c}
              className={styles.calCell}
              onClick={() => onSelectDay(isSel ? null : c)}
              aria-pressed={isSel}
            >
              <span
                className={`${styles.calDay}${isToday ? ' ' + styles.calToday : ''}${isSel && !isToday ? ' ' + styles.calSel : ''}`}
                style={!isToday && !isSel ? { color: dow === 0 ? PINK : dow === 6 ? BLUE : 'var(--text)' } : undefined}
              >{day}</span>
              <span className={styles.calDots}>
                {dots.map((col, idx) => <span key={idx} className={styles.calDot} style={{ background: col }} />)}
              </span>
            </button>
          )
        })}
      </div>
      <div className={styles.calFoot}>
        <span className={styles.calFootText}>
          {Number(focusDay.slice(5, 7))}월 {Number(focusDay.slice(8, 10))}일 · 이벤트 <b>{focusCount}건</b>
        </span>
        <button className={styles.calFootLink} onClick={() => router.push('/events/calendar')}>일정 보기 ›</button>
      </div>
    </div>
  )
}
function order(c: string) { return c === PINK ? 0 : c === BLUE ? 1 : 2 }
const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {dir === 'left' ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
  </svg>
)

/* ================= 드롭다운 칩 ================= */
function Dropdown({ label, value, options, onSelect }: {
  label: string; value: string | null; options: { v: string; label: string }[]; onSelect: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const cur = value ? options.find(o => o.v === value)?.label ?? label : label
  return (
    <div className={styles.ddWrap}>
      <button className={value ? `${styles.ctrlChip} ${styles.ctrlOn}` : styles.ctrlChip} onClick={() => setOpen(o => !o)}>
        {cur} <span className={styles.ddCaret}>▾</span>
      </button>
      {open && (
        <>
          <div className={styles.ddOverlay} onClick={() => setOpen(false)} />
          <div className={styles.ddMenu}>
            <button className={styles.ddItem} onClick={() => { onSelect(null); setOpen(false) }}>{label} 전체</button>
            {options.map(o => (
              <button key={o.v} className={o.v === value ? `${styles.ddItem} ${styles.ddItemOn}` : styles.ddItem} onClick={() => { onSelect(o.v); setOpen(false) }}>{o.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ================= 메인 ================= */
export default function EventHomePage() {
  const router = useRouter()
  const { user } = useAuth()
  const isDesktop = useIsDesktop()

  const [items, setItems] = useState<EventHomeItem[]>([])
  // 종료 탭 — 처음 눌렀을 때만 불러온다(홈 첫 로딩을 무겁게 하지 않으려고)
  const [endedItems, setEndedItems] = useState<EventHomeItem[]>([])
  const [endedState, setEndedState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [favTagIds, setFavTagIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState<string | null>(null)
  const [type, setType] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('all')
  const [workId, setWorkId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)

  useEffect(() => { getEventHomeItems().then(setItems).catch(() => {}).finally(() => setLoading(false)) }, [])
  useEffect(() => {
    if (tab !== 'ended' || endedState !== 'idle') return
    setEndedState('loading')
    getRecentlyEndedEventItems(ENDED_WINDOW_DAYS)
      .then(setEndedItems).catch(() => setEndedItems([])).finally(() => setEndedState('done'))
  }, [tab, endedState])
  useEffect(() => {
    if (!user) { setFavTagIds(new Set()); setSavedIds(new Set()); return }
    getMyAffinityTagIds(user.id).then(({ favorites }) => setFavTagIds(new Set(favorites))).catch(() => {})
    getMySavedEventIds(user.id).then(ids => setSavedIds(new Set(ids))).catch(() => {})
  }, [user])

  const openEvent = (ev: EventHomeItem) => router.push(`/event/${ev.id}`)
  const toggleSave = (id: string) => {
    if (!user) { router.push('/login'); return }
    const was = savedIds.has(id)
    setSavedIds(prev => { const n = new Set(prev); was ? n.delete(id) : n.add(id); return n })
    ;(was ? unsaveEvent(user.id, id) : saveEvent(user.id, id)).catch(() => {
      setSavedIds(prev => { const n = new Set(prev); was ? n.add(id) : n.delete(id); return n })
    })
  }

  // 히어로 — 필터와 무관하게 "이번 주 추천"
  const hero = useMemo(() => rankEvents(items, { favoriteTagIds: favTagIds })[0]?.event ?? null, [items, favTagIds])

  // 곧 종료 — 남은 일수 적은 순 3건 (종료된 것 제외)
  const endingSoon = useMemo(() => items
    .filter(i => i.endDate && bucketOf(getEventStatus(i).kind) !== null)
    .map(i => ({ i, d: daysUntil(i.endDate!) }))
    .filter(x => x.d >= 0)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3), [items])

  const regions = useMemo(() => [...new Set(items.map(regionOf).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'ko')), [items])
  const works = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of items) if (i.tagId && i.workName) m.set(i.tagId, i.workName)
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [items])

  // 기간 겹침 판정
  const inPeriod = (i: EventHomeItem): boolean => {
    if (period === 'all') return true
    if (!i.startDate) return false
    const today = ymd(new Date())
    const s = i.startDate.slice(0, 10), e = (i.endDate ?? i.startDate).slice(0, 10)
    const end = period === 'week' ? addDays(today, 7) : ymd(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
    return s <= end && e >= today
  }

  // 탭과 무관한 공통 필터(검색·지역·종류·작품·기간·날짜)
  const passesCommon = (i: EventHomeItem): boolean => {
    const q = search.trim().toLowerCase()
    if (region && regionOf(i) !== region) return false
    if (type && i.type !== type) return false
    if (workId && i.tagId !== workId) return false
    if (!inPeriod(i)) return false
    if (selectedDay && !eventOnDay(i.startDate, i.endDate, selectedDay)) return false
    if (q && !(i.title.toLowerCase().includes(q) || (i.workName ?? '').toLowerCase().includes(q))) return false
    return true
  }

  // 탭 제외 공통 필터
  const preTab = useMemo(
    () => items.filter(i => bucketOf(getEventStatus(i).kind) !== null && passesCommon(i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, search, region, type, workId, period, selectedDay])

  // 종료 탭 — ⚠️ rankEvents는 종료 이벤트를 걸러내므로 여기엔 쓰지 않는다. 종료일 최신순.
  const preTabEnded = useMemo(
    () => endedItems.filter(passesCommon).slice().sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endedItems, search, region, type, workId, period, selectedDay])

  const counts = useMemo(() => {
    const c = { all: preTab.length, ongoing: 0, upcoming: 0, ending: 0, fav: 0, ended: preTabEnded.length }
    for (const i of preTab) {
      const k = getEventStatus(i).kind
      if (inTab(k, 'ongoing')) c.ongoing++
      if (inTab(k, 'upcoming')) c.upcoming++
      if (inTab(k, 'ending')) c.ending++
      if (i.tagId && favTagIds.has(i.tagId)) c.fav++
    }
    return c
  }, [preTab, favTagIds, preTabEnded])

  const list = useMemo(() => {
    if (tab === 'ended') return preTabEnded
    // 전체 = 아직 안 끝난 이벤트 전부(preTab이 이미 종료·불명을 걸러냄)
    if (tab === 'all') return rankEvents(preTab, { favoriteTagIds: favTagIds }).map(r => r.event)
    if (tab === 'fav') {
      const fav = preTab.filter(i => i.tagId && favTagIds.has(i.tagId))
      return rankEvents(fav, { favoriteTagIds: favTagIds }).map(r => r.event)
    }
    const st: 'ongoing' | 'upcoming' | 'ending' = tab
    const f = preTab.filter(i => inTab(getEventStatus(i).kind, st))
    return rankEvents(f, { favoriteTagIds: favTagIds }).map(r => r.event)
  }, [preTab, preTabEnded, tab, favTagIds])

  const activeChips = [
    selectedDay && { key: 'day', label: `${Number(selectedDay.slice(5, 7))}월 ${Number(selectedDay.slice(8, 10))}일`, clear: () => setSelectedDay(null) },
    region && { key: 'region', label: region, clear: () => setRegion(null) },
    type && { key: 'type', label: TYPE_LABEL[type], clear: () => setType(null) },
    period !== 'all' && { key: 'period', label: period === 'week' ? '이번 주' : '이번 달', clear: () => setPeriod('all') },
    workId && { key: 'work', label: works.find(w => w.id === workId)?.name ?? '작품', clear: () => setWorkId(null) },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[]

  const TABS: { key: StatusTab; label: string; count?: number }[] = [
    { key: 'all', label: '전체', count: counts.all },
    { key: 'ongoing', label: '진행 중', count: counts.ongoing },
    { key: 'upcoming', label: '오픈 예정', count: counts.upcoming },
    { key: 'ending', label: '종료 임박', count: counts.ending },
    { key: 'fav', label: '내 최애', count: user ? counts.fav : undefined },
    { key: 'ended', label: '종료', count: endedState === 'done' ? counts.ended : undefined },
  ]

  return (
    <div className={styles.page}>
      {/* 추천 + 캘린더 */}
      <div className={styles.topRow}>
        <div className={styles.heroCard}>
          {hero ? (
            <>
              <div className={styles.heroPoster}>
                {hero.coverUrl
                  ? <img className={styles.heroImg} src={hero.coverUrl} alt="" />
                  : <div className={styles.posterPh}><Icon name={TYPE_ICON[hero.type] ?? 'calendar'} size={54} style={{ opacity: .4 }} /></div>}
              </div>
              <div className={styles.heroInfo}>
                <div className={styles.heroTop}>
                  <span className={styles.heroBadge}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#F7A928" style={{ display: 'block' }}><path d="M12 2.5 14.7 9.3 21.5 12 14.7 14.7 12 21.5 9.3 14.7 2.5 12 9.3 9.3Z" /></svg>
                    이번 주 추천
                  </span>
                  <EventStatusBadge startDate={hero.startDate} endDate={hero.endDate} />
                </div>
                {hero.workName && <div className={styles.heroWork}>{hero.workName}</div>}
                <h2 className={styles.heroTitle}>{hero.title}</h2>
                <div className={styles.heroTags}>
                  <span className={styles.heroTag}>{TYPE_LABEL[hero.type] ?? '행사'}</span>
                  {hero.region && <span className={styles.heroTag}>{hero.region}</span>}
                </div>
                <div className={styles.heroMeta}><CalIcon />{periodText(hero.startDate, hero.endDate)}</div>
                {(hero.placeName ?? hero.shopName) && <div className={styles.heroMeta}><PinIcon /><span className={styles.cMetaText}>{hero.placeName ?? hero.shopName}</span></div>}
                <button className={styles.heroCta} onClick={() => openEvent(hero)}>
                  상세 보기
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                </button>
              </div>
            </>
          ) : (
            <div className={styles.heroEmpty}>아직 등록된 이벤트가 없어요.</div>
          )}
        </div>
        <MonthCalendar items={items} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
      </div>

      {/* 곧 종료 */}
      {endingSoon.length > 0 && (
        <div className={styles.endingRow}>
          <span className={styles.endingLabel}>곧 종료해요</span>
          <div className={styles.endingList}>
            {endingSoon.map(({ i, d }) => (
              <button key={i.id} className={styles.endingItem} onClick={() => openEvent(i)}>
                <span className={styles.endingD}>{d === 0 ? '오늘' : `D-${d}`}</span>
                <span className={styles.endingThumb}>
                  {i.coverUrl ? <img src={i.coverUrl} alt="" /> : <Icon name={TYPE_ICON[i.type] ?? 'calendar'} size={14} style={{ opacity: .5 }} />}
                </span>
                <span className={styles.endingName}>{i.title}</span>
              </button>
            ))}
          </div>
          <button className={styles.endingMore} onClick={() => router.push('/events/all?section=ends_today')}>전체 보기 ›</button>
        </div>
      )}

      {/* 상태 탭 + 등록 버튼(우측) */}
      <div className={styles.tabsRow}>
        <div className={styles.tabs}>
          {TABS.map(t => (
            <button key={t.key} className={tab === t.key ? `${styles.tab} ${styles.tabOn}` : styles.tab} onClick={() => setTab(t.key)}>
              {t.label}{t.count != null && <span className={styles.tabCount}>{t.count}</span>}
            </button>
          ))}
        </div>
        <button className={styles.regBtn} onClick={() => router.push(user ? '/event/new' : '/login?redirect=/event/new')}>+ 이벤트 등록</button>
      </div>

      {/* 검색·필터 */}
      <div className={styles.controls}>
        <div className={styles.search}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
          <input className={styles.searchInput} placeholder="이벤트명·작품 검색" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isDesktop ? (
          <>
            {regions.length > 0 && <Dropdown label="지역" value={region} options={regions.map(r => ({ v: r, label: r }))} onSelect={setRegion} />}
            <Dropdown label="종류" value={type} options={Object.keys(TYPE_LABEL).map(k => ({ v: k, label: TYPE_LABEL[k] }))} onSelect={setType} />
            <Dropdown label="기간" value={period === 'all' ? null : period} options={[{ v: 'week', label: '이번 주' }, { v: 'month', label: '이번 달' }]} onSelect={v => setPeriod((v as Period) ?? 'all')} />
            <button className={workId ? `${styles.ctrlChip} ${styles.ctrlOn}` : styles.ctrlChip} onClick={() => setSheet(true)}>필터</button>
          </>
        ) : (
          <button className={styles.filterBtn} onClick={() => setSheet(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            필터
          </button>
        )}
      </div>

      {/* 목록 제목 + 적용 칩 */}
      <div className={styles.listHead}>
        <span className={styles.listTitle}>{TABS.find(t => t.key === tab)?.label} 이벤트</span>
        <div className={styles.chipRow}>
          {activeChips.map(c => (
            <button key={c.key} className={styles.chip} onClick={c.clear}>{c.label} ✕</button>
          ))}
        </div>
      </div>

      {/* 포스터 그리드 */}
      {(tab === 'ended' ? endedState !== 'done' : loading) ? (
        <div className={styles.grid}>
          {[0, 1, 2, 3].map(i => <div key={i} className={styles.skel} />)}
        </div>
      ) : list.length === 0 ? (
        <div className={styles.empty}>
          {selectedDay
            ? `${Number(selectedDay.slice(5, 7))}월 ${Number(selectedDay.slice(8, 10))}일에는 이벤트가 없어요.`
            : tab === 'ended'
              ? `최근 ${ENDED_WINDOW_DAYS}일 안에 끝난 이벤트가 없어요.`
              : '선택한 조건의 이벤트가 없어요.'}
          {activeChips.length > 0 && <button className={styles.emptyReset} onClick={() => { setRegion(null); setType(null); setPeriod('all'); setWorkId(null); setSelectedDay(null); setSearch('') }}>필터 초기화</button>}
        </div>
      ) : (
        <div className={styles.grid}>
          {list.map(ev => (
            <PosterCard key={ev.id} ev={ev} saved={savedIds.has(ev.id)} onToggleSave={toggleSave} onOpen={openEvent}
              ended={getEventStatus(ev).kind === 'ended'} />
          ))}
        </div>
      )}

      {/* 필터 시트 (작품 + 기간 + 지역/종류(모바일) + 초기화) */}
      {sheet && (
        <FilterSheet
          isDesktop={isDesktop}
          regions={regions} works={works}
          region={region} type={type} period={period} workId={workId}
          onApply={(v) => { setRegion(v.region); setType(v.type); setPeriod(v.period); setWorkId(v.workId); setSheet(false) }}
          onClose={() => setSheet(false)}
        />
      )}
    </div>
  )
}

/* ================= 필터 시트 ================= */
function FilterSheet({ isDesktop, regions, works, region, type, period, workId, onApply, onClose }: {
  isDesktop: boolean
  regions: string[]; works: { id: string; name: string }[]
  region: string | null; type: string | null; period: Period; workId: string | null
  onApply: (v: { region: string | null; type: string | null; period: Period; workId: string | null }) => void
  onClose: () => void
}) {
  const [rg, setRg] = useState(region)
  const [tp, setTp] = useState(type)
  const [pd, setPd] = useState<Period>(period)
  const [wk, setWk] = useState(workId)
  const [q, setQ] = useState('')
  const shownWorks = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? works.filter(w => w.name.toLowerCase().includes(s)) : works
  }, [works, q])
  const reset = () => { setRg(null); setTp(null); setPd('all'); setWk(null) }

  return (
    <div className={styles.sheetOverlay} onClick={onClose}>
      <div className={styles.sheetPanel} onClick={e => e.stopPropagation()} role="dialog" aria-label="이벤트 필터">
        <div className={styles.sheetHead}><span className={styles.sheetTitle}>필터</span><button className={styles.sheetReset} onClick={reset}>초기화</button></div>
        <div className={styles.sheetBody}>
          {!isDesktop && (
            <>
              {regions.length > 0 && (
                <SheetSection label="지역">
                  <div className={styles.optChips}>
                    {regions.map(r => <button key={r} className={rg === r ? `${styles.optChip} ${styles.optChipOn}` : styles.optChip} onClick={() => setRg(rg === r ? null : r)}>{r}</button>)}
                  </div>
                </SheetSection>
              )}
              <SheetSection label="종류">
                <div className={styles.optChips}>
                  {Object.keys(TYPE_LABEL).map(k => <button key={k} className={tp === k ? `${styles.optChip} ${styles.optChipOn}` : styles.optChip} onClick={() => setTp(tp === k ? null : k)}>{TYPE_LABEL[k]}</button>)}
                </div>
              </SheetSection>
            </>
          )}
          <SheetSection label="기간">
            <div className={styles.optChips}>
              {([['all', '전체'], ['week', '이번 주'], ['month', '이번 달']] as const).map(([v, l]) => (
                <button key={v} className={pd === v ? `${styles.optChip} ${styles.optChipOn}` : styles.optChip} onClick={() => setPd(v)}>{l}</button>
              ))}
            </div>
          </SheetSection>
          <SheetSection label="작품">
            <input className={styles.sheetSearch} placeholder="작품 검색" value={q} onChange={e => setQ(e.target.value)} />
            <div className={styles.workList}>
              <button className={wk === null ? `${styles.workRow} ${styles.workRowOn}` : styles.workRow} onClick={() => setWk(null)}>전체 작품</button>
              {shownWorks.map(w => (
                <button key={w.id} className={wk === w.id ? `${styles.workRow} ${styles.workRowOn}` : styles.workRow} onClick={() => setWk(w.id)}>{w.name}</button>
              ))}
            </div>
          </SheetSection>
        </div>
        <div className={styles.sheetFoot}>
          <button className={styles.applyBtn} onClick={() => onApply({ region: rg, type: tp, period: pd, workId: wk })}>적용하기</button>
        </div>
      </div>
    </div>
  )
}
function SheetSection({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className={styles.sheetSection}><div className={styles.sheetLabel}>{label}</div>{children}</div>
}
