'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import SettingsSubShell from '@/components/settings/SettingsSubShell'
import { getMyLevelInfo, getMonthlyExpTotal, type LevelInfo } from '@/services/expService'
import {
  getMyActivityLog, getActivityCount, markClickable,
  ACTIVITY_CATEGORIES, type ActivityLogRow, type ActivityCategory,
} from '@/services/activityService'
import styles from './ProfileActivityPage.module.css'

const LIMIT = 25
const KST = 9 * 3600 * 1000

/* ── KST 월 계산 ── */
function kstParts(ms: number) { const d = new Date(ms + KST); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 } }
function currentMonth(): string { const p = kstParts(Date.now()); return `${p.y}-${String(p.m).padStart(2, '0')}` }
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
function monthRangeUtc(month: string) {
  const [y, m] = month.split('-').map(Number)
  return {
    startUtc: new Date(Date.UTC(y, m - 1, 1) - KST).toISOString(),
    endUtc: new Date(Date.UTC(y, m, 1) - KST).toISOString(),
  }
}
function monthLabel(month: string) { const [y, m] = month.split('-').map(Number); return `${y}년 ${m}월` }

/* ── KST 표시 ── */
function dayKey(iso: string) { return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) }
function dayLabel(iso: string) { return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'long' }) }
function timeLabel(iso: string) { return new Date(iso).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' }) }

/* ── 아이콘 ── */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
function ActIcon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    shopCheck: <><path d="M4 9.5V20h16V9.5" /><path d="M3 9.5 5 4h14l2 5.5" /><path d="m9 14 2 2 4-4" /></>,
    shopPlus: <><path d="M4 9.5V20h16V9.5" /><path d="M3 9.5 5 4h14l2 5.5" /><path d="M12 12v5M9.5 14.5h5" /></>,
    event: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
    bookmark: <><path d="M6 3h12v18l-6-4-6 4z" /></>,
    megaphone: <><path d="M4 10v4h3l7 4V6L7 10H4z" /><path d="M17 9a4 4 0 0 1 0 6" /></>,
    routePin: <><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="5" r="2.2" /><path d="M8.2 19H14a3.3 3.3 0 0 0 0-6.6h-4a3.3 3.3 0 0 1 0-6.6h5.8" /></>,
    flag: <><path d="M6 21V4" /><path d="M6 4.5h11l-2 3.5 2 3.5H6z" /></>,
    star: <><path d="M12 4l2.3 5.3 5.7.5-4.3 3.8 1.3 5.6L12 16.9 7 19.2l1.3-5.6L4 9.6l5.7-.5z" /></>,
    photo: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></>,
    medal: <><circle cx="12" cy="14.5" r="4.5" /><path d="M8.5 10 6 3h12l-2.5 7" /></>,
    spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" {...P}>{paths[name] ?? paths.spark}</svg>
}

export default function MyActivityPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { user, profile, loading: authLoading } = useAuth()

  const [month, setMonth] = useState(() => params.get('m') || currentMonth())
  const [cat, setCat] = useState<ActivityCategory | 'all'>(() => (params.get('cat') as any) || 'all')

  const [level, setLevel] = useState<LevelInfo | null>(null)
  const [monthExp, setMonthExp] = useState(0)
  const [monthCount, setMonthCount] = useState(0)
  const [sumLoading, setSumLoading] = useState(true)

  const [rows, setRows] = useState<ActivityLogRow[]>([])
  const [cursor, setCursor] = useState<{ occurredAt: string; id: string } | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [error, setError] = useState(false)
  const reqRef = useRef(0)

  const cur = currentMonth()
  const canNext = month < cur

  // URL 동기화 (월·필터 보존)
  useEffect(() => {
    const qs = new URLSearchParams()
    if (month !== cur) qs.set('m', month)
    if (cat !== 'all') qs.set('cat', cat)
    const q = qs.toString()
    router.replace(q ? `/profile/activity?${q}` : '/profile/activity', { scroll: false })
  }, [month, cat, cur, router])

  // 요약
  useEffect(() => {
    if (!user) return
    setSumLoading(true)
    const { startUtc, endUtc } = monthRangeUtc(month)
    Promise.all([
      getMyLevelInfo(user.id),
      getMonthlyExpTotal(user.id, startUtc, endUtc),
      getActivityCount(user.id, startUtc, endUtc),
    ]).then(([lv, exp, cnt]) => {
      setLevel(lv); setMonthExp(exp); setMonthCount(cnt); setSumLoading(false)
    }).catch(() => setSumLoading(false))
  }, [user, month])

  // 목록 (월·필터 변경 시 리셋)
  const loadFirst = useCallback(async () => {
    if (!user) return
    const rid = ++reqRef.current
    setListLoading(true); setError(false); setRows([]); setCursor(null); setHasMore(false)
    try {
      const { startUtc, endUtc } = monthRangeUtc(month)
      const res = await getMyActivityLog({ userId: user.id, startUtc, endUtc, category: cat, cursor: null, limit: LIMIT })
      const ok = await markClickable(res.rows)
      if (rid !== reqRef.current) return
      setRows(res.rows.map(r => ({ ...r, clickable: ok.has(r.id) })))
      setCursor(res.nextCursor); setHasMore(!!res.nextCursor)
    } catch {
      if (rid === reqRef.current) setError(true)
    } finally {
      if (rid === reqRef.current) setListLoading(false)
    }
  }, [user, month, cat])

  useEffect(() => { loadFirst() }, [loadFirst])

  async function loadMore() {
    if (!user || moreLoading || !cursor) return
    setMoreLoading(true)
    const rid = reqRef.current
    try {
      const { startUtc, endUtc } = monthRangeUtc(month)
      const res = await getMyActivityLog({ userId: user.id, startUtc, endUtc, category: cat, cursor, limit: LIMIT })
      const ok = await markClickable(res.rows)
      if (rid !== reqRef.current) return
      setRows(prev => [...prev, ...res.rows.map(r => ({ ...r, clickable: ok.has(r.id) }))])
      setCursor(res.nextCursor); setHasMore(!!res.nextCursor)
    } catch { /* 목록 유지 */ } finally {
      setMoreLoading(false)
    }
  }

  // 날짜별 그룹
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: ActivityLogRow[] }[] = []
    for (const r of rows) {
      if (!r.occurredAt) continue
      const k = dayKey(r.occurredAt)
      let g = out[out.length - 1]
      if (!g || g.key !== k) { g = { key: k, label: dayLabel(r.occurredAt), items: [] }; out.push(g) }
      g.items.push(r)
    }
    return out
  }, [rows])

  // ── 요약 진행률 ──
  const isMax = level ? level.nextLevelThreshold == null : false
  const pct = level && !isMax && level.nextLevelThreshold != null
    ? Math.min(100, Math.max(0, ((level.totalExp - level.currentLevelExp) / (level.nextLevelThreshold - level.currentLevelExp)) * 100))
    : 100

  return (
    <SettingsSubShell title="내 활동 기록" onBack={() => router.back()}>
      <div className={styles.wrap}>
        <p className={styles.desc}>타쿠로드에서 남긴 활동과 경험치 내역을 확인해요.</p>

        {/* 경험치 요약 */}
        {sumLoading || !level ? (
          <div className={`${styles.sk} ${styles.skSummary}`} />
        ) : (
          <div className={styles.summary}>
            <div className={styles.sumMain}>
              <img className={styles.lvIcon} src={level.icon} alt={`Lv.${level.level}`} />
              <div className={styles.sumBody}>
                <div className={styles.sumNameRow}>
                  <span className={styles.sumName}>{profile?.nickname ?? '나'}</span>
                  <span className={styles.sumTier}>Lv.{level.level} · {level.title}</span>
                </div>
                <div className={styles.sumExp}>누적 경험치 {level.totalExp.toLocaleString()} EXP</div>
                <div className={styles.bar}><div className={styles.barFill} style={{ width: `${pct}%` }} /></div>
                <div className={styles.barMeta}>
                  <span>{isMax ? '최고 등급을 달성했어요' : `다음 등급까지 ${(level.nextLevelExp ?? 0).toLocaleString()} EXP`}</span>
                  <span className={styles.barPct}>{pct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className={styles.sumRight}>
              <div className={styles.sumStat}>
                <div className={styles.sumStatLabel}>이번 달</div>
                <div className={`${styles.sumStatValue} ${styles.accent}`}>{monthExp >= 0 ? '+' : ''}{monthExp.toLocaleString()} EXP</div>
              </div>
              <div className={styles.sumStat}>
                <div className={styles.sumStatLabel}>활동</div>
                <div className={styles.sumStatValue}>{monthCount}회</div>
              </div>
            </div>
          </div>
        )}

        {/* 필터 + 월 이동 */}
        <div className={styles.controls}>
          <div className={styles.filters}>
            {ACTIVITY_CATEGORIES.map(c => (
              <button
                key={c.key}
                className={`${styles.chip} ${cat === c.key ? styles.chipOn : ''}`}
                onClick={() => setCat(c.key)}
              >{c.label}</button>
            ))}
          </div>
          <div className={styles.monthNav}>
            <button className={styles.monthBtn} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달">
              <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <span className={styles.monthLabel}>{monthLabel(month)}</span>
            <button className={styles.monthBtn} onClick={() => canNext && setMonth(shiftMonth(month, 1))} disabled={!canNext} aria-label="다음 달">
              <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        </div>

        {/* 목록 */}
        {listLoading ? (
          <div>{[0, 1, 2, 3].map(i => <div key={i} className={`${styles.sk} ${styles.skRow}`} />)}</div>
        ) : error ? (
          <div className={styles.state}>
            <div className={styles.stateTitle}>활동 기록을 불러오지 못했어요</div>
            <button className={styles.stateBtn} onClick={loadFirst}>다시 시도</button>
          </div>
        ) : rows.length === 0 ? (
          <div className={styles.state}>
            {cat === 'all' ? (
              <>
                <div className={styles.stateTitle}>이 달의 활동 기록이 없어요</div>
                <div className={styles.stateDesc}>샵을 방문하거나 루트를 만들어 활동을 시작해보세요.</div>
                <button className={styles.stateBtnGhost} onClick={() => router.push('/shops')}>샵 둘러보기</button>
              </>
            ) : (
              <div className={styles.stateTitle}>선택한 조건의 활동이 없어요</div>
            )}
          </div>
        ) : (
          <>
            {groups.map(g => (
              <div key={g.key} className={styles.dayGroup}>
                <div className={styles.dayLabel}>{g.label}</div>
                <div className={styles.card}>
                  {g.items.map(r => {
                    const clickable = !!r.clickable && !!r.href
                    const Row: any = clickable ? 'button' : 'div'
                    return (
                      <Row
                        key={r.id}
                        className={`${styles.row} ${clickable ? styles.rowClickable : ''}`}
                        {...(clickable ? { onClick: () => router.push(r.href!) } : {})}
                      >
                        <span className={styles.rowIcon}><ActIcon name={r.icon} /></span>
                        <span className={styles.rowBody}>
                          <span className={styles.rowSentence}>{r.sentence}</span>
                          <span className={styles.rowMeta}>
                            {r.name
                              ? <span className={styles.rowName}>{r.name}{!clickable && r.href ? ' · 삭제된 항목' : ''}</span>
                              : null}
                            {r.name && <span className={styles.rowDot}>·</span>}
                            <span className={styles.rowTime}>{timeLabel(r.occurredAt)}</span>
                          </span>
                        </span>
                        <span className={styles.rowRight}>
                          <span className={`${styles.rowExp} ${r.exp < 0 ? styles.rowExpNeg : r.exp === 0 ? styles.rowExpZero : ''}`}>
                            {r.exp > 0 ? '+' : ''}{r.exp} EXP
                          </span>
                          {clickable && (
                            <span className={styles.rowArrow}>
                              <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="m9 18 6-6-6-6" /></svg>
                            </span>
                          )}
                        </span>
                      </Row>
                    )
                  })}
                </div>
              </div>
            ))}

            {hasMore && (
              <div className={styles.moreWrap}>
                <button className={styles.moreBtn} onClick={loadMore} disabled={moreLoading}>
                  {moreLoading ? '불러오는 중…' : '이전 활동 더 보기'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </SettingsSubShell>
  )
}
