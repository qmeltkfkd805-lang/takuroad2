'use client'
import AppIcon from '@/components/tds/AppIcon'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { EventIcon } from '@/components/event/EventIcon'
import { shopRegion, shopDistrict, SIDO } from '@/lib/utils/region'
import { getAllGoodsTypes, GoodsType } from '@/services/goodsTypeService'
import { getActiveWorks, ActiveWork } from '@/services/activeWorksService'
import { getShopHomeItems, getUserShopContext, ShopHomeItem } from '@/services/shopHomeService'
import { saveBookmark, removeBookmark } from '@/services/shopService'
import { ROUTES } from '@/lib/constants/routes'
import { CATEGORIES } from '@/lib/constants/categories'
import {
  ShopFilters, EMPTY_FILTERS, applyShopFilters, isDirty,
  paramsToFilters, filtersToParams, SHOP_PRESETS, UserContext,
} from '@/services/shopFilters'
import ShopFilterSidebar from './ShopFilterSidebar'
import { ShopResultCard, EventResultCard, placeLabel, CardView } from './ShopResultCards'
import { getOngoingMapEvents, MapEvent } from '@/services/mapEventService'
import styles from './ShopAllPage.module.css'

const EV_CAT_NAME: Record<string, string> = { popup: '팝업스토어', collab_cafe: '콜라보카페', exhibition: '전시', official_event: '행사' }
const PAGE_SIZE = 12
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
type Tab = 'shop' | 'event'

const SORT_OPTIONS: { v: ShopFilters['sort']; label: string }[] = [
  { v: 'hot', label: '인기순' },
  { v: 'reviews', label: '후기 많은순' },
  { v: 'saves', label: '찜 많은순' },
  { v: 'recent', label: '최근 등록순' },
]

export default function ShopAllPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuth()

  const [items, setItems] = useState<ShopHomeItem[]>([])
  const [works, setWorks] = useState<ActiveWork[]>([])
  const [goodsTypes, setGoodsTypes] = useState<GoodsType[]>([])
  const [userCtx, setUserCtx] = useState<UserContext>({ favoriteTagIds: new Set(), libraryTagIds: new Set(), savedShopIds: new Set() })
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set())
  const [events, setEvents] = useState<MapEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // ── URL이 진실의 원천: 필터·탭·보기·페이지·검색 ──
  const sp = useMemo(() => new URLSearchParams(params?.toString() ?? ''), [params])
  const filters = useMemo(() => paramsToFilters(sp), [sp])
  const tab: Tab = sp.get('tab') === 'event' ? 'event' : 'shop'
  const view: CardView = sp.get('view') === 'list' ? 'list' : 'grid'
  const page = Math.max(1, Number(sp.get('page')) || 1)
  const urlQ = sp.get('q') ?? ''

  // 검색 입력 — 로컬 상태 + debounce → URL
  const [q, setQ] = useState(urlQ)
  const [qDebounced, setQDebounced] = useState(urlQ)
  useEffect(() => { setQ(urlQ); setQDebounced(urlQ) }, [urlQ])
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250)
    return () => clearTimeout(t)
  }, [q])

  const [filterOpen, setFilterOpen] = useState(false)
  const listTop = useRef<HTMLDivElement>(null)

  // ── 데이터 로드 ──
  useEffect(() => {
    setLoading(true); setError(false)
    Promise.all([getShopHomeItems(), getActiveWorks(200), getAllGoodsTypes()])
      .then(([shops, w, g]) => { setItems(shops); setWorks(w); setGoodsTypes(g) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    getOngoingMapEvents().then(setEvents).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) { setSavedSet(new Set()); return }
    getUserShopContext(user.id)
      .then(c => {
        setUserCtx({ favoriteTagIds: new Set(c.favoriteTagIds), libraryTagIds: new Set(c.libraryTagIds), savedShopIds: new Set(c.savedShopIds) })
        setSavedSet(new Set(c.savedShopIds))
      })
      .catch(() => {})
  }, [user])

  // ── 네비게이션 헬퍼 (필터/탭/보기/페이지/검색 → URL) ──
  const buildUrl = (next: { filters: ShopFilters; q: string; tab: Tab; view: CardView; page: number }) => {
    const p = filtersToParams(next.filters)
    if (next.q) p.set('q', next.q)
    if (next.tab === 'event') p.set('tab', 'event')
    if (next.view === 'list') p.set('view', 'list')
    if (next.page > 1) p.set('page', String(next.page))
    const qs = p.toString()
    return qs ? `/shops/all?${qs}` : '/shops/all'
  }
  const go = (patch: Partial<{ filters: ShopFilters; q: string; tab: Tab; view: CardView; page: number }>, push = false) => {
    const next = { filters, q: qDebounced, tab, view, page, ...patch }
    const url = buildUrl(next)
    if (push) router.push(url, { scroll: false })
    else router.replace(url, { scroll: false })
  }

  // 검색어 변경 → 1페이지로, URL 반영 (필터·탭은 유지)
  useEffect(() => {
    if (qDebounced === urlQ) return
    go({ q: qDebounced, page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced])

  const apply = (f: ShopFilters) => go({ filters: f, page: 1 }, false)

  // 지역별 구 목록 (상세 필터용)
  const districtsByRegion = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    for (const s of items) {
      const r = shopRegion(s), d = shopDistrict(s)
      if (!r || !d) continue
      ;(map[r] ??= new Set()).add(d)
    }
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v].sort()]))
  }, [items])

  // ── 샵 결과 ──
  const shopRows = useMemo(() => {
    const rows = applyShopFilters(items, filters, userCtx)
    const query = norm(qDebounced)
    if (!query) return rows
    return rows.filter(s => norm(s.name).includes(query) || norm(placeLabel(s)).includes(query))
  }, [items, filters, userCtx, qDebounced])

  // ── 이벤트 결과 (샵 전용 필터가 걸리면 제외, 지역·카테고리만 매칭) ──
  const eventRows = useMemo(() => {
    if (filters.goodsSlugs.length || filters.workSlugs.length || filters.mine ||
        filters.official || filters.featured || filters.openNow || filters.excludeClosedToday) return []
    const query = norm(qDebounced)
    return events.filter(ev => {
      if (!ev.type || !EV_CAT_NAME[ev.type]) return false
      if (filters.cats.length && !filters.cats.includes(EV_CAT_NAME[ev.type])) return false
      if (filters.region && ev.region !== filters.region) return false
      if (filters.district && ev.district !== filters.district) return false
      if (query && !norm(ev.title).includes(query) && !norm(ev.address ?? '').includes(query)) return false
      return true
    })
  }, [events, filters, qDebounced])

  const todayISO = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const activeList = tab === 'shop' ? shopRows : eventRows
  const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages)
  const pageItems = activeList.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE)

  // 페이지 이동 시 목록 상단으로
  useEffect(() => {
    if (pageClamped > 1 && listTop.current) listTop.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageClamped])

  const dirty = isDirty(filters)
  const detailCount =
    filters.workSlugs.length + filters.goodsSlugs.length +
    (filters.district ? 1 : 0) +
    [filters.excludeClosedToday, filters.hasEvent, filters.official, filters.featured, !!filters.mine].filter(Boolean).length

  // ── 찜 토글 (낙관적 반영, 실패 시 복구) ──
  const toggleSave = (shop: ShopHomeItem) => {
    if (!user) { router.push(ROUTES.login); return }
    const wasSaved = savedSet.has(shop.id)
    setSavedSet(prev => { const n = new Set(prev); wasSaved ? n.delete(shop.id) : n.add(shop.id); return n })
    const req = wasSaved ? removeBookmark(shop.id, user.id) : saveBookmark(shop.id, user.id)
    req.catch(() => setSavedSet(prev => { const n = new Set(prev); wasSaved ? n.add(shop.id) : n.delete(shop.id); return n }))
  }

  const openMap = () => {
    const p = filtersToParams(filters)
    if (qDebounced) p.set('q', qDebounced)
    const qs = p.toString()
    router.push(qs ? `/map?${qs}` : '/map')
  }

  return (
    <div className={styles.page}>
      <nav className={styles.crumbs}>
        <button onClick={() => router.push('/')}>홈</button><span>›</span>
        <button onClick={() => router.push('/shops')}>샵</button><span>›</span>
        <strong>전체 샵</strong>
      </nav>

      {/* 헤더 : 제목 + 결과 수 + 지도 보기 */}
      <div className={styles.head}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>전체 샵</h1>
          <span className={styles.resultCount}>
            {loading ? '불러오는 중…' : `${shopRows.length}개의 샵을 찾았어요`}
          </span>
        </div>
        <button className={styles.mapBtn} onClick={openMap}>
          <AppIcon name="map" size={16} />지도 보기
        </button>
      </div>

      {/* 오늘의 테마 — 한 줄 칩 */}
      <div className={styles.themes}>
        <span className={styles.themeLabel}><EventIcon name="sparkle" size={15} color="var(--accent)" />오늘의 테마</span>
        {SHOP_PRESETS.map(p => {
          // 팝업·전시·콜라보 카페 테마는 '팝업·이벤트' 탭이 켜진 상태로 연다(tab: 'event')
          const on = presetActive(filters, p.patch) && tab === (p.tab ?? 'shop')
          return (
            <button
              key={p.id}
              className={on ? styles.themeChipOn : styles.themeChip}
              aria-pressed={on}
              onClick={() => on
                ? go({ filters: EMPTY_FILTERS, tab: 'shop', page: 1 })
                : go({ filters: { ...EMPTY_FILTERS, ...p.patch }, tab: p.tab ?? 'shop', page: 1 })}
            >
              <EventIcon name={p.icon as any} size={14} color={on ? '#fff' : p.color} />{p.label}
            </button>
          )
        })}
      </div>

      {/* 탭 : 샵 / 팝업·이벤트 */}
      <div className={styles.tabs} role="tablist" ref={listTop}>
        <button role="tab" aria-selected={tab === 'shop'} className={tab === 'shop' ? styles.tabOn : styles.tab}
          onClick={() => go({ tab: 'shop', page: 1 }, true)}>
          샵 <b>{shopRows.length}</b>
        </button>
        <button role="tab" aria-selected={tab === 'event'} className={tab === 'event' ? styles.tabOn : styles.tab}
          onClick={() => go({ tab: 'event', page: 1 }, true)}>
          팝업·이벤트 <b>{eventRows.length}</b>
        </button>
      </div>

      {/* 필터 툴바 */}
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <AppIcon name="search" size={15} color="var(--muted)" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="샵 이름이나 지역 검색"
            aria-label="샵 검색"
          />
          {q && <button className={styles.searchClear} onClick={() => setQ('')} aria-label="검색어 지우기"><AppIcon name="close" size={13} /></button>}
        </div>

        <div className={styles.filterBtns}>
          <Popover label="지역" value={filters.district ? `${filters.region} ${filters.district}` : (filters.region ?? undefined)} menuClass={styles.popMenuRegion}>
            {close => (
              <RegionPanel
                region={filters.region}
                district={filters.district}
                districtsByRegion={districtsByRegion}
                onPick={(region, district) => apply({ ...filters, region, district })}
                close={close}
              />
            )}
          </Popover>

          <Popover label="카테고리" count={filters.cats.length}>
            {() => (
              <div className={styles.popChips}>
                {CATEGORIES.filter(c => c.slug !== 'online').map(c => {
                  const on = filters.cats.includes(c.name)
                  return (
                    <button key={c.slug} className={on ? styles.popChipOn : styles.popChip}
                      onClick={() => apply({ ...filters, cats: on ? filters.cats.filter(x => x !== c.name) : [...filters.cats, c.name] })}>
                      {on && '✓ '}{c.name}
                    </button>
                  )
                })}
              </div>
            )}
          </Popover>

          <Popover label="영업 중" count={[filters.openNow, filters.excludeClosedToday].filter(Boolean).length}>
            {() => (
              <div className={styles.popList}>
                <CheckRow label="지금 영업 중" on={filters.openNow} onClick={() => apply({ ...filters, openNow: !filters.openNow })} />
                <CheckRow label="오늘 휴무 제외" on={filters.excludeClosedToday} onClick={() => apply({ ...filters, excludeClosedToday: !filters.excludeClosedToday })} />
              </div>
            )}
          </Popover>

          <button className={detailCount ? styles.detailBtnOn : styles.detailBtn} onClick={() => setFilterOpen(true)}>
            <SlidersIcon />상세 필터{detailCount ? ` ${detailCount}` : ''}
          </button>
        </div>

        {dirty && <button className={styles.resetInline} onClick={() => apply(EMPTY_FILTERS)}>초기화</button>}

        <div className={styles.toolbarRight}>
          <Popover
            label={SORT_OPTIONS.find(o => o.v === filters.sort)?.label ?? '정렬'}
            value={filters.sort !== 'hot' ? SORT_OPTIONS.find(o => o.v === filters.sort)?.label : undefined}
            align="right"
          >
            {close => (
              <div className={styles.popList} role="listbox">
                {SORT_OPTIONS.map(o => (
                  <button key={o.v} className={filters.sort === o.v ? styles.popItemOn : styles.popItem}
                    onClick={() => { apply({ ...filters, sort: o.v }); close() }}>{o.label}</button>
                ))}
              </div>
            )}
          </Popover>
          <div className={styles.viewToggle} role="group" aria-label="보기 방식">
            <button className={view === 'grid' ? styles.viewOn : styles.viewBtn} aria-pressed={view === 'grid'} aria-label="그리드 보기" onClick={() => go({ view: 'grid' })}><GridIcon /></button>
            <button className={view === 'list' ? styles.viewOn : styles.viewBtn} aria-pressed={view === 'list'} aria-label="리스트 보기" onClick={() => go({ view: 'list' })}><ListIcon /></button>
          </div>
        </div>
      </div>

      {/* 상세 필터 패널 */}
      {filterOpen && (
        <>
          <div className={styles.scrim} onClick={() => setFilterOpen(false)} />
          <aside className={styles.panel} role="dialog" aria-label="상세 필터">
            <div className={styles.panelHead}>
              <strong>상세 필터</strong>
              {dirty && <button className={styles.reset} onClick={() => apply(EMPTY_FILTERS)}>초기화</button>}
              <button className={styles.panelClose} onClick={() => setFilterOpen(false)} aria-label="닫기"><AppIcon name="close" size={15} /></button>
            </div>
            <div className={styles.panelBody}>
              <ShopFilterSidebar filters={filters} onChange={apply} works={works} goodsTypes={goodsTypes} districtsByRegion={districtsByRegion} loggedIn={!!user} />
            </div>
            <div className={styles.panelFoot}>
              <button className={styles.applyBtn} onClick={() => setFilterOpen(false)}>{loading ? '…' : `${shopRows.length}개 샵 보기`}</button>
            </div>
          </aside>
        </>
      )}

      {/* 결과 */}
      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      ) : error ? (
        <div className={styles.empty}>
          <p>목록을 불러오지 못했어요.</p>
          <button onClick={() => location.reload()}>다시 시도</button>
        </div>
      ) : activeList.length === 0 ? (
        <div className={styles.empty}>
          <p>{tab === 'shop' ? '조건에 맞는 샵이 없어요.' : '진행 중인 팝업·이벤트가 없어요.'}</p>
          {tab === 'shop' && dirty && <button onClick={() => apply(EMPTY_FILTERS)}>필터 초기화</button>}
        </div>
      ) : (
        <>
          <div className={view === 'list' ? styles.list : styles.grid}>
            {tab === 'shop'
              ? (pageItems as ShopHomeItem[]).map(s => (
                <ShopResultCard key={s.id} shop={s} view={view} saved={savedSet.has(s.id)}
                  onOpen={() => router.push(ROUTES.shop(s.slug))} onToggleSave={() => toggleSave(s)} />
              ))
              : (pageItems as MapEvent[]).map(ev => (
                <EventResultCard key={ev.id} event={ev} view={view} todayISO={todayISO}
                  onOpen={() => router.push(`/event/${ev.id}`)} />
              ))}
          </div>

          {totalPages > 1 && (
            <nav className={styles.pager} aria-label="페이지">
              <button className={styles.pagerArrow} disabled={pageClamped <= 1} onClick={() => go({ page: pageClamped - 1 }, true)} aria-label="이전">‹</button>
              {pageNumbers(pageClamped, totalPages).map((n, i) =>
                n === '…'
                  ? <span key={`e${i}`} className={styles.pagerGap}>…</span>
                  : <button key={n} className={n === pageClamped ? styles.pagerNumOn : styles.pagerNum} onClick={() => go({ page: n as number }, true)}>{n}</button>
              )}
              <button className={styles.pagerArrow} disabled={pageClamped >= totalPages} onClick={() => go({ page: pageClamped + 1 }, true)} aria-label="다음">›</button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}

/* ───────── 프리셋 활성 판정 ───────── */
function presetActive(f: ShopFilters, patch: Partial<ShopFilters>): boolean {
  return Object.entries(patch).every(([k, v]) => {
    const cur = (f as any)[k]
    if (Array.isArray(v)) return Array.isArray(cur) && v.every(x => cur.includes(x))
    return cur === v
  })
}

/* ───────── 페이지 번호 배열 (1 … n-1 n n+1 … total) ───────── */
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

/* ───────── 지역 2단계 패널 (지도 CategoryFilter와 같은 구조: 좌 시/도, 우 구·군) ───────── */
function RegionPanel({ region, district, districtsByRegion, onPick, close }: {
  region: string | null
  district: string | null
  districtsByRegion: Record<string, string[]>
  onPick: (region: string | null, district: string | null) => void
  close: () => void
}) {
  // 패널 안에서 보고 있는 시/도 — 고르기 전에도 구 목록을 미리 볼 수 있게 선택과 분리
  const [viewRegion, setViewRegion] = useState<string | null>(region)
  const districts = viewRegion ? (districtsByRegion[viewRegion] ?? []) : []

  const pickRegion = (s: string) => {
    setViewRegion(s)
    onPick(s, null)   // 시/도 단계에서 이미 필터 적용 — 패널은 열어둔 채 구 목록을 보여준다
  }

  return (
    <div>
      <div className={styles.regionHead}>
        <span className={styles.regionHeadLabel}>지역</span>
        {region && <button className={styles.regionReset} onClick={() => { onPick(null, null); close() }}>초기화</button>}
      </div>
      <div className={styles.regionGrid}>
        {/* 왼쪽 — 시/도 */}
        <div className={styles.regionCol}>
          <button className={!region ? styles.regionItemOn : styles.regionItem}
            onClick={() => { onPick(null, null); close() }}>전체 지역</button>
          {SIDO.map(s => (
            <button key={s} className={viewRegion === s ? styles.regionItemOn : styles.regionItem}
              onClick={() => pickRegion(s)}>{s}</button>
          ))}
        </div>
        {/* 오른쪽 — 시/군/구 */}
        <div className={styles.districtCol}>
          {!viewRegion ? (
            <div className={styles.regionHint}>왼쪽에서 시/도를 먼저 고르세요.</div>
          ) : districts.length === 0 ? (
            <div className={styles.regionHint}>{viewRegion}에는 구·군 정보가 없어요.</div>
          ) : (
            <>
              <button
                className={viewRegion === region && !district ? styles.districtItemOn : styles.districtItem}
                onClick={() => { onPick(viewRegion, null); close() }}
              >{viewRegion} 전체</button>
              {districts.map(d => (
                <button key={d}
                  className={viewRegion === region && district === d ? styles.districtItemOn : styles.districtItem}
                  onClick={() => { onPick(viewRegion, d); close() }}
                >{d}</button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ───────── 팝오버 ───────── */
function Popover({ label, value, count, align, menuClass, children }: {
  label: string; value?: string; count?: number; align?: 'left' | 'right'; menuClass?: string
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const active = !!value || !!count
  return (
    <div className={styles.pop} ref={ref}>
      <button className={active ? styles.popBtnOn : styles.popBtn} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {value ?? label}{count ? ` ${count}` : ''}
        <svg className={open ? styles.chevUp : styles.chevDown} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className={[styles.popMenu, align === 'right' ? styles.popMenuRight : '', menuClass ?? ''].filter(Boolean).join(' ')}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
function CheckRow({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button className={styles.popItem} onClick={onClick}>
      <span className={on ? styles.checkOn : styles.check}>{on && '✓'}</span>{label}
    </button>
  )
}

/* ───────── 인라인 아이콘 ───────── */
const SlidersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="9" cy="6" r="2.2" fill="var(--surface)" /><circle cx="15" cy="12" r="2.2" fill="var(--surface)" /><circle cx="8" cy="18" r="2.2" fill="var(--surface)" />
  </svg>
)
const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
  </svg>
)
const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
    <line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" />
    <circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" />
  </svg>
)
