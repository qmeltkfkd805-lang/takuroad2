'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import GoodsPageShell from './GoodsPageShell'
import GoodsCollectionsTab from './GoodsCollectionsTab'
import {
  getMyGoods, getMyGoodsCounts, getMyGoodsCollections, getGoodsTypes,
  deleteGoods, setGoodsVisibility, getGoodsPostId,
  type GoodsListItem, type GoodsType, type GoodsVisibility,
} from '@/services/goodsService'
import { getMyPrivacy, setPrivacy, type PrivacyLevel } from '@/services/privacyService'
import styles from './Goods.module.css'

const PAGE = 30
const WRITE_HREF = '/community/write?board=goods'
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const VIS: { key: GoodsVisibility; label: string }[] = [
  { key: 'public', label: '전체 공개' }, { key: 'followers', label: '팔로워 공개' }, { key: 'private', label: '나만 보기' },
]
const VIS_LABEL: Record<string, string> = { public: '전체 공개', followers: '팔로워 공개', private: '나만 보기' }

function VisIcon({ v }: { v: GoodsVisibility }) {
  if (v === 'private') return <svg width="12" height="12" viewBox="0 0 24 24" {...P}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
  if (v === 'followers') return <svg width="12" height="12" viewBox="0 0 24 24" {...P}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6M21 20a6 6 0 0 0-3-5" /></svg>
  return <svg width="12" height="12" viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" /></svg>
}

export default function GoodsListPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const { user } = useAuth()
  const tab: 'all' | 'collections' = sp.get('tab') === 'collections' ? 'collections' : 'all'
  const setTab = (t: 'all' | 'collections') =>
    router.replace(t === 'collections' ? '/profile/goods?tab=collections' : '/profile/goods', { scroll: false })

  // 요약
  const [counts, setCounts] = useState<{ goodsCount: number; collectionCount: number; thisMonthCount: number } | null>(null)
  const [privacy, setPrivacyLevel] = useState<PrivacyLevel | null>(null)
  const [privacyOpen, setPrivacyOpen] = useState(false)

  // 카탈로그(필터)
  const [types, setTypes] = useState<GoodsType[]>([])
  const [works, setWorks] = useState<{ id: string | null; name: string }[]>([])

  // 필터/정렬/뷰
  const [search, setSearch] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [typeSel, setTypeSel] = useState<string>('all')
  const [workSel, setWorkSel] = useState<string>('all')   // 'all' | 'none' | tagId
  const [visSel, setVisSel] = useState<string>('all')     // 'all' | level
  const [order, setOrder] = useState<'recent' | 'old'>('recent')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  // 목록
  const [items, setItems] = useState<GoodsListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [error, setError] = useState(false)
  const reqRef = useRef(0)

  // 메뉴/삭제
  const [menu, setMenu] = useState<{ item: GoodsListItem; x: number; top: number; bottom: number } | null>(null)
  const [delTarget, setDelTarget] = useState<GoodsListItem | null>(null)
  const [busy, setBusy] = useState(false)

  const refreshCounts = useCallback(() => { getMyGoodsCounts().then(setCounts).catch(() => {}) }, [])

  useEffect(() => {
    refreshCounts()
    getGoodsTypes().then(setTypes).catch(() => setTypes([]))
    getMyGoodsCollections()
      .then(cs => setWorks(cs.filter(c => c.workId).map(c => ({ id: c.workId, name: c.workName || '작품' }))))
      .catch(() => setWorks([]))
  }, [refreshCounts])

  useEffect(() => {
    if (!user) return
    getMyPrivacy(user.id).then(p => setPrivacyLevel(p.goods)).catch(() => {})
  }, [user])

  // 검색 디바운스
  useEffect(() => {
    const t = setTimeout(() => setSearchQ(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const params = useMemo(() => ({
    typeId: typeSel === 'all' ? null : typeSel,
    workId: workSel === 'all' || workSel === 'none' ? null : workSel,
    onlyUnassigned: workSel === 'none',
    search: searchQ || null,
    visibility: (visSel === 'all' ? null : visSel) as GoodsVisibility | null,
    order,
  }), [typeSel, workSel, searchQ, visSel, order])

  const loadFirst = useCallback(async () => {
    const rid = ++reqRef.current
    setLoading(true); setError(false); setItems([]); setCursor(null); setHasMore(false)
    try {
      const res = await getMyGoods({ ...params, limit: PAGE })
      if (rid !== reqRef.current) return
      setItems(res.items); setCursor(res.nextCursor); setHasMore(!!res.nextCursor)
    } catch {
      if (rid === reqRef.current) setError(true)
    } finally {
      if (rid === reqRef.current) setLoading(false)
    }
  }, [params])

  useEffect(() => { if (tab === 'all') loadFirst() }, [loadFirst, tab])

  async function loadMore() {
    if (moreLoading || !cursor) return
    setMoreLoading(true)
    const rid = reqRef.current
    try {
      const res = await getMyGoods({ ...params, before: cursor, limit: PAGE })
      if (rid !== reqRef.current) return
      setItems(prev => [...prev, ...res.items]); setCursor(res.nextCursor); setHasMore(!!res.nextCursor)
    } catch { /* keep */ } finally {
      setMoreLoading(false)
    }
  }

  const collectibleTypes = types.filter(t => t.isCollectible)
  const typeOptions = collectibleTypes.length > 0 ? collectibleTypes : types

  async function onChangePrivacy(level: PrivacyLevel) {
    setPrivacyOpen(false)
    const prev = privacy
    setPrivacyLevel(level)
    const r = await setPrivacy({ goods: level })
    if (!r.ok) setPrivacyLevel(prev)
  }

  // 카드 클릭 → 연결된 커뮤니티 글로 이동(없으면 편집 화면 fallback)
  async function openGoods(it: GoodsListItem) {
    try {
      const pid = await getGoodsPostId(it.id)
      if (pid) { router.push(`/community/${pid}`); return }
    } catch { /* fallback below */ }
    router.push(`/profile/goods/${it.id}/edit`)
  }

  // 수정 → 연결된 커뮤니티 글쓰기(편집) 화면(없으면 굿즈 편집 화면 fallback)
  async function editGoods(it: GoodsListItem) {
    try {
      const pid = await getGoodsPostId(it.id)
      if (pid) { router.push(`/community/write?edit=${pid}`); return }
    } catch { /* fallback below */ }
    router.push(`/profile/goods/${it.id}/edit`)
  }

  async function onChangeVisibility(it: GoodsListItem, v: GoodsVisibility) {
    setMenu(null)
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, visibility: v } : x))
    try { await setGoodsVisibility(it.id, v) } catch { setItems(prev => prev.map(x => x.id === it.id ? { ...x, visibility: it.visibility } : x)) }
  }

  async function onDelete() {
    if (!delTarget) return
    setBusy(true)
    try {
      await deleteGoods(delTarget.id)
      setItems(prev => prev.filter(x => x.id !== delTarget.id))
      setDelTarget(null)
      refreshCounts()
    } catch { /* keep */ } finally { setBusy(false) }
  }

  const addBtn = (
    <button onClick={() => router.push(WRITE_HREF)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, padding: '9px 16px', borderRadius: 9999 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>굿즈 추가
    </button>
  )

  return (
    <GoodsPageShell crumbs={[{ label: '마이', href: '/profile' }, { label: '내 굿즈' }]} title="내 굿즈" right={addBtn}>
      <div className={styles.wrap}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <p className={styles.desc} style={{ margin: 0 }}>내가 모은 굿즈를 한곳에서 기록하고 작품별로 모아보세요.</p>
          <div className={styles.deskAdd} style={{ flexShrink: 0 }}>{addBtn}</div>
        </div>

        {/* 요약 바 */}
        <div className={styles.summary}>
          <div className={`${styles.summaryItem} ${styles.summaryTab}`} role="button" tabIndex={0}
            onClick={() => setTab('all')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTab('all') } }}>
            <span className={`${styles.sumIcon} ${tab === 'all' ? styles.sumIconOn : ''}`}>
              <svg width="19" height="19" viewBox="0 0 24 24" {...P}><path d="M4 8h16l-1 12H5L4 8z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></svg>
            </span>
            <span className={styles.sumText}>
              <span className={styles.summaryLabel} style={tab === 'all' ? { color: 'var(--accent)' } : undefined}>전체 굿즈</span>
              <span className={styles.summaryValue}>{counts ? counts.goodsCount : '–'}</span>
            </span>
          </div>
          <div className={`${styles.summaryItem} ${styles.summaryTab}`} role="button" tabIndex={0}
            onClick={() => setTab('collections')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTab('collections') } }}>
            <span className={`${styles.sumIcon} ${tab === 'collections' ? styles.sumIconOn : ''}`}>
              <svg width="19" height="19" viewBox="0 0 24 24" {...P}><rect x="3.5" y="4" width="7" height="7" rx="1.5" /><rect x="13.5" y="4" width="7" height="7" rx="1.5" /><rect x="3.5" y="14" width="7" height="7" rx="1.5" /><rect x="13.5" y="14" width="7" height="7" rx="1.5" /></svg>
            </span>
            <span className={styles.sumText}>
              <span className={styles.summaryLabel} style={tab === 'collections' ? { color: 'var(--accent)' } : undefined}>작품 컬렉션</span>
              <span className={styles.summaryValue}>{counts ? counts.collectionCount : '–'}</span>
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.sumIcon}>
              <svg width="19" height="19" viewBox="0 0 24 24" {...P}><path d="M12 3l1.9 4.6L18.5 9l-3.5 3 1 4.8L12 14.7 8 16.8l1-4.8L5.5 9l4.6-1.4z" /></svg>
            </span>
            <span className={styles.sumText}>
              <span className={styles.summaryLabel}>이번 달</span>
              <span className={`${styles.summaryValue} ${styles.summaryAccent}`}>{counts ? (counts.thisMonthCount > 0 ? `+${counts.thisMonthCount}` : '0') : '–'}</span>
            </span>
          </div>
          <div className={styles.summaryItem} style={{ position: 'relative', justifyContent: 'flex-end' }}>
            <button className={styles.privacyBtn} onClick={() => setPrivacyOpen(o => !o)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" {...P}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                {privacy ? VIS_LABEL[privacy] : '설정'}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" {...P} style={{ transform: privacyOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', color: 'var(--muted)' }}><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {privacyOpen && (
              <>
                <div onClick={() => setPrivacyOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                <div className={styles.privacyPop}>
                  {VIS.map(v => (
                    <button key={v.key} className={`${styles.privacyOpt} ${privacy === v.key ? styles.privacyOptOn : ''}`} onClick={() => onChangePrivacy(v.key)}>{v.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {tab === 'collections' ? (
          <GoodsCollectionsTab />
        ) : (
          <>
            {/* 검색·필터 툴바 */}
            <div className={styles.toolbar}>
              <div className={styles.search}>
                <svg width="16" height="16" viewBox="0 0 24 24" {...P}><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="내 굿즈 검색" />
              </div>
              <div className={styles.toolFilters}>
                {works.length > 0 && (
                  <PinkSelect ariaLabel="작품 필터" value={workSel} onChange={setWorkSel}
                    options={[{ value: 'all', label: '작품 전체' }, { value: 'none', label: '작품 미지정' }, ...works.map(w => ({ value: w.id!, label: w.name }))]} />
                )}
                <PinkSelect ariaLabel="종류 필터" value={typeSel} onChange={setTypeSel}
                  options={[{ value: 'all', label: '종류 전체' }, ...typeOptions.map(t => ({ value: t.id, label: t.name }))]} />
                <PinkSelect ariaLabel="공개 범위 필터" value={visSel} onChange={setVisSel}
                  options={[{ value: 'all', label: '공개 범위' }, { value: 'public', label: '전체 공개' }, { value: 'followers', label: '팔로워 공개' }, { value: 'private', label: '나만 보기' }]} />
                <PinkSelect ariaLabel="정렬" value={order} onChange={v => setOrder(v as 'recent' | 'old')}
                  options={[{ value: 'recent', label: '최근 등록순' }, { value: 'old', label: '오래된순' }]} />
                <div className={styles.viewToggle}>
                  <button className={`${styles.viewBtn} ${view === 'grid' ? styles.viewBtnOn : ''}`} onClick={() => setView('grid')} aria-label="그리드">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>
                  </button>
                  <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnOn : ''}`} onClick={() => setView('list')} aria-label="목록">
                    <svg width="17" height="17" viewBox="0 0 24 24" {...P}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* 목록 */}
            {loading ? (
              <div className={styles.grid}>{[0, 1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className={`${styles.sk} ${styles.skCard}`} />)}</div>
            ) : error ? (
              <div className={styles.state}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>굿즈를 불러오지 못했어요</div>
                <button className={styles.stateBtn} onClick={loadFirst}>다시 시도</button>
              </div>
            ) : items.length === 0 && searchQ === '' && typeSel === 'all' && workSel === 'all' && visSel === 'all' ? (
              <div className={styles.grid}>
                <AddCard onClick={() => router.push(WRITE_HREF)} />
              </div>
            ) : items.length === 0 ? (
              <div className={styles.state}><div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--muted)' }}>조건에 맞는 굿즈가 없어요</div></div>
            ) : view === 'grid' ? (
              <>
                <div className={styles.grid}>
                  <AddCard onClick={() => router.push(WRITE_HREF)} />
                  {items.map(it => (
                    <GoodsCard key={it.id} item={it}
                      onEdit={() => openGoods(it)}
                      onOpenMenu={(x, top, bottom) => setMenu({ item: it, x, top, bottom })}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className={styles.moreWrap}>
                    <button className={styles.moreBtn} onClick={loadMore} disabled={moreLoading}>{moreLoading ? '불러오는 중…' : '더 보기'}</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(it => (
                    <GoodsRow key={it.id} item={it}
                      onEdit={() => openGoods(it)}
                      onOpenMenu={(x, top, bottom) => setMenu({ item: it, x, top, bottom })}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className={styles.moreWrap}>
                    <button className={styles.moreBtn} onClick={loadMore} disabled={moreLoading}>{moreLoading ? '불러오는 중…' : '더 보기'}</button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* 더보기 메뉴 (카드 밖 고정 위치, 아래 공간 부족 시 위로) */}
      {menu && (() => {
        const MENU_H = 224
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800
        const up = menu.bottom + MENU_H > vh
        const pos: React.CSSProperties = up
          ? { position: 'fixed', bottom: vh - menu.top + 6, left: Math.max(8, menu.x - 148), width: 148, zIndex: 3000 }
          : { position: 'fixed', top: menu.bottom + 6, left: Math.max(8, menu.x - 148), width: 148, zIndex: 3000 }
        return (
        <>
          <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 2999 }} />
          <div className={styles.menuPop} style={pos}>
            <button className={styles.menuItem} onClick={() => { const it = menu.item; setMenu(null); editGoods(it) }}>수정</button>
            <div className={styles.menuHead}>공개 범위</div>
            {VIS.map(v => (
              <button key={v.key} className={styles.menuItem} style={menu.item.visibility === v.key ? { color: 'var(--accent)' } : undefined}
                onClick={() => { const it = menu.item; setMenu(null); onChangeVisibility(it, v.key) }}>{v.label}</button>
            ))}
            <button className={`${styles.menuItem} ${styles.menuDanger}`} onClick={() => { const it = menu.item; setMenu(null); setDelTarget(it) }}>삭제</button>
          </div>
        </>
        )
      })()}

      {/* 삭제 확인 모달 */}
      {delTarget && (
        <div onClick={() => !busy && setDelTarget(null)} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, background: 'var(--surface)', borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>굿즈를 삭제할까요?</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 18 }}>삭제하면 되돌릴 수 없어요. 이 글로 커뮤니티에 올린 게시글은 그대로 남아요.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDelTarget(null)} disabled={busy} style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>취소</button>
              <button onClick={onDelete} disabled={busy} style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: 'var(--red, #e5484d)', color: '#fff', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? '삭제 중…' : '삭제'}</button>
            </div>
          </div>
        </div>
      )}
    </GoodsPageShell>
  )
}

/* ── 커스텀 드롭다운(핑크) ── */
function PinkSelect({ value, onChange, options, ariaLabel }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; ariaLabel?: string }) {
  const [open, setOpen] = useState(false)
  const cur = options.find(o => o.value === value) ?? options[0]
  const active = open || (options.length > 0 && value !== options[0].value)
  return (
    <div className={styles.sel}>
      <button aria-label={ariaLabel} className={`${styles.selBtn} ${active ? styles.selBtnOn : ''}`} onClick={() => setOpen(o => !o)}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur?.label}</span>
        <svg className={styles.selCaret} width="14" height="14" viewBox="0 0 24 24" {...P} style={{ transform: open ? 'rotate(180deg)' : 'none' }}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
          <div className={styles.selPop}>
            {options.map(o => (
              <button key={o.value} className={`${styles.selOpt} ${o.value === value ? styles.selOptOn : ''}`} onClick={() => { onChange(o.value); setOpen(false) }}>{o.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── 새 굿즈 추가 카드 ── */
function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <button className={styles.addCard} onClick={onClick}>
      <svg width="26" height="26" viewBox="0 0 24 24" {...P}><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.2" /><path d="M8 6l1.2-2h5.6L16 6" /><path d="M19 9.5v-3M17.5 8h3" /></svg>
      <span className={styles.addCardText}>새 굿즈 추가</span>
      <span className={styles.addCardSub}>사진과 정보를 기록해보세요</span>
    </button>
  )
}

/* ── 카드 커버(사진 → 작품 이미지 fallback → 플레이스홀더) ── */
function Cover({ item }: { item: GoodsListItem }) {
  if (item.cover.url) return <img className={styles.thumb} src={item.cover.url} alt={item.name ?? '굿즈'} loading="lazy" />
  if (item.workCoverUrl) return (
    <>
      <img className={styles.thumb} src={item.workCoverUrl} alt="" loading="lazy" />
      <span className={styles.fallbackBadge}>작품 이미지</span>
    </>
  )
  return <span className={styles.thumbPh}><svg width="34" height="34" viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg></span>
}

interface CardProps {
  item: GoodsListItem
  onEdit: () => void
  onOpenMenu: (x: number, top: number, bottom: number) => void
}

function GoodsCard({ item, onEdit, onOpenMenu }: CardProps) {
  return (
    <div className={styles.card} style={{ position: 'relative', cursor: 'default' }}>
      <button onClick={onEdit} style={{ display: 'flex', flexDirection: 'column', width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span className={styles.thumbWrap}>
          <Cover item={item} />
          {item.isFromCommunity && <span className={styles.badges}><span className={`${styles.pill} ${styles.pillCommunity}`}>굿즈 자랑</span></span>}
        </span>
        <span className={styles.body}>
          <span className={styles.name}>{item.name || item.goodsTypeName || '이름 없는 굿즈'}</span>
          {item.workName && <span className={styles.sub}>{item.workName}</span>}
        </span>
      </button>
      <button className={styles.visIcon} aria-label="더보기" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onOpenMenu(r.right, r.top, r.bottom) }} style={{ border: 'none', cursor: 'pointer', zIndex: 5 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
      </button>
      <div className={styles.cardFoot}>
        {item.goodsTypeName ? <span className={styles.typeChip}>{item.goodsTypeName}</span> : <span />}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', flexShrink: 0 }} title={VIS_LABEL[item.visibility]}>
          <VisIcon v={item.visibility} />{VIS_LABEL[item.visibility]}
        </span>
      </div>
    </div>
  )
}

function GoodsRow({ item, onEdit, onOpenMenu }: CardProps) {
  return (
    <div className={styles.listRow}>
      <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ position: 'relative', width: 56, height: 56, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)', display: 'inline-flex' }}>
          {item.cover.url ? <img src={item.cover.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
            : item.workCoverUrl ? <img src={item.workCoverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" /> : null}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || item.goodsTypeName || '이름 없는 굿즈'}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 12, color: 'var(--muted)' }}>
            {item.workName && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.workName}</span>}
            {item.goodsTypeName && <><span>·</span><span style={{ whiteSpace: 'nowrap' }}>{item.goodsTypeName}</span></>}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }}><VisIcon v={item.visibility} />{VIS_LABEL[item.visibility]}</span>
          </span>
        </span>
      </button>
      <button aria-label="더보기" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onOpenMenu(r.right, r.top, r.bottom) }} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
    </div>
  )
}
