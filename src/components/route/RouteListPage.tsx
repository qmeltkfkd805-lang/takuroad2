'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getPublicRoutes, toggleRouteSave, getMySavedRouteIds } from '@/services/routeService'
import RouteResultCard, { RouteView } from './RouteResultCard'
import { rtRegions, rtNames, rtTags } from './routeMeta'
import styles from './RouteListPage.module.css'

const PAGE_SIZE = 12
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')

const DURATIONS = [
  { key: 'short', label: '2시간 이내', test: (m: number) => m > 0 && m <= 120 },
  { key: 'half', label: '반나절 (2~4시간)', test: (m: number) => m > 120 && m <= 240 },
  { key: 'day', label: '하루 (4시간+)', test: (m: number) => m > 240 },
]
const STOPS = [{ key: '2', label: '2곳+' }, { key: '3', label: '3곳+' }, { key: '4', label: '4곳+' }, { key: '5', label: '5곳+' }]
const PERIODS = [{ key: '7', label: '최근 7일' }, { key: '30', label: '최근 30일' }]
const SORTS = [{ key: 'popular', label: '인기순' }, { key: 'latest', label: '최신순' }, { key: 'saves', label: '저장 많은순' }]

export default function RouteListPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuth()

  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [detailOpen, setDetailOpen] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  const sp = useMemo(() => new URLSearchParams(params?.toString() ?? ''), [params])
  const region = sp.get('region')
  const work = sp.get('work')
  const duration = sp.get('duration')
  const theme = sp.get('theme')
  const stops = sp.get('stops')
  const period = sp.get('period')
  const sort = sp.get('sort') ?? 'popular'
  const view = (sp.get('view') ?? 'grid') as RouteView | 'map'
  const page = Math.max(1, Number(sp.get('page')) || 1)
  const urlQ = sp.get('q') ?? ''

  const [q, setQ] = useState(urlQ)
  const [debouncedQ, setDebouncedQ] = useState(urlQ)
  useEffect(() => { setQ(urlQ); setDebouncedQ(urlQ) }, [urlQ])
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 250); return () => clearTimeout(t) }, [q])

  useEffect(() => {
    setLoading(true); setError(false)
    getPublicRoutes().then(setRoutes).catch(() => setError(true)).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    if (!user) { setSavedIds(new Set()); return }
    getMySavedRouteIds(user.id).then(ids => setSavedIds(new Set(ids))).catch(() => {})
  }, [user])

  const current = { q: debouncedQ, region, work, duration, theme, stops, period, sort, view, page }
  const buildUrl = (n: any) => {
    const p = new URLSearchParams()
    if (n.q) p.set('q', n.q)
    if (n.region) p.set('region', n.region)
    if (n.work) p.set('work', n.work)
    if (n.duration) p.set('duration', n.duration)
    if (n.theme) p.set('theme', n.theme)
    if (n.stops) p.set('stops', n.stops)
    if (n.period) p.set('period', n.period)
    if (n.sort && n.sort !== 'popular') p.set('sort', n.sort)
    if (n.view && n.view !== 'grid') p.set('view', n.view)
    if (n.page > 1) p.set('page', String(n.page))
    const qs = p.toString()
    return qs ? `/routes/all?${qs}` : '/routes/all'
  }
  const go = (patch: any, push = false) => {
    const url = buildUrl({ ...current, ...patch })
    push ? router.push(url, { scroll: false }) : router.replace(url, { scroll: false })
  }
  useEffect(() => {
    if (debouncedQ === urlQ) return
    go({ q: debouncedQ, page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ])

  // 옵션 목록 — 전부 실제 데이터 기반
  const regionOpts = useMemo(() => {
    const m = new Map<string, number>()
    routes.forEach(r => rtRegions(r).forEach(x => m.set(x, (m.get(x) ?? 0) + 1)))
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [routes])
  const workOpts = useMemo(() => {
    const m = new Map<string, number>()
    routes.forEach(r => { const n = r.primary_tag?.name; if (n) m.set(n, (m.get(n) ?? 0) + 1) })
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [routes])
  const themeOpts = useMemo(() => {
    const m = new Map<string, number>()
    routes.forEach(r => (r.themes ?? []).forEach((t: string) => m.set(t, (m.get(t) ?? 0) + 1)))
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [routes])

  // 필터 + 정렬
  const filtered = useMemo(() => {
    const qq = norm(debouncedQ)
    const durTest = DURATIONS.find(d => d.key === duration)?.test
    const minStops = stops ? Number(stops) : 0
    const periodDays = period ? Number(period) : 0
    const cutoff = periodDays ? Date.now() - periodDays * 86400000 : 0

    let list = routes.filter(r => {
      if (region && !rtRegions(r).includes(region)) return false
      if (work && r.primary_tag?.name !== work) return false
      if (durTest && !durTest(r.total_duration_min ?? 0)) return false
      if (theme && !(r.themes ?? []).includes(theme)) return false
      if (minStops && (r.route_shops?.length ?? 0) < minStops) return false
      if (cutoff && new Date(r.created_at).getTime() < cutoff) return false
      if (qq) {
        const hay = norm([r.title ?? '', r.primary_tag?.name ?? '', rtNames(r).join(' '), rtRegions(r).join(' '), rtTags(r).join(' ')].join(' '))
        if (!hay.includes(qq)) return false
      }
      return true
    })
    const infoScore = (r: any) => (r.route_shops?.length ?? 0) + (r.route_tips?.[0]?.count ?? 0)
    if (sort === 'latest') list = list.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    else if (sort === 'saves') list = list.slice().sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    else list = list.slice().sort((a, b) => ((b.likes ?? 0) - (a.likes ?? 0)) || (infoScore(b) - infoScore(a)))
    return list
  }, [routes, debouncedQ, region, work, duration, theme, stops, period, sort])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages)
  const pageItems = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE)

  useEffect(() => {
    if (pageClamped > 1 && topRef.current) topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
     
  }, [pageClamped])

  const detailCount = [stops, theme, period].filter(Boolean).length
  const anyFilter = !!(region || work || duration || theme || stops || period)

  const resultText = loading ? '불러오는 중…'
    : region ? `${region}에서 ${total}개의 루트를 찾았어요`
      : `총 ${total}개의 루트를 찾았어요`

  const toggleSave = (e: React.MouseEvent, r: any) => {
    e.stopPropagation()
    if (!user) { router.push('/login'); return }
    const was = savedIds.has(r.id); const d = was ? -1 : 1
    setSavedIds(prev => { const n = new Set(prev); was ? n.delete(r.id) : n.add(r.id); return n })
    setRoutes(prev => prev.map(x => x.id === r.id ? { ...x, likes: Math.max(0, (x.likes ?? 0) + d) } : x))
    toggleRouteSave(r.id, user.id).catch(() => {
      setSavedIds(prev => { const n = new Set(prev); was ? n.add(r.id) : n.delete(r.id); return n })
      setRoutes(prev => prev.map(x => x.id === r.id ? { ...x, likes: Math.max(0, (x.likes ?? 0) - d) } : x))
    })
  }
  const openRoute = (r: any) => { const t = r.share_token ?? r.shareToken; if (t) router.push(`/route/${t}`) }
  const resetAll = () => router.replace('/routes/all', { scroll: false })
  const removeChip = (key: string) => go({ [key]: null, page: 1 })

  // 결과가 적을 때 제안할 다른 지역 (실제 데이터 있는 곳만, 현재 지역 제외)
  const otherRegions = useMemo(() => regionOpts.filter(([r]) => r !== region).slice(0, 5), [regionOpts, region])

  const label = {
    duration: DURATIONS.find(d => d.key === duration)?.label,
    stops: STOPS.find(s => s.key === stops)?.label,
    period: PERIODS.find(p => p.key === period)?.label,
  }

  return (
    <div className={styles.page}>
      <div ref={topRef} />
      {/* 헤더 */}
      <div className={styles.head}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>
            <img src="/icons/colormap.png" alt="" width={26} height={26} style={{ display: 'block' }} />전체 루트
          </h1>
          <span className={styles.resultCount}>{resultText}</span>
        </div>
        <div className={styles.headBtns}>
          <button className={styles.subBtn} onClick={() => router.push(user ? '/profile?tab=myroutes' : '/login')}>
            <UserIcon />내 루트
          </button>
          <button className={styles.primaryBtn} onClick={() => router.push('/route/new')}>+ 루트 만들기</button>
        </div>
      </div>

      {/* 검색 */}
      <div className={styles.searchRow}>
        <div className={styles.search}>
          <SearchIcon />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="루트·지역·작품 검색" aria-label="루트 검색" />
          {q && <button className={styles.searchClear} onClick={() => setQ('')} aria-label="검색어 지우기"><XIcon /></button>}
        </div>
      </div>

      {/* 필터 툴바 */}
      <div className={styles.toolbar}>
        <Popover label="지역" value={region ?? undefined}>
          {close => (
            <div className={styles.popList} role="listbox">
              <button className={!region ? styles.popItemOn : styles.popItem} onClick={() => { go({ region: null, page: 1 }); close() }}>전체 지역</button>
              {regionOpts.map(([r, n]) => (
                <button key={r} className={region === r ? styles.popItemOn : styles.popItem} onClick={() => { go({ region: r, page: 1 }); close() }}>{r} <em>{n}</em></button>
              ))}
            </div>
          )}
        </Popover>
        <Popover label="작품" value={work ?? undefined}>
          {close => (
            <div className={styles.popList} role="listbox">
              <button className={!work ? styles.popItemOn : styles.popItem} onClick={() => { go({ work: null, page: 1 }); close() }}>전체 작품</button>
              {workOpts.map(([w, n]) => (
                <button key={w} className={work === w ? styles.popItemOn : styles.popItem} onClick={() => { go({ work: w, page: 1 }); close() }}>{w} <em>{n}</em></button>
              ))}
            </div>
          )}
        </Popover>
        <Popover label="소요 시간" value={label.duration}>
          {close => (
            <div className={styles.popList} role="listbox">
              <button className={!duration ? styles.popItemOn : styles.popItem} onClick={() => { go({ duration: null, page: 1 }); close() }}>전체</button>
              {DURATIONS.map(d => (
                <button key={d.key} className={duration === d.key ? styles.popItemOn : styles.popItem} onClick={() => { go({ duration: d.key, page: 1 }); close() }}>{d.label}</button>
              ))}
            </div>
          )}
        </Popover>

        <button className={detailCount ? styles.detailBtnOn : styles.detailBtn} onClick={() => setDetailOpen(true)}>
          <SlidersIcon />상세 필터{detailCount ? ` ${detailCount}` : ''}
        </button>

        <div className={styles.toolbarRight}>
          <select className={styles.sort} value={sort} onChange={e => go({ sort: e.target.value, page: 1 })} aria-label="정렬">
            {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <div className={styles.viewToggle} role="group" aria-label="보기 방식">
            <button className={view === 'grid' ? styles.viewOn : styles.viewBtn} aria-pressed={view === 'grid'} title="그리드 보기" aria-label="그리드 보기" onClick={() => go({ view: 'grid' })}><GridIcon /></button>
            <button className={view === 'list' ? styles.viewOn : styles.viewBtn} aria-pressed={view === 'list'} title="리스트 보기" aria-label="리스트 보기" onClick={() => go({ view: 'list' })}><ListIcon /></button>
            <button className={view === 'map' ? styles.viewOn : styles.viewBtn} aria-pressed={view === 'map'} title="지도 보기" aria-label="지도 보기" onClick={() => go({ view: 'map' })}><MapIcon /></button>
          </div>
        </div>
      </div>

      {/* 적용된 필터 */}
      {anyFilter && (
        <div className={styles.applied}>
          <span className={styles.appliedLabel}>적용된 필터</span>
          {region && <Chip onRemove={() => removeChip('region')}>{region}</Chip>}
          {work && <Chip onRemove={() => removeChip('work')}>{work}</Chip>}
          {duration && <Chip onRemove={() => removeChip('duration')}>{label.duration}</Chip>}
          {theme && <Chip onRemove={() => removeChip('theme')}>{theme}</Chip>}
          {stops && <Chip onRemove={() => removeChip('stops')}>{label.stops}</Chip>}
          {period && <Chip onRemove={() => removeChip('period')}>{label.period}</Chip>}
          <button className={styles.resetAll} onClick={resetAll}>전체 초기화</button>
        </div>
      )}

      {/* 상세 필터 패널 */}
      {detailOpen && (
        <>
          <div className={styles.scrim} onClick={() => setDetailOpen(false)} />
          <aside className={styles.panel} role="dialog" aria-label="상세 필터">
            <div className={styles.panelHead}>
              <strong>상세 필터</strong>
              <button className={styles.panelClose} onClick={() => setDetailOpen(false)} aria-label="닫기"><XIcon /></button>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.fgroup}>
                <div className={styles.fgLabel}>장소 수</div>
                <div className={styles.fgChips}>
                  {STOPS.map(s => (
                    <button key={s.key} className={stops === s.key ? styles.fchipOn : styles.fchip} onClick={() => go({ stops: stops === s.key ? null : s.key, page: 1 })}>{s.label}</button>
                  ))}
                </div>
              </div>
              {themeOpts.length > 0 && (
                <div className={styles.fgroup}>
                  <div className={styles.fgLabel}>루트 테마</div>
                  <div className={styles.fgChips}>
                    {themeOpts.map(([t]) => (
                      <button key={t} className={theme === t ? styles.fchipOn : styles.fchip} onClick={() => go({ theme: theme === t ? null : t, page: 1 })}>{t}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className={styles.fgroup}>
                <div className={styles.fgLabel}>등록 기간</div>
                <div className={styles.fgChips}>
                  {PERIODS.map(p => (
                    <button key={p.key} className={period === p.key ? styles.fchipOn : styles.fchip} onClick={() => go({ period: period === p.key ? null : p.key, page: 1 })}>{p.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.panelFoot}>
              {detailCount > 0 && <button className={styles.panelReset} onClick={() => go({ stops: null, theme: null, period: null, page: 1 })}>초기화</button>}
              <button className={styles.panelApply} onClick={() => setDetailOpen(false)}>{total}개 루트 보기</button>
            </div>
          </aside>
        </>
      )}

      {/* 결과 */}
      {loading ? (
        <div className={styles.grid}>{Array.from({ length: 8 }).map((_, i) => <div key={i} className={styles.skeleton} />)}</div>
      ) : error ? (
        <div className={styles.empty}><p>루트를 불러오지 못했어요.</p><button onClick={() => location.reload()}>다시 시도</button></div>
      ) : view === 'map' ? (
        <div className={styles.mapNote}>
          <MapIcon size={34} />
          <p>루트 지도 보기는 준비 중이에요.<br />지금은 그리드·리스트로 둘러볼 수 있어요.</p>
          <button onClick={() => { const p = new URLSearchParams(); if (region) p.set('region', region); if (debouncedQ) p.set('q', debouncedQ); router.push(p.toString() ? `/map?${p}` : '/map') }}>샵·이벤트 지도 열기</button>
        </div>
      ) : total === 0 ? (
        <div className={styles.empty}>
          <p>조건에 맞는 루트를 찾지 못했어요.</p>
          {anyFilter && (
            <>
              <div className={styles.emptyChips}>
                {region && <span className={styles.emptyChip}>{region}</span>}
                {work && <span className={styles.emptyChip}>{work}</span>}
                {duration && <span className={styles.emptyChip}>{label.duration}</span>}
                {theme && <span className={styles.emptyChip}>{theme}</span>}
                {stops && <span className={styles.emptyChip}>{label.stops}</span>}
                {period && <span className={styles.emptyChip}>{label.period}</span>}
              </div>
              <button onClick={resetAll}>필터 초기화</button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className={view === 'list' ? styles.list : styles.grid}>
            {pageItems.map(r => (
              <RouteResultCard key={r.id} route={r} view={view as RouteView} saved={savedIds.has(r.id)}
                onOpen={() => openRoute(r)} onToggleSave={e => toggleSave(e, r)} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className={styles.pager} aria-label="페이지">
              <button className={styles.pagerArrow} disabled={pageClamped <= 1} onClick={() => go({ page: pageClamped - 1 }, true)} aria-label="이전">‹</button>
              {pageNumbers(pageClamped, totalPages).map((n, i) =>
                n === '…' ? <span key={`e${i}`} className={styles.pagerGap}>…</span>
                  : <button key={n} className={n === pageClamped ? styles.pagerNumOn : styles.pagerNum} onClick={() => go({ page: n as number }, true)}>{n}</button>
              )}
              <button className={styles.pagerArrow} disabled={pageClamped >= totalPages} onClick={() => go({ page: pageClamped + 1 }, true)} aria-label="다음">›</button>
            </nav>
          )}

          {otherRegions.length > 0 && (
            <div className={styles.otherRegions}>
              <span>다른 지역도 둘러보세요</span>
              {otherRegions.map(([r]) => (
                <button key={r} onClick={() => go({ region: r, page: 1 })}>{r}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ───────── 페이지 번호 ───────── */
function pageNumbers(cur: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const from = Math.max(2, cur - 1), to = Math.min(total - 1, cur + 1)
  if (from > 2) out.push('…')
  for (let i = from; i <= to; i++) out.push(i)
  if (to < total - 1) out.push('…')
  out.push(total)
  return out
}

/* ───────── 팝오버 ───────── */
function Popover({ label, value, children }: { label: string; value?: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className={styles.pop} ref={ref}>
      <button className={value ? styles.popBtnOn : styles.popBtn} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="listbox">
        {value ?? label}
        <svg className={open ? styles.chevUp : styles.chevDown} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && <div className={styles.popMenu}>{children(() => setOpen(false))}</div>}
    </div>
  )
}
function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className={styles.chip}>
      {children}
      <button onClick={onRemove} aria-label="필터 제거"><XIcon size={12} /></button>
    </span>
  )
}

/* ───────── 아이콘 ───────── */
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
const XIcon = ({ size = 14 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
const UserIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
const SlidersIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /><circle cx="9" cy="6" r="2.2" fill="var(--surface)" /><circle cx="15" cy="12" r="2.2" fill="var(--surface)" /><circle cx="8" cy="18" r="2.2" fill="var(--surface)" /></svg>
const GridIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" /></svg>
const ListIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" /></svg>
const MapIcon = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3z" /><path d="M9 7v13M15 4v13" /></svg>
