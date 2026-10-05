'use client'

import { useState, useRef, useEffect } from 'react'
import { Shop } from '@/types/shop'
import { useSaved } from '@/hooks/useSaved'
import { useAuth } from '@/components/layout/AuthProvider'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'
import { ShopCard, Chip } from '@/components/tds'
import ShopRow from '@/components/shop/ShopCard'
import { MapEvent } from '@/services/mapEventService'
import styles from './MapBottomSheet.module.css'

type SheetState = 'closed' | 'peek' | 'expanded'
const ORDER: SheetState[] = ['closed', 'peek', 'expanded']

interface MapBottomSheetProps {
  shops: Shop[]
  events?: MapEvent[]
  onSelectShop: (shop: Shop) => void
  onSelectEvent?: (ev: MapEvent) => void
  onStateChange?: (state: SheetState) => void
  onListClick?: () => void   // '전체보기' → 필터 걸린 /shops/all
  /** 고른 지역 이름 (예: "서울 마포구") — 있으면 "서울 마포구 샵 12곳"으로 */
  regionLabel?: string | null
  /** 지도에 보이는 종류 — 샵만/이벤트만이면 제목도 맞춘다 */
  layer?: 'all' | 'shop' | 'event'
  /** 펼친 목록을 아래로 스크롤하면 위 바를 숨기고, 맨 위로 오면 다시 보이게 */
  onListScrollDir?: (dir: 'down' | 'up') => void
}

// 📱 렉 줄이기 — 접힌 가로 카드는 앞쪽 몇 개만, 펼친 목록은 스크롤하면서 조금씩 더 그린다
const PEEK_LIMIT = 24
const LIST_STEP = 40

// 이벤트 type → 라벨/칩 톤 (샵 카드 칩과 같은 Chip 컴포넌트 사용)
const EV_LABEL: Record<string, string> = { popup: '팝업스토어', collab_cafe: '콜라보 카페', exhibition: '전시', official_event: '행사' }
const EV_TONE: Record<string, 'coral' | 'lavender' | 'mint' | 'blue' | 'yellow' | 'gray'> = { popup: 'blue', collab_cafe: 'coral', exhibition: 'lavender', official_event: 'gray' }

function fmtDate(d: string) { const p = d.split('-'); return p.length === 3 ? `${p[0].slice(2)}.${p[1]}.${p[2]}` : d }
function fmtPeriod(start: string | null, end: string | null): string | null {
  if (start && end) return `${fmtDate(start)} ~ ${fmtDate(end)}`
  if (end) return `~ ${fmtDate(end)}`
  if (start) return `${fmtDate(start)} ~`
  return null
}
const CalIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
const PinIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 21c-4.5-5.5-6.6-9.4-6.6-12.5a6.6 6.6 0 0 1 13.2 0c0 3.1-2.1 7-6.6 12.5z" /><circle cx="12" cy="8.5" r="2.3" /></svg>

// 이벤트 가로 카드 (peek) — tds ShopCard 톤. 순서: 이미지 → 전시 기간 → 위치 → 카테고리
function EventCard({ ev, onClick }: { ev: MapEvent; onClick: () => void }) {
  const label = ev.type ? (EV_LABEL[ev.type] ?? '이벤트') : '이벤트'
  const tone = ev.type ? (EV_TONE[ev.type] ?? 'gray') : 'gray'
  const period = fmtPeriod(ev.startDate, ev.endDate)
  return (
    <div onClick={onClick} style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)', cursor: 'pointer' }}>
      <div style={{ position: 'relative', height: 120, background: '#F7F7F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {ev.coverUrl ? <img src={ev.coverUrl} alt={ev.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'var(--muted)', fontSize: 13 }}>이벤트</span>}
      </div>
      <div className="evcard-body" style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>{ev.title}</div>
        {period && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}><CalIco />{period}</div>}
        {ev.address && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}><PinIco /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.address}</span></div>}
        <div className="shopcard-cats" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip tone={tone}>{label}</Chip></div>
      </div>
    </div>
  )
}

// 이벤트 세로 행 (expanded) — ShopRow 톤. 순서: 이미지 → 전시 기간 → 위치 → 카테고리
function EventRow({ ev, onClick }: { ev: MapEvent; onClick: () => void }) {
  const label = ev.type ? (EV_LABEL[ev.type] ?? '이벤트') : '이벤트'
  const tone = ev.type ? (EV_TONE[ev.type] ?? 'gray') : 'gray'
  const period = fmtPeriod(ev.startDate, ev.endDate)
  return (
    <div onClick={onClick} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'var(--surface)' }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)' }}>
        {ev.coverUrl && <img src={ev.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{ev.title}</div>
        {period && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)', marginBottom: 3, overflow: 'hidden' }}><CalIco /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{period}</span></div>}
        {ev.address && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)', marginBottom: 6, overflow: 'hidden' }}><PinIco /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.address}</span></div>}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><Chip tone={tone}>{label}</Chip></div>
      </div>
    </div>
  )
}

export default function MapBottomSheet({ shops, events = [], onSelectShop, onSelectEvent, onStateChange, onListClick, regionLabel = null, layer = 'all', onListScrollDir }: MapBottomSheetProps) {
  const { isSaved, toggleSave } = useSaved()
  const { user } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<SheetState>('peek')
  // 📱 모바일은 처음에 접힌 상태(제목 줄만)로 — 지도를 넓게. 위로 올리면 카드 줄, 한 번 더 올리면 전체 목록
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) setState('closed')
  }, [])
  useEffect(() => { onStateChange?.(state) }, [state, onStateChange])
  const startY = useRef<number | null>(null)
  const movedRef = useRef(0)

  // 펼친 목록 — 처음엔 LIST_STEP 개, 바닥 근처에 오면 더
  const [listCount, setListCount] = useState(LIST_STEP)
  useEffect(() => { setListCount(LIST_STEP) }, [shops, events, state])
  const lastScroll = useRef(0)
  const onListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 600) setListCount(c => c + LIST_STEP)
    const d = el.scrollTop - lastScroll.current
    if (Math.abs(d) > 12) { onListScrollDir?.(d > 0 && el.scrollTop > 40 ? 'down' : 'up'); lastScroll.current = el.scrollTop }
  }

  // 가로 카드 영역 마우스 드래그 스크롤
  const rowRef = useRef<HTMLDivElement>(null)
  const hDrag = useRef({ down: false, startX: 0, startScroll: 0, moved: false })

  const step = (dir: 1 | -1) => {
    setState(prev => {
      const i = ORDER.indexOf(prev)
      const next = Math.min(ORDER.length - 1, Math.max(0, i + dir))
      return ORDER[next]
    })
  }

  /* 시트 위아래 터치 드래그 — 시트 어디를 잡아도(제목 줄·가로 카드 줄·펼친 목록의 맨 위) 시트만 움직인다.
     예전엔 제목 줄에서만 잡혀서, 카드 줄을 위아래로 끌면 화면 전체가 끌려 내려가 새로고침이 됐다.
     touchmove 에서 preventDefault 를 해야 하므로 React 이벤트(수동 passive) 대신 직접 붙인다. */
  const rootRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let sx = 0, sy = 0
    let axis: 'x' | 'y' | 'list' | null = null
    let listEl: HTMLElement | null = null
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { startY.current = null; return }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY
      startY.current = sy
      movedRef.current = 0
      axis = null
      listEl = (e.target as HTMLElement).closest('[data-sheet-list]')
    }
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const dx = e.touches[0].clientX - sx
      const dy = e.touches[0].clientY - sy
      if (!axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        if (Math.abs(dx) > Math.abs(dy)) axis = 'x'
        // 펼친 목록 안: 맨 위에서 아래로 끌 때만 시트를 접고, 나머지는 목록 스크롤
        else if (listEl && !(listEl.scrollTop <= 0 && dy > 0)) axis = 'list'
        else axis = 'y'
      }
      if (axis !== 'y') return
      if (e.cancelable) e.preventDefault()   // 화면이 끌려 내려가거나 당겨서 새로고침 되지 않게
      movedRef.current = dy
    }
    const onEnd = () => {
      if (axis === 'y') {
        const dy = movedRef.current
        const THRESHOLD = 40
        if (dy < -THRESHOLD) stepRef.current(1)
        else if (dy > THRESHOLD) stepRef.current(-1)
      }
      startY.current = null
      movedRef.current = 0
      axis = null
    }
    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: false })
    root.addEventListener('touchend', onEnd)
    root.addEventListener('touchcancel', onEnd)
    return () => {
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchmove', onMove)
      root.removeEventListener('touchend', onEnd)
      root.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  // 가로 카드 마우스 드래그
  const onRowMouseDown = (e: React.MouseEvent) => {
    const el = rowRef.current
    if (!el) return
    e.preventDefault()
    hDrag.current = { down: true, startX: e.pageX, startScroll: el.scrollLeft, moved: false }
  }
  const onRowMouseMove = (e: React.MouseEvent) => {
    const el = rowRef.current
    if (!el || !hDrag.current.down) return
    const dx = e.pageX - hDrag.current.startX
    if (Math.abs(dx) > 4) hDrag.current.moved = true
    el.scrollLeft = hDrag.current.startScroll - dx
  }
  const endRowDrag = () => { hDrag.current.down = false }
  const onRowClickCapture = (e: React.MouseEvent) => {
    if (hDrag.current.moved) { e.preventDefault(); e.stopPropagation() }
  }

  const expanded = state === 'expanded'
  const collapsed = state === 'closed'   // 접힘: '주변 샵 N개 · 이벤트 N / 루트 보기 / 목록 보기' 줄만

  return (
    <div ref={rootRef} className={expanded ? styles.sheetExpanded : styles.sheet}>
      <div
        className={styles.dragZone}
        // 접혀 있을 땐 제목 줄 아무 데나 눌러도 카드 줄이 펼쳐진다 (루트 보기·목록 보기 버튼은 제외)
        onClick={e => { if (collapsed && !(e.target as HTMLElement).closest('button')) setState('peek') }}
      >
        <div className={styles.handle} onClick={() => step(collapsed ? 1 : -1)}
          role="button" aria-label={collapsed ? '샵 카드 펼치기' : '접기'} />
        <div className={styles.header}>
          <div className={styles.title}>
            {layer === 'event'
              ? <>{regionLabel ? `${regionLabel} ` : '진행 중 '}이벤트 <strong>{events.length}</strong>개</>
              : <>{regionLabel ? `${regionLabel} ` : '주변 '}샵 <strong>{shops.length}</strong>개{layer === 'all' && events.length > 0 && <> · 이벤트 <strong>{events.length}</strong></>}</>}
          </div>
          <div className={styles.headBtns}><button className={styles.routeBtn} onClick={() => router.push(ROUTES.routes)}>루트 보기</button><button className={styles.listBtn} onClick={onListClick}>목록 보기</button></div>
        </div>
      </div>

      {collapsed ? null : expanded ? (
        <div className={styles.list} data-sheet-list onScroll={onListScroll}>
          {shops.slice(0, listCount).map(shop => (
            <ShopRow key={shop.id} shop={shop} isActive={false} onClick={onSelectShop} />
          ))}
          {listCount > shops.length && events.slice(0, listCount - shops.length).map(ev => (
            <EventRow key={`e-${ev.id}`} ev={ev} onClick={() => onSelectEvent?.(ev)} />
          ))}
        </div>
      ) : (
        <div
          ref={rowRef}
          className={styles.row}
          onMouseDown={onRowMouseDown}
          onMouseMove={onRowMouseMove}
          onMouseUp={endRowDrag}
          onMouseLeave={endRowDrag}
          onClickCapture={onRowClickCapture}
        >
          {shops.slice(0, PEEK_LIMIT).map(shop => (
            <div key={shop.id} className={styles.cardWrap}>
              <ShopCard shop={{ ...shop, isSaved: isSaved(shop.id) } as Shop} meta="distance" onClick={onSelectShop} onToggleSave={(sh) => { if (!user) { router.push(ROUTES.login); return } toggleSave(sh.id) }} />
            </div>
          ))}
          {events.slice(0, Math.max(0, PEEK_LIMIT - Math.min(shops.length, PEEK_LIMIT))).map(ev => (
            <div key={`e-${ev.id}`} className={styles.cardWrap}>
              <EventCard ev={ev} onClick={() => onSelectEvent?.(ev)} />
            </div>
          ))}
          {shops.length + events.length > PEEK_LIMIT && (
            <div className={styles.cardWrap}>
              <button type="button" className={styles.moreCard} onClick={() => setState('expanded')}>
                <span className={styles.moreNum}>+{shops.length + events.length - PEEK_LIMIT}</span>
                전체 목록 보기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
