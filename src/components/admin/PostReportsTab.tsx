'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  getPendingPostReports, getReviewedPostReports, getHiddenPosts,
  getPostAppeals, resolvePostReports,
  PostReportGroup, PostReportRow, PostReportAction,
} from '@/services/communityPostService'
import { CommunityPost, PostAppeal, REASON_LABEL, BOARD_LABEL, REPORT_REASONS } from '@/types/community-post'
import AdminIcon, { AdminIconName } from './AdminIcon'
import styles from './postReports.module.css'

/* 관리자 > 게시글 신고.

   축이 둘이다. 섞지 않는다.
     community_posts.status  글 공개 여부 (active / hidden)
     post_reports.status     신고 처리 진행도 (pending / dismissed / resolved)
   그래서 탭도 셋이다 — 미처리 신고(대기열) / 처리 이력 / 숨김 글(현재 상태).

   처리는 전부 /api/admin/post-report → admin_resolve_post_reports RPC 를 거친다.
   글 상태 변경과 신고 처리가 한 트랜잭션이어야 하고, 처리할 신고 목록·처리자·
   처리 시각을 클라이언트가 정하면 안 되기 때문이다. 여기서 보내는 건 글 id 와
   동작 이름뿐이다.

   이 화면에 없는 것과 그 이유:
   - 삭제 버튼: 신고만으로 글을 지우도록 유도하지 않는다. 숨김이 되돌릴 수 있는 조치다.
   - 신고자 닉네임: 관리자가 신고자를 보고 판단하지 않게 한다.
   - 작성자 제재·이메일·정지 상태: 이 화면의 판단 범위가 아니다. 조회도 하지 않는다. */

type TabId = 'pending' | 'reviewed' | 'hidden'
type SortId = 'old' | 'new' | 'many'

const fmtDate = (s: string | null | undefined) => {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR')
}
const fmtDateTime = (s: string | null | undefined) => {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
}
const fmtTime = (d: Date) => d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
const reasonLabel = (r: string) => REASON_LABEL[r] ?? r
const postTitle = (p: CommunityPost | null) => p?.title?.trim() || '제목 없음'

/* 이의제기에 들어오는 URL 은 사용자가 입력한 값이다. http(s) 만 링크로 연다.
   javascript: 나 data: 는 링크로 만들지 않고 일반 텍스트로 보여준다. */
function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = new globalThis.URL(raw.trim())
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null
  } catch { return null }
}

/** 숨김 주체 표기. PostUI 의 작성자 숨김도 hidden_by='admin' 으로 저장돼서
 *  둘을 구분할 수 없다. 자동 숨김만 확실하므로 나머지는 '수동 숨김'으로 적는다. */
const hiddenByLabel = (by: string | null) => by === 'auto' ? '자동 숨김' : '수동 숨김'

function countReasons(reports: PostReportRow[]): [string, number][] {
  const m: Record<string, number> = {}
  for (const r of reports) m[r.reason] = (m[r.reason] ?? 0) + 1
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}
const oldestOf = (g: PostReportGroup) => new Date(g.reports[0].createdAt).getTime()
const newestOf = (g: PostReportGroup) => new Date(g.reports[g.reports.length - 1].createdAt).getTime()

/** 검색어 매칭 — 제목·본문·신고 내용·사유 라벨 */
function matchGroup(g: PostReportGroup, q: string): boolean {
  if (q === '') return true
  if (postTitle(g.post).toLowerCase().includes(q)) return true
  if ((g.post?.content ?? '').toLowerCase().includes(q)) return true
  return g.reports.some(r =>
    (r.content ?? '').toLowerCase().includes(q) || reasonLabel(r.reason).toLowerCase().includes(q))
}

export default function PostReportsTab({ onResolved }: {
  /** 신고를 처리하면 상위(AdminPage)의 사이드바 배지를 다시 맞춘다 */
  onResolved?: () => void
}) {
  const [tab, setTab] = useState<TabId>('pending')
  const [sort, setSort] = useState<SortId>('old')
  const [query, setQuery] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  // 미처리 — 화면을 열면 바로 조회
  const [pending, setPending] = useState<PostReportGroup[]>([])
  const [pFailed, setPFailed] = useState(false)
  const [pReload, setPReload] = useState(0)
  const [pLoaded, setPLoaded] = useState(-1)
  const pLoading = pLoaded !== pReload

  // 처리 이력 / 숨김 글 — 탭을 처음 열 때만. 상태를 분리해 미처리를 깨뜨리지 않는다
  const [reviewed, setReviewed] = useState<PostReportGroup[]>([])
  const [rFailed, setRFailed] = useState(false)
  const [rAsked, setRAsked] = useState(false)
  const [rReload, setRReload] = useState(0)
  const [rLoaded, setRLoaded] = useState(-1)
  const rLoading = rAsked && rLoaded !== rReload

  const [hidden, setHidden] = useState<CommunityPost[]>([])
  const [hFailed, setHFailed] = useState(false)
  const [hAsked, setHAsked] = useState(false)
  const [hReload, setHReload] = useState(0)
  const [hLoaded, setHLoaded] = useState(-1)
  const hLoading = hAsked && hLoaded !== hReload

  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<PostReportAction | null>(null)

  const [msg, setMsg] = useState<string | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])
  function toast(m: string) {
    setMsg(m)
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setMsg(null), 3200)
  }

  useEffect(() => {
    let alive = true
    getPendingPostReports()
      .then(rows => {
        if (!alive) return
        setPending(rows); setPFailed(false); setPLoaded(pReload); setCheckedAt(new Date())
      })
      .catch(e => {
        if (!alive) return
        console.error('[게시글 신고] 미처리 조회 실패:', e)
        setPending([]); setPFailed(true); setPLoaded(pReload)
      })
    return () => { alive = false }
  }, [pReload])

  useEffect(() => {
    if (!rAsked) return
    let alive = true
    getReviewedPostReports()
      .then(rows => {
        if (!alive) return
        setReviewed(rows); setRFailed(false); setRLoaded(rReload); setCheckedAt(new Date())
      })
      .catch(e => {
        if (!alive) return
        console.error('[게시글 신고] 처리 이력 조회 실패:', e)
        setReviewed([]); setRFailed(true); setRLoaded(rReload)
      })
    return () => { alive = false }
  }, [rAsked, rReload])

  useEffect(() => {
    if (!hAsked) return
    let alive = true
    getHiddenPosts()
      .then(rows => {
        if (!alive) return
        setHidden(rows); setHFailed(false); setHLoaded(hReload); setCheckedAt(new Date())
      })
      .catch(e => {
        if (!alive) return
        console.error('[게시글 신고] 숨김 글 조회 실패:', e)
        setHidden([]); setHFailed(true); setHLoaded(hReload)
      })
    return () => { alive = false }
  }, [hAsked, hReload])

  function refresh() {
    if (tab === 'pending') { if (!pLoading) setPReload(k => k + 1) }
    else if (tab === 'reviewed') { if (!rLoading) { setRAsked(true); setRReload(k => k + 1) } }
    else if (!hLoading) { setHAsked(true); setHReload(k => k + 1) }
  }
  function openTab(next: TabId) {
    setTab(next)
    setSelectedId(null)
    setMobileOpen(false)
    if (next === 'reviewed') setRAsked(true)
    if (next === 'hidden') setHAsked(true)
  }

  const summary = useMemo(() => ({
    reports: pending.reduce((n, g) => n + g.reports.length, 0),
    posts: pending.length,
    multi: pending.filter(g => g.reports.length >= 2).length,
  }), [pending])

  const shownPending = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = pending.filter(g => {
      if (reasonFilter && !g.reports.some(r => r.reason === reasonFilter)) return false
      return matchGroup(g, q)
    })
    return [...filtered].sort((a, b) =>
      sort === 'many' ? b.reports.length - a.reports.length
        : sort === 'new' ? newestOf(b) - newestOf(a)
        : oldestOf(a) - oldestOf(b))
  }, [pending, query, reasonFilter, sort])

  const shownReviewed = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = reviewed.filter(g => {
      if (reasonFilter && !g.reports.some(r => r.reason === reasonFilter)) return false
      return matchGroup(g, q)
    })
    // 처리 이력은 마지막 처리 시각 기준
    const key = (g: PostReportGroup) => Math.max(...g.reports.map(r => new Date(r.reviewedAt ?? r.createdAt).getTime()))
    return [...filtered].sort((a, b) =>
      sort === 'many' ? b.reports.length - a.reports.length
        : sort === 'new' ? key(b) - key(a)
        : key(a) - key(b))
  }, [reviewed, query, reasonFilter, sort])

  const shownHidden = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = hidden.filter(p =>
      q === '' || postTitle(p).toLowerCase().includes(q) || (p.content ?? '').toLowerCase().includes(q))
    const key = (p: CommunityPost) => new Date(p.createdAt).getTime()
    return [...filtered].sort((a, b) => sort === 'old' ? key(a) - key(b) : key(b) - key(a))
  }, [hidden, query, sort])

  // 첫 항목 자동 선택 — 상태로 두지 않고 파생값으로 구한다
  const selGroup = tab === 'pending'
    ? (shownPending.find(g => g.postId === selectedId) ?? shownPending[0] ?? null)
    : tab === 'reviewed'
      ? (shownReviewed.find(g => g.postId === selectedId) ?? shownReviewed[0] ?? null)
      : null
  const selHidden = tab === 'hidden'
    ? (shownHidden.find(p => p.id === selectedId) ?? shownHidden[0] ?? null)
    : null
  const detailPost = selGroup?.post ?? selHidden ?? null
  const detailPostId = detailPost?.id ?? null

  /* 이의제기는 선택한 글에 대해서만 가져온다. 요청한 글 id 는 ref 로 기억해
     같은 글을 다시 부르지 않는다(effect 안에서 setState 로 로딩 플래그를 세우지 않기 위해). */
  const [appeals, setAppeals] = useState<Record<string, PostAppeal[] | 'error'>>({})
  const askedAppeals = useRef<Set<string>>(new Set())
  useEffect(() => {
    const id = detailPostId
    if (!id || askedAppeals.current.has(id)) return
    askedAppeals.current.add(id)
    let alive = true
    getPostAppeals(id)
      .then(rows => { if (alive) setAppeals(prev => ({ ...prev, [id]: rows })) })
      .catch(() => { if (alive) setAppeals(prev => ({ ...prev, [id]: 'error' })) })
    return () => { alive = false }
  }, [detailPostId])

  const loading = tab === 'pending' ? pLoading : tab === 'reviewed' ? rLoading : hLoading
  const failed = tab === 'pending' ? pFailed : tab === 'reviewed' ? rFailed : hFailed
  const listCount = tab === 'pending' ? shownPending.length : tab === 'reviewed' ? shownReviewed.length : shownHidden.length

  /* 처리. 성공했을 때만 목록에서 뺀다 — 실패하면 대기열에 그대로 남아야 한다. */
  async function apply(action: PostReportAction) {
    if (!detailPost || busy) return
    const postId = detailPost.id
    setBusy(true)
    const res = await resolvePostReports(postId, action)
    setBusy(false)
    if (!res.ok) { toast(res.error ?? '처리에 실패했어요'); return }

    setConfirm(null)
    if (action === 'restore') {
      setHidden(prev => prev.filter(p => p.id !== postId))
      setPending(prev => prev.map(g => g.postId === postId && g.post
        ? { ...g, post: { ...g.post, status: 'active', hiddenBy: null } } : g))
      toast('글을 다시 공개했어요')
    } else {
      setPending(prev => prev.filter(g => g.postId !== postId))
      if (action === 'hide_and_resolve') {
        setHAsked(false); setHLoaded(-1)   // 숨김 글 목록은 다음에 열 때 새로 받는다
        toast(`글을 숨기고 신고 ${res.reports ?? 0}건을 처리했어요`)
      } else {
        toast(`신고 ${res.reports ?? 0}건을 반려했어요`)
      }
    }
    setRAsked(false); setRLoaded(-1)       // 처리 이력도 다음에 열 때 새로
    setSelectedId(null)
    onResolved?.()
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.h1}>게시글 신고</h1>
          <p className={styles.headSub}>신고된 글을 확인하고 공개 여부를 결정하세요</p>
        </div>
        <div className={styles.headRight}>
          {checkedAt && <span className={styles.updatedAt}>마지막 확인 {fmtTime(checkedAt)}</span>}
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={refresh} disabled={loading}>
            <AdminIcon name="refresh" size={16} />{loading ? '불러오는 중' : '새로고침'}
          </button>
        </div>
      </div>

      <div className={styles.summary}>
        <SumCard icon="flagPost" on={summary.reports > 0} label="미처리 신고" value={pLoading ? '—' : String(summary.reports)} />
        <SumCard icon="doc" on={summary.posts > 0} label="신고된 글" value={pLoading ? '—' : String(summary.posts)} />
        <SumCard icon="alert" on={summary.multi > 0} label="복수 신고 글" value={pLoading ? '—' : String(summary.multi)} />
      </div>

      <div className={styles.tabs} role="tablist" aria-label="게시글 신고 목록">
        {([['pending', '미처리 신고'], ['reviewed', '처리 이력'], ['hidden', '숨김 글']] as [TabId, string][]).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabOn : ''}`} onClick={() => openTab(id)}>
            {label}
            {id === 'pending' && !pLoading && pending.length > 0 && <span className={styles.tabCount}>{pending.length}</span>}
            {id === 'hidden' && hAsked && !hLoading && hidden.length > 0 && <span className={styles.tabCount}>{hidden.length}</span>}
          </button>
        ))}
      </div>

      <div className={styles.split}>
        <section className={styles.card}>
          <div className={styles.listHead}>
            <h2 className={styles.listTitle}>
              {tab === 'pending' ? '미처리 신고' : tab === 'reviewed' ? '처리 이력' : '숨김 글'}
            </h2>
            <span className={styles.listCount}>{loading ? '—' : `${listCount}건`}</span>
          </div>
          <div className={styles.tools}>
            <span className={styles.searchWrap}>
              <span className={styles.searchIcon}><AdminIcon name="search" size={17} /></span>
              <input className={styles.search} value={query} onChange={e => setQuery(e.target.value)}
                placeholder={tab === 'hidden' ? '글 제목 또는 내용' : '글 제목, 내용 또는 신고 내용'}
                aria-label="검색" />
            </span>
            {tab !== 'hidden' && (
              <select className={styles.select} value={reasonFilter} onChange={e => setReasonFilter(e.target.value)} aria-label="신고 사유 필터">
                <option value="">신고 사유 전체</option>
                {REPORT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            )}
            <select className={styles.select} value={sort} onChange={e => setSort(e.target.value as SortId)} aria-label="정렬">
              <option value="old">오래된 순</option>
              <option value="new">최근 순</option>
              {tab !== 'hidden' && <option value="many">신고 많은 순</option>}
            </select>
          </div>

          {loading ? (
            [0, 1, 2].map(i => (
              <div key={i} className={styles.skelRow}>
                <div className={styles.skel} style={{ width: 46, height: 46 }} />
                <div style={{ flex: 1 }}>
                  <div className={styles.skel} style={{ width: '55%', height: 14, marginBottom: 7 }} />
                  <div className={styles.skel} style={{ width: '35%', height: 11 }} />
                </div>
              </div>
            ))
          ) : failed ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="alert" size={32} /></span>
              <strong className={styles.stateStrong}>목록을 불러오지 못했어요</strong>
              <p className={styles.stateDesc}>잠시 후 다시 시도해주세요.</p>
              <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.stateBtn}`} onClick={refresh}>다시 시도</button>
            </div>
          ) : listCount === 0 ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="approve" size={34} /></span>
              {query.trim() !== '' || reasonFilter !== '' ? (
                <>
                  <strong className={styles.stateStrong}>검색 결과가 없습니다</strong>
                  <p className={styles.stateDesc}>다른 검색어나 신고 사유로 찾아보세요.</p>
                </>
              ) : tab === 'pending' ? (
                <>
                  <strong className={styles.stateStrong}>처리할 게시글 신고가 없습니다</strong>
                  <p className={styles.stateDesc}>
                    새로운 신고가 접수되면 이곳에 표시됩니다.
                    {checkedAt && <><br />마지막 확인 {fmtTime(checkedAt)}</>}
                  </p>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.stateBtn}`} onClick={refresh} disabled={loading}>새로고침</button>
                </>
              ) : tab === 'reviewed' ? (
                <>
                  <strong className={styles.stateStrong}>처리한 신고가 없습니다</strong>
                  <p className={styles.stateDesc}>반려하거나 조치한 신고가 이곳에 쌓입니다.</p>
                </>
              ) : (
                <>
                  <strong className={styles.stateStrong}>숨김 처리된 글이 없습니다</strong>
                  <p className={styles.stateDesc}>자동 숨김되거나 관리자가 숨긴 글이 이곳에 표시됩니다.</p>
                </>
              )}
            </div>
          ) : tab === 'hidden' ? (
            <div className={styles.rows}>
              {shownHidden.map(p => (
                <button key={p.id} type="button" aria-current={selHidden?.id === p.id ? 'true' : undefined}
                  className={`${styles.row} ${selHidden?.id === p.id ? styles.rowOn : ''}`}
                  onClick={() => { setSelectedId(p.id); setMobileOpen(true) }}>
                  <Thumb src={p.images[0] ?? null} />
                  <span className={styles.rowBody}>
                    <span className={styles.rowTop}>
                      <span className={styles.rowName}>{postTitle(p)}</span>
                      <span className={`${styles.badge} ${styles.badgeHidden}`}>{hiddenByLabel(p.hiddenBy)}</span>
                    </span>
                    <span className={styles.rowMeta}>
                      {BOARD_LABEL[p.board] ?? p.board} · {p.author?.nickname ?? '알 수 없음'} · 작성 {fmtDate(p.createdAt)}
                    </span>
                    {p.hiddenReason && (
                      <span className={styles.rowFlags}>
                        <span className={`${styles.badge} ${styles.badgeReason}`}>{reasonLabel(p.hiddenReason)}</span>
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.rows}>
              {(tab === 'pending' ? shownPending : shownReviewed).map(g => {
                const on = selGroup?.postId === g.postId
                const reasons = countReasons(g.reports)
                const resolvedCount = g.reports.filter(r => r.status === 'resolved').length
                return (
                  <button key={g.postId} type="button" aria-current={on ? 'true' : undefined}
                    className={`${styles.row} ${on ? styles.rowOn : ''}`}
                    onClick={() => { setSelectedId(g.postId); setMobileOpen(true) }}>
                    <Thumb src={g.post?.images[0] ?? null} />
                    <span className={styles.rowBody}>
                      <span className={styles.rowTop}>
                        <span className={styles.rowName}>{postTitle(g.post)}</span>
                        {tab === 'pending' ? (
                          <span className={`${styles.badge} ${styles.badgePending}`}>미처리 {g.reports.length}건</span>
                        ) : (
                          <span className={`${styles.badge} ${resolvedCount > 0 ? styles.badgeResolved : styles.badgeDismissed}`}>
                            {resolvedCount > 0 ? '조치 완료' : '반려'} {g.reports.length}건
                          </span>
                        )}
                      </span>
                      <span className={styles.rowMeta}>
                        {BOARD_LABEL[g.post?.board ?? ''] ?? '게시판 미상'} · {g.post?.author?.nickname ?? '알 수 없음'}
                        {tab === 'pending'
                          ? <> · 최초 접수 {fmtDate(g.reports[0].createdAt)}</>
                          : <> · 처리 {fmtDate(g.reports[g.reports.length - 1].reviewedAt)}</>}
                      </span>
                      <span className={styles.rowFlags}>
                        {reasons.slice(0, 2).map(([reason, cnt]) => (
                          <span key={reason} className={`${styles.badge} ${styles.badgeReason}`}>{reasonLabel(reason)} {cnt}</span>
                        ))}
                        {g.post?.status === 'hidden' && <span className={`${styles.badge} ${styles.badgeHidden}`}>숨김</span>}
                        {tab === 'pending' && g.reports.length >= 2 && <span className={`${styles.badge} ${styles.badgeMulti}`}>복수 신고</span>}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className={`${styles.card} ${styles.detailPanel} ${mobileOpen ? '' : styles.detailPanelHidden}`}>
          {detailPost || selGroup ? (
            <div>
              <div className={styles.mobileBar}>
                <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => setMobileOpen(false)}>
                  <AdminIcon name="chevron" size={15} style={{ transform: 'rotate(180deg)' }} /> 목록으로
                </button>
              </div>
              <DetailPanel
                tab={tab}
                post={detailPost}
                reports={selGroup?.reports ?? []}
                pendingOnPost={tab === 'hidden' && selHidden
                  ? (pending.find(g => g.postId === selHidden.id)?.reports.length ?? 0) : 0}
                appeals={detailPostId ? appeals[detailPostId] : undefined}
                busy={busy}
                onAsk={setConfirm}
              />
            </div>
          ) : !loading && !failed ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="flagPost" size={32} /></span>
              <strong className={styles.stateStrong}>
                {tab === 'hidden' ? '숨김 글을 선택하세요' : '검토할 신고를 선택하세요'}
              </strong>
              <p className={styles.stateDesc}>왼쪽 목록에서 글을 고르면 내용과 접수된 신고가 표시됩니다.</p>
            </div>
          ) : null}
        </section>
      </div>

      {confirm && detailPost && (
        <ConfirmModal
          action={confirm}
          post={detailPost}
          pendingCount={selGroup?.reports.length ?? 0}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => apply(confirm)}
        />
      )}

      {msg && <div className={styles.toast} role="status">{msg}</div>}
    </div>
  )
}

function Thumb({ src }: { src: string | null }) {
  if (!src) return <span className={styles.thumbEmpty}><AdminIcon name="doc" size={20} /></span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={styles.thumb} />
}

function SumCard({ icon, on, label, value }: { icon: AdminIconName; on: boolean; label: string; value: string }) {
  return (
    <div className={styles.sumCard}>
      <span className={styles.sumIcon} style={{ background: on ? 'rgba(245,177,0,.14)' : 'var(--surface2)' }}>
        <AdminIcon name={icon} size={20} color={on ? '#A87A00' : 'var(--muted)'} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className={styles.sumLabel}>{label}</div>
        <div className={styles.sumValue}>{value}</div>
      </div>
    </div>
  )
}

/* ── 상세 ───────────────────────────────────────────────── */
function DetailPanel({ tab, post, reports, pendingOnPost, appeals, busy, onAsk }: {
  tab: TabId
  post: CommunityPost | null
  reports: PostReportRow[]
  pendingOnPost: number
  appeals: PostAppeal[] | 'error' | undefined
  busy: boolean
  onAsk: (a: PostReportAction) => void
}) {
  if (!post) {
    return (
      <div className={styles.state}>
        <span className={styles.stateIcon}><AdminIcon name="alert" size={32} /></span>
        <strong className={styles.stateStrong}>글을 찾을 수 없습니다</strong>
        <p className={styles.stateDesc}>이미 삭제된 글일 수 있습니다.</p>
      </div>
    )
  }

  const isHidden = post.status === 'hidden'
  const reasons = countReasons(reports)
  const lastReviewed = reports.length > 0 ? reports[reports.length - 1] : null

  return (
    <div className={styles.detail}>
      {/* 1. 글 개요 */}
      <div className={styles.detailHead}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.detailTitleRow}>
            <span className={`${styles.badge} ${styles.badgeBoard}`}>{BOARD_LABEL[post.board] ?? post.board}</span>
            <span className={`${styles.badge} ${isHidden ? styles.badgeHidden : styles.badgeOpen}`}>
              {isHidden ? hiddenByLabel(post.hiddenBy) : '공개 중'}
            </span>
            {tab === 'pending' && reports.length > 0 && (
              <span className={`${styles.badge} ${styles.badgePending}`}>미처리 {reports.length}건</span>
            )}
          </div>
          <div className={styles.detailTitle}>{postTitle(post)}</div>
          <div className={styles.detailMeta}>
            {post.work?.name ? `${post.work.name} · ` : ''}작성 {fmtDateTime(post.createdAt)}
          </div>
        </div>
        {!isHidden && (
          <Link href={`/community/${post.id}`} target="_blank" rel="noopener noreferrer" className={styles.postLink}>
            글 보기 (새 탭) <AdminIcon name="external" size={13} />
          </Link>
        )}
      </div>

      {isHidden && (
        <div className={styles.notice} role="status">
          <AdminIcon name="alert" size={15} />
          이미 숨김 상태입니다{post.hiddenBy === 'auto' ? ' (신고 누적으로 자동 숨김)' : ''}. 사이트에서는 보이지 않습니다.
        </div>
      )}

      {/* 2. 글 원문 — 전부 사용자 입력이라 일반 텍스트로만 그린다 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>글 내용</div>
        <div className={styles.postBox}>
          <div className={styles.postAuthor}>
            {post.author?.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={post.author.avatarUrl} alt="" className={styles.avatar} />
              : <span className={styles.avatarEmpty}><AdminIcon name="member" size={16} /></span>}
            <div style={{ minWidth: 0 }}>
              <div className={styles.authorName}>{post.author?.nickname ?? '알 수 없음'}</div>
              <div className={styles.authorMeta}>작성자</div>
            </div>
          </div>
          {post.content?.trim()
            ? <div className={styles.postText}>{post.content}</div>
            : <div className={styles.postTextEmpty}>본문 없음</div>}
          {post.images.length > 0 && (
            <div className={styles.postImages}>
              {post.images.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`첨부 이미지 ${i + 1}`} className={styles.postImage} />
                </a>
              ))}
            </div>
          )}
          <div className={styles.postStats}>
            <span>좋아요 {post.likeCount}</span>
            <span>댓글 {post.commentCount}</span>
            <span>조회 {post.viewCount}</span>
            {post.isSpoiler && <span>스포일러 표시됨</span>}
          </div>
        </div>
      </div>

      {/* 3. 접수된 신고 — 신고자는 표시하지 않는다 */}
      {reports.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            {tab === 'pending' ? `접수된 미처리 신고 ${reports.length}건` : `처리한 신고 ${reports.length}건`}
          </div>
          <div className={styles.reasonSummary} style={{ marginBottom: 12 }}>
            {reasons.map(([reason, cnt]) => (
              <span key={reason} className={`${styles.badge} ${styles.badgeReason}`}>{reasonLabel(reason)} {cnt}</span>
            ))}
          </div>
          <div className={styles.reportList}>
            {reports.map((r, i) => (
              <div key={r.id} className={styles.reportCard}>
                <div className={styles.reportTop}>
                  <span className={styles.reportNo}>{i + 1}</span>
                  <div className={styles.reportBody}>
                    <div className={styles.reportReason}>{reasonLabel(r.reason)}</div>
                    {r.content?.trim() && <div className={styles.reportContent}>{r.content}</div>}
                    <div className={styles.reportMeta}>접수 {fmtDateTime(r.createdAt)}</div>
                  </div>
                  <span className={`${styles.badge} ${
                    r.status === 'pending' ? styles.badgePending
                      : r.status === 'resolved' ? styles.badgeResolved : styles.badgeDismissed}`}>
                    {r.status === 'pending' ? '미처리' : r.status === 'resolved' ? '조치 완료' : '반려'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. 처리 기록 (처리 이력 탭) */}
      {tab === 'reviewed' && lastReviewed && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>처리 기록</div>
          <div className={styles.infoBox}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>처리 결과</span>
              <span className={styles.infoValue}>
                {reports.some(r => r.status === 'resolved') ? '글 숨김 조치' : '신고 반려'}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>처리한 관리자</span>
              {lastReviewed.reviewer
                ? <span className={styles.infoValue}>{lastReviewed.reviewer.nickname}</span>
                : <span className={styles.infoEmpty}>알 수 없음 (탈퇴한 계정)</span>}
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>처리 시각</span>
              {lastReviewed.reviewedAt
                ? <span className={styles.infoValue}>{fmtDateTime(lastReviewed.reviewedAt)}</span>
                : <span className={styles.infoEmpty}>기록 없음</span>}
            </div>
          </div>
        </div>
      )}

      {/* 5. 숨김 정보 (숨김 글 탭) */}
      {tab === 'hidden' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>숨김 정보</div>
          <div className={styles.infoBox}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>숨긴 주체</span>
              <span className={styles.infoValue}>{hiddenByLabel(post.hiddenBy)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>숨김 사유</span>
              {post.hiddenReason
                ? <span className={styles.infoValue}>{reasonLabel(post.hiddenReason)}</span>
                : <span className={styles.infoEmpty}>기록 없음 (관리자 판단으로 숨긴 글은 사유를 남기지 않습니다)</span>}
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>미처리 신고</span>
              <span className={pendingOnPost > 0 ? styles.infoValue : styles.infoEmpty}>
                {pendingOnPost > 0 ? `${pendingOnPost}건 (미처리 신고 탭에서 처리)` : '없음'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. 이의제기 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>작성자 이의제기</div>
        {appeals === undefined ? (
          <p className={styles.stateDesc}>불러오는 중…</p>
        ) : appeals === 'error' ? (
          <p className={styles.stateDesc}>이의제기를 불러오지 못했어요.</p>
        ) : appeals.length === 0 ? (
          <p className={styles.stateDesc}>접수된 이의제기가 없습니다.</p>
        ) : (
          appeals.map(ap => <AppealCard key={ap.id} appeal={ap} />)
        )}
      </div>

      {/* 7. 처리 작업 */}
      <div className={styles.actions}>
        {tab === 'reviewed' ? (
          <p className={styles.actionsNote}>
            이미 처리한 신고입니다. 글을 다시 공개하려면 <b>숨김 글</b> 탭에서 처리해주세요.
          </p>
        ) : tab === 'hidden' ? (
          <>
            <p className={styles.actionsNote}>
              다시 공개해도 과거 신고의 처리 상태는 바뀌지 않습니다.
              {pendingOnPost > 0 && ' 이 글에는 미처리 신고가 남아 있습니다.'}
            </p>
            <div className={styles.actionsBtns}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => onAsk('restore')} disabled={busy}>
                다시 공개
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.actionsNote}>
              {isHidden
                ? '이미 숨겨진 글입니다. 처리하면 글 상태는 그대로 두고 신고만 정리합니다.'
                : '숨기면 사이트에서 보이지 않지만 삭제되지는 않습니다. 언제든 다시 공개할 수 있습니다.'}
            </p>
            <div className={styles.actionsBtns}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => onAsk('dismiss')} disabled={busy || reports.length === 0}>
                신고 반려
              </button>
              <button type="button" className={`${styles.btn} ${isHidden ? styles.btnDone : styles.btnWarn}`}
                onClick={() => onAsk('hide_and_resolve')} disabled={busy || reports.length === 0}>
                {isHidden ? '숨김 유지하고 처리' : '글 숨기고 처리'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AppealCard({ appeal }: { appeal: PostAppeal }) {
  const original = safeHttpUrl(appeal.originalUrl)
  return (
    <div className={styles.appealCard}>
      {appeal.message?.trim() && <div className={styles.appealMsg}>{appeal.message}</div>}
      {appeal.originalUrl && (
        <div className={styles.appealRow}>
          원본:{' '}
          {original
            ? <a href={original} target="_blank" rel="noopener noreferrer" className={styles.appealLink}>{appeal.originalUrl}</a>
            : <span className={styles.appealPlain}>{appeal.originalUrl} (열 수 없는 주소)</span>}
        </div>
      )}
      {appeal.snsLinks.length > 0 && (
        <div className={styles.appealRow}>
          SNS:{' '}
          {appeal.snsLinks.map((raw, i) => {
            const safe = safeHttpUrl(raw)
            return (
              <span key={i} style={{ marginRight: 10 }}>
                {safe
                  ? <a href={safe} target="_blank" rel="noopener noreferrer" className={styles.appealLink}>{raw}</a>
                  : <span className={styles.appealPlain}>{raw} (열 수 없는 주소)</span>}
              </span>
            )
          })}
        </div>
      )}
      {appeal.proofImages.length > 0 && (
        <div className={styles.appealImages}>
          {appeal.proofImages.map((src, i) => (
            <a key={i} href={src} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`증빙 ${i + 1}`} className={styles.appealImage} />
            </a>
          ))}
        </div>
      )}
      <div className={styles.appealRow}>접수 {fmtDateTime(appeal.createdAt)}</div>
    </div>
  )
}

/* ── 확인 모달 ─────────────────────────────────────────────
   ESC 닫기, 초기 포커스, Tab 순환, 닫을 때 포커스 복귀.
   onCancel 을 의존성에 넣지 않는다 — 부모가 인라인 함수를 넘기면 매 렌더 effect 가
   다시 돌아 focus() 가 재실행되고, 한글 조합 중이면 글자가 깨진다. */
function ConfirmModal({ action, post, pendingCount, busy, onCancel, onConfirm }: {
  action: PostReportAction
  post: CommunityPost
  pendingCount: number
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)
  const cancelRef = useRef(onCancel)
  useEffect(() => { cancelRef.current = onCancel })

  useEffect(() => {
    openerRef.current = document.activeElement
    const box = boxRef.current
    box?.querySelector<HTMLElement>('[data-autofocus], button')?.focus()

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cancelRef.current(); return }
      if (e.key !== 'Tab' || !box) return
      const items = box.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, textarea, a[href], [tabindex]:not([tabindex="-1"])')
      if (items.length === 0) return
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      ;(openerRef.current as HTMLElement | null)?.focus?.()
    }
  }, [])

  const isHidden = post.status === 'hidden'
  const spec = action === 'dismiss'
    ? {
      title: '이 글의 신고를 반려할까요?',
      confirm: '신고 반려',
      cls: styles.btnGhost,
      desc: `미처리 신고 ${pendingCount}건이 모두 반려 처리됩니다. 글 공개 상태는 바뀌지 않습니다.`,
    }
    : action === 'hide_and_resolve'
      ? {
        title: isHidden ? '숨김을 유지하고 처리할까요?' : '이 글을 숨기고 처리할까요?',
        confirm: isHidden ? '숨김 유지하고 처리' : '글 숨기고 처리',
        cls: isHidden ? styles.btnDone : styles.btnWarn,
        desc: isHidden
          ? `글은 이미 숨김 상태라 그대로 두고, 미처리 신고 ${pendingCount}건만 조치 완료로 기록합니다.`
          : `글이 사이트에서 보이지 않게 되고 미처리 신고 ${pendingCount}건이 조치 완료로 기록됩니다. 삭제되지 않으며 숨김 글 탭에서 다시 공개할 수 있습니다.`,
      }
      : {
        title: '이 글을 다시 공개할까요?',
        confirm: '다시 공개',
        cls: styles.btnGhost,
        desc: '글이 사이트에 다시 보입니다. 과거 신고의 처리 상태는 바뀌지 않습니다.',
      }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div ref={boxRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="post-report-modal-title"
        onClick={e => e.stopPropagation()}>
        <h2 id="post-report-modal-title" className={styles.modalTitle}>{spec.title}</h2>
        <p className={styles.modalBody}>
          <b>{postTitle(post)}</b>
          <span style={{ color: 'var(--muted)' }}> · {BOARD_LABEL[post.board] ?? post.board}</span>
        </p>
        <p className={styles.modalMuted}>{spec.desc}</p>
        <div className={styles.modalActs}>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onCancel} disabled={busy}>취소</button>
          <button type="button" data-autofocus className={`${styles.btn} ${spec.cls}`} onClick={onConfirm} disabled={busy}>
            {busy ? '처리 중…' : spec.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
