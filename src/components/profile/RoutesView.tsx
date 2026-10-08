'use client'

/* 마이페이지 › 내 루트 — '내 루트'(만든 루트)와 '완주한 루트'를 한 화면으로 합쳤다. (2026-10-08)
   - 위: 마이페이지로 → 내 루트 (+ 루트 만들기) → 설명 → [만든 루트 | 완주한 루트] (기본 만든 루트)
   - 머리말·탭 모양은 '내 활동'·'저장함'과 같다
   - 목록은 예전 두 화면(MyRoutesTab / CompletedRoutesTab) 그대로 — 공개·수정·삭제 메뉴, 완주 횟수 배지까지
   - 탭은 처음 열 때 불러오고 그 뒤로는 그려 둔 채 숨긴다. 루트 카드의 지도 썸네일이 숨은 칸에서 먼저 그려지면
     크기가 0으로 잡혀서 미리 다 그리지 않는다 (저장함과 같은 이유)
   - 개수는 그 탭을 불러와서 실제 개수를 알 때만 보여준다. 스크롤 위치는 탭마다 기억한다 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import MyRoutesTab from './MyRoutesTab'
import CompletedRoutesTab from './CompletedRoutesTab'
import { scrollersOf } from './MyActivityView'
import styles from './MyActivity.module.css'

export type RoutesTab = 'mine' | 'completed'
const TABS: { key: RoutesTab; label: string }[] = [
  { key: 'mine', label: '만든 루트' },
  { key: 'completed', label: '완주한 루트' },
]

export default function RoutesView({ userId, initialTab = 'mine', onBack }: {
  userId: string
  initialTab?: RoutesTab
  onBack: () => void
}) {
  const router = useRouter()
  const [tab, setTab] = useState<RoutesTab>(initialTab)
  const [opened, setOpened] = useState<Set<RoutesTab>>(() => new Set([initialTab]))
  useEffect(() => {
    setTab(initialTab)
    setOpened(prev => (prev.has(initialTab) ? prev : new Set(prev).add(initialTab)))
  }, [initialTab])

  const [counts, setCounts] = useState<Record<RoutesTab, number | null>>({ mine: null, completed: null })
  const setCount = useCallback((k: RoutesTab, n: number) => setCounts(c => (c[k] === n ? c : { ...c, [k]: n })), [])

  const wrapRef = useRef<HTMLDivElement>(null)
  const scrollPos = useRef<Record<RoutesTab, number[]>>({ mine: [], completed: [] })
  const restoreFor = useRef<RoutesTab | null>(null)
  const switchTab = (next: RoutesTab) => {
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
        <div className={styles.headRow}>
          <h1 className={styles.title}>내 루트</h1>
          <button type="button" className={styles.headAction} onClick={() => router.push('/route/new')}>+ 루트 만들기</button>
        </div>
        <p className={styles.desc}>내가 만든 루트와 끝까지 다녀온 루트를 모아봤어요.</p>

        <div className={styles.tabs} role="tablist" aria-label="내 루트">
          {TABS.map(t => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
              className={tab === t.key ? `${styles.tab} ${styles.tabOn}` : styles.tab} onClick={() => switchTab(t.key)}>
              {t.label}{counts[t.key] != null && <span className={styles.tabCount}>{counts[t.key]}</span>}
            </button>
          ))}
        </div>

        {opened.has('mine') && (
          <div role="tabpanel" hidden={tab !== 'mine'} className={styles.panelGap}>
            <MyRoutesTab userId={userId} onCount={n => setCount('mine', n)} />
          </div>
        )}
        {opened.has('completed') && (
          <div role="tabpanel" hidden={tab !== 'completed'} className={styles.panelGap}>
            <CompletedRoutesTab userId={userId} onCount={n => setCount('completed', n)} />
          </div>
        )}
      </div>
    </div>
  )
}
