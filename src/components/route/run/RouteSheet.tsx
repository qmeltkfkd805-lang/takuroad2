'use client'
/* 모바일 루트 지도 하단 드래그 시트 — collapsed / half / expanded 3단.
   idle: 요약+시작 / 선택스팟 상세 / 전체 코스목록.  running: 진행 정보+제어.
   높이는 부모(RouteMapMobile)에 보고해 지도 bottom padding에 반영한다. */
import { useState, useRef, useEffect, useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject, ReactNode } from 'react'
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
  addr?: string | null
  /** 영업 상태 배지 (영업 중·영업 종료 …) */
  status?: { text: string; tone: string } | null
  cats: string[]
  thumb: string | null
  walkMin: number | null    // 이전 스팟에서 이동
  walkM: number | null
  toNextMin: number | null  // 다음 스팟까지 이동
  toNextM: number | null
  moveTip: string | null
  visited: boolean
}

export type SheetSnap = 'mini' | 'collapsed' | 'half' | 'expanded'   // mini = 손잡이·진행률만 남기고 접은 상태

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
  /** (사용 안 함) 외부 지도 앱 길안내 — 사이트를 벗어나지 않도록 버튼을 없앴다 */
  onNavigate?: () => void
  onSkip: () => void
  onPauseResume: () => void
  onEnd: () => void
  /** 스팟 방문 체크 토글 — 목록·선택 카드·"다음" 줄의 체크 버튼 */
  onToggleVisit?: (id: string) => void | Promise<boolean | void>
  busyVisitId?: string | null
  /** 로그인했을 때만 진행률(방문 체크 n/N)을 요약에 보여준다 */
  showProgress?: boolean
  /** 진행 중 "다음" 안내 대상 샵 id — 한 번에 도착 체크 */
  nextId?: string | null
  /** 완주 초기화 — 코스 목록을 펼쳤을 때 맨 아래에 보인다 (체크가 하나라도 있을 때) */
  onReset?: () => void
  /** 따라가는 중 코스 목록에서 장소를 누르면 그곳을 다음 장소로 */
  onChooseNext?: (id: string) => void
}) {
  const {
    onHeightChange, title, metaLine, stops, selectedId, onSelect, onOpenDetail,
    running, phase, onStart, startLabel, starting, visitedCount, totalStops,
    nextLabel, nextDistanceM, onSkip, onPauseResume, onEnd,
    onToggleVisit, busyVisitId = null, showProgress = false, nextId = null, onReset, onChooseNext,
  } = props
  const pct = totalStops ? Math.round((visitedCount / totalStops) * 100) : 0

  // 다음 장소로 가는 길 메모 — 루트 작성자가 앞 장소에 적어 둔 이동 설명(move_tip)
  const nextIdx = nextId ? stops.findIndex(s => s.id === nextId) : -1
  const nextTip = nextIdx > 0 ? stops[nextIdx - 1]?.moveTip ?? null : null
  const hasArrive = !!nextId && !!onToggleVisit && !!nextLabel
  const hasTip = !!nextTip   // 진행 중 "여기 방문했어요" 버튼이 있으면 접힌 높이도 키운다
  const [snap, setSnap] = useState<SheetSnap>('collapsed')
  // "여기 방문했어요" — 평소엔 회색, 눌러서 기록되면 잠깐 초록(방문 완료)으로 보여준 뒤 다음 장소로
  // 방문 완료를 보여주는 동안엔 "다음" 줄도 방금 방문한 곳을 그대로 두었다가, 끝나면 2번→3번으로 넘어간다
  const [arrived, setArrived] = useState(false)
  const [heldLabel, setHeldLabel] = useState<string | null>(null)
  const [heldId, setHeldId] = useState<string | null>(null)
  useEffect(() => { if (!arrived) return; const t = setTimeout(() => { setArrived(false); setHeldLabel(null); setHeldId(null) }, 1400); return () => clearTimeout(t) }, [arrived])
  async function onArrive() {
    if (!nextId || !onToggleVisit || arrived) return
    // 누르는 즉시 지금 장소를 붙잡아 둔다 — 기록 중에 목록이 먼저 다음 장소로 바뀌어도 화면은 순서대로(현재 → 방문 완료 → 다음)
    setHeldLabel(nextLabel)
    setHeldId(nextId)
    setArrived(true)
    const ok = await onToggleVisit(nextId)
    if (!ok) { setArrived(false); setHeldLabel(null); setHeldId(null) }
  }
  const shownNext = arrived && heldLabel ? heldLabel : nextLabel
  // 카드로 보여줄 "다음" 장소 — 방문 완료를 보여주는 동안엔 방금 방문한 곳
  const shownId = arrived && heldId ? heldId : nextId
  const shownStop = shownId ? stops.find(s => s.id === shownId) ?? null : null
  // 진행 중 접힌 높이 = 위쪽 내용(진행률·다음 카드·버튼) 실제 높이에 맞춘다
  const runTopRef = useRef<HTMLDivElement>(null)
  const [runTopH, setRunTopH] = useState(0)
  useEffect(() => {
    const el = runTopRef.current
    if (!running || !el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setRunTopH(Math.ceil(el.getBoundingClientRect().height)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [running])
  const [heights, setHeights] = useState({ mini: MINI_H, collapsed: 190, half: 380, expanded: 560 })
  const [dragH, setDragH] = useState<number | null>(null)   // 드래그 중 실시간 높이
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // 뷰포트에 맞춰 3단 높이 계산 (앱바 54 + 하단탭 58 제외 영역 기준)
  useEffect(() => {
    const calc = () => {
      const vh = window.innerHeight
      const avail = vh - 54 - 58
      setHeights({
        mini: MINI_H,
        // 진행 중: 위쪽 내용 높이(손잡이 18 + 내용 + 코스 목록 줄 여유) — 화면의 86%를 넘지 않게
        collapsed: running
          ? Math.min(Math.round(avail * 0.86), runTopH ? runTopH + 18 + 44 : (hasArrive ? 262 : 200) + (hasTip ? 58 : 0))
          : (showProgress ? 262 : 196),   // 진행률 줄만큼 더 높게
        // 선택한 스팟 카드(사진·이름 / 상태·층 / 주소 / 태그 / 버튼 + 시작 버튼)가 잘리지 않게 최소 430px
        half: Math.min(Math.round(avail * 0.86), Math.max(Math.round(avail * 0.5), 430)),
        expanded: Math.round(avail * 0.86),
      })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [running, showProgress, hasArrive, hasTip, runTopH])

  const curH = dragH ?? heights[snap]
  useEffect(() => { onHeightChange(curH) }, [curH, onHeightChange])

  // 선택되면 최소 half까지 올려서 상세가 보이게
  useEffect(() => {
    if (selectedId && (snap === 'collapsed' || snap === 'mini')) setSnap('half')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const snapTo = useCallback((target: SheetSnap) => setSnap(target), [])
  const cycle = useCallback(() => {
    // 손잡이 탭: 기본 ↔ 접기(mini). 크게 펼친 상태에서 누르면 기본 높이로
    setSnap(s => (s === 'collapsed' ? 'mini' : 'collapsed'))
  }, [])

  // 드래그(핸들)
  const onPointerDown = (e: ReactPointerEvent) => {
    dragRef.current = { startY: e.clientY, startH: heights[snap] }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return
    const dy = dragRef.current.startY - e.clientY   // 위로 끌면 +
    const h = Math.min(heights.expanded + 40, Math.max(heights.mini - 10, dragRef.current.startH + dy))
    setDragH(h)
  }
  const onPointerUp = () => {
    if (!dragRef.current) return
    const h = dragH ?? heights[snap]
    // 가장 가까운 스냅으로
    const cands: SheetSnap[] = ['mini', 'collapsed', 'half', 'expanded']
    let best: SheetSnap = 'collapsed', bd = Infinity
    for (const c of cands) { const d = Math.abs(heights[c] - h); if (d < bd) { bd = d; best = c } }
    dragRef.current = null
    setDragH(null)
    setSnap(best)
  }

  const selected = selectedId ? stops.find(s => s.id === selectedId) ?? null : null
  // 따라가는 중엔 목록에서 누른 곳을 "다음 장소"로 바꾸고 시트를 기본 높이로 내려 카드를 보여준다
  const listSelect = running && onChooseNext
    ? (id: string | null) => { if (id) { onChooseNext(id); setSnap('collapsed'); contentRef.current?.scrollTo({ top: 0 }) } }
    : onSelect
  const listProps = { stops, selectedId: running ? nextId : selectedId, onSelect: listSelect, onOpenDetail, listRef, onToggleVisit, busyVisitId }

  return (
    <div className={styles.sheet} style={{ height: curH, transition: dragH == null ? 'height .28s cubic-bezier(.32,.72,0,1)' : 'none' }}>
      <div className={styles.handleZone} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onClick={cycle} role="button" aria-label="시트 열기/닫기" tabIndex={0}>
        <div className={styles.handle} />
      </div>

      {running ? (
        <div className={styles.content} ref={contentRef}>
          <div ref={runTopRef}>
          <div className={styles.runHead}>
            <div>
              <span className={styles.badge}>{phase === 'paused' ? '일시중지' : '진행 중'}</span>
              <span className={styles.runCount}>방문 {visitedCount}/{totalStops}곳</span>
            </div>
            <FoldBtn folded={snap === 'mini'} onClick={() => snapTo(snap === 'mini' ? 'collapsed' : 'mini')} />
          </div>
          <div className={styles.bar}><div className={styles.barFill} style={{ width: `${pct}%` }} /></div>
          {shownStop ? (
            <SpotCard stop={shownStop} label={arrived ? '방금 방문' : '다음 장소'}
              distance={arrived ? <span style={{ color: '#16a34a' }}>도착</span>
                : <>지금 위치에서 {nextDistanceM != null ? walkText(Math.round(nextDistanceM / 75), nextDistanceM) : '위치 확인 중…'}</>}
              tip={!arrived ? nextTip : null}
              left={null /* 외부 지도 앱 길안내는 두지 않는다 — 타쿠로드 지도 안에서 안내 */}
              right={onToggleVisit ? (
                <button type="button" className={arrived ? styles.spotVisitDone : styles.spotVisit} onClick={onArrive}
                  disabled={arrived || busyVisitId === nextId} aria-label={`${shownStop.name} 방문 체크`}>
                  {arrived ? <CheckIcon size={16} /> : <PinSvg />}{arrived ? '방문 완료!' : '방문 체크'}
                </button>
              ) : null} />
          ) : shownNext ? (
            <div className={styles.nextRow}><div className={styles.nextInfo}><span className={styles.nextLabel}>다음</span><span className={styles.nextName}>{shownNext}</span></div></div>
          ) : (
            <div className={styles.runNote}>방문한 곳은 아래 목록에서 체크하거나 ‘오늘 루트 종료’에서 확인해 주세요.</div>
          )}
          <div className={styles.runBtns}>
            <button className={styles.ghost} onClick={onSkip} disabled={!nextLabel}>건너뛰기</button>
            <button className={styles.ghost} onClick={onPauseResume}>{phase === 'paused' ? '다시 시작' : '일시중지'}</button>
          </div>
          <button className={styles.endBtn} onClick={onEnd}>오늘 루트 종료</button>
          </div>
          <button className={styles.listToggle} onClick={() => snapTo(snap === 'expanded' ? 'collapsed' : 'expanded')}>
            코스 목록 {snap === 'expanded' ? '▾' : '▸'}
          </button>
          {snap === 'expanded' && <CourseList {...listProps} />}
        </div>
      ) : selected ? (
        <div className={styles.content}>
          {/* 선택한 스팟 — 루트 상세 코스 안내 카드와 같은 구조 */}
          <SpotCard stop={selected}
            distance={selected.toNextM != null ? <>다음 장소까지 {walkText(selected.toNextMin, selected.toNextM)}</> : null}
            left={<button type="button" className={styles.spotDetail} onClick={() => onOpenDetail(selected.slug)}>상세 보기</button>}
            right={onToggleVisit ? (
              <button type="button" className={selected.visited ? styles.spotVisitOn : styles.spotVisit}
                onClick={() => onToggleVisit(selected.id)} disabled={busyVisitId === selected.id}
                aria-pressed={selected.visited} aria-label={`${selected.name} ${selected.visited ? '방문 체크 풀기' : '방문 체크'}`}>
                {selected.visited ? <CheckIcon size={16} /> : <PinSvg />}{selected.visited ? '방문함' : '방문 체크'}
              </button>
            ) : null} />
          <button className={styles.cta} onClick={onStart} disabled={starting}>{starting ? '준비 중…' : startLabel}</button>
          {snap === 'expanded' && <CourseList {...listProps} />}
        </div>
      ) : (
        <div className={styles.content}>
          <div className={styles.summary}>
            <div className={styles.sumTitleRow}>
              <div className={styles.sumTitle}>{title}</div>
              <FoldBtn folded={snap === 'mini'} onClick={() => snapTo(snap === 'mini' ? 'collapsed' : 'mini')} />
            </div>
            <div className={styles.sumMeta}>{metaLine}</div>
          </div>
          {/* 내 방문 체크 진행률 — 목록을 열어 스팟마다 체크 */}
          {showProgress && (
            <button type="button" className={styles.progress} onClick={() => snapTo('expanded')} aria-label="코스 목록 열어 방문 체크하기">
              <span className={styles.progressTop}>
                <span>방문 체크 <b>{visitedCount}</b>/{totalStops}</span>
                <span className={styles.progressHint}>{visitedCount === 0 ? '다녀온 곳을 체크해요 ›' : `${pct}%`}</span>
              </span>
              <span className={styles.bar} style={{ marginBottom: 0 }}><span className={styles.barFill} style={{ width: `${pct}%`, display: 'block' }} /></span>
            </button>
          )}
          <button className={styles.cta} onClick={onStart} disabled={starting}>{starting ? '준비 중…' : startLabel}</button>
          <button className={styles.listToggle} onClick={() => snapTo(snap === 'expanded' ? 'collapsed' : 'expanded')}>
            코스 목록 {snap === 'expanded' ? '▾' : '▸'}
          </button>
          {snap === 'expanded' && <CourseList {...listProps} />}
          {snap === 'expanded' && onReset && visitedCount > 0 && (
            <button type="button" className={styles.resetBtn} onClick={onReset}>완주 초기화</button>
          )}
        </div>
      )}
    </div>
  )
}

const MINI_H = 74   // 접었을 때: 손잡이 + 진행 중·방문 n/N + 진행 막대 (또는 루트 제목)

/* 시트 접기/펼치기 버튼 — 손잡이를 탭하거나 끌어도 같은 동작 */
function FoldBtn({ folded, onClick }: { folded: boolean; onClick: () => void }) {
  return (
    <button type="button" className={styles.foldBtn} onClick={onClick} aria-expanded={!folded} aria-label={folded ? '시트 펼치기' : '시트 접기'}>
      {folded ? '펼치기' : '접기'}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: folded ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6" /></svg>
    </button>
  )
}

function PinSvg({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
}

/* 스팟 카드 — 루트 상세 "코스 안내" 카드와 같은 구조 (지도 시트의 선택 스팟 · 따라가기 "다음 장소" 공용)
   사진 + 번호·이름 / 영업 상태·층 / 주소(전체 폭) / 태그 / 거리 줄 / 가는 길 메모 / [왼쪽 | 오른쪽] 버튼 */
function SpotCard({ stop, label, distance, tip, left, right }: {
  stop: SheetStop; label?: string; distance?: ReactNode; tip?: string | null; left?: ReactNode; right: ReactNode
}) {
  return (
    <div className={styles.spotCard}>
      {label && <span className={styles.spotLabel}>{label}</span>}
      <div className={styles.spotTop}>
        <div className={styles.spotThumb}>{stop.thumb ? <img src={stop.thumb} alt="" /> : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10h18M9 20v-6h6v6" /></svg>
        )}</div>
        <div className={styles.spotHead}>
          <div className={styles.spotName}>
            <span className={`${styles.spotNum} ${stop.visited ? styles.spotNumDone : ''}`}>{stop.visited ? <CheckIcon size={12} /> : stop.order}</span>
            <span className={styles.spotNameText}>{stop.name}</span>
          </div>
          {(stop.status || stop.floor) && (
            <div className={styles.spotMeta}>
              {stop.status && <span className={styles.spotStatus} data-tone={stop.status.tone}>{stop.status.text}</span>}
              {stop.floor && <span className={styles.spotFloor}>{stop.floor}</span>}
            </div>
          )}
        </div>
      </div>
      {stop.addr && (
        <div className={styles.spotAddr}><PinSvg size={13} /><span>{stop.addr}</span></div>
      )}
      {stop.cats.length > 0 && <div className={styles.spotTags}>{stop.cats.slice(0, 3).map(c => <Tag key={c} c={c} />)}</div>}
      {distance && <div className={styles.spotNext}>{distance}</div>}
      {tip && <div className={styles.spotTip}><b>가는 길</b>{tip}</div>}
      <div className={styles.spotBtns}>{left}{right}</div>
    </div>
  )
}

function CheckIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
}

/* 방문 체크 버튼 — 엄지로 누르기 쉬운 44px 원. 체크되면 초록 */
function VisitCheck({ on, busy, name, onClick, big = false }: { on: boolean; busy: boolean; name: string; onClick: () => void; big?: boolean }) {
  return (
    <button type="button" className={`${styles.check} ${on ? styles.checkOn : ''} ${big ? styles.checkBig : ''}`}
      onClick={e => { e.stopPropagation(); onClick() }} disabled={busy}
      aria-pressed={on} aria-label={`${name} ${on ? '방문 체크 풀기' : '방문 체크'}`}>
      <CheckIcon size={big ? 22 : 20} />
      <span className={styles.checkText}>{on ? '방문 완료' : '방문 체크'}</span>
    </button>
  )
}

function CourseList({ stops, selectedId, onSelect, onOpenDetail, listRef, onToggleVisit, busyVisitId }: {
  stops: SheetStop[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpenDetail: (slug: string) => void
  listRef: RefObject<HTMLOListElement | null>
  onToggleVisit?: (id: string) => void
  busyVisitId?: string | null
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
            <div className={`${styles.row} ${sel ? styles.rowSel : ''} ${s.visited ? styles.rowDone : ''}`} role="button" tabIndex={0}
              onClick={() => onSelect(sel ? null : s.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(sel ? null : s.id) } }}>
              <span className={`${styles.rowNum} ${s.visited ? styles.rowNumDone : ''}`}>{s.visited ? '✓' : s.order}</span>
              <div className={styles.rowThumb}>{s.thumb ? <img src={s.thumb} alt="" loading="lazy" /> : <span className={styles.noThumb} />}</div>
              <div className={styles.rowBody}>
                <div className={styles.rowName}>{s.name}</div>
                <div className={styles.rowMeta}>
                  {s.floor && <span>{s.floor}</span>}
                  {s.cats.slice(0, 2).map(c => <Tag key={c} c={c} />)}
                  <button className={styles.rowDetail} onClick={e => { e.stopPropagation(); onOpenDetail(s.slug) }}>상세 ›</button>
                </div>
              </div>
              {onToggleVisit && <VisitCheck on={s.visited} busy={busyVisitId === s.id} name={s.name} onClick={() => onToggleVisit(s.id)} />}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
