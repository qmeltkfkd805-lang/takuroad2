'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getOfficialRouteCandidates,
  getOfficialRoutes,
  approveOfficialRoute,
  revokeOfficialRoute,
} from '@/services/adminRouteService'
import { buildRouteHero, ROUTE_HERO_MAX } from '@/lib/route/heroOrder'
import RouteBuilder from './RouteBuilder'
import AdminIcon, { AdminIconName } from './AdminIcon'
import styles from './routeAdmin.module.css'

/* ============================================================
   추천 루트 관리

   여기서 켜고 끄는 값은 routes.is_official 하나다.
   이 값이 노출되는 곳은 홈(/)이 아니라 루트 탐색 화면(/routes)이다.
   홈 히어로는 home_hero_slots 기반이고 루트를 아예 받지 않는다 — 헷갈리지 말 것.

   노출 순서는 관리자가 정할 수 없다. buildRouteHero()가
   "추천 먼저 → 남는 자리는 좋아요순(동률이면 장소+팁 수)"으로 계산하며,
   사용자 화면(RouteExplorePage)과 이 미리보기가 같은 함수를 쓴다.
   ⚠️ 다만 후보 조회에 route_tips가 없어서 동률일 때만 순서가 갈릴 수 있다(아래 주석 참고).
   ============================================================ */

/* 난이도 라벨은 RouteBuilder의 DIFF와 같은 값 */
const DIFF_LABEL: Record<number, string> = { 1: '가볍게', 2: '반나절', 3: '하루' }
const DIFF_OPTIONS = [1, 2, 3]

type StateFilter = 'all' | 'official' | 'candidate'
type SortKey = 'likes' | 'shops' | 'approved'

/** getOfficialRouteCandidates()가 주는 행 — is_shared=true인 루트 전부(공식 포함) */
interface SharedRoute {
  id: string
  title: string
  likes: number | null
  is_official: boolean | null
  profiles: { nickname: string } | null
  route_shops: { id: string }[] | null
  completionCount: number
}

/** getOfficialRoutes()가 주는 행 — is_official=true (공유 여부는 안 봄) */
interface OfficialRoute {
  id: string
  title: string
  official_difficulty: number | null
  approved_at: string | null
  profiles: { nickname: string } | null
  route_shops: { id: string }[] | null
}

/** 두 조회를 id로 합친 관리 목록 한 줄 */
interface ManagedRoute {
  id: string
  title: string
  nickname: string | null
  /** null = 값을 가져오지 못함(공유가 꺼진 공식 루트). 0과 구분한다 */
  likes: number | null
  shopCount: number
  /** null = 아직 정해진 적 없음(후보) */
  difficulty: number | null
  approvedAt: string | null
  isOfficial: boolean
  /** is_shared=true 목록에 있었는지 */
  inShared: boolean
}

export default function OfficialRouteTab() {
  const { user } = useAuth()

  const [shared, setShared] = useState<SharedRoute[]>([])
  const [official, setOfficial] = useState<OfficialRoute[]>([])
  const [failed, setFailed] = useState(false)

  const [reloadKey, setReloadKey] = useState(0)
  const [loadedKey, setLoadedKey] = useState(-1)
  const loading = loadedKey !== reloadKey

  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<StateFilter>('all')
  const [sort, setSort] = useState<SortKey>('likes')

  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    const key = reloadKey
    Promise.allSettled([getOfficialRouteCandidates(), getOfficialRoutes()]).then(([cand, off]) => {
      if (!alive) return
      setShared(cand.status === 'fulfilled' ? (cand.value as unknown as SharedRoute[]) : [])
      setOfficial(off.status === 'fulfilled' ? (off.value as unknown as OfficialRoute[]) : [])
      setFailed(cand.status !== 'fulfilled' && off.status !== 'fulfilled')
      setLoadedKey(key)
    })
    return () => { alive = false }
  }, [reloadKey])

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current) }, [])

  function showNotice(ok: boolean, text: string) {
    setNotice({ ok, text })
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    if (ok) noticeTimer.current = setTimeout(() => setNotice(null), 5000)
  }
  function reload() { setReloadKey((k) => k + 1) }

  /* 탐색 화면에 실제로 나가는 목록 — 사용자 화면과 같은 buildRouteHero()를 쓴다.
     shared는 is_shared=true만 담고 있어 /routes의 모수와 같다. */
  const heroList = useMemo(() => buildRouteHero(shared, ROUTE_HERO_MAX), [shared])
  const heroIndex = useMemo(() => {
    const m = new Map<string, number>()
    heroList.forEach((r, i) => m.set(r.id, i))
    return m
  }, [heroList])

  /* 두 조회를 id로 합친다. 공유가 꺼진 공식 루트는 shared에 없어서 likes를 알 수 없다. */
  const rows: ManagedRoute[] = useMemo(() => {
    const map = new Map<string, ManagedRoute>()
    for (const r of shared) {
      map.set(r.id, {
        id: r.id,
        title: r.title,
        nickname: r.profiles?.nickname ?? null,
        likes: r.likes ?? 0,           // 조회는 했으니 값이 없으면 실제로 0이다
        shopCount: r.route_shops?.length ?? 0,
        difficulty: null,
        approvedAt: null,
        isOfficial: !!r.is_official,
        inShared: true,
      })
    }
    for (const o of official) {
      const prev = map.get(o.id)
      map.set(o.id, {
        id: o.id,
        title: o.title,
        nickname: o.profiles?.nickname ?? prev?.nickname ?? null,
        likes: prev ? prev.likes : null,   // 이 조회에는 likes가 없다 → 모름
        shopCount: prev?.shopCount ?? o.route_shops?.length ?? 0,
        difficulty: o.official_difficulty ?? null,
        approvedAt: o.approved_at,
        isOfficial: true,
        inShared: !!prev,
      })
    }
    return [...map.values()]
  }, [shared, official])

  const counts = useMemo(() => {
    const officialCount = rows.filter((r) => r.isOfficial).length
    return { all: rows.length, official: officialCount, candidate: rows.length - officialCount }
  }, [rows])

  // approved_at이 하나라도 있어야 '최근 승인순'을 제공한다
  const canSortByApproved = useMemo(() => rows.some((r) => r.approvedAt), [rows])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = rows
    if (needle) out = out.filter((r) => r.title.trim().toLowerCase().includes(needle))
    if (filter === 'official') out = out.filter((r) => r.isOfficial)
    else if (filter === 'candidate') out = out.filter((r) => !r.isOfficial)

    const sorted = [...out]
    // 값이 없는 항목(-1 / 빈 문자열)은 어느 정렬에서든 항상 뒤로 간다
    if (sort === 'shops') sorted.sort((a, b) => b.shopCount - a.shopCount)
    else if (sort === 'approved') sorted.sort((a, b) => (b.approvedAt ?? '').localeCompare(a.approvedAt ?? ''))
    else sorted.sort((a, b) => (b.likes ?? -1) - (a.likes ?? -1))
    return sorted
  }, [rows, q, filter, sort])

  function exposureOf(row: ManagedRoute): { text: string; cls: string; hint: string } {
    const i = heroIndex.get(row.id)
    if (i !== undefined) {
      return row.isOfficial
        ? { text: `탐색 노출 ${i + 1}위`, cls: styles.exposeRank, hint: '추천 루트로 노출되고 있어요' }
        : { text: `인기순 대체 ${i + 1}위`, cls: styles.exposeAuto, hint: '빈 자리를 인기 루트로 채우면서 노출되고 있어요' }
    }
    if (row.isOfficial) {
      return row.inShared
        ? { text: '상위 5개 밖', cls: styles.exposeOut, hint: `추천 루트지만 좋아요순 상위 ${ROUTE_HERO_MAX}개에 들지 못했어요` }
        : { text: '상위 5개 밖', cls: styles.exposeOut, hint: '공유가 꺼져 있어 탐색 화면 목록에 들어가지 않아요' }
    }
    return { text: '현재 미노출', cls: styles.exposeOut, hint: '추천도 아니고 인기순 자리에도 들지 못했어요' }
  }

  async function handlePromote(row: ManagedRoute) {
    if (!user) { showNotice(false, '로그인 정보를 확인할 수 없어요. 새로고침 후 다시 시도해 주세요.'); return }
    // 확인 전에는 절대 update를 실행하지 않는다
    const ok = window.confirm(
      `"${row.title}"을(를) 추천 루트로 지정할까요?\n\n`
      + `· 난이도: ${DIFF_LABEL[difficulty]}\n`
      + '· 루트 탐색 화면의 추천 자리에 올라갑니다\n'
      + '· 공유 상태가 켜지고, 이후 관리자만 편집할 수 있게 됩니다\n'
      + '  (작성자는 수정과 공유 해제를 할 수 없게 돼요)',
    )
    if (!ok) return

    setBusyId(row.id)
    const done = await approveOfficialRoute(row.id, difficulty, user.id)
    setBusyId(null)
    if (!done) { showNotice(false, `"${row.title}" 추천 지정에 실패했어요. 잠시 후 다시 시도해 주세요.`); return }
    setPromotingId(null)
    setDifficulty(1)
    showNotice(true, `"${row.title}"을(를) 추천 루트로 지정했어요.`)
    reload()
  }

  async function handleRevoke(row: ManagedRoute) {
    if (!confirm(`"${row.title}"의 추천을 해제할까요?\n\n루트 탐색 화면의 추천 자리에서 빠집니다.`)) return
    setBusyId(row.id)
    const done = await revokeOfficialRoute(row.id)
    setBusyId(null)
    // 실패하면 화면 상태를 건드리지 않는다
    if (!done) { showNotice(false, `"${row.title}" 추천 해제에 실패했어요.`); return }
    showNotice(true, `"${row.title}"의 추천을 해제했어요.`)
    reload()
  }

  // 루트를 만들거나 고치는 중에는 화면 전체를 빌더에 넘긴다 (기존 방식 유지)
  if (building) {
    return (
      <div className={styles.wrap}>
        <button type="button" className={styles.backBtn} onClick={() => { setBuilding(false); setEditId(null) }}>
          ← 추천 루트 목록
        </button>
        <RouteBuilder
          editRouteId={editId}
          onDone={() => { setBuilding(false); setEditId(null); reload() }}
          onCancel={() => { setBuilding(false); setEditId(null) }}
        />
      </div>
    )
  }

  const overLimit = counts.official > ROUTE_HERO_MAX

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.h1}>추천 루트</h1>
          <p className={styles.headSub}>루트 탐색 화면에 추천할 공식 루트와 실제 노출 결과를 확인하세요</p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => { setEditId(null); setBuilding(true) }}>
          <AdminIcon name="plus" size={18} strokeWidth={2.2} />새 추천 루트 만들기
        </button>
      </div>

      {notice && (
        <div
          className={notice.ok ? `${styles.notice} ${styles.noticeOk}` : `${styles.notice} ${styles.noticeErr}`}
          role={notice.ok ? 'status' : 'alert'}
        >
          <AdminIcon name={notice.ok ? 'checkCircle' : 'alert'} size={17} />
          <span>{notice.text}</span>
          <button type="button" className={styles.noticeClose} onClick={() => setNotice(null)} aria-label="안내 닫기">
            <AdminIcon name="close" size={15} />
          </button>
        </div>
      )}

      <div className={styles.summary}>
        <Stat label="현재 추천" value={counts.official} loading={loading} icon="route" iconClass={styles.iconPink} toneClass={styles.tonePink} />
        <Stat label="탐색 노출" value={heroList.length} max={ROUTE_HERO_MAX} loading={loading} icon="hero" iconClass={styles.iconGreen} toneClass={styles.toneGreen} />
        <Stat label="추천 후보" value={counts.candidate} loading={loading} icon="inbox" iconClass={styles.iconNeutral} />
      </div>

      {/* 개수 제한은 걸지 않는다. 5개를 넘기면 알려만 준다 */}
      {!loading && !failed && (
        <div
          className={overLimit ? `${styles.notice} ${styles.noticeWarn}` : `${styles.notice} ${styles.noticeMuted}`}
          role={overLimit ? 'status' : undefined}
        >
          <AdminIcon name={overLimit ? 'alert' : 'checkCircle'} size={17} />
          <span>
            {overLimit
              ? `추천 루트가 ${ROUTE_HERO_MAX}개를 초과했습니다. 좋아요순 상위 ${ROUTE_HERO_MAX}개만 탐색 화면에 노출됩니다.`
              : `추천 루트 중 최대 ${ROUTE_HERO_MAX}개가 탐색 화면에 노출됩니다.`}
          </span>
        </div>
      )}

      {failed ? (
        <div className={`${styles.card} ${styles.state}`}>
          <strong className={styles.stateStrong}>루트를 불러오지 못했어요</strong>
          잠시 후 다시 시도해 주세요.
          <div><button type="button" className={styles.retryBtn} onClick={reload}>다시 불러오기</button></div>
        </div>
      ) : loading ? (
        <div className={styles.card}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.skelRow}>
              <div className={styles.skel} style={{ width: 28, height: 28 }} />
              <div style={{ flex: 1 }}>
                <div className={styles.skel} style={{ width: '45%', height: 14, marginBottom: 7 }} />
                <div className={styles.skel} style={{ width: '28%', height: 11 }} />
              </div>
              <div className={styles.skel} style={{ width: 150, height: 36 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* 1. 실제 노출 결과 — 읽기 전용 */}
          <section className={`${styles.card} ${styles.section}`}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>루트 탐색 노출 미리보기</h2>
              <span className={styles.sectionNote}>추천 우선 · 빈 자리는 인기순 · 최대 {ROUTE_HERO_MAX}개</span>
            </div>
            <p
              className={styles.previewNote}
              title="추천 루트를 우선 배치하고, 남은 자리는 좋아요순으로 자동 채웁니다. 동률이면 장소와 팁 수를 반영합니다."
            >
              추천 루트가 먼저 노출되고 남은 자리는 인기 루트로 자동 채워집니다.
            </p>
            {rows.length === 0 ? (
              <div className={styles.state}>공유된 루트가 없어 탐색 화면에 표시할 것이 없어요.</div>
            ) : (
              <div className={styles.slots}>
                {Array.from({ length: ROUTE_HERO_MAX }).map((_, i) => {
                  const r = heroList[i]
                  if (!r) {
                    return (
                      <div key={`empty-${i}`} className={`${styles.slot} ${styles.slotEmpty}`}>
                        <div className={styles.slotTop}><span className={styles.rank}>{i + 1}</span></div>
                        <span className={styles.slotEmptyText}>인기 루트로 자동 채워집니다</span>
                      </div>
                    )
                  }
                  const row = rows.find((x) => x.id === r.id)
                  return (
                    <div key={r.id} className={styles.slot}>
                      <div className={styles.slotTop}>
                        <span className={i === 0 ? `${styles.rank} ${styles.rankOn}` : styles.rank}>{i + 1}</span>
                        <span className={styles.slotTitle} title={row?.title ?? ''}>{row?.title ?? ''}</span>
                      </div>
                      <span className={styles.slotMeta}>
                        좋아요 {row && row.likes !== null ? row.likes.toLocaleString() : '—'}
                        {' · '}장소 {row?.shopCount ?? 0}곳
                        {row?.isOfficial && row.difficulty !== null ? ` · 난이도 ${DIFF_LABEL[row.difficulty] ?? '미지정'}` : ''}
                      </span>
                      <span className={row?.isOfficial ? `${styles.badge} ${styles.badgeOfficial}` : `${styles.badge} ${styles.badgeAuto}`}>
                        {row?.isOfficial ? '추천' : '인기순 대체'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* 2. 관리 목록 — 추천/후보를 상태로만 구분한 하나의 표 */}
          <section className={`${styles.card} ${styles.section}`}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>루트 관리</h2>
            </div>

            <div className={styles.toolbar}>
              <div className={styles.searchRow}>
                <div className={styles.searchWrap}>
                  <span className={styles.searchIcon}><AdminIcon name="search" size={18} /></span>
                  <input
                    className={styles.search}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="루트명 검색"
                    aria-label="루트명 검색"
                  />
                </div>
                <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬 기준">
                  <option value="likes">좋아요 많은 순</option>
                  <option value="shops">장소 많은 순</option>
                  {canSortByApproved && <option value="approved">최근 승인순</option>}
                </select>
              </div>
              <div className={styles.filterRow}>
                <div className={styles.chips}>
                  {([
                    { value: 'all', label: '전체', count: counts.all },
                    { value: 'official', label: '추천 중', count: counts.official },
                    { value: 'candidate', label: '추천 후보', count: counts.candidate },
                  ] as { value: StateFilter; label: string; count: number }[]).map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      className={filter === f.value ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                      aria-pressed={filter === f.value}
                      onClick={() => setFilter(f.value)}
                    >
                      {f.label}<span className={styles.chipCount}>{f.count}</span>
                    </button>
                  ))}
                </div>
                <span className={styles.total}>{filtered.length.toLocaleString()}개 표시</span>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className={styles.state}>
                <strong className={styles.stateStrong}>공유된 루트가 없어요</strong>
                새 추천 루트를 직접 만들거나, 사용자가 루트를 공유하면 여기에 나타납니다.
              </div>
            ) : filtered.length === 0 ? (
              <div className={styles.state}>
                <strong className={styles.stateStrong}>조건에 맞는 루트가 없어요</strong>
                검색어나 필터를 바꿔보세요.
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">루트</th>
                      <th scope="col" className={styles.colMetric}>지표</th>
                      <th scope="col" className={styles.colDiff}>난이도</th>
                      <th scope="col" className={styles.colState}>추천 상태</th>
                      <th scope="col" className={styles.colExpose}>탐색 노출</th>
                      <th scope="col" className={styles.colAction}>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const ex = exposureOf(row)
                      const busy = busyId === row.id
                      return (
                        <tr key={row.id}>
                          <td className={styles.cellRoute}>
                            <span className={styles.routeName} title={row.title}>{row.title}</span>
                            <span className={styles.routeSub}>
                              {row.approvedAt ? `승인 ${new Date(row.approvedAt).toLocaleDateString('ko-KR')} · ` : ''}
                              {row.nickname ?? '작성자 알 수 없음'}
                            </span>
                          </td>

                          <td className={styles.cellMetric}>
                            <span className={styles.metric}>
                              좋아요{' '}
                              {row.likes === null
                                ? <span className={styles.dash} title="공유가 꺼져 있어 좋아요 수를 가져오지 못했어요">—</span>
                                : row.likes.toLocaleString()}
                              {' · '}장소 {row.shopCount}곳
                            </span>
                          </td>

                          <td className={styles.cellDiff}>
                            {row.difficulty !== null
                              ? <span className={`${styles.badge} ${styles.badgeNeutral}`}>{DIFF_LABEL[row.difficulty] ?? '미지정'}</span>
                              : <span className={styles.dash} title="추천으로 지정할 때 정해집니다">미지정</span>}
                          </td>

                          <td className={styles.cellState}>
                            <span className={row.isOfficial ? `${styles.badge} ${styles.badgeOfficial}` : `${styles.badge} ${styles.badgeNeutral}`}>
                              {row.isOfficial ? '추천 중' : '추천 후보'}
                            </span>
                          </td>

                          <td className={styles.cellExpose}>
                            <span className={ex.cls} title={ex.hint}>{ex.text}</span>
                          </td>

                          <td className={styles.cellAction}>
                            {promotingId === row.id ? (
                              <div className={styles.promoteBox}>
                                <span className={styles.promoteLabel}>난이도를 고르고 지정하세요</span>
                                <div className={styles.diffPick}>
                                  {DIFF_OPTIONS.map((d) => (
                                    <button
                                      key={d}
                                      type="button"
                                      className={difficulty === d ? `${styles.diffBtn} ${styles.diffBtnOn}` : styles.diffBtn}
                                      aria-pressed={difficulty === d}
                                      onClick={() => setDifficulty(d)}
                                    >{DIFF_LABEL[d]}</button>
                                  ))}
                                </div>
                                <div className={styles.confirmRow}>
                                  <button type="button" className={styles.confirmBtn} onClick={() => handlePromote(row)} disabled={busy}>
                                    {busy ? '지정 중…' : '추천 지정'}
                                  </button>
                                  <button type="button" className={styles.ghostBtn} onClick={() => { setPromotingId(null); setDifficulty(1) }} disabled={busy}>
                                    취소
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={styles.actionCell}>
                                {/* 편집은 기존대로 추천 중인 루트에만 */}
                                {row.isOfficial && (
                                  <button type="button" className={styles.ghostBtn} onClick={() => { setEditId(row.id); setBuilding(true) }}>
                                    편집
                                  </button>
                                )}
                                {row.isOfficial ? (
                                  <button type="button" className={styles.dangerBtn} onClick={() => handleRevoke(row)} disabled={busy}>
                                    {busy ? '처리 중…' : '추천 해제'}
                                  </button>
                                ) : (
                                  <button type="button" className={styles.promoteBtn} onClick={() => { setPromotingId(row.id); setDifficulty(1) }}>
                                    추천 지정
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, max, loading, icon, iconClass, toneClass }: {
  label: string; value: number; max?: number; loading: boolean
  icon: AdminIconName; iconClass: string; toneClass?: string
}) {
  return (
    <div className={`${styles.card} ${styles.stat}`}>
      <span className={styles.statBody}>
        <span className={styles.statLabel}>{label}</span>
        <span className={`${styles.statValue} ${toneClass ?? ''}`}>
          {loading ? '—' : value.toLocaleString()}
          {max !== undefined && <span className={styles.statMax}> / {max}</span>}
        </span>
      </span>
      <span className={`${styles.statIcon} ${iconClass}`}><AdminIcon name={icon} size={20} /></span>
    </div>
  )
}
