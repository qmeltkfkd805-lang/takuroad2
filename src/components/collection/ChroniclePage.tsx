'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyStories, Story, StoryItem } from '@/services/storyBuilder'
import { AXIS_KEYS, AXIS_LABEL, AXIS_ICON, AxisKey } from '@/lib/work/workProgress'
import { ROUTES } from '@/lib/constants/routes'
import StoryCard from './StoryCard'
import { Icon, LineIcon } from '@/components/tds'
import { MaskIcon } from './MaskIcon'
import styles from './ChroniclePage.module.css'

/* ============================================================
   연대기 전체 화면 (/chronicle)

   상단 = 연도 + 월 + 전체 필터.
   ⭐ 연대기는 "기록을 되짚는 곳"이라 시간축이 1급 네비게이션이다.
      (검색이 아니라 회상 — "작년 7월에 뭐 했더라")
   ⭐ 필터는 껍데기를 두지 않는다. 지금 데이터로 실제 도는 것만 넣는다.
   ============================================================ */

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const WEEKDAY = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

/** "2026-07-11" -> { md: "7.11", wd: "금요일" } — 타임라인 레일에 붙는 날짜 */
function railDate(date: string): { md: string; wd: string } {
  const [y, m, d] = date.split('-').map(Number)
  const wd = WEEKDAY[new Date(y, m - 1, d).getDay()]
  return { md: `${m}.${d}`, wd }
}

/** 드롭다운 화살표 — 문자(⌄)는 폰트마다 두께·위치가 달라서 SVG로 그린다 */
function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="11" height="11" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.6"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/** Activity 하나가 어느 축에 속하는지 — 필터의 기준 */
function itemAxis(item: StoryItem): AxisKey | null {
  if (item.type === 'shop_visit') return 'shop'
  if (item.type === 'route_completed') return 'route'
  if (item.type === 'event_visit') return item.eventType === 'collab_cafe' ? 'cafe' : 'event'
  return null
}

function storyAxes(story: Story): Set<AxisKey> {
  const set = new Set<AxisKey>()
  for (const p of story.places) {
    for (const it of p.items) {
      const a = itemAxis(it)
      if (a) set.add(a)
    }
  }
  return set
}

export default function ChroniclePage() {
  const { user } = useAuth()
  const router = useRouter()

  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)

  const [year, setYear] = useState<string | null>(null)
  const [month, setMonth] = useState<number | null>(null)
  const [axisFilter, setAxisFilter] = useState<Set<AxisKey>>(new Set())   // 비어 있으면 전체
  const [areaFilter, setAreaFilter] = useState<Set<string>>(new Set())    // 비어 있으면 전체

  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getMyStories(user.id, 300)
      .then(list => {
        setStories(list)
        // 기록이 있는 가장 최근 연·월을 기본값으로 (연대기를 열면 최근이 먼저 보여야 한다)
        if (list.length > 0) {
          setYear(list[0].date.slice(0, 4))
          setMonth(Number(list[0].date.slice(5, 7)))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  // 바깥 클릭하면 필터 패널 닫기
  useEffect(() => {
    if (!panelOpen) return
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [panelOpen])

  // 기록이 있는 연도 (최신순)
  const years = useMemo(
    () => [...new Set(stories.map(s => s.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a)),
    [stories],
  )

  // 그 해에 기록이 있는 달 — 없는 달은 눌리지 않게 흐리게
  const monthsWithData = useMemo(() => {
    const set = new Set<number>()
    for (const s of stories) {
      if (s.date.slice(0, 4) === year) set.add(Number(s.date.slice(5, 7)))
    }
    return set
  }, [stories, year])

  // 그 해에 등장한 지역 (필터 목록)
  const areas = useMemo(
    () => [...new Set(stories.filter(s => s.date.slice(0, 4) === year).map(s => s.area))].sort(),
    [stories, year],
  )

  const visible = useMemo(() => stories.filter(s => {
    if (year && s.date.slice(0, 4) !== year) return false
    if (month && Number(s.date.slice(5, 7)) !== month) return false
    if (areaFilter.size > 0 && !areaFilter.has(s.area)) return false
    if (axisFilter.size > 0) {
      const has = storyAxes(s)
      if (![...axisFilter].some(a => has.has(a))) return false
    }
    return true
  }), [stories, year, month, axisFilter, areaFilter])

  const filterCount = axisFilter.size + areaFilter.size

  const toggleAxis = (a: AxisKey) => {
    setAxisFilter(prev => {
      const next = new Set(prev)
      next.has(a) ? next.delete(a) : next.add(a)
      return next
    })
  }
  const toggleArea = (a: string) => {
    setAreaFilter(prev => {
      const next = new Set(prev)
      next.has(a) ? next.delete(a) : next.add(a)
      return next
    })
  }
  const resetFilter = () => { setAxisFilter(new Set()); setAreaFilter(new Set()) }

  // 연도를 바꾸면 그 해에 기록이 있는 가장 마지막 달로
  const changeYear = (y: string) => {
    setYear(y)
    const ms = stories.filter(s => s.date.slice(0, 4) === y).map(s => Number(s.date.slice(5, 7)))
    setMonth(ms.length > 0 ? Math.max(...ms) : null)
    resetFilter()
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.signin}>
          <h1>나의 덕질 연대기</h1>
          <p>로그인하면 내가 다녀온 곳들이 시간순으로 쌓여요.</p>
          <button onClick={() => router.push(ROUTES.login)}>로그인하기</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <h1>
            나의 덕질 연대기
            <Icon name="colorstar" size={22} />
          </h1>
          <p>내가 언제, 어디를 다녀왔는지 — 시간의 흐름을 따라 내 덕질을 기록해요.</p>
        </div>

        {stories.length > 0 && (
          <div className={styles.controls}>
            {/* 연도 */}
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={year ?? ''}
                onChange={e => changeYear(e.target.value)}
              >
                {years.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <Chevron className={styles.caret} />
            </div>

            {/* 전체 필터 */}
            <div className={styles.filterWrap} ref={panelRef}>
              <button
                className={`${styles.filterBtn} ${filterCount > 0 ? styles.filterOn : ''}`}
                onClick={() => setPanelOpen(o => !o)}
              >
                <span className={styles.filterIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
                    <circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" />
                  </svg>
                </span>
                전체 필터
                {filterCount > 0 && <span className={styles.badge}>{filterCount}</span>}
                <Chevron className={styles.btnCaret} />
              </button>

              {panelOpen && (
                <div className={styles.panel}>
                  <div className={styles.panelSec}>
                    <div className={styles.panelLabel}>활동</div>
                    <div className={styles.chips}>
                      {AXIS_KEYS.map(a => (
                        <button
                          key={a}
                          className={`${styles.chip} ${axisFilter.has(a) ? styles.chipOn : ''}`}
                          onClick={() => toggleAxis(a)}
                        >
                          <MaskIcon name={AXIS_ICON[a]} size={15} color="currentColor" />
                          {AXIS_LABEL[a]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {areas.length > 1 && (
                    <div className={styles.panelSec}>
                      <div className={styles.panelLabel}>지역</div>
                      <div className={styles.chips}>
                        {areas.map(a => (
                          <button
                            key={a}
                            className={`${styles.chip} ${areaFilter.has(a) ? styles.chipOn : ''}`}
                            onClick={() => toggleArea(a)}
                          >
                            <LineIcon name="pin" size={15} color="currentColor" />
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {filterCount > 0 && (
                    <button className={styles.reset} onClick={resetFilter}>초기화</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 월 선택 — 연대기는 시간축이 1급 네비게이션 */}
      {stories.length > 0 && (
        <nav className={styles.monthBar}>
          <span className={styles.yearBig}>{year}</span>
          <div className={styles.months}>
            {MONTHS.map(m => {
              const has = monthsWithData.has(m)
              return (
                <button
                  key={m}
                  className={`${styles.month} ${month === m ? styles.monthOn : ''} ${has ? '' : styles.monthOff}`}
                  onClick={() => has && setMonth(m)}
                  disabled={!has}
                  title={has ? `${m}월 기록 보기` : `${m}월엔 기록이 없어요`}
                >
                  {m}월
                </button>
              )
            })}
          </div>
        </nav>
      )}

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className={styles.skelCard} />)}
        </div>
      ) : stories.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <MaskIcon name="book" size={44} color="var(--border)" />
          </div>
          <h2>아직 기록이 없어요</h2>
          <p>
            굿즈샵에 다녀오셨다면 샵 상세에서 <b>&ldquo;방문했어요&rdquo;</b>를 눌러보세요.<br />
            다녀온 곳들이 지역별로 묶여 하나의 이야기가 됩니다.
          </p>
          <button onClick={() => router.push('/map')}>지도에서 샵 찾기</button>
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.noResult}>
          <p>{filterCount > 0 ? '이 조건에 맞는 기록이 없어요.' : `${year}년 ${month}월엔 기록이 없어요.`}</p>
          {filterCount > 0 && <button onClick={resetFilter}>필터 초기화</button>}
        </div>
      ) : (
        <>
          {/* 타임라인 레일 — 날짜가 곧 이야기의 좌표.
              연대기는 "언제"가 먼저고 "무엇"이 뒤따른다 */}
          <div className={styles.timeline}>
            {visible.map(s => {
              const { md, wd } = railDate(s.date)
              return (
                <div key={s.key} className={styles.row}>
                  <div className={styles.dateBox}>
                    <span className={styles.md}>{md}</span>
                    <span className={styles.wd}>{wd}</span>
                  </div>
                  <div className={styles.rail}>
                    <span className={styles.dot} />
                  </div>
                  <div className={styles.rowBody}>
                    <StoryCard story={s} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className={styles.footNote}>
            {year}년 {month}월의 기록이에요. 더 많은 추억을 쌓아보세요.
          </p>
        </>
      )}
    </div>
  )
}
