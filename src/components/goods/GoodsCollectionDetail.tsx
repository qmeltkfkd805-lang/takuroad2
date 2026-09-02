'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/tds'
import GoodsPageShell from './GoodsPageShell'
import { getMyGoods, getGoodsTypes, getCollectionCovers, setCollectionCover, getGoodsPostId, type GoodsListItem, type GoodsType } from '@/services/goodsService'
import styles from './Goods.module.css'

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
type Sort = 'recent' | 'old'

export default function GoodsCollectionDetail({ workId }: { workId: string | null }) {
  const router = useRouter()
  const unassigned = workId === null

  const [all, setAll] = useState<GoodsListItem[] | null>(null)
  const [types, setTypes] = useState<GoodsType[]>([])
  const [error, setError] = useState(false)
  const [typeSel, setTypeSel] = useState<string>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [coverItemId, setCoverItemId] = useState<string | null>(null)   // 대표 굿즈 id
  const [menu, setMenu] = useState<{ item: GoodsListItem; x: number; top: number; bottom: number } | null>(null)

  useEffect(() => { getGoodsTypes().then(setTypes).catch(() => setTypes([])) }, [])
  useEffect(() => {
    if (unassigned || !workId) { setCoverItemId(null); return }
    getCollectionCovers().then(m => setCoverItemId(m[workId] ?? null)).catch(() => {})
  }, [workId, unassigned])

  async function chooseCover(it: GoodsListItem) {
    if (unassigned || !workId) return
    setMenu(null)
    const prev = coverItemId
    setCoverItemId(it.id)
    try {
      await setCollectionCover(workId, it.id)
    } catch (e: any) {
      setCoverItemId(prev)
      alert(`대표 지정에 실패했어요: ${e?.message ?? '알 수 없는 오류'}`)
    }
  }

  // 카드 클릭 → 연결된 커뮤니티 글, 수정 → 커뮤니티 글쓰기(편집) 화면 (없으면 굿즈 편집 fallback)
  async function openGoods(it: GoodsListItem) {
    try { const pid = await getGoodsPostId(it.id); if (pid) { router.push(`/community/${pid}`); return } } catch { /* fallback */ }
    router.push(`/profile/goods/${it.id}`)   // 연결 글 없으면 읽기 전용 굿즈 보기
  }
  async function editGoods(it: GoodsListItem) {
    try { const pid = await getGoodsPostId(it.id); if (pid) { router.push(`/community/write?edit=${pid}`); return } } catch { /* fallback */ }
    router.push(`/community/write?goodsId=${it.id}`)   // 연결 글 없으면 기존 굿즈로 새 글 작성
  }

  async function load() {
    setError(false); setAll(null)
    try {
      const acc: GoodsListItem[] = []
      let before: string | null = null
      for (let i = 0; i < 20; i++) {
        const res = await getMyGoods({ workId: unassigned ? null : workId, onlyUnassigned: unassigned, before, limit: 60 })
        acc.push(...res.items)
        if (!res.nextCursor) break
        before = res.nextCursor
      }
      setAll(acc)
    } catch { setError(true); setAll([]) }
  }
  useEffect(() => { load()   }, [workId])

  const workName = unassigned ? '작품 미지정' : (all?.[0]?.workName ?? '컬렉션')
  const total = all?.length ?? 0
  const allPublic = (all ?? []).every(i => i.visibility === 'public')

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>(); let none = 0
    for (const it of all ?? []) { if (it.goodsTypeId) m.set(it.goodsTypeId, (m.get(it.goodsTypeId) ?? 0) + 1); else none++ }
    return { m, none }
  }, [all])

  const chips = useMemo(() => {
    const out: { key: string; label: string; count: number }[] = [{ key: 'all', label: '전체', count: total }]
    for (const t of types) { const c = typeCounts.m.get(t.id) ?? 0; if (c > 0) out.push({ key: t.id, label: t.name, count: c }) }
    if (typeCounts.none > 0) out.push({ key: 'none', label: '미지정', count: typeCounts.none })
    return out
  }, [types, typeCounts, total])

  const sortedAll = useMemo(() => (all ?? []).slice().sort((a, b) => a.createdAt < b.createdAt ? 1 : -1), [all])
  const items = useMemo(() => {
    let list = (all ?? []).slice()
    if (typeSel === 'none') list = list.filter(i => !i.goodsTypeId)
    else if (typeSel !== 'all') list = list.filter(i => i.goodsTypeId === typeSel)
    list.sort((a, b) => sort === 'recent' ? (a.createdAt < b.createdAt ? 1 : -1) : (a.createdAt > b.createdAt ? 1 : -1))
    return list
  }, [all, typeSel, sort])

  const recentCovers = sortedAll.map(i => i.cover.url).filter(Boolean).slice(0, 4) as string[]
  const chosenCoverUrl = coverItemId ? ((all ?? []).find(i => i.id === coverItemId)?.cover.url ?? null) : null
  const coverUrl = chosenCoverUrl ?? recentCovers[0] ?? null
  const lastAdded = sortedAll[0]?.createdAt ? new Date(sortedAll[0].createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '-'
  const topTypeName = useMemo(() => {
    let best = ''; let bestN = 0
    for (const [tid, n] of typeCounts.m) if (n > bestN) { bestN = n; best = types.find(t => t.id === tid)?.name ?? '' }
    return best || '-'
  }, [typeCounts, types])

  const addHref = unassigned ? '/profile/goods/new' : `/profile/goods/new?work=${workId}&workName=${encodeURIComponent(workName)}`

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      const nav = navigator as any
      if (nav.share) await nav.share({ title: `${workName} 컬렉션`, url })
      else { await navigator.clipboard.writeText(url); alert('링크를 복사했어요') }
    } catch { /* 취소 */ }
  }

  const shareBtnMobile = (
    <button onClick={share} aria-label="공유" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)', display: 'inline-flex', padding: 6 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" {...P}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" /></svg>
    </button>
  )

  return (
    <GoodsPageShell
      crumbs={[{ label: '마이', href: '/profile' }, { label: '내 굿즈', href: '/profile/goods' }, { label: '컬렉션' }]}
      title="컬렉션" right={shareBtnMobile}
    >
      <div className={styles.detailWrap}>
        {/* 본문 */}
        <div>
          {/* 헤더 카드 */}
          <div className={styles.headCard}>
            <div className={styles.headTop}>
              <span className={styles.headCover}>
                {coverUrl
                  ? <img src={coverUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                      <svg width="30" height="30" viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg>
                    </span>}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-l)', padding: '3px 9px', borderRadius: 9999 }}>작품별 자동 컬렉션</span>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', margin: '8px 0 6px' }}>{workName}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                  <span>소장 굿즈 {total}개</span><span>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {allPublic
                      ? <><svg width="13" height="13" viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" /></svg>공개</>
                      : <><svg width="13" height="13" viewBox="0 0 24 24" {...P}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>일부 비공개</>}
                  </span>
                </div>
              </div>
              <div className={styles.headActions}>
                <button onClick={share} style={btnOutline}>컬렉션 공유</button>
                <button onClick={() => router.push(addHref)} style={btnPrimary}>
                  <svg width="15" height="15" viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>굿즈 추가
                </button>
              </div>
            </div>
          </div>

          {all === null ? (
            <div className={styles.grid}>{[0, 1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className={`${styles.sk} ${styles.skCard}`} />)}</div>
          ) : error ? (
            <div className={styles.state}><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>불러오지 못했어요</div><button className={styles.stateBtn} onClick={load}>다시 시도</button></div>
          ) : total === 0 ? (
            <EmptyState title="이 작품의 굿즈가 없어요" description="굿즈를 추가하면 여기에 모여요." action={{ label: '굿즈 추가', onClick: () => router.push(addHref) }} />
          ) : (
            <>
              <div className={styles.chips} style={{ marginBottom: 12 }}>
                {chips.map(c => (
                  <button key={c.key} className={`${styles.chip} ${typeSel === c.key ? styles.chipOn : ''}`} onClick={() => setTypeSel(c.key)}>{c.label} {c.count}</button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <SortDropdown value={sort} onChange={setSort} />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setView('grid')} aria-label="그리드" style={viewBtn(view === 'grid')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>
                  </button>
                  <button onClick={() => setView('list')} aria-label="목록" style={viewBtn(view === 'list')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
                  </button>
                </div>
              </div>

              {view === 'grid' ? (
                <div className={styles.grid}>
                  {items.map(it => <CardGrid key={it.id} item={it} isCover={coverItemId === it.id}
                    onClick={() => openGoods(it)}
                    onOpenMenu={(x, top, bottom) => setMenu({ item: it, x, top, bottom })} />)}
                  <button onClick={() => router.push(addHref)} style={dashedCard('accent')}>
                    <svg width="26" height="26" viewBox="0 0 24 24" {...P}><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.2" /><path d="M8 6l1.2-2h5.6L16 6" /><path d="M19 9.5v-3M17.5 8h3" /></svg>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--accent)' }}>새 굿즈를 자랑해보세요</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.4 }}>사진을 추가하고 컬렉션을<br />더 풍성하게 만들어보세요</span>
                  </button>
                  <div style={dashedCard('gray')}>
                    <svg width="26" height="26" viewBox="0 0 24 24" {...P} style={{ color: 'var(--muted)' }}><path d="M12 3l2.2 5 5.3.4-4 3.5 1.2 5.1L12 19.8 7.3 22.5 8.5 17.4l-4-3.5 5.3-.4z" /></svg>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>다음 굿즈는 무엇인가요?</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.4 }}>아직 만나지 못한 소중한 굿즈를<br />기다리고 있어요</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(it => <RowList key={it.id} item={it} isCover={coverItemId === it.id}
                    onClick={() => openGoods(it)}
                    onOpenMenu={(x, top, bottom) => setMenu({ item: it, x, top, bottom })} />)}
                </div>
              )}
            </>
          )}
        </div>

        {/* 우측 패널 (데스크톱) */}
        <aside className={styles.aside}>
          <div className={styles.panel}>
            <div className={styles.panelHead}><span className={styles.panelTitle}>컬렉션 기록</span></div>
            <div className={styles.panelRow}><div className={styles.panelLabel}>최근 추가</div><div className={styles.panelValue}>{lastAdded}</div></div>
            <div className={styles.panelRow}><div className={styles.panelLabel}>가장 많은 종류</div><div className={styles.panelValue}>{topTypeName}</div></div>
            <div className={styles.panelRow}><div className={styles.panelLabel}>소장 굿즈</div><div className={styles.panelValue}>{total}개</div></div>
          </div>
        </aside>
      </div>

      {menu && (() => {
        const MENU_H = 120
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800
        const up = menu.bottom + MENU_H > vh
        const pos: React.CSSProperties = up
          ? { position: 'fixed', bottom: vh - menu.top + 6, left: Math.max(8, menu.x - 168), width: 168, zIndex: 3000 }
          : { position: 'fixed', top: menu.bottom + 6, left: Math.max(8, menu.x - 168), width: 168, zIndex: 3000 }
        return (
          <>
            <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 2999 }} />
            <div className={styles.menuPop} style={pos}>
              <button className={styles.menuItem} onClick={() => { const it = menu.item; setMenu(null); editGoods(it) }}>수정</button>
              <button className={styles.menuItem} onClick={() => { const it = menu.item; setMenu(null); router.push(`/profile/goods/${it.id}/edit`) }}>굿즈 정보 수정</button>
              {!unassigned && (
                <button className={styles.menuItem} style={coverItemId === menu.item.id ? { color: 'var(--accent)' } : undefined} onClick={() => chooseCover(menu.item)}>
                  {coverItemId === menu.item.id ? '대표 이미지 (현재)' : '대표로 설정'}
                </button>
              )}
            </div>
          </>
        )
      })()}
    </GoodsPageShell>
  )
}

/* ── 카드/행/칩 ── */
function TypePill({ name }: { name: string | null }) {
  if (!name) return null
  return <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 9999 }}>{name}</span>
}
function CommunityBadge() {
  const P2 = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-l)', padding: '2px 8px', borderRadius: 9999 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" {...P2}><path d="M12 3l2 5 5 .5-3.8 3.3 1.2 5.2L12 19l-4.6 3 1.2-5.2L4.8 8.5 10 8z" /></svg>굿즈 자랑에서 추가
    </span>
  )
}
interface ItemCardProps { item: GoodsListItem; isCover?: boolean; onClick: () => void; onOpenMenu: (x: number, top: number, bottom: number) => void }
function coverBadge() {
  return <span style={{ position: 'absolute', top: 8, left: 8, zIndex: 3, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 800, color: '#fff', background: 'var(--accent)', padding: '3px 8px', borderRadius: 9999 }}>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>대표
  </span>
}
function moreBtn(onOpenMenu: (x: number, top: number, bottom: number) => void, style: React.CSSProperties) {
  return (
    <button aria-label="더보기" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onOpenMenu(r.right, r.top, r.bottom) }} style={style}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
    </button>
  )
}
function CardGrid({ item, isCover, onClick, onOpenMenu }: ItemCardProps) {
  return (
    <div className={styles.card} style={{ position: 'relative', cursor: 'default' }}>
      <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span className={styles.thumbWrap}>
          {item.cover.url ? <img className={styles.thumb} src={item.cover.url} alt={item.name ?? '굿즈'} loading="lazy" />
            : <span className={styles.thumbPh}><svg width="34" height="34" viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg></span>}
          {isCover && coverBadge()}
        </span>
        <span className={styles.body}>
          <span className={styles.name}>{item.name || item.goodsTypeName || '이름 없는 굿즈'}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}><TypePill name={item.goodsTypeName} /></span>
          {item.isFromCommunity && <span style={{ marginTop: 6 }}><CommunityBadge /></span>}
        </span>
      </button>
      {moreBtn(onOpenMenu, { position: 'absolute', top: 8, right: 8, zIndex: 5, width: 28, height: 28, borderRadius: 9999, border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })}
    </div>
  )
}
function RowList({ item, isCover, onClick, onOpenMenu }: ItemCardProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 8, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, position: 'relative' }}>
      <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ position: 'relative', width: 56, height: 56, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)', display: 'inline-flex' }}>
          {item.cover.url ? <img src={item.cover.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" /> : null}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || item.goodsTypeName || '이름 없는 굿즈'}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            {isCover && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>대표 · </span>}
            <TypePill name={item.goodsTypeName} />{item.isFromCommunity && <CommunityBadge />}
          </span>
        </span>
      </button>
      {moreBtn(onOpenMenu, { flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })}
    </div>
  )
}

function SortDropdown({ value, onChange }: { value: Sort; onChange: (s: Sort) => void }) {
  const [open, setOpen] = useState(false)
  const opts: { key: Sort; label: string }[] = [{ key: 'recent', label: '최근 등록순' }, { key: 'old', label: '오래된순' }]
  const cur = opts.find(o => o.key === value) ?? opts[0]
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        <span>{cur.label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" {...P} style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--muted)' }}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 31, minWidth: 148, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.10)' }}>
            {opts.map(o => (
              <button key={o.key} onClick={() => { onChange(o.key); setOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none', background: o.key === value ? 'var(--accent-l)' : 'transparent', color: o.key === value ? 'var(--accent)' : 'var(--text)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: o.key === value ? 800 : 600, cursor: 'pointer' }}>{o.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const btnOutline: React.CSSProperties = { height: 40, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { height: 40, padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }
function dashedCard(tone: 'accent' | 'gray'): React.CSSProperties {
  return {
    minHeight: 220, border: `1.5px dashed ${tone === 'accent' ? 'var(--accent)' : 'var(--border)'}`,
    background: tone === 'accent' ? 'var(--accent-l)' : 'var(--surface2)', borderRadius: 14, cursor: tone === 'accent' ? 'pointer' : 'default',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--accent)', fontFamily: 'inherit', padding: 12,
  }
}
function viewBtn(on: boolean): React.CSSProperties {
  return { width: 36, height: 36, borderRadius: 9, border: on ? '1px solid var(--accent)' : '1px solid var(--border)', background: on ? 'var(--accent-l)' : 'var(--surface)', color: on ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
}
