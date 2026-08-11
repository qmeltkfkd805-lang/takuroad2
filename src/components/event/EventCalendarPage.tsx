'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { Icon } from '@/components/tds'
import { EventHomeItem, getEventHomeItems, getPastEventItems, getMyAffinityTagIds } from '@/services/eventHomeService'
import { getMySavedEventIds, saveEvent, unsaveEvent, saveEventsBulk } from '@/services/eventSaveService'
import { getEventStatus } from '@/lib/utils/eventStatus'
import { daysUntil } from '@/lib/event/rankEvents'
import { monthCells, ymd, WEEKDAY_KO, eventOnDay } from '@/lib/event/calendar'
import styles from './EventCalendarPage.module.css'

const PINK = '#F0568F', BLUE = '#3B82C4'
const TL_TOP = 24, TL_TRACK = 26, TL_MAXTRACK = 3

type Filter = 'all' | 'popup' | 'exhibition' | 'collab_cafe' | 'saved'
const FILTERS: { k: Filter; label: string }[] = [
  { k: 'all', label: '전체' }, { k: 'popup', label: '팝업·행사' }, { k: 'exhibition', label: '전시' },
  { k: 'collab_cafe', label: '콜라보 카페' }, { k: 'saved', label: '저장 이벤트' },
]

interface Cat { bg: string; dot: string; label: string }
function catOf(type: string): Cat {
  if (type === 'collab_cafe') return { bg: '#FFF7E8', dot: '#F5A623', label: '콜라보 카페' }
  if (type === 'exhibition') return { bg: '#EEF7FF', dot: '#5B9BD5', label: '전시' }
  return { bg: '#FFF1F5', dot: '#FF6FA3', label: '팝업·행사' }
}
function matchesFilter(ev: EventHomeItem, f: Filter, saved: Set<string>): boolean {
  if (f === 'all') return true
  if (f === 'saved') return saved.has(ev.id)
  if (f === 'popup') return ev.type === 'popup' || ev.type === 'official_event'
  if (f === 'exhibition') return ev.type === 'exhibition'
  if (f === 'collab_cafe') return ev.type === 'collab_cafe'
  return true
}
function catIconOf(type: string): string {
  return type === 'collab_cafe' ? 'cafe' : type === 'exhibition' ? 'exhibition' : 'event'
}

const md = (s: string | null) => (s ? `${Number(s.slice(5, 7))}.${s.slice(8, 10)}` : '')
const periodText = (s: string | null, e: string | null) => [md(s), md(e)].filter(Boolean).join(' ~ ')
const fmtSelected = (day: string) => {
  const d = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))
  return `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일 (${WEEKDAY_KO[d.getDay()]})`
}
function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number), [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}
// 6주 × 7일 (앞뒤 달 포함, inMonth 플래그) — 타임라인 위치 계산용
function monthMatrix(y: number, m0: number): { date: string; inMonth: boolean }[][] {
  const first = new Date(y, m0, 1)
  const start = new Date(y, m0, 1 - first.getDay())
  const weeks: { date: string; inMonth: boolean }[][] = []
  for (let w = 0; w < 6; w++) {
    const row: { date: string; inMonth: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)
      row.push({ date: ymd(dt), inMonth: dt.getMonth() === m0 })
    }
    weeks.push(row)
  }
  return weeks
}

const CELL_MAX = 3

export default function EventCalendarPage() {
  const router = useRouter()
  const { user } = useAuth()
  const isDesktop = useIsDesktop()
  const now = new Date()
  const todayStr = ymd(now)

  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [items, setItems] = useState<EventHomeItem[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [favTagIds, setFavTagIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string>(todayStr)
  const [filter, setFilter] = useState<Filter>('all')
  const [workQuery, setWorkQuery] = useState('')
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
  const [ddOpen, setDdOpen] = useState(false)
  const [savingAll, setSavingAll] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([getEventHomeItems(), getPastEventItems(100)]).then(([cur, past]) => {
      const map = new Map<string, EventHomeItem>()
      for (const e of [...cur, ...past]) map.set(e.id, e)
      setItems([...map.values()])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    if (!user) { setSavedIds(new Set()); setFavTagIds(new Set()); return }
    getMySavedEventIds(user.id).then(ids => setSavedIds(new Set(ids))).catch(() => {})
    getMyAffinityTagIds(user.id).then(({ favorites }) => setFavTagIds(new Set(favorites))).catch(() => {})
  }, [user])

  // 작품 목록(선택용) + 검색 매칭
  const works = useMemo(() => {
    const m = new Map<string, { id: string; name: string; cover: string | null }>()
    for (const i of items) if (i.tagId && i.workName && !m.has(i.tagId)) m.set(i.tagId, { id: i.tagId, name: i.workName, cover: i.coverUrl })
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [items])
  const selWork = selectedWorkId ? works.find(w => w.id === selectedWorkId) ?? null : null
  const workMatches = useMemo(() => {
    const q = workQuery.trim().toLowerCase()
    return (q ? works.filter(w => w.name.toLowerCase().includes(q)) : works).slice(0, 20)
  }, [works, workQuery])

  // 작품 정확히 1개 선택 → 상세(타임라인) 모드
  const isSingleWorkMode = !!selectedWorkId
  // base: 선택 작품이 있으면 그 작품 이벤트만 → 우측 패널·개수·전체저장이 자동으로 작품 기준이 됨
  const base = useMemo(() => selectedWorkId ? items.filter(i => i.tagId === selectedWorkId) : items, [items, selectedWorkId])

  const cells = useMemo(() => monthCells(view.y, view.m), [view])
  const matrix = useMemo(() => monthMatrix(view.y, view.m), [view])
  const monthStr = useMemo(() => ymd(new Date(view.y, view.m, 1)), [view])

  // 종료 날짜가 빠른 순(곧 끝나는 이벤트 먼저), 종료일 같으면 시작일 순. 종료일 없으면 맨 뒤.
  const dayListSorted = (day: string): EventHomeItem[] =>
    base.filter(ev => eventOnDay(ev.startDate, ev.endDate, day) && matchesFilter(ev, filter, savedIds))
      .sort((a, b) => {
        const ea = (a.endDate ?? a.startDate)?.slice(0, 10) ?? '9999-99-99'
        const eb = (b.endDate ?? b.startDate)?.slice(0, 10) ?? '9999-99-99'
        if (ea !== eb) return ea.localeCompare(eb)
        return (a.startDate ?? '').localeCompare(b.startDate ?? '')
      })

  const selList = useMemo(() => dayListSorted(selected), [base, filter, savedIds, favTagIds, selected])
  const selCounts = useMemo(() => {
    let ongoing = 0, upcoming = 0, ending = 0
    for (const ev of selList) {
      const k = getEventStatus(ev).kind
      if (k === 'upcoming') upcoming++
      else if (k === 'ending_soon' || k === 'ends_today') ending++
      else if (k !== 'ended' && k !== 'unknown') ongoing++
    }
    return { total: selList.length, ongoing, upcoming, ending }
  }, [selList])

  const timelineEvents = useMemo(() => base.filter(ev => matchesFilter(ev, filter, savedIds)), [base, filter, savedIds])

  const selectDay = (day: string) => {
    setSelected(day)
    if (!isDesktop) setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }
  const shiftMonth = (delta: number) => setView(v => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const goToday = () => { setView({ y: now.getFullYear(), m: now.getMonth() }); setSelected(todayStr) }
  const resetFilters = () => { setFilter('all'); setSelectedWorkId(null); setWorkQuery('') }  // 월은 유지

  const toggleSave = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation()
    if (!user) { router.push('/login'); return }
    const was = savedIds.has(id)
    setSavedIds(prev => { const n = new Set(prev); was ? n.delete(id) : n.add(id); return n })
    ;(was ? unsaveEvent(user.id, id) : saveEvent(user.id, id)).catch(() => {
      setSavedIds(prev => { const n = new Set(prev); was ? n.add(id) : n.delete(id); return n })
    })
  }
  const allSaved = selList.length > 0 && selList.every(ev => savedIds.has(ev.id))
  const saveAll = async () => {
    if (!user) { router.push('/login'); return }
    if (savingAll || allSaved || selList.length === 0) return
    setSavingAll(true)
    const ids = selList.map(ev => ev.id)
    setSavedIds(prev => { const n = new Set(prev); ids.forEach(i => n.add(i)); return n })
    try { await saveEventsBulk(user.id, ids) } finally { setSavingAll(false) }
  }

  const panelStatus = (ev: EventHomeItem): { label: string; color: string } => {
    const k = getEventStatus(ev).kind
    if (k === 'upcoming') return { label: '오픈 예정', color: '#2563eb' }
    if (k === 'ending_soon' || k === 'ends_today') return { label: '종료 임박', color: '#E0397F' }
    if (k === 'ended') return { label: '종료', color: '#9ca3af' }
    return { label: '진행 중', color: '#16a34a' }
  }

  return (
    <div className={styles.page}>
      {/* 월 이동 헤더 */}
      <div className={styles.topHead}>
        <div className={styles.monthNav}>
          <button className={styles.navBtn} onClick={() => shiftMonth(-1)} aria-label="이전 달"><Chevron d="left" /></button>
          <span className={styles.monthTitle}>{view.y}년 {view.m + 1}월</span>
          <button className={styles.navBtn} onClick={() => shiftMonth(1)} aria-label="다음 달"><Chevron d="right" /></button>
          <button className={styles.todayBtn} onClick={goToday}>오늘</button>
        </div>
        <div className={styles.headRight}>
          {selWork ? (
            <div className={styles.workChip}>
              <span className={styles.workChipName}>{selWork.name}</span>
              <button className={styles.workChipX} onClick={() => setSelectedWorkId(null)} aria-label="작품 필터 해제">×</button>
            </div>
          ) : (
            <div className={styles.workSearch} style={{ position: 'relative' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
              <input placeholder="작품 검색" value={workQuery} onChange={e => { setWorkQuery(e.target.value); setDdOpen(true) }} onFocus={() => setDdOpen(true)} />
              {ddOpen && workMatches.length > 0 && (
                <>
                  <div className={styles.ddBackdrop} onClick={() => setDdOpen(false)} />
                  <div className={styles.workDd}>
                    {workMatches.map(w => (
                      <button key={w.id} className={styles.workDdItem} onClick={() => { setSelectedWorkId(w.id); setWorkQuery(''); setDdOpen(false) }}>
                        {w.cover ? <img className={styles.workDdImg} src={w.cover} alt="" /> : <span className={styles.workDdImg} />}
                        <span className={styles.workDdName}>{w.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {(filter !== 'all' || selectedWorkId) && (
            <button className={styles.resetBtn} onClick={resetFilters}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4" /></svg>
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* 필터 탭 + 범례 */}
      <div className={styles.filterRow}>
        <div className={styles.tabs}>
          {FILTERS.map(f => (
            <button key={f.k} className={filter === f.k ? `${styles.tab} ${styles.tabOn}` : styles.tab} onClick={() => setFilter(f.k)}>{f.label}</button>
          ))}
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#FF6FA3' }} />팝업·행사</span>
          <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#F5A623' }} />콜라보 카페</span>
          <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#5B9BD5' }} />전시</span>
        </div>
      </div>

      <div className={styles.layout}>
        {loading ? <div className={styles.skelCal} /> : (
          <div className={styles.cal}>
            <div className={styles.dowRow}>
              {WEEKDAY_KO.map((w, i) => (
                <div key={w} className={styles.dow} style={{ color: i === 0 ? PINK : i === 6 ? BLUE : 'var(--muted)' }}>{w}</div>
              ))}
            </div>

            {isSingleWorkMode ? (
              <div className={styles.weeks}>
                {matrix.map((week, wi) => (
                  <TimelineWeek key={wi} week={week} events={timelineEvents} selected={selected} todayStr={todayStr} monthStr={monthStr} onSelectDay={selectDay} onOpen={id => router.push(`/event/${id}`)} />
                ))}
              </div>
            ) : (
              <div className={styles.grid}>
                {cells.map((c, i) => {
                  if (!c) return <div key={`e${i}`} className={`${styles.cell} ${styles.cellOut}`} />
                  const day = Number(c.slice(8, 10))
                  const isToday = c === todayStr
                  const isSel = c === selected
                  const dow = i % 7
                  const list = dayListSorted(c)
                  const shown = list.slice(0, CELL_MAX)
                  const rest = list.length - shown.length
                  return (
                    <button key={c} className={`${styles.cell}${isSel ? ' ' + styles.cellSel : ''}`} onClick={() => selectDay(c)}>
                      <div className={styles.cellTop}>
                        <span className={styles.dayNum} style={{ color: isToday ? undefined : dow === 0 ? PINK : dow === 6 ? BLUE : 'var(--text)' }}>{day}</span>
                        {isToday && <span className={styles.todayTag}>오늘</span>}
                      </div>
                      <div className={styles.cellEvents}>
                        {shown.map(ev => {
                          const cat = catOf(ev.type)
                          const dEnd = ev.endDate ? daysUntil(ev.endDate) : 99
                          const soon = dEnd >= 0 && dEnd <= 2
                          return (
                            <span key={ev.id} className={styles.evPill} style={{ background: cat.bg }} title={ev.title} aria-label={`${cat.label}: ${ev.title}`}>
                              <span className={styles.evName}>{ev.title}</span>
                              {soon && <span className={styles.evDday}>D-{dEnd}</span>}
                            </span>
                          )
                        })}
                        {rest > 0 && <span className={styles.moreLink}>+{rest}개 더보기</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 선택 날짜 패널 — 구조/스타일 동일, 데이터는 base(작품 필터) 기준 */}
        <div className={styles.panel} ref={panelRef}>
          <div className={styles.panelHead}>
            <div className={styles.panelDate}>{fmtSelected(selected)}</div>
            <div className={styles.panelCounts}>
              <span>전체 <b>{selCounts.total}</b></span>
              {selCounts.ongoing > 0 && <span className={styles.pcOngoing}>진행 중 {selCounts.ongoing}</span>}
              {selCounts.upcoming > 0 && <span className={styles.pcUpcoming}>오픈 예정 {selCounts.upcoming}</span>}
              {selCounts.ending > 0 && <span className={styles.pcEnding}>종료 임박 {selCounts.ending}</span>}
            </div>
          </div>
          <div className={styles.panelBody}>
            {selList.length === 0 ? (
              <div className={styles.panelEmpty}>이날 등록된 이벤트가 없어요<br />다른 날짜를 선택해보세요.</div>
            ) : selList.map(ev => {
              const st = panelStatus(ev)
              const saved = savedIds.has(ev.id)
              return (
                <div key={ev.id} className={styles.pRow} onClick={() => router.push(`/event/${ev.id}`)}>
                  <span className={styles.pThumb}>
                    {ev.coverUrl ? <PanelImg src={ev.coverUrl} type={ev.type} /> : <Icon name={catIconOf(ev.type)} size={22} style={{ opacity: .4 }} />}
                  </span>
                  <span className={styles.pBody}>
                    <span className={styles.pStatus} style={{ color: st.color }}><span className={styles.pStatusDot} style={{ background: st.color }} />{st.label}</span>
                    <span className={styles.pName}>{ev.title}</span>
                    <span className={styles.pMeta}>{[periodText(ev.startDate, ev.endDate), ev.placeName ?? ev.shopName].filter(Boolean).join(' · ')}</span>
                  </span>
                  <button className={styles.pHeart} onClick={e => toggleSave(e, ev.id)} aria-pressed={saved} aria-label={saved ? '저장 해제' : '저장'}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? PINK : 'none'} stroke={saved ? PINK : '#8A857C'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20C5 15 3.5 10.5 5.5 7.8 7.1 5.9 10.2 6.1 12 8.4 13.8 6.1 16.9 5.9 18.5 7.8 20.5 10.5 19 15 12 20Z" /></svg>
                  </button>
                </div>
              )
            })}
          </div>
          {selList.length > 0 && (
            <div className={styles.panelFoot}>
              <button className={styles.saveAllBtn} onClick={saveAll} disabled={allSaved || savingAll}>
                {allSaved ? '모두 저장됨' : '이 날짜의 이벤트 전체 저장'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 카테고리 색 (기간선·점 공통)
const catColor = (type: string) => type === 'collab_cafe' ? '#F5A623' : type === 'exhibition' ? '#5B9BD5' : '#FF6FA3'

/* ── 작품 상세: 한 주의 기간선 ── */
const clamp06 = (n: number) => Math.max(0, Math.min(6, n))
interface Bar { ev: EventHomeItem; startCol: number; endCol: number; nameCol: number | null; endHere: boolean; reservedEnd: number }

function TimelineWeek({ week, events, selected, todayStr, monthStr, onSelectDay, onOpen }: {
  week: { date: string; inMonth: boolean }[]
  events: EventHomeItem[]
  selected: string; todayStr: string; monthStr: string
  onSelectDay: (d: string) => void; onOpen: (id: string) => void
}) {
  const weekStart = week[0].date, weekEnd = week[6].date
  const monthStartInWeek = monthStr >= weekStart && monthStr <= weekEnd

  const raw: Bar[] = []
  for (const ev of events) {
    const s = ev.startDate?.slice(0, 10)
    const e = (ev.endDate ?? ev.startDate)?.slice(0, 10)
    if (!s || !e || s > weekEnd || e < weekStart) continue
    const startCol = clamp06(dayDiff(weekStart, s))
    const endCol = clamp06(dayDiff(weekStart, e))
    const startInWeek = s >= weekStart && s <= weekEnd
    // 이름 위치: 시작 주는 시작일, 단 시작이 이전 달(패딩)이고 이번 달로 이어지면 그 달 1일에 표시
    let nameCol: number | null = null
    if (startInWeek) nameCol = startCol
    if (monthStartInWeek && s < monthStr && e >= monthStr && (nameCol == null || !week[nameCol].inMonth)) {
      nameCol = clamp06(dayDiff(weekStart, monthStr))
    }
    const endHere = e <= weekEnd
    const reservedEnd = clamp06(Math.max(endCol, nameCol != null ? nameCol + 3 : endCol))
    raw.push({ ev, startCol, endCol, nameCol, endHere, reservedEnd })
  }
  raw.sort((a, b) => a.startCol - b.startCol || a.reservedEnd - b.reservedEnd)

  const trackEnds: number[] = []
  const placed: { b: Bar; track: number }[] = []
  let overflow = 0
  for (const b of raw) {
    let t = 0
    while (trackEnds[t] !== undefined && trackEnds[t] >= b.startCol) t++
    if (t >= TL_MAXTRACK) { overflow++; continue }
    trackEnds[t] = b.reservedEnd
    placed.push({ b, track: t })
  }

  return (
    <div className={styles.weekRow}>
      <div className={styles.weekCells}>
        {week.map((d, di) => {
          const isToday = d.date === todayStr, isSel = d.date === selected
          const num = Number(d.date.slice(8, 10))
          return (
            <button key={di} className={`${styles.tlCell}${!d.inMonth ? ' ' + styles.tlCellOut : ''}${isSel ? ' ' + styles.tlCellSel : ''}`} onClick={() => onSelectDay(d.date)}>
              <span className={styles.cellTop}>
                <span className={styles.dayNum} style={{ opacity: d.inMonth ? 1 : .4, color: isToday ? undefined : di === 0 ? PINK : di === 6 ? BLUE : 'var(--text)' }}>{num}</span>
                {isToday && <span className={styles.todayTag}>오늘</span>}
              </span>
            </button>
          )
        })}
      </div>
      <div className={styles.weekBars}>
        {placed.map(({ b, track }, i) => {
          const top = TL_TOP + track * TL_TRACK
          const color = catColor(b.ev.type)
          const span = b.endCol - b.startCol + 1
          const lineLeft = b.startCol / 7 * 100
          const lineW = span / 7 * 100
          // 월 경계로 선 분할 — 이번 달이 아닌 칸 위 구간은 흐리게
          const segs: { from: number; to: number; faded: boolean }[] = []
          let c = b.startCol
          while (c <= b.endCol) {
            const faded = !week[c].inMonth
            let t = c
            while (t + 1 <= b.endCol && (!week[t + 1].inMonth) === faded) t++
            segs.push({ from: c, to: t, faded }); c = t + 1
          }
          return (
            <Fragment key={i}>
              <div className={styles.bar} style={{ left: `${lineLeft}%`, width: `${lineW}%`, top }}
                onClick={e => { e.stopPropagation(); onOpen(b.ev.id) }}
                title={`${b.ev.title} (${md(b.ev.startDate)} ~ ${md(b.ev.endDate)})`}>
                {segs.map((sg, si) => {
                  const l = (sg.from - b.startCol) / span * 100
                  const w = (sg.to - sg.from + 1) / span * 100
                  const inset = `${si === 0 ? 4 : 0}px`
                  const insetR = `${si === segs.length - 1 ? 5 : 0}px`
                  return <span key={si} className={styles.barLine} style={{ left: `calc(${l}% + ${inset})`, width: `calc(${w}% - ${inset} - ${insetR})`, background: color, opacity: sg.faded ? .32 : 1 }} />
                })}
                {b.endHere && <span className={styles.barDot} style={{ background: color, opacity: week[b.endCol].inMonth ? 1 : .32 }} />}
              </div>
              {b.nameCol != null && (
                <span className={styles.barName}
                  style={{ left: `${b.nameCol / 7 * 100}%`, width: `${(b.reservedEnd - b.nameCol + 1) / 7 * 100}%`, top }}
                  onClick={e => { e.stopPropagation(); onOpen(b.ev.id) }}
                  title={`${b.ev.title} (${md(b.ev.startDate)} ~ ${md(b.ev.endDate)})`}>
                  <span className={styles.barNameDot} style={{ background: color }} />
                  <span className={styles.barNameText}>{b.ev.title}</span>
                </span>
              )}
            </Fragment>
          )
        })}
        {overflow > 0 && <span className={styles.tlMore} style={{ top: TL_TOP + TL_MAXTRACK * TL_TRACK - 4 }}>+{overflow}개</span>}
      </div>
    </div>
  )
}

function PanelImg({ src, type }: { src: string; type: string }) {
  const [err, setErr] = useState(false)
  if (err) return <Icon name={catIconOf(type)} size={22} style={{ opacity: .4 }} />
  return <img src={src} alt="" onError={() => setErr(true)} />
}
const Chevron = ({ d }: { d: 'left' | 'right' }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{d === 'left' ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}</svg>
)
