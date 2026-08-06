'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { EventHomeItem, getEventHomeItems, getPastEventItems } from '@/services/eventHomeService'
import { getMySavedEventIds, saveEvent, unsaveEvent, saveEventsBulk } from '@/services/eventSaveService'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import { monthCells, ymd, addDays, WEEKDAY_KO, EV_TYPE_NAME } from '@/lib/event/calendar'

const TEAL = '#22bcc9'   // 시안 느낌 — 토요일 강조색
const PINK = '#f0568f'   // 일요일 강조색
const dowColor = (dow: number) => dow === 0 ? PINK : dow === 6 ? TEAL : 'var(--muted)'
const DISPLAY_FONT = "'Jua', system-ui, sans-serif"   // 둥근 볼드 (캘린더 제목용)
function typeColor(type: string): string { return CATEGORY_NAME_MAP[EV_TYPE_NAME[type] ?? '']?.color ?? 'var(--accent)' }
function typeBg(type: string): string { return CATEGORY_NAME_MAP[EV_TYPE_NAME[type] ?? '']?.bgColor ?? 'rgba(232,0,111,.1)' }
const fmt = (s: string | null) => s ? `${Number(s.slice(5, 7))}.${s.slice(8, 10)}` : ''
const fmtFull = (s: string | null) => {
  if (!s) return ''
  const dow = WEEKDAY_KO[new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))).getDay()]
  return `${Number(s.slice(5, 7))}.${s.slice(8, 10)} (${dow})`
}

type StatusKey = 'reserve' | 'ongoing' | 'starts_today' | 'ending_soon' | 'ended'
const STATUS_META: Record<StatusKey, { label: string; color: string }> = {
  reserve: { label: '사전예약', color: '#f59e0b' },
  ongoing: { label: '진행중', color: '#16a34a' },
  starts_today: { label: '오늘 시작', color: '#2563eb' },
  ending_soon: { label: '종료임박', color: '#e0397f' },
  ended: { label: '종료', color: '#9ca3af' },
}
const STATUS_ORDER: StatusKey[] = ['reserve', 'ongoing', 'starts_today', 'ending_soon', 'ended']

const inRange = (day: string, start: string | null, end: string | null) => !!start && day >= start.slice(0, 10) && day <= (end ?? start).slice(0, 10)

// 어떤 이벤트가 특정 날짜에 캘린더에 뜨는지 + 그 날의 성격(사전예약/진행 상태)
interface DayEv { ev: EventHomeItem; isReserve: boolean; status: StatusKey }
function dayEvents(evs: EventHomeItem[], day: string, today: string): DayEv[] {
  const out: DayEv[] = []
  for (const ev of evs) {
    const onRun = inRange(day, ev.startDate, ev.endDate)
    const onRes = inRange(day, ev.reserveStart, ev.reserveEnd)
    if (!onRun && !onRes) continue
    if (onRes && !onRun) { out.push({ ev, isReserve: true, status: 'reserve' }); continue }
    // 진행 기간 — 오늘 기준 상태
    const e = (ev.endDate ?? ev.startDate)!.slice(0, 10)
    const s = ev.startDate!.slice(0, 10)
    let status: StatusKey = 'ongoing'
    if (e < today) status = 'ended'
    else if (s === today) status = 'starts_today'
    else if (e === today || e === addDays(today, 1)) status = 'ending_soon'
    out.push({ ev, isReserve: false, status })
  }
  return out
}
const TYPE_ORDER = ['popup', 'collab_cafe', 'exhibition', 'official_event']
// 하루 배지: 사전예약(주황)은 'reserve' 그룹, 진행 이벤트는 종류별로. [key, color, count]
function dayBadges(list: DayEv[]): { key: string; color: string; count: number }[] {
  const m = new Map<string, number>()
  for (const d of list) {
    const key = d.isReserve ? 'reserve' : d.ev.type
    m.set(key, (m.get(key) ?? 0) + 1)
  }
  const order = [...TYPE_ORDER, 'reserve']
  return [...m.entries()]
    .sort((a, b) => (order.indexOf(a[0]) < 0 ? 99 : order.indexOf(a[0])) - (order.indexOf(b[0]) < 0 ? 99 : order.indexOf(b[0])))
    .map(([key, count]) => ({ key, count, color: key === 'reserve' ? STATUS_META.reserve.color : typeColor(key) }))
}

export default function EventCalendarPage() {
  const router = useRouter()
  const { user } = useAuth()
  const now = new Date()

  const [year, setYear] = useState(now.getFullYear())
  const [month0, setMonth0] = useState(now.getMonth())
  const [items, setItems] = useState<EventHomeItem[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(ymd(now))
  const [mode, setMode] = useState<'all' | 'saved'>('all')
  const [workFilter, setWorkFilter] = useState<string>('')

  const todayStr = ymd(now)

  useEffect(() => {
    Promise.all([getEventHomeItems(), getPastEventItems(100)])
      .then(([cur, past]) => {
        const map = new Map<string, EventHomeItem>()
        for (const e of [...cur, ...past]) map.set(e.id, e)
        setItems([...map.values()])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) { setSavedIds(new Set()); return }
    getMySavedEventIds(user.id).then(ids => setSavedIds(new Set(ids))).catch(() => {})
  }, [user])

  const cells = useMemo(() => monthCells(year, month0), [year, month0])

  const modeItems = useMemo(
    () => mode === 'saved' ? items.filter(i => savedIds.has(i.id)) : items,
    [items, mode, savedIds],
  )
  const workOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const i of modeItems) if (i.tagId && i.workName) map.set(i.tagId, i.workName)
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [modeItems])
  const filtered = useMemo(
    () => workFilter ? modeItems.filter(i => i.tagId === workFilter) : modeItems,
    [modeItems, workFilter],
  )

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEv[]>()
    for (const c of cells) {
      if (!c) continue
      const on = dayEvents(filtered, c, todayStr)
      if (on.length) map.set(c, on)
    }
    return map
  }, [cells, filtered, todayStr])

  const selectedEvents = useMemo(
    () => selected ? dayEvents(filtered, selected, todayStr).sort((a, b) => (a.ev.startDate ?? '').localeCompare(b.ev.startDate ?? '')) : [],
    [filtered, selected, todayStr],
  )
  const statusCounts = useMemo(() => {
    const c: Record<StatusKey, number> = { reserve: 0, ongoing: 0, starts_today: 0, ending_soon: 0, ended: 0 }
    for (const d of selectedEvents) c[d.status]++
    return c
  }, [selectedEvents])

  const prevMonth = () => { const m = month0 - 1; if (m < 0) { setYear(y => y - 1); setMonth0(11) } else setMonth0(m) }
  const nextMonth = () => { const m = month0 + 1; if (m > 11) { setYear(y => y + 1); setMonth0(0) } else setMonth0(m) }
  const goToday = () => { setYear(now.getFullYear()); setMonth0(now.getMonth()); setSelected(todayStr) }
  const resetFilters = () => { setMode('all'); setWorkFilter('') }

  async function toggleSave(eventId: string) {
    if (!user) { router.push('/login?redirect=/events/calendar'); return }
    const next = new Set(savedIds)
    if (next.has(eventId)) { next.delete(eventId); setSavedIds(next); await unsaveEvent(user.id, eventId) }
    else { next.add(eventId); setSavedIds(next); await saveEvent(user.id, eventId) }
  }
  async function saveAll() {
    if (!user) { router.push('/login?redirect=/events/calendar'); return }
    const ids = selectedEvents.map(d => d.ev.id)
    const next = new Set(savedIds); ids.forEach(id => next.add(id)); setSavedIds(next)
    await saveEventsBulk(user.id, ids)
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px 40px' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&display=swap" />
      <style>{`.evcal-wrap{display:flex;gap:24px;align-items:flex-start}.evcal-cal{flex:1;min-width:0}.evcal-side{width:400px;flex-shrink:0}@media (hover:none) and (pointer:coarse) and (max-width:980px){.evcal-wrap{flex-direction:column}.evcal-side{width:100%}}`}</style>

      {/* 상단: 작품 검색 + 초기화 (전체/저장 탭은 달력 헤더로 이동) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: 1 }} />
        <WorkSearch options={workOptions} value={workFilter} onChange={setWorkFilter} />
        <button onClick={resetFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54z" /></svg>
          필터 초기화
        </button>
      </div>

      <div className="evcal-wrap">
        {/* ===== 달력 ===== */}
        <div className="evcal-cal">
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 44, margin: 0, lineHeight: 1, display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ color: '#F5A524' }}>{year}</span>
              <span style={{ color: 'var(--muted)', fontSize: 32 }}>.</span>
              <span style={{ color: 'var(--text)' }}>{String(month0 + 1).padStart(2, '0')}</span>
            </h1>
            {/* 전체/저장 탭 + < > 오늘 (같은 라인) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 20 }}>
                <Tab active={mode === 'all'} onClick={() => { setMode('all'); setWorkFilter('') }} label="전체" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>} />
                <Tab active={mode === 'saved'} onClick={() => { setMode('saved'); setWorkFilter('') }} label="저장 이벤트" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill={mode === 'saved' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
                <button onClick={prevMonth} style={navBtn} aria-label="이전 달"><Chev dir="left" /></button>
                <button onClick={nextMonth} style={navBtn} aria-label="다음 달"><Chev dir="right" /></button>
                <button onClick={goToday} style={{ ...navBtn, width: 'auto', padding: '0 15px', fontSize: 13, fontWeight: 800 }}>오늘</button>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ height: 620, borderRadius: 16, background: 'var(--surface2)' }} />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', paddingBottom: 12, borderBottom: '1.5px solid var(--border)', marginBottom: 8 }}>
                {WEEKDAY_KO.map((w, i) => (
                  <div key={w} style={{ textAlign: 'left', paddingLeft: 6, fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: dowColor(i) }}>{w}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {cells.map((c, i) => {
                  const lastCol = i % 7 === 6
                  const lastRow = i >= cells.length - 7
                  const cellBorders: React.CSSProperties = {
                    borderRight: lastCol ? 'none' : '1px solid var(--border)',
                    borderBottom: lastRow ? 'none' : '1px solid var(--border)',
                  }
                  if (!c) return <div key={`e${i}`} style={{ minHeight: 90, ...cellBorders }} />
                  const day = Number(c.slice(8, 10))
                  const dow = i % 7
                  const isToday = c === todayStr
                  const isSel = c === selected
                  const evs = eventsByDay.get(c) ?? []
                  return (
                    <button
                      key={c}
                      onClick={() => setSelected(c)}
                      style={{
                        minHeight: 90, padding: '7px 7px', cursor: 'pointer', border: 'none', ...cellBorders,
                        background: isSel ? `${TEAL}16` : 'transparent',
                        boxShadow: isSel ? `inset 0 0 0 2px ${TEAL}` : 'none',
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ fontFamily: DISPLAY_FONT, fontSize: 15, color: dowColor(dow), paddingLeft: 1, opacity: isToday ? 1 : 0.92 }}>{day}</span>
                      {evs.length > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 4, flexWrap: 'wrap', width: '100%' }}>
                          {dayBadges(evs).map(b => (
                            <span key={b.key} style={{
                              minWidth: 20, height: 20, padding: '0 5px', borderRadius: 9999,
                              background: b.color, color: '#fff', fontSize: 12.5, fontFamily: DISPLAY_FONT,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            }}>{b.count}</span>
                          ))}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* 범례 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'center', marginTop: 18, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--muted)' }}>이벤트 종류</span>
              {(['popup', 'collab_cafe', 'exhibition', 'official_event'] as const).map(t => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 9999, background: typeColor(t) }} />{EV_TYPE_NAME[t]}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--muted)' }}>상태 안내</span>
              {STATUS_ORDER.map(k => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 800, color: STATUS_META[k].color }}>
                  <span style={{ width: 8, height: 8, borderRadius: 9999, background: STATUS_META[k].color }} />{STATUS_META[k].label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ===== 상세 패널 ===== */}
        <aside className="evcal-side">
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 18px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                {selected ? fmtFull(selected) : '날짜 선택'}
              </h2>
              {selected && (
                <button onClick={() => setSelected(null)} aria-label="닫기" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            {/* 상태 요약 칩 */}
            {selected && selectedEvents.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {STATUS_ORDER.map(k => (
                  <span key={k} style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 9999, background: `${STATUS_META[k].color}18`, color: STATUS_META[k].color }}>
                    {STATUS_META[k].label} {statusCounts[k]}
                  </span>
                ))}
              </div>
            )}

            {!selected ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', padding: '10px 0' }}>달력에서 날짜를 선택하세요.</p>
            ) : selectedEvents.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', padding: '10px 0' }}>이 날 진행되는 이벤트가 없어요.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedEvents.map(d => {
                  const ev = d.ev
                  const meta = STATUS_META[d.status]
                  const saved = savedIds.has(ev.id)
                  return (
                    <div key={ev.id} style={{ position: 'relative', border: '1px solid var(--border)', borderLeft: `4px solid ${meta.color}`, borderRadius: 14, padding: 12, background: 'var(--surface)' }}>
                      <button onClick={() => toggleSave(ev.id)} aria-label="저장" style={{ position: 'absolute', top: 10, right: 10, border: 'none', background: 'none', cursor: 'pointer', padding: 2 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? 'var(--accent)' : 'none'} stroke={saved ? 'var(--accent)' : 'var(--muted)'} strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
                      </button>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                        <span style={{ alignSelf: 'stretch', width: 58, flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {ev.coverUrl ? <img src={ev.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
                        </span>
                        <div style={{ minWidth: 0, flex: 1, paddingRight: 22 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 800, color: meta.color, marginBottom: 4 }}>
                            <span style={{ width: 7, height: 7, borderRadius: 9999, background: meta.color }} />{meta.label}
                          </span>
                          <div
                            onClick={() => ev.tagId && ev.workName ? setWorkFilter(ev.tagId) : router.push(`/event/${ev.id}`)}
                            title={ev.tagId && ev.workName ? `${ev.workName} 일정만 보기` : ev.title}
                            style={{ fontSize: 14.5, fontWeight: 800, cursor: 'pointer', lineHeight: 1.3, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >{ev.title || EV_TYPE_NAME[ev.type]}</div>
                          {d.isReserve ? (
                            <div style={{ fontSize: 12, color: STATUS_META.reserve.color, fontWeight: 700, marginBottom: 2 }}>
                              사전예약 {fmt(ev.reserveStart)}{ev.reserveEnd && ev.reserveEnd !== ev.reserveStart ? ` ~ ${fmt(ev.reserveEnd)}` : ''}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>
                              {fmt(ev.startDate)}{ev.endDate && ev.endDate !== ev.startDate ? ` ~ ${fmt(ev.endDate)}` : ''}
                            </div>
                          )}
                          {(ev.placeName ?? ev.shopName) && (
                            <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.placeName ?? ev.shopName}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* 이 날짜 모두 저장 */}
                <button onClick={saveAll} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '13px 16px', borderRadius: 14, border: '1px solid var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.07))', color: 'var(--accent)', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="var(--accent)" stroke="none"><path d="M12 17.3 6.2 21l1.6-6.7L2.6 9.8l6.9-.6L12 2.9l2.5 6.3 6.9.6-5.2 4.5 1.6 6.7z" /></svg>
                    이 날짜의 이벤트 모두 저장
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{selectedEvents.length}개 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg></span>
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ===== 하단 안내 카드 ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 22 }}>
        <Guide icon="calendar" title="숫자/배지 안내" desc="색깔 점 안 숫자는 그 종류의 이벤트 개수예요. (예: 전시 2개)" />
        <Guide icon="dots" title="색상 안내" desc="점 색은 종류(팝업·콜라보·전시·행사), 주황색은 사전예약일이에요." />
        <Guide icon="cursor" title="상세 보기" desc="날짜를 클릭하면 해당 날짜의 이벤트를 볼 수 있어요." />
        <Guide icon="heart" title="저장하기" desc="이벤트 카드의 ♡를 눌러 내 저장 이벤트에 추가하세요." />
      </div>
    </div>
  )
}

// 작품 검색 콤보박스 — 타이핑하면 실시간으로 목록이 좁혀지고, 클릭하면 그 작품만 필터
function WorkSearch({ options, value, onChange }: { options: { id: string; name: string }[]; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const selectedName = options.find(o => o.id === value)?.name ?? ''

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const q = query.trim().toLowerCase()
  const list = q ? options.filter(o => o.name.toLowerCase().includes(q)) : options

  const pick = (id: string) => { onChange(id); setQuery(''); setOpen(false) }
  const clear = () => { onChange(''); setQuery(''); setOpen(false) }

  const optStyle = (on: boolean): React.CSSProperties => ({
    display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 9,
    border: 'none', background: on ? 'var(--accent-l, rgba(232,0,111,.08))' : 'transparent',
    color: on ? 'var(--accent)' : 'var(--text)', fontSize: 13.5, fontWeight: on ? 800 : 600,
    cursor: 'pointer', fontFamily: 'inherit',
  })

  return (
    <div ref={wrapRef} style={{ position: 'relative', minWidth: 260 }}>
      <input
        value={open ? query : selectedName}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => { setOpen(true); setQuery('') }}
        placeholder="작품 검색"
        style={{ width: '100%', padding: '11px 38px 11px 38px', borderRadius: 12, border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
      />
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      {value ? (
        <button onClick={clear} aria-label="작품 필터 해제" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 3, display: 'inline-flex' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="m6 9 6 6 6-6" /></svg>
      )}
      {open && (
        <div style={{ position: 'absolute', zIndex: 30, top: 'calc(100% + 6px)', left: 0, right: 0, maxHeight: 300, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,.14)', padding: 6 }}>
          <button onClick={() => pick('')} style={optStyle(value === '')}>작품 전체</button>
          {list.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--muted)' }}>검색 결과가 없어요.</div>
          ) : list.map(o => (
            <button key={o.id} onClick={() => pick(o.id)} style={optStyle(o.id === value)}>{o.name}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 2px 10px', marginBottom: -1,
      border: 'none', borderBottom: `2.5px solid ${active ? 'var(--accent)' : 'transparent'}`,
      background: 'none', cursor: 'pointer', fontFamily: 'inherit',
      fontSize: 15.5, fontWeight: active ? 800 : 600, color: active ? 'var(--accent)' : 'var(--muted)',
    }}>{icon}{label}</button>
  )
}

function Guide({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '16px 16px', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' }}>
      <span style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: 'var(--accent-l, rgba(232,0,111,.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
        <GuideIcon name={icon} />
      </span>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 900, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}
function GuideIcon({ name }: { name: string }) {
  const p: any = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (name === 'calendar') return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
  if (name === 'dots') return <svg {...p} fill="currentColor" stroke="none"><circle cx="7" cy="10" r="3" /><circle cx="16" cy="8" r="3" /><circle cx="12" cy="16" r="3" /></svg>
  if (name === 'cursor') return <svg {...p}><path d="m3 3 7 18 2-8 8-2z" /></svg>
  return <svg {...p} fill="currentColor" stroke="none"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
}

const navBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 9999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }
function Chev({ dir }: { dir: 'left' | 'right' }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{dir === 'left' ? <path d="m15 18-6-6 6-6" /> : <path d="m9 6 6 6-6 6" />}</svg>
}
