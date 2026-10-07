'use client'

/* 마이페이지 › 저장함 — '저장한 샵'·'저장한 루트'를 합치고, 글·이벤트 저장도 같이 모았다.
   - 위: 마이페이지로 → 저장함 → 설명 → [샵 | 루트 | 글 | 이벤트] (기본 샵)
   - 머리말·탭·목록 모양은 '내 활동'(MyActivityView)과 같다
   - 데이터:
       샵     SavedShopsTab   (saved_shops — 예전 '저장한 샵' 그대로)
       루트   SavedRoutesTab  (route_saves — 예전 '저장한 루트' 그대로)
       글     getSavedPosts   (saved_posts — migrations/saved_posts.sql, 글 상세의 '저장' 버튼)
       이벤트 getSavedEventItems (saved_events — 이벤트 화면의 저장 버튼)
   - 탭은 처음 열 때 불러오고, 그 뒤로는 그려 둔 채 숨긴다(다시 불러오지 않음).
     루트 카드의 지도 썸네일이 숨은 칸에서 먼저 그려지면 크기가 0으로 잡혀서, 미리 다 그리지 않는다.
   - 개수는 그 탭을 불러와서 실제 전체 개수를 알 때만 보여준다
   - 스크롤 위치는 탭마다 기억했다가 돌려준다 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSavedPosts, setPostSaved, type SavedPostEntry } from '@/services/communityPostService'
import { getSavedEventItems, type EventHomeItem } from '@/services/eventHomeService'
import { unsaveEvent } from '@/services/eventSaveService'
import { BOARD_LABEL } from '@/types/community-post'
import ThumbImg from '@/components/common/ThumbImg'
import SavedShopsTab from './SavedShopsTab'
import SavedRoutesTab from './SavedRoutesTab'
import { fmtDate, plainText, firstImg, scrollersOf } from './MyActivityView'
import styles from './MyActivity.module.css'

export type SavedTab = 'shops' | 'routes' | 'posts' | 'events'
const TABS: { key: SavedTab; label: string }[] = [
  { key: 'shops', label: '샵' },
  { key: 'routes', label: '루트' },
  { key: 'posts', label: '글' },
  { key: 'events', label: '이벤트' },
]

type Load<T> = { state: 'loading' } | { state: 'error' } | { state: 'done'; items: T[] }

const BookmarkOn = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1z" /></svg>

export default function SavedView({ userId, initialTab = 'shops', onBack }: {
  userId: string
  initialTab?: SavedTab
  onBack: () => void
}) {
  const [tab, setTab] = useState<SavedTab>(initialTab)
  const [opened, setOpened] = useState<Set<SavedTab>>(() => new Set([initialTab]))
  useEffect(() => {
    setTab(initialTab)
    setOpened(prev => (prev.has(initialTab) ? prev : new Set(prev).add(initialTab)))
  }, [initialTab])

  const [counts, setCounts] = useState<Record<SavedTab, number | null>>({ shops: null, routes: null, posts: null, events: null })
  const setCount = useCallback((k: SavedTab, n: number) => setCounts(c => (c[k] === n ? c : { ...c, [k]: n })), [])

  // 탭마다 스크롤 위치 기억 → 돌아오면 그 자리로 (내 활동과 같은 방식)
  const wrapRef = useRef<HTMLDivElement>(null)
  const scrollPos = useRef<Record<SavedTab, number[]>>({ shops: [], routes: [], posts: [], events: [] })
  const restoreFor = useRef<SavedTab | null>(null)
  const switchTab = (next: SavedTab) => {
    if (next === tab) return
    scrollPos.current[tab] = scrollersOf(wrapRef.current).map(s => s.scrollTop)
    restoreFor.current = next
    setOpened(prev => (prev.has(next) ? prev : new Set(prev).add(next)))
    setTab(next)
  }
  useLayoutEffect(() => {
    if (restoreFor.current !== tab) return
    restoreFor.current = null
    const saved = scrollPos.current[tab]
    scrollersOf(wrapRef.current).forEach((s, i) => { s.scrollTop = saved[i] ?? 0 })
  }, [tab])

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.inner}>
        <button type="button" className={styles.back} onClick={onBack}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
          마이페이지
        </button>
        <h1 className={styles.title}>저장함</h1>
        <p className={styles.desc}>저장해 둔 샵·루트·글·이벤트를 모아봤어요.</p>

        <div className={styles.tabs} role="tablist" aria-label="저장함">
          {TABS.map(t => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
              className={tab === t.key ? `${styles.tab} ${styles.tabOn}` : styles.tab} onClick={() => switchTab(t.key)}>
              {t.label}{counts[t.key] != null && <span className={styles.tabCount}>{counts[t.key]}</span>}
            </button>
          ))}
        </div>

        {opened.has('shops') && (
          <div role="tabpanel" hidden={tab !== 'shops'} className={styles.panelGap}>
            <SavedShopsTab userId={userId} onCount={n => setCount('shops', n)} />
          </div>
        )}
        {opened.has('routes') && (
          <div role="tabpanel" hidden={tab !== 'routes'} className={styles.panelGap}>
            <SavedRoutesTab userId={userId} onCount={n => setCount('routes', n)} />
          </div>
        )}
        {opened.has('posts') && (
          <div role="tabpanel" hidden={tab !== 'posts'}>
            <SavedPosts userId={userId} onCount={n => setCount('posts', n)} />
          </div>
        )}
        {opened.has('events') && (
          <div role="tabpanel" hidden={tab !== 'events'}>
            <SavedEvents userId={userId} onCount={n => setCount('events', n)} />
          </div>
        )}
      </div>
    </div>
  )
}

function StateBox({ load, emptyText, onRetry, kind }: { load: Load<unknown>; emptyText: string; onRetry: () => void; kind: string }) {
  if (load.state === 'loading') return <div aria-busy="true" aria-label={`${kind} 불러오는 중`}>{[0, 1, 2, 3].map(i => <div key={i} className={styles.skel} />)}</div>
  if (load.state === 'error') return (
    <div className={styles.state}>
      {kind}을 불러오지 못했어요.
      <div><button type="button" className={styles.stateBtn} onClick={onRetry}>다시 시도</button></div>
    </div>
  )
  return <div className={styles.state}>{emptyText}</div>
}

/** 목록 오른쪽 '저장 해제' 버튼 */
function UnsaveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.unsave} onClick={onClick} aria-label="저장 해제" title="저장 해제">
      <BookmarkOn />
    </button>
  )
}

// ───────── 글 ─────────
function SavedPosts({ userId, onCount }: { userId: string; onCount: (n: number) => void }) {
  const router = useRouter()
  const [load, setLoad] = useState<Load<SavedPostEntry>>({ state: 'loading' })
  const [key, setKey] = useState(0)

  useEffect(() => {
    let alive = true
    setLoad({ state: 'loading' })
    getSavedPosts(userId)
      .then(items => { if (alive) setLoad({ state: 'done', items }) })
      .catch(e => { console.error('[저장함] 글 조회 실패:', e?.message ?? e); if (alive) setLoad({ state: 'error' }) })
    return () => { alive = false }
  }, [userId, key])

  const n = load.state === 'done' ? load.items.length : null
  useEffect(() => { if (n != null) onCount(n) }, [n, onCount])

  async function unsave(entry: SavedPostEntry) {
    if (!confirm('저장을 해제할까요?')) return
    setLoad(l => (l.state === 'done' ? { state: 'done', items: l.items.filter(i => i.postId !== entry.postId) } : l))
    const ok = await setPostSaved(entry.postId, userId, false)
    if (!ok) { alert('저장 해제에 실패했어요. 잠시 후 다시 시도해 주세요.'); setKey(k => k + 1) }
  }

  if (load.state !== 'done' || load.items.length === 0) {
    return <StateBox load={load} emptyText="저장한 글이 없어요 — 글 아래 '저장'을 눌러 담아 보세요" onRetry={() => setKey(k => k + 1)} kind="저장한 글" />
  }
  return (
    <ul className={styles.list}>
      {load.items.map(entry => {
        const p = entry.post
        if (!p) {
          // 지워졌거나(작성자 삭제) 지금은 볼 수 없는 글 — 이동하지 않고 해제만 할 수 있게
          return (
            <li key={entry.postId} className={`${styles.item} ${styles.itemFlex}`}>
              <div className={`${styles.row} ${styles.rowStatic}`}>
                <div className={styles.main}>
                  <div className={styles.meta}>
                    <span className={styles.kindMuted}>커뮤니티</span>
                    <span className={styles.date}>{fmtDate(entry.savedAt)} 저장</span>
                  </div>
                  <p className={`${styles.postTitle} ${styles.originGone}`} style={{ color: 'var(--muted)', fontWeight: 600 }}>삭제되었거나 볼 수 없는 글</p>
                </div>
              </div>
              <UnsaveBtn onClick={() => unsave(entry)} />
            </li>
          )
        }
        const text = plainText(p.content)
        const title = p.title || (text ? text.slice(0, 60) : '(제목 없음)')
        const preview = p.title && text ? text : null
        const thumb = p.images?.[0] ?? firstImg(p.content)
        return (
          <li key={entry.postId} className={`${styles.item} ${styles.itemFlex}`}>
            <button type="button" className={styles.row} onClick={() => router.push('/community/' + p.id)}>
              <div className={styles.main}>
                <div className={styles.meta}>
                  <span className={styles.kind}>{BOARD_LABEL[p.board] ?? '커뮤니티'}</span>
                  {p.author?.nickname && <span className={styles.author}>{p.author.nickname}</span>}
                  <span className={styles.date}>{fmtDate(p.createdAt)}</span>
                </div>
                <p className={styles.postTitle}>{title}</p>
                {preview && <p className={styles.preview}>{preview}</p>}
                <div className={styles.stats}>
                  <span>댓글 {p.commentCount ?? 0}</span>
                  <span>좋아요 {p.likeCount ?? 0}</span>
                  <span>조회 {p.viewCount ?? 0}</span>
                </div>
              </div>
              {thumb && <ThumbImg className={styles.thumb} src={thumb} alt="" loading="lazy" />}
            </button>
            <UnsaveBtn onClick={() => unsave(entry)} />
          </li>
        )
      })}
    </ul>
  )
}

// ───────── 이벤트 ─────────
const EVENT_TYPE_LABEL: Record<string, string> = { popup: '팝업스토어', collab_cafe: '콜라보 카페', exhibition: '전시', official_event: '행사', goods_added: '굿즈 입고' }

/** 오늘 날짜 (기기 시간 기준) YYYY-MM-DD */
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
type EvStatus = 'ongoing' | 'upcoming' | 'ended'
function statusOf(ev: EventHomeItem, today: string): EvStatus {
  if (ev.endDate && ev.endDate < today) return 'ended'
  if (ev.startDate && ev.startDate > today) return 'upcoming'
  return 'ongoing'
}
const STATUS_LABEL: Record<EvStatus, string> = { ongoing: '진행 중', upcoming: '예정', ended: '종료' }

/** 2026-10-01 ~ 2026-10-20 → "2026. 10. 01. ~ 10. 20." (해가 다르면 해까지) */
function dateRange(start: string | null, end: string | null): string {
  const f = (s: string, withYear: boolean) => {
    const [y, m, d] = s.slice(0, 10).split('-')
    return withYear ? `${y}. ${m}. ${d}.` : `${m}. ${d}.`
  }
  if (start && end) return start === end ? f(start, true) : `${f(start, true)} ~ ${f(end, start.slice(0, 4) !== end.slice(0, 4))}`
  if (start) return `${f(start, true)} ~`
  if (end) return `~ ${f(end, true)}`
  return ''
}

/** 안 끝난 것 먼저(시작일 빠른 순), 끝난 것은 뒤로(최근에 끝난 순) */
function sortEvents(items: EventHomeItem[], today: string): EventHomeItem[] {
  const live = items.filter(e => statusOf(e, today) !== 'ended')
    .sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'))
  const ended = items.filter(e => statusOf(e, today) === 'ended')
    .sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''))
  return [...live, ...ended]
}

function SavedEvents({ userId, onCount }: { userId: string; onCount: (n: number) => void }) {
  const router = useRouter()
  const [load, setLoad] = useState<Load<EventHomeItem>>({ state: 'loading' })
  const [key, setKey] = useState(0)
  const today = todayStr()

  useEffect(() => {
    let alive = true
    setLoad({ state: 'loading' })
    getSavedEventItems(userId)
      .then(items => { if (alive) setLoad({ state: 'done', items: sortEvents(items, todayStr()) }) })
      .catch(e => { console.error('[저장함] 이벤트 조회 실패:', e?.message ?? e); if (alive) setLoad({ state: 'error' }) })
    return () => { alive = false }
  }, [userId, key])

  const n = load.state === 'done' ? load.items.length : null
  useEffect(() => { if (n != null) onCount(n) }, [n, onCount])

  async function unsave(ev: EventHomeItem) {
    if (!confirm('저장을 해제할까요?')) return
    setLoad(l => (l.state === 'done' ? { state: 'done', items: l.items.filter(i => i.id !== ev.id) } : l))
    const ok = await unsaveEvent(userId, ev.id)
    if (!ok) { alert('저장 해제에 실패했어요. 잠시 후 다시 시도해 주세요.'); setKey(k => k + 1) }
  }

  if (load.state !== 'done' || load.items.length === 0) {
    return <StateBox load={load} emptyText="저장한 이벤트가 없어요 — 이벤트 화면에서 저장해 보세요" onRetry={() => setKey(k => k + 1)} kind="저장한 이벤트" />
  }
  return (
    <ul className={styles.list}>
      {load.items.map(ev => {
        const st = statusOf(ev, today)
        const place = [ev.placeName, ev.region].filter(Boolean).join(' · ')
        const range = dateRange(ev.startDate, ev.endDate)
        return (
          <li key={ev.id} className={`${styles.item} ${styles.itemFlex}`}>
            <button type="button" className={styles.row} onClick={() => router.push(`/event/${ev.id}`)}>
              {ev.coverUrl && <ThumbImg className={styles.poster} src={ev.coverUrl} alt="" loading="lazy" />}
              <div className={styles.main}>
                <div className={styles.meta}>
                  <span className={st === 'ended' ? styles.kindMuted : styles.kind}>{EVENT_TYPE_LABEL[ev.type] ?? '이벤트'}</span>
                  <span className={st === 'ongoing' ? styles.statusOn : styles.statusOff}>{STATUS_LABEL[st]}</span>
                </div>
                <p className={styles.postTitle} style={st === 'ended' ? { color: 'var(--muted)' } : undefined}>{ev.title || '(제목 없음)'}</p>
                {ev.workName && <p className={styles.evLine}>{ev.workName}</p>}
                {place && <p className={styles.evLine}>{place}</p>}
                {range && <div className={styles.stats}><span>{range}</span></div>}
              </div>
            </button>
            <UnsaveBtn onClick={() => unsave(ev)} />
          </li>
        )
      })}
    </ul>
  )
}
