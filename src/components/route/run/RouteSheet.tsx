'use client'
/* 모바일 루트 지도 하단 드래그 시트 — collapsed / half / expanded 3단.
   idle: 요약+시작 / 선택스팟 상세 / 전체 코스목록.  running: 진행 정보+제어.
   높이는 부모(RouteMapMobile)에 보고해 지도 bottom padding에 반영한다. */
import { useState, useRef, useEffect, useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { RunPhase } from '@/lib/routeRun/useRouteRun'
import { formatDistance } from '@/hooks/useCurrentLocation'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import styles from './RouteSheet.module.css'

export interface SheetStop {
  id: string
  slug: string
  order: number
  name: string
  floor: string | null
  cats: string[]
  thumb: string | null
  walkMin: number | null    // 이전 스팟에서 이동
  walkM: number | null
  toNextMin: number | null  // 다음 스팟까지 이동
  toNextM: number | null
  moveTip: string | null
  visited: boolean
}

export type SheetSnap = 'collapsed' | 'half' | 'expanded'

function walkText(min: number | null, m: number | null): string | null {
  const parts: string[] = []
  if (m != null) parts.push(formatDistance(m))
  if (min != null) parts.push(`도보 ${min}분`)
  return parts.length ? parts.join(' · ') : null
}

function Tag({ c }: { c: string }) {
  const cc = (CATEGORY_NAME_MAP as any)[c]
  return <span className={styles.tag} style={cc ? { color: cc.color, background: cc.bgColor } : undefined}>{c}</span>
}

export default function RouteSheet(props: {
  onHeightChange: (px: number) => void
  title: string
  metaLine: string
  stops: SheetStop[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpenDetail: (slug: string) => void
  running: boolean
  phase: RunPhase
  onStart: () => void
  startLabel: string
  starting: boolean
  visitedCount: number
  totalStops: number
  fieldVerified: number
  checkpointTotal: number
  nextLabel: string | null
  nextDistanceM: number | null
  onNavigate: () => void
  onSkip: () => void
  onPauseResume: () => void
  onEnd: () => void
}) {
  const {
    onHeightChange, title, metaLine, stops, selectedId, onSelect, onOpenDetail,
    running, phase, onStart, startLabel, starting, visitedCount, totalStops,
    fieldVerified, checkpointTotal, nextLabel, nextDistanceM, onNavigate, onSkip, onPauseResume, onEnd,
  } = props

  const [snap, setSnap] = useState<SheetSnap>('collapsed')
  const [heights, setHeights] = useState({ collapsed: 190, half: 380, expanded: 560 })
  const [dragH, setDragH] = useState<number | null>(null)   // 드래그 중 실시간 높이
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const listRef = useRef<HTMLOListElement>(null)

  // 뷰포트에 맞춰 3단 높이 계산 (앱바 54 + 하단탭 58 제외 영역 기준)
  useEffect(() => {
    const calc = () => {
      const vh = window.innerHeight
      const avail = vh - 54 - 58
      setHeights({
        collapsed: running ? 214 : 196,
        half: Math.round(avail * 0.5),
        expanded: Math.round(avail * 0.86),
      })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [running])

  const curH = dragH ?? heights[snap]
  useEffect(() => { onHeightChange(curH) }, [curH, onHeightChange])

  // 선택되면 최소 half까지 올려서 상세가 보이게
  useEffect(() => {
    if (selectedId && snap === 'collapsed') setSnap('half')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const snapTo = useCallback((target: SheetSnap) => setSnap(target), [])
  const cycle = useCallback(() => {
    setSnap(s => (s === 'collapsed' ? 'half' : s === 'half' ? 'expanded' : 'collapsed'))
  }, [])

  // 드래그(핸들)
  const onPointerDown = (e: ReactPointerEvent) => {
    dragRef.current = { startY: e.clientY, startH: heights[snap] }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return
    const dy = dragRef.current.startY - e.clientY   // 위로 끌면 +
    const h = Math.min(heights.expanded + 40, Math.max(heights.collapsed - 40, dragRef.current.startH + dy))
    setDragH(h)
  }
  const onPointerUp = () => {
    if (!dragRef.current) return
    const h = dragH ?? heights[snap]
    // 가장 가까운 스냅으로
    const cands: SheetSnap[] = ['collapsed', 'half', 'expanded']
    let best: SheetSnap = 'collapsed', bd = Infinity
    for (const c of cands) { const d = Math.abs(heights[c] - h); if (d < bd) { bd = d; best = c } }
    dragRef.current = null
    setDragH(null)
    setSnap(best)
  }

  const selected = selectedId ? stops.find(s => s.id === selectedId) ?? null : null

  return (
    <div className={styles.sheet} style={{ height: curH, transition: dragH == null ? 'height .28s cubic-bezier(.32,.72,0,1)' : 'none' }}>
      <div className={styles.handleZone} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onClick={cycle} role="button" aria-label="시트 열기/닫기" tabIndex={0}>
        <div className={styles.handle} />
      </div>

      {running ? (
        <div className={styles.content}>
          <div className={styles.runHead}>
            <div>
              <span className={styles.badge}>{phase === 'paused' ? '일시중지' : '진행 중'}</span>
              <span className={styles.runCount}>현장 확인 {fieldVerified}/{checkpointTotal}</span>
            </div>
            <span className={styles.runVisited}>방문 기록 {visitedCount}/{totalStops}곳</span>
          </div>
          <div className={styles.bar}><div className={styles.barFill} style={{ width: `${checkpointTotal ? Math.round((fieldVerified / checkpointTotal) * 100) : 0}%` }} /></div>
          <div className={styles.nextRow}>
            <div className={styles.nextInfo}>
              <span className={styles.nextLabel}>다음</span>
              <span className={styles.nextName}>{nextLabel ?? '안내할 다음 지점이 없어요'}</span>
            </div>
            {nextLabel && <span className={styles.nextDist}>{nextDistanceM != null ? walkText(Math.round(nextDistanceM / 75), nextDistanceM) : '위치 확인 중…'}</span>}
          </div>
          {!nextLabel && <div className={styles.runNote}>방문한 곳은 ‘오늘 루트 종료’에서 확인해 주세요.</div>}
          <div className={styles.runBtns}>
            <button className={styles.ghost} onClick={onNavigate} disabled={!nextLabel}>길안내</button>
            <button className={styles.ghost} onClick={onSkip} disabled={!nextLabel}>건너뛰기</button>
            <button className={styles.ghost} onClick={onPauseResume}>{phase === 'paused' ? '다시 시작' : '일시중지'}</button>
          </div>
          <button className={styles.endBtn} onClick={onEnd}>오늘 루트 종료</button>
          <button className={styles.listToggle} onClick={() => snapTo(snap === 'expanded' ? 'collapsed' : 'expanded')}>
            코스 목록 {snap === 'expanded' ? '▾' : '▸'}
          </button>
          {snap === 'expanded' && <CourseList stops={stops} selectedId={selectedId} onSelect={onSelect} onOpenDetail={onOpenDetail} listRef={listRef} showVisited />}
        </div>
      ) : selected ? (
        <div className={styles.content}>
          <div className={styles.spotCard}>
            <div className={styles.spotThumb}>{selected.thumb ? <img src={selected.thumb} alt="" /> : <span className={styles.noThumb} />}</div>
            <div className={styles.spotBody}>
              <div className={styles.spotName}><span className={styles.spotNum}>{selected.order}</span>{selected.name}</div>
              <div className={styles.spotMeta}>
                {selected.floor && <span>{selected.floor}</span>}
                {selected.cats.slice(0, 2).map(c => <Tag key={c} c={c} />)}
              </div>
              {selected.toNextM != null && <div className={styles.spotNext}>다음 장소까지 {walkText(selected.toNextMin, selected.toNextM)}</div>}
            </div>
          </div>
          <button className={styles.detailLink} onClick={() => onOpenDetail(selected.slug)}>상세 보기 →</button>
          <button className={styles.cta} onClick={onStart} disabled={starting}>{starting ? '준비 중…' : startLabel}</button>
          {snap === 'expanded' && <CourseList stops={stops} selectedId={selectedId} onSelect={onSelect} onOpenDetail={onOpenDetail} listRef={listRef} />}
        </div>
      ) : (
        <div className={styles.content}>
          <div className={styles.summary}>
            <div className={styles.sumTitle}>{title}</div>
            <div className={styles.sumMeta}>{metaLine}</div>
          </div>
          <button className={styles.cta} onClick={onStart} disabled={starting}>{starting ? '준비 중…' : startLabel}</button>
          <button className={styles.listToggle} onClick={() => snapTo(snap === 'expanded' ? 'collapsed' : 'expanded')}>
            코스 목록 {snap === 'expanded' ? '▾' : '▸'}
          </button>
          {snap === 'expanded' && <CourseList stops={stops} selectedId={selectedId} onSelect={onSelect} onOpenDetail={onOpenDetail} listRef={listRef} />}
        </div>
      )}
    </div>
  )
}

function CourseList({ stops, selectedId, onSelect, onOpenDetail, listRef, showVisited = false }: {
  stops: SheetStop[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpenDetail: (slug: string) => void
  listRef: RefObject<HTMLOListElement | null>
  showVisited?: boolean
}) {
  return (
    <ol className={styles.list} ref={listRef}>
      {stops.map((s, i) => {
        const sel = s.id === selectedId
        return (
          <li key={s.id}>
            {i > 0 && (s.walkMin != null || s.walkM != null) && (
              <div className={styles.travel}>{walkText(s.walkMin, s.walkM)}</div>
            )}
            {i > 0 && stops[i - 1]?.moveTip && <div className={styles.tip}>{stops[i - 1].moveTip}</div>}
            <div className={`${styles.row} ${sel ? styles.rowSel : ''}`} role="button" tabIndex={0}
              onClick={() => onSelect(sel ? null : s.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(sel ? null : s.id) } }}>
              <span className={`${styles.rowNum} ${showVisited && s.visited ? styles.rowNumDone : ''}`}>{showVisited && s.visited ? '✓' : s.order}</span>
              <div className={styles.rowThumb}>{s.thumb ? <img src={s.thumb} alt="" loading="lazy" /> : <span className={styles.noThumb} />}</div>
              <div className={styles.rowBody}>
                <div className={styles.rowName}>{s.name}</div>
                <div className={styles.rowMeta}>{s.floor && <span>{s.floor}</span>}{s.cats.slice(0, 2).map(c => <Tag key={c} c={c} />)}</div>
              </div>
              <button className={styles.rowDetail} onClick={e => { e.stopPropagation(); onOpenDetail(s.slug) }}>상세 ›</button>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
