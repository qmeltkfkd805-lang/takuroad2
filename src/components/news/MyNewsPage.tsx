'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { EmptyState } from '@/components/tds'
import AppIcon from '@/components/tds/AppIcon'
import { getMyWorkRelationships } from '@/services/workRelationshipService'
import {
  getMyNews, getMyReadNewsKeys, markNewsRead, markNewsReadBulk,
  NEWS_CATS, NEWS_CAT_MAP, type NewsItem, type NewsCat,
} from '@/services/myNewsService'
import { getMySavedEventIds, saveEvent, unsaveEvent } from '@/services/eventSaveService'
import styles from './MyNewsPage.module.css'

type CatFilter = NewsCat | 'all'
type Sort = 'latest' | 'ending'

interface WorkLite { id: string; name: string }

const DAY = 86400000

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d === 1) return '어제'
  if (d < 7) return `${d}일 전`
  if (d < 30) return `${Math.floor(d / 7)}주 전`
  if (d < 365) return `${Math.floor(d / 30)}개월 전`
  return `${Math.floor(d / 365)}년 전`
}

function endInfo(endDate: string | null) {
  if (!endDate) return { ended: false, soon: false, days: Infinity }
  const end = new Date(endDate + 'T23:59:59').getTime()
  const days = Math.floor((end - Date.now()) / DAY)
  return { ended: days < 0, soon: days >= 0 && days <= 7, days }
}

function bucketOf(createdAt: string): '오늘' | '이번 주' | '이전 소식' {
  const t = new Date(createdAt).getTime()
  const start = new Date(); start.setHours(0, 0, 0, 0)
  if (t >= start.getTime()) return '오늘'
  if (t >= start.getTime() - 7 * DAY) return '이번 주'
  return '이전 소식'
}

// 카테고리 → 앱 공용 아이콘 이름 (지도 등에서 쓰는 AppIcon과 동일)
const CAT_ICON: Record<NewsCat, string> = {
  event: 'event',
  shop: 'popup',
  goods: 'goods',
  official: 'megaphone',
}

const BookmarkIcon = ({ on }: { on: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? '#FF5692' : 'none'} stroke={on ? '#FF5692' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
)
const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
)

export default function MyNewsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const isDesktop = useIsDesktop()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<NewsItem[]>([])
  const [works, setWorks] = useState<WorkLite[]>([])
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set())
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set())

  // 필터 상태 (적용된 값)
  const [cat, setCat] = useState<CatFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set())
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [endingSoon, setEndingSoon] = useState(false)
  const [sort, setSort] = useState<Sort>('latest')

  const [markingAll, setMarkingAll] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  // 데이터 로드
  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    let alive = true
    setLoading(true)
    Promise.all([
      getMyNews(user.id),
      getMyWorkRelationships(user.id),
      getMyReadNewsKeys(user.id),
      getMySavedEventIds(user.id).catch(() => [] as string[]),
    ]).then(([news, rels, reads, saved]) => {
      if (!alive) return
      setItems(news)
      setWorks(rels.filter(r => r.affinity).map(r => ({ id: r.work.id, name: r.work.name })))
      setReadKeys(reads)
      setSavedEventIds(new Set(saved))
      setLoading(false)
    }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user, authLoading])

  const isUnread = (it: NewsItem) => !readKeys.has(it.key)

  // 작품별 안읽음 수
  const workUnread = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of items) if (isUnread(it)) m.set(it.workId, (m.get(it.workId) ?? 0) + 1)
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, readKeys])

  // 카테고리 제외한 나머지 필터를 적용한 목록 (카테고리별 개수 계산용)
  const preCat = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(it => {
      if (selectedWorkIds.size && !selectedWorkIds.has(it.workId)) return false
      if (unreadOnly && !isUnread(it)) return false
      if (endingSoon && !endInfo(it.endDate).soon) return false
      if (q && !(it.title.toLowerCase().includes(q) || it.workName.toLowerCase().includes(q))) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, selectedWorkIds, unreadOnly, endingSoon, readKeys])

  const catCounts = useMemo(() => {
    const c: Record<string, number> = { all: preCat.length, event: 0, shop: 0, goods: 0, official: 0 }
    for (const it of preCat) c[it.cat]++
    return c
  }, [preCat])

  // 최종 목록 (카테고리 + 정렬)
  const sorted = useMemo(() => {
    const list = cat === 'all' ? preCat : preCat.filter(it => it.cat === cat)
    const withEnd = list.map(it => ({ it, e: endInfo(it.endDate) }))
    withEnd.sort((a, b) => {
      // 종료된 이벤트는 항상 아래로
      if (a.e.ended !== b.e.ended) return a.e.ended ? 1 : -1
      if (sort === 'ending') {
        if (a.e.days !== b.e.days) return a.e.days - b.e.days
      }
      return new Date(b.it.createdAt).getTime() - new Date(a.it.createdAt).getTime()
    })
    return withEnd.map(x => x.it)
  }, [preCat, cat, sort])

  // 날짜 그룹 (정렬 순서 보존)
  const groups = useMemo(() => {
    const order = ['오늘', '이번 주', '이전 소식'] as const
    const map = new Map<string, NewsItem[]>()
    for (const it of sorted) {
      const b = bucketOf(it.createdAt)
      if (!map.has(b)) map.set(b, [])
      map.get(b)!.push(it)
    }
    return order.filter(o => map.has(o)).map(o => ({ label: o, items: map.get(o)! }))
  }, [sorted])

  const filteredWorks = works // 우측 목록은 검색 별도(아래 workQuery)
  const [workQuery, setWorkQuery] = useState('')
  const shownWorks = useMemo(() => {
    const q = workQuery.trim().toLowerCase()
    return q ? filteredWorks.filter(w => w.name.toLowerCase().includes(q)) : filteredWorks
  }, [filteredWorks, workQuery])

  /* ---------- 액션 ---------- */
  // 소식 클릭 → 읽음 저장을 확실히 보낸 뒤 상세로 이동 (이동 때문에 저장 요청이 끊기는 것 방지)
  const openNews = (e: React.MouseEvent, it: NewsItem) => {
    if (!user || !isUnread(it)) return          // 이미 읽음/비로그인은 기본 이동
    e.preventDefault()
    setReadKeys(prev => new Set(prev).add(it.key))   // 낙관적
    markNewsRead(user.id, it.key).finally(() => router.push(it.href))
  }

  const markAll = async () => {
    if (!user || markingAll || items.length === 0) return
    setMarkingAll(true)
    const keys = items.map(i => i.key)
    setReadKeys(new Set(keys))          // 낙관적
    try { await markNewsReadBulk(user.id, keys) } finally { setMarkingAll(false) }
  }

  const toggleSave = (e: React.MouseEvent, it: NewsItem) => {
    e.preventDefault(); e.stopPropagation()
    if (!user) { router.push('/login'); return }
    const was = savedEventIds.has(it.eventId)
    setSavedEventIds(prev => { const n = new Set(prev); was ? n.delete(it.eventId) : n.add(it.eventId); return n })
    ;(was ? unsaveEvent(user.id, it.eventId) : saveEvent(user.id, it.eventId)).catch(() => {
      setSavedEventIds(prev => { const n = new Set(prev); was ? n.add(it.eventId) : n.delete(it.eventId); return n })
    })
  }

  const toggleWork = (id: string) => {
    setSelectedWorkIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const resetFilters = () => {
    setSelectedWorkIds(new Set()); setUnreadOnly(false); setEndingSoon(false); setSort('latest')
  }

  const totalUnread = useMemo(() => items.filter(isUnread).length, [items, readKeys]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- 비로그인 / 빈 상태 ---------- */
  if (!authLoading && !user) {
    return (
      <div className={styles.page}>
        <EmptyState
          title="로그인하면 최애 새소식을 모아드려요"
          description="좋아하는 작품의 이벤트·샵·굿즈 소식을 한곳에서 확인할 수 있어요."
          action={{ label: '로그인', onClick: () => router.push('/login') }}
        />
      </div>
    )
  }

  const catTabs = (
    <div className={styles.catTabs}>
      {(['all', ...NEWS_CATS.map(c => c.key)] as CatFilter[]).map(key => {
        const on = cat === key
        const meta = key === 'all' ? { label: '전체', color: 'var(--accent)' } : NEWS_CAT_MAP[key as NewsCat]
        return (
          <button
            key={key}
            type="button"
            className={on ? `${styles.catTab} ${styles.catTabOn}` : styles.catTab}
            aria-selected={on}
            onClick={() => setCat(key)}
          >
            {key !== 'all' && <AppIcon name={CAT_ICON[key as NewsCat]} size={17} color={on ? 'var(--accent)' : (meta as any).color} />}
            <span className={styles.catLabel}>{meta.label}</span>
            <span className={styles.catCount} style={on ? undefined : { color: (meta as any).color }}>{catCounts[key]}</span>
          </button>
        )
      })}
    </div>
  )

  const feed = (
    <div className={styles.feed}>
      {loading ? (
        <div className={styles.group}>
          {[0, 1, 2, 3].map(i => <div key={i} className={styles.skelRow}><div className={styles.skelThumb} /><div className={styles.skelBody}><div className={styles.skelLine} style={{ width: '40%' }} /><div className={styles.skelLine} style={{ width: '75%' }} /><div className={styles.skelLine} style={{ width: '55%' }} /></div></div>)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="아직 새로운 소식이 없어요"
          description="최애 작품을 추가하면 이벤트와 샵 소식을 모아드려요."
          action={{ label: '최애 작품 둘러보기', onClick: () => router.push('/my-works') }}
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          title="선택한 조건의 소식이 없어요"
          description="필터를 초기화하거나 다른 작품을 선택해보세요."
          action={{ label: '필터 초기화', onClick: () => { resetFilters(); setSearch(''); setCat('all') } }}
        />
      ) : (
        groups.map(g => (
          <section key={g.label} className={styles.group}>
            <h2 className={styles.groupLabel}>{g.label}</h2>
            {g.items.map(it => {
              const unread = isUnread(it)
              const meta = NEWS_CAT_MAP[it.cat]
              const e = endInfo(it.endDate)
              return (
                <Link key={it.key} href={it.href} className={styles.row} onClick={(e) => openNews(e, it)}>
                  <span className={styles.rowThumb} style={{ background: it.thumbUrl ? undefined : meta.colorL }}>
                    {it.thumbUrl
                      ? <img src={it.thumbUrl} alt="" onError={ev => { (ev.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      : <AppIcon name={CAT_ICON[it.cat]} size={24} color={meta.color} />}
                  </span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowTop}>
                      <span className={styles.rowBadge} style={{ background: meta.colorL, color: meta.color }}>{meta.label}</span>
                      <span className={styles.rowWork}>{it.workName}</span>
                      {e.soon && <span className={styles.soonTag}>종료 임박</span>}
                    </span>
                    <span className={unread ? `${styles.rowTitle} ${styles.rowTitleUnread}` : styles.rowTitle}>{it.title}</span>
                    {it.meta && <span className={styles.rowMeta}>{it.meta}</span>}
                  </span>
                  <span className={styles.rowRight}>
                    <span className={styles.rowTime}>{timeAgo(it.createdAt)}</span>
                    {unread && <span className={styles.unreadDot} aria-label="안 읽음" />}
                    <button className={styles.saveBtn} onClick={ev => toggleSave(ev, it)} aria-pressed={savedEventIds.has(it.eventId)} aria-label={savedEventIds.has(it.eventId) ? '저장 해제' : '저장'}>
                      <BookmarkIcon on={savedEventIds.has(it.eventId)} />
                    </button>
                    <span className={styles.chevron}><Chevron /></span>
                  </span>
                </Link>
              )
            })}
          </section>
        ))
      )}
    </div>
  )

  const workFilter = (
    <div className={styles.railCard}>
      <div className={styles.railTitle}>내 최애 작품 {selectedWorkIds.size > 0 && <span className={styles.railSel}>{selectedWorkIds.size}개 선택</span>}</div>
      <input className={styles.workSearch} placeholder="작품 검색" value={workQuery} onChange={e => setWorkQuery(e.target.value)} />
      <button type="button" className={styles.workRow} onClick={() => setSelectedWorkIds(new Set())}>
        <span className={selectedWorkIds.size === 0 ? `${styles.check} ${styles.checkOn}` : styles.check} />
        <span className={styles.workName}>전체 작품</span>
      </button>
      <div className={styles.workList}>
        {shownWorks.map(w => (
          <button type="button" key={w.id} className={styles.workRow} onClick={() => toggleWork(w.id)}>
            <span className={selectedWorkIds.has(w.id) ? `${styles.check} ${styles.checkOn}` : styles.check} />
            <span className={styles.workName}>{w.name}</span>
            {(workUnread.get(w.id) ?? 0) > 0 && <span className={styles.workCount}>{workUnread.get(w.id)}</span>}
          </button>
        ))}
      </div>
      <Link href="/my-works" className={styles.allWorksLink}>전체 작품 보기 ›</Link>
    </div>
  )

  return (
    <div className={styles.page}>
      {/* ── 헤더 ── */}
      {isDesktop ? (
        <>
          <nav className={styles.bcrumb}><Link href="/">홈</Link><span> › </span><span>최애 새소식</span></nav>
          <div className={styles.head}>
            <div>
              <h1 className={styles.headTitle}>최애 새소식</h1>
              <p className={styles.headDesc}>좋아하는 작품의 새로운 소식을 한곳에서 확인해요</p>
            </div>
            <button className={styles.allRead} onClick={markAll} disabled={markingAll || totalUnread === 0}>✓ 모두 읽음</button>
          </div>
        </>
      ) : (
        <header className={styles.mHeader}>
          <button className={styles.mBack} onClick={() => router.back()} aria-label="뒤로">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span className={styles.mTitle}>최애 새소식</span>
          <button className={styles.mAllRead} onClick={markAll} disabled={markingAll || totalUnread === 0}>✓ 모두 읽음</button>
        </header>
      )}

      {catTabs}

      {/* ── 검색·필터 ── */}
      {isDesktop ? (
        <div className={styles.controls}>
          <div className={styles.search}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
            <input className={styles.searchInput} placeholder="작품 또는 소식 검색" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className={unreadOnly ? `${styles.toggleChip} ${styles.toggleOn}` : styles.toggleChip} onClick={() => setUnreadOnly(v => !v)}>안 읽은 소식{unreadOnly && ' ●'}</button>
          <button className={endingSoon ? `${styles.toggleChip} ${styles.toggleOn}` : styles.toggleChip} onClick={() => setEndingSoon(v => !v)}>종료 임박</button>
          <button className={styles.sortBtn} onClick={() => setSort(s => s === 'latest' ? 'ending' : 'latest')}>{sort === 'latest' ? '최신순' : '종료 임박순'} ▾</button>
        </div>
      ) : (
        <>
          <div className={styles.mControls}>
            <div className={styles.search}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
              <input className={styles.searchInput} placeholder="작품 또는 소식 검색" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className={styles.filterBtn} onClick={() => setSheetOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
              필터
            </button>
          </div>
          <div className={styles.chipRow}>
            <button className={selectedWorkIds.size > 0 ? `${styles.chip} ${styles.chipOn}` : styles.chip} onClick={() => setSheetOpen(true)}>{selectedWorkIds.size === 0 ? '전체 작품' : `작품 ${selectedWorkIds.size}개`}</button>
            <button className={unreadOnly ? `${styles.chip} ${styles.chipOn}` : styles.chip} onClick={() => setUnreadOnly(v => !v)}>안 읽은 소식</button>
            <button className={endingSoon ? `${styles.chip} ${styles.chipOn}` : styles.chip} onClick={() => setEndingSoon(v => !v)}>종료 임박</button>
            <button className={styles.chip} onClick={() => setSheetOpen(true)}>{sort === 'latest' ? '최신순' : '종료 임박순'} ▾</button>
          </div>
        </>
      )}

      {/* ── 본문 ── */}
      <div className={styles.layout}>
        {feed}
        {isDesktop && <aside className={styles.rail}>{workFilter}</aside>}
      </div>

      {/* ── 모바일 필터 바텀시트 ── */}
      {!isDesktop && sheetOpen && (
        <FilterSheet
          works={works}
          workUnread={workUnread}
          initial={{ selectedWorkIds, unreadOnly, endingSoon, sort }}
          onClose={() => setSheetOpen(false)}
          onApply={(v) => {
            setSelectedWorkIds(v.selectedWorkIds); setUnreadOnly(v.unreadOnly)
            setEndingSoon(v.endingSoon); setSort(v.sort); setSheetOpen(false)
          }}
        />
      )}
    </div>
  )
}

/* ============================================================
   모바일 필터 바텀시트 — 적용 전 draft / 적용 시 commit
   ============================================================ */
interface SheetVal { selectedWorkIds: Set<string>; unreadOnly: boolean; endingSoon: boolean; sort: Sort }

function FilterSheet({ works, workUnread, initial, onClose, onApply }: {
  works: WorkLite[]
  workUnread: Map<string, number>
  initial: SheetVal
  onClose: () => void
  onApply: (v: SheetVal) => void
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(initial.selectedWorkIds))
  const [unreadOnly, setUnreadOnly] = useState(initial.unreadOnly)
  const [endingSoon, setEndingSoon] = useState(initial.endingSoon)
  const [sort, setSort] = useState<Sort>(initial.sort)
  const [q, setQ] = useState('')

  // 모바일 뒤로가기로 시트 닫기
  useEffect(() => {
    window.history.pushState({ sheet: true }, '')
    const onPop = () => onClose()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const close = () => { if (window.history.state?.sheet) window.history.back(); else onClose() }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? works.filter(w => w.name.toLowerCase().includes(s)) : works
  }, [works, q])

  const toggle = (id: string) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const reset = () => { setSel(new Set()); setUnreadOnly(false); setEndingSoon(false); setSort('latest') }

  return (
    <div className={styles.sheetOverlay} onClick={close}>
      <div className={styles.sheetPanel} onClick={e => e.stopPropagation()} role="dialog" aria-label="소식 필터">
        <div className={styles.sheetHead}>
          <span className={styles.sheetTitle}>소식 필터</span>
          <button className={styles.sheetReset} onClick={reset}>초기화</button>
        </div>
        <div className={styles.sheetBody}>
          <div className={styles.sheetSection}>
            <div className={styles.sheetLabel}>작품</div>
            <input className={styles.workSearch} placeholder="작품 검색" value={q} onChange={e => setQ(e.target.value)} />
            <button type="button" className={styles.optRow} onClick={() => setSel(new Set())}>
              <span className={sel.size === 0 ? `${styles.check} ${styles.checkOn}` : styles.check} />
              <span className={styles.workName}>전체 작품</span>
            </button>
            {shown.map(w => (
              <button type="button" key={w.id} className={styles.optRow} onClick={() => toggle(w.id)}>
                <span className={sel.has(w.id) ? `${styles.check} ${styles.checkOn}` : styles.check} />
                <span className={styles.workName}>{w.name}</span>
                {(workUnread.get(w.id) ?? 0) > 0 && <span className={styles.workCount}>{workUnread.get(w.id)}</span>}
              </button>
            ))}
          </div>
          <div className={styles.sheetSection}>
            <div className={styles.sheetLabel}>소식 상태</div>
            <button type="button" className={styles.optRow} onClick={() => setUnreadOnly(v => !v)}>
              <span className={unreadOnly ? `${styles.box} ${styles.boxOn}` : styles.box} />
              <span className={styles.workName}>안 읽은 소식</span>
            </button>
            <button type="button" className={styles.optRow} onClick={() => setEndingSoon(v => !v)}>
              <span className={endingSoon ? `${styles.box} ${styles.boxOn}` : styles.box} />
              <span className={styles.workName}>종료 임박</span>
            </button>
          </div>
          <div className={styles.sheetSection}>
            <div className={styles.sheetLabel}>정렬</div>
            <button type="button" className={styles.optRow} onClick={() => setSort('latest')}>
              <span className={sort === 'latest' ? `${styles.radio} ${styles.radioOn}` : styles.radio} />
              <span className={styles.workName}>최신순</span>
            </button>
            <button type="button" className={styles.optRow} onClick={() => setSort('ending')}>
              <span className={sort === 'ending' ? `${styles.radio} ${styles.radioOn}` : styles.radio} />
              <span className={styles.workName}>종료 임박순</span>
            </button>
          </div>
        </div>
        <div className={styles.sheetFoot}>
          <button className={styles.applyBtn} onClick={() => onApply({ selectedWorkIds: sel, unreadOnly, endingSoon, sort })}>선택한 조건으로 보기</button>
        </div>
      </div>
    </div>
  )
}
