'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getAdminMembers, getMemberDetail, getMemberItems, getMemberSignupSource,
  getMemberBadges, getManualBadges, setMemberRole, saveAdminNote, setBetaTester,
  grantBadge, grantExp,
  ROLE_LABEL,
  AdminMember, MemberDetail, MemberItem, MemberItemKind, MemberSignupSource,
  MemberBadge, ManualBadge, MemberRole, MemberSort, MemberRoleFilter, MemberStatusFilter,
} from '@/services/adminMemberService'
import { getAdminStats, AdminStats } from '@/services/adminDashboardService'
import AdminIcon, { AdminIconName } from './AdminIcon'
import AdminConfirmModal from './AdminConfirmModal'
import styles from './memberAdmin.module.css'

/* 관리자 > 회원 관리.

   조회는 전부 관리자 전용 security definer RPC 를 거친다.
   목록  get_admin_members       검색·역할·상태 필터·정렬·페이지네이션을 서버에서 처리
   상세  get_member_detail       활동 카운트·EXP·메모까지 한 번에
   유입  get_member_signup_source
   활동  get_member_items        타일을 누른 종류만 그때 조회한다(상세 열 때 몰아 받지 않는다)

   ⚠️ 정지(1일·7일·영구·해제) 버튼은 일부러 넣지 않았다.
      status='suspended' 를 참조하는 코드가 관리자 화면 밖에 한 줄도 없다.
      middleware 는 /profile/settings 의 로그인 여부만 보고 RLS 정책에도 status
      조건이 없어서, 정지해도 로그인·글쓰기가 그대로 된다.
      실제로 아무것도 막지 못하는 버튼을 "정지"라고 부르면 관리자가 조치했다고
      오해한다. 기존 정지 데이터는 읽기 전용으로만 표시한다.
      실제 제재(세션·요청 차단·RLS·만료 처리)는 별도 후속 작업이다.

   ⚠️ 관리 이력 타임라인도 넣지 않았다. 감사 로그 테이블이 없다.
      exp_logs 와 배지 awarded_by 만으로 전체 이력인 것처럼 보이게 하지 않는다. */

const PAGE_SIZE = 20
const NOTE_MAX = 500

const ROLE_OPTIONS: { v: MemberRole; l: string }[] = [
  { v: 'user', l: '일반 회원' },
  { v: 'admin', l: '관리자' },
]

/* profiles_role_check 는 manager 도 허용하지만 실제 데이터가 0건이고 제품에서
   의미가 정의된 적이 없어 제외했다. 사장님(owner)은 애초에 DB 가 거부하는 값이었고
   shops.owner_id / is_claimed 로 관리되는 별개 개념이다. */
const roleLabel = (r: string) => ROLE_LABEL[r] ?? r

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
const hasText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
function errText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return '알 수 없는 오류'
}

/** 며칠 전 / 오늘 처럼 대략의 시각. 없는 값을 지어내지 않는다. */
function relTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const days = Math.floor((Date.now() - t) / 86400000)
  if (days <= 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 30) return `${days}일 전`
  return fmtDate(iso)
}

/** 유입 URL 은 사용자 브라우저가 준 값이다. http(s) 만 링크로 연다. */
function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = new globalThis.URL(raw.trim())
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null
  } catch { return null }
}

/* 상태 표시. 실제 status·suspended_until 로만 판단하고, 클라이언트가 임의로
   정상화해서 저장하지 않는다. 만료된 정지를 자동 해제하는 잡이 없어서
   기간이 지나도 status 는 suspended 로 남는다 — 그대로 구분해서 보여준다. */
function statusView(status: string, until: string | null): { label: string; cls: string } {
  if (status !== 'suspended') {
    if (status === 'active') return { label: '정상', cls: styles.badgeActive }
    return { label: status, cls: styles.badgeNeutral }
  }
  if (!until) return { label: '영구 정지', cls: styles.badgeSuspended }
  const t = new Date(until).getTime()
  if (Number.isNaN(t)) return { label: '정지', cls: styles.badgeSuspended }
  if (t <= Date.now()) return { label: '정지 · 기간 만료', cls: styles.badgeSuspended }
  const left = Math.ceil((t - Date.now()) / 86400000)
  return { label: `정지 · D-${left}`, cls: styles.badgeSuspended }
}

const shortUid = (id: string) => id.slice(0, 8)

export default function MemberAdminTab() {
  const { user } = useAuth()

  // ── 목록 조건 ──
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<MemberRoleFilter>(null)
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>(null)
  const [sort, setSort] = useState<MemberSort>('recent')
  const [page, setPage] = useState(0)
  const [reload, setReload] = useState(0)

  // ── 목록 결과 ──
  const [members, setMembers] = useState<AdminMember[]>([])
  const [total, setTotal] = useState(0)
  const [listError, setListError] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  const key = `${search}|${roleFilter ?? ''}|${statusFilter ?? ''}|${sort}|${page}|${reload}`
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loading = loadedKey !== key

  // ── 요약 ──
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsFailed, setStatsFailed] = useState(false)

  const [picked, setPicked] = useState<AdminMember | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  // 저장하지 않은 메모가 있는지. 상세가 알려주고, 회원을 바꿀 때 여기서 막는다.
  const dirtyRef = useRef(false)
  const [pendingNav, setPendingNav] = useState<{ run: () => void } | null>(null)

  /* 검색은 입력하는 대로 걸린다(300ms 디바운스). 엔터를 기다리지 않고,
     지우면 곧바로 전체 목록으로 돌아온다.
     setState 가 setTimeout 콜백 안이라 렌더 중 동기 setState 가 아니다. */
  useEffect(() => {
    const t = setTimeout(() => { setSearch(query.trim()); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [query])

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
    getAdminMembers({
      search, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
      roleFilter, statusFilter, sort,
    })
      .then(res => {
        if (!alive) return
        setMembers(res.members); setTotal(res.total)
        setListError(null); setLoadedKey(key); setCheckedAt(new Date())
      })
      .catch(e => {
        if (!alive) return
        console.error('[회원 관리] 목록 조회 실패:', e)
        setMembers([]); setTotal(0); setListError(errText(e)); setLoadedKey(key)
      })
    return () => { alive = false }
  }, [key, search, page, roleFilter, statusFilter, sort])

  useEffect(() => {
    let alive = true
    getAdminStats()
      .then(s => { if (alive) { setStats(s); setStatsFailed(false) } })
      .catch(e => {
        if (!alive) return
        console.error('[회원 관리] 요약 조회 실패:', e)
        setStatsFailed(true)
      })
    return () => { alive = false }
  }, [reload])

  /* 저장 안 한 메모가 있으면 이동 전에 확인한다.
     확인 모달을 닫으면 현재 회원과 입력값이 그대로 남는다. */
  function guarded(run: () => void) {
    if (dirtyRef.current) { setPendingNav({ run }); return }
    run()
  }

  /* 고른 회원은 객체로 들고 있는다. 목록이 검색·필터로 바뀌어도 보고 있던 회원이
     갑자기 다른 사람으로 바뀌지 않는다(작성 중인 메모가 조용히 사라지는 것을 막는다).
     아직 아무도 안 골랐으면 첫 회원을 자동으로 보여준다. 결과가 없으면 아무도 안 고른다. */
  const selected = picked ?? members[0] ?? null
  const effectiveId = selected?.id ?? null

  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min(total, (page + 1) * PAGE_SIZE)
  const filtered = search.trim() !== '' || roleFilter !== null || statusFilter !== null

  /* 조건이 바뀌면 첫 페이지로 돌아간다.
     보고 있던 회원은 위에서 객체로 고정돼 있어 목록이 바뀌어도 유지된다.
     그래서 여기서는 메모 dirty 확인을 하지 않는다 — 타이핑 중에 모달이 뜨면 안 된다. */
  const changeCond = (fn: () => void) => { fn(); setPage(0) }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.h1}>회원 관리</h1>
          <p className={styles.headSub}>회원 정보와 활동, 권한 상태를 확인하고 관리하세요</p>
        </div>
        <div className={styles.headRight}>
          <span className={styles.headCount}>
            {statsFailed ? '전체 —명' : stats ? `전체 ${stats.members.toLocaleString()}명` : '전체 …'}
          </span>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => { if (!loading) setReload(k => k + 1) }} disabled={loading}>
            <AdminIcon name="refresh" size={16} />{loading ? '불러오는 중' : '새로고침'}
          </button>
        </div>
      </div>

      {/* 요약은 기존 get_dashboard_stats 에서 안전하게 오는 두 개만 쓴다.
          정상·정지 회원 수는 전용 count 가 없어 넣지 않았다.
          전체 목록을 받아와 클라이언트에서 세는 방식은 쓰지 않는다. */}
      <div className={styles.summary}>
        <SumCard icon="member" label="전체 회원"
          value={statsFailed ? '—' : stats ? stats.members.toLocaleString() : '…'} />
        <SumCard icon="userPlus" label="오늘 가입"
          value={statsFailed ? '—' : stats ? stats.newMembersToday.toLocaleString() : '…'} />
      </div>

      <div className={styles.split}>
        {/* ── 목록 ── */}
        <section className={styles.card}>
          <div className={styles.listHead}>
            <h2 className={styles.listTitle}>회원 목록</h2>
            <span className={styles.listCount}>
              {loading ? '—' : listError ? '' : `${total.toLocaleString()}명`}
            </span>
          </div>

          <div className={styles.tools}>
            <span className={styles.searchWrap}>
              <span className={styles.searchIcon}><AdminIcon name="search" size={17} /></span>
              <input className={styles.search} value={query} type="search"
                onChange={e => setQuery(e.target.value)}
                placeholder="닉네임 검색" aria-label="닉네임으로 회원 검색" />
            </span>
            <select className={styles.select} value={roleFilter ?? ''} aria-label="역할 필터"
              onChange={e => changeCond(() => setRoleFilter((e.target.value || null) as MemberRoleFilter))}>
              <option value="">역할 전체</option>
              <option value="user">일반 회원</option>
              <option value="admin">관리자</option>
            </select>
            <select className={styles.select} value={statusFilter ?? ''} aria-label="상태 필터"
              onChange={e => changeCond(() => setStatusFilter((e.target.value || null) as MemberStatusFilter))}>
              <option value="">상태 전체</option>
              <option value="active">정상</option>
              <option value="suspended">정지</option>
            </select>
            <select className={styles.select} value={sort} aria-label="정렬"
              onChange={e => changeCond(() => setSort(e.target.value as MemberSort))}>
              <option value="recent">최근 가입순</option>
              <option value="oldest">오래된 가입순</option>
              <option value="nickname">닉네임순</option>
            </select>
          </div>

          {loading ? (
            [0, 1, 2, 3].map(i => (
              <div key={i} className={styles.skelRow}>
                <div className={styles.skelAvatar} />
                <div style={{ flex: 1 }}>
                  <div className={styles.skel} style={{ width: '50%', height: 13, marginBottom: 6 }} />
                  <div className={styles.skel} style={{ width: '30%', height: 11 }} />
                </div>
              </div>
            ))
          ) : listError ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="alert" size={32} /></span>
              <strong className={styles.stateStrong}>회원 목록을 불러오지 못했어요</strong>
              <p className={styles.stateDesc}>{listError}</p>
              <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.stateBtn}`}
                onClick={() => setReload(k => k + 1)}>다시 시도</button>
            </div>
          ) : members.length === 0 ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="member" size={32} /></span>
              {filtered ? (
                <>
                  <strong className={styles.stateStrong}>조건에 맞는 회원이 없습니다</strong>
                  <p className={styles.stateDesc}>검색어나 필터를 바꿔보세요.</p>
                </>
              ) : (
                <>
                  <strong className={styles.stateStrong}>아직 회원이 없습니다</strong>
                  <p className={styles.stateDesc}>
                    가입이 생기면 이곳에 표시됩니다.
                    {checkedAt && <><br />마지막 확인 {fmtTime(checkedAt)}</>}
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className={styles.rows}>
                {members.map(m => {
                  const on = effectiveId === m.id
                  const st = statusView(m.status, m.suspended_until)
                  return (
                    <button key={m.id} type="button" aria-current={on ? 'true' : undefined}
                      className={`${styles.row} ${on ? styles.rowOn : ''}`}
                      onClick={() => guarded(() => { setPicked(m); setMobileOpen(true) })}>
                      <Avatar url={m.avatar_url} />
                      <span className={styles.rowMain}>
                        <span className={styles.rowTop}>
                          <span className={styles.rowName}>{m.nickname || '(닉네임 없음)'}</span>
                          <span className={`${styles.badge} ${m.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}`}>
                            {roleLabel(m.role)}
                          </span>
                          <span className={`${styles.badge} ${st.cls}`}>{st.label}</span>
                        </span>
                        <span className={styles.rowMeta}>{shortUid(m.id)}</span>
                      </span>
                      <span className={styles.rowDate}>{fmtDate(m.created_at)}</span>
                    </button>
                  )
                })}
              </div>

              <div className={styles.pager}>
                <span className={styles.pagerInfo}>
                  {from}–{to} / {total.toLocaleString()}
                </span>
                <span className={styles.pagerBtns}>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                    disabled={page === 0}
                    onClick={() => guarded(() => setPage(p => Math.max(0, p - 1)))}>이전</button>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                    disabled={page >= maxPage}
                    onClick={() => guarded(() => setPage(p => Math.min(maxPage, p + 1)))}>다음</button>
                </span>
              </div>
            </>
          )}
        </section>

        {/* ── 상세 ── */}
        <section className={`${styles.card} ${styles.detailPanel} ${mobileOpen ? '' : styles.detailPanelHidden}`}>
          {selected ? (
            <div>
              <div className={styles.mobileBar}>
                <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                  onClick={() => guarded(() => setMobileOpen(false))}>
                  <AdminIcon name="chevron" size={15} style={{ transform: 'rotate(180deg)' }} /> 목록으로
                </button>
              </div>
              {/* key 로 새 마운트 → 회원을 바꾸면 메모·역할·EXP·펼친 목록·배지 선택이
                  effect 없이 전부 초기화된다. 이전 회원 값이 새 회원에게 보이지 않는다. */}
              <MemberDetailPanel
                key={selected.id}
                member={selected}
                isSelf={user?.id === selected.id}
                onToast={toast}
                onDirtyChange={v => {
                  dirtyRef.current = v
                  // 메모를 쓰기 시작하면 그 회원을 고정한다.
                  // 자동 선택 상태로 두면 검색·필터로 목록이 바뀔 때 화면이 넘어가 버린다.
                  if (v && !picked) setPicked(selected)
                }}
                onRoleChanged={() => setReload(k => k + 1)}
              />
            </div>
          ) : !loading && !listError ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="member" size={32} /></span>
              <strong className={styles.stateStrong}>회원을 선택하세요</strong>
              <p className={styles.stateDesc}>왼쪽 목록에서 회원을 고르면 정보와 활동이 표시됩니다.</p>
            </div>
          ) : null}
        </section>
      </div>

      {pendingNav && (
        <AdminConfirmModal
          labelledById="member-dirty-title"
          title="저장하지 않은 메모가 있어요"
          description="이동하면 작성 중인 관리자 메모가 사라집니다. 계속 편집하려면 취소를 누르세요."
          cancelLabel="계속 편집"
          confirmLabel="변경사항 버리고 이동"
          tone="danger"
          onCancel={() => setPendingNav(null)}
          onConfirm={() => { dirtyRef.current = false; pendingNav.run(); setPendingNav(null) }}
        />
      )}

      {msg && <div className={styles.toast} role="status">{msg}</div>}
    </div>
  )
}

function Avatar({ url, large }: { url: string | null; large?: boolean }) {
  return (
    <span className={`${styles.avatar} ${large ? styles.avatarLg : ''}`}>
      {url
        ? <img src={url} alt="" />
        : <AdminIcon name="member" size={large ? 26 : 18} />}
    </span>
  )
}

function SumCard({ icon, label, value }: { icon: AdminIconName; label: string; value: string }) {
  return (
    <div className={styles.sumCard}>
      <span className={styles.sumIcon}><AdminIcon name={icon} size={20} color="var(--muted)" /></span>
      <div style={{ minWidth: 0 }}>
        <div className={styles.sumLabel}>{label}</div>
        <div className={styles.sumValue}>{value}</div>
      </div>
    </div>
  )
}

/* ── 상세 ─────────────────────────────────────────────────── */

type DetailTab = 'overview' | 'activity' | 'ops'

const ACT_TILES: { label: string; kind: MemberItemKind; pick: (d: MemberDetail) => number }[] = [
  { label: '체크인',   kind: 'checkins',          pick: d => d.checkins },
  { label: '최애',     kind: 'favorites',         pick: d => d.favorites },
  { label: '후기',     kind: 'reviews',           pick: d => d.reviews },
  { label: '저장 샵',  kind: 'saved_shops',       pick: d => d.saved_shops },
  { label: '만든 루트', kind: 'routes',            pick: d => d.routes },
  { label: '완주 루트', kind: 'route_completions', pick: d => d.route_completions },
]

function MemberDetailPanel({ member, isSelf, onToast, onDirtyChange, onRoleChanged }: {
  member: AdminMember
  isSelf: boolean
  onToast: (m: string) => void
  onDirtyChange: (dirty: boolean) => void
  onRoleChanged: () => void
}) {
  const uid = member.id

  const [tab, setTab] = useState<DetailTab>('overview')
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailKey, setDetailKey] = useState(0)
  const [detailLoaded, setDetailLoaded] = useState(-1)
  const detailLoading = detailLoaded !== detailKey

  const [src, setSrc] = useState<MemberSignupSource | null>(null)
  const [srcOpen, setSrcOpen] = useState(false)

  const [badges, setBadges] = useState<MemberBadge[] | null>(null)
  const [badgesError, setBadgesError] = useState(false)
  const [manual, setManual] = useState<ManualBadge[]>([])
  const [tierId, setTierId] = useState('')

  const [openKind, setOpenKind] = useState<MemberItemKind | null>(null)

  // 권한·메모
  const [role, setRole] = useState<MemberRole>('user')
  const [note, setNote] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [roleBusy, setRoleBusy] = useState(false)
  const [noteBusy, setNoteBusy] = useState(false)
  const [betaBusy, setBetaBusy] = useState(false)
  const [badgeBusy, setBadgeBusy] = useState(false)
  const [askRole, setAskRole] = useState<MemberRole | null>(null)

  // EXP
  const [expAmt, setExpAmt] = useState('')
  const [expReason, setExpReason] = useState('')
  const [expBusy, setExpBusy] = useState(false)
  const [askExp, setAskExp] = useState(false)

  /* 처음 불러온 값과 비교해 dirty 를 판단한다.
     포커스나 같은 값 재입력은 dirty 가 아니다(문자열 비교라 그대로면 false).
     콜백은 ref 로 들고 있어서, 부모가 매 렌더 새 함수를 넘겨도
     알림 effect 가 다시 돌지 않는다. */
  const noteDirty = note !== savedNote
  const dirtyCb = useRef(onDirtyChange)
  useEffect(() => { dirtyCb.current = onDirtyChange })
  useEffect(() => { dirtyCb.current(noteDirty) }, [noteDirty])
  useEffect(() => () => { dirtyCb.current(false) }, [])

  useEffect(() => {
    let alive = true
    const k = detailKey
    getMemberDetail(uid)
      .then(d => {
        if (!alive) return
        setDetail(d); setDetailError(null)
        setRole(d.role === 'admin' ? 'admin' : 'user')
        setNote(d.admin_note ?? ''); setSavedNote(d.admin_note ?? '')
        setDetailLoaded(k)
      })
      .catch(e => {
        if (!alive) return
        console.error('[회원 상세] 조회 실패:', e)
        setDetail(null); setDetailError(errText(e)); setDetailLoaded(k)
      })
    return () => { alive = false }
  }, [uid, detailKey])

  useEffect(() => {
    let alive = true
    getMemberSignupSource(uid).then(s => { if (alive) setSrc(s) }).catch(() => {})
    return () => { alive = false }
  }, [uid])

  useEffect(() => {
    let alive = true
    getMemberBadges(uid)
      .then(b => { if (alive) { setBadges(b); setBadgesError(false) } })
      .catch(e => {
        if (!alive) return
        console.error('[보유 배지] 조회 실패:', e)
        setBadges(null); setBadgesError(true)
      })
    return () => { alive = false }
  }, [uid, badgeBusy])

  useEffect(() => {
    let alive = true
    getManualBadges()
      .then(list => {
        if (!alive) return
        setManual(list)
        if (list.length > 0) setTierId(prev => prev || list[0].id)
      })
      .catch(e => console.error('[수동 배지 목록] 조회 실패:', e))
    return () => { alive = false }
  }, [])

  if (detailLoading) {
    return <div className={styles.state}><p className={styles.stateDesc}>불러오는 중…</p></div>
  }
  if (detailError || !detail) {
    return (
      <div className={styles.state}>
        <span className={styles.stateIcon}><AdminIcon name="alert" size={32} /></span>
        <strong className={styles.stateStrong}>회원 정보를 불러오지 못했어요</strong>
        <p className={styles.stateDesc}>{detailError ?? '알 수 없는 오류'}</p>
        <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.stateBtn}`}
          onClick={() => setDetailKey(k => k + 1)}>다시 시도</button>
      </div>
    )
  }

  const d = detail
  const st = statusView(d.status || 'active', d.suspended_until)
  const lastAct = d.recent_activity?.[0]?.created_at ?? null
  const held = new Set((badges ?? []).map(b => b.tierId))
  const roleDirty = role !== (d.role === 'admin' ? 'admin' : 'user')

  const expNum = Number.parseInt(expAmt, 10)
  const expValid = Number.isInteger(expNum) && expNum > 0 && String(expNum) === expAmt.trim()

  async function copyUid() {
    try {
      await navigator.clipboard.writeText(d.id)
      onToast('UID를 복사했어요')
    } catch {
      onToast('복사에 실패했어요')
    }
  }

  async function applyRole() {
    if (roleBusy || askRole === null) return
    setRoleBusy(true)
    try {
      const r = await setMemberRole(uid, askRole)
      setAskRole(null)
      onToast(r.changed ? `역할을 ${roleLabel(r.after)}(으)로 바꿨어요` : '이미 같은 역할이에요')
      setDetailKey(k => k + 1)   // 서버 값을 다시 읽어온다
      onRoleChanged()            // 목록도 다시 읽는다
    } catch (e) {
      setAskRole(null)
      setRole(d.role === 'admin' ? 'admin' : 'user')  // 실패하면 화면 값을 되돌린다
      onToast(errText(e))
    } finally {
      setRoleBusy(false)
    }
  }

  async function applyNote() {
    if (noteBusy) return
    setNoteBusy(true)
    try {
      await saveAdminNote(uid, note)
      setSavedNote(note.trim() ? note : '')
      setNote(note.trim() ? note : '')
      onToast('메모를 저장했어요')
    } catch (e) {
      onToast(errText(e))   // 실패하면 입력값과 dirty 상태를 그대로 둔다
    } finally {
      setNoteBusy(false)
    }
  }

  async function applyBeta(next: boolean) {
    if (betaBusy) return
    setBetaBusy(true)
    try {
      await setBetaTester(uid, next)
      onToast(next ? '베타테스터로 지정했어요' : '베타테스터 지정을 해제했어요')
      setDetailKey(k => k + 1)
    } catch (e) {
      onToast(errText(e))
    } finally {
      setBetaBusy(false)
    }
  }

  async function applyBadge() {
    if (badgeBusy || !tierId) return
    setBadgeBusy(true)
    try {
      await grantBadge(uid, tierId)
      onToast('배지를 지급했어요')
    } catch (e) {
      onToast(errText(e))
    } finally {
      setBadgeBusy(false)   // 보유 목록 재조회를 겸한다
    }
  }

  async function applyExp() {
    if (expBusy || !expValid) return
    setExpBusy(true)
    try {
      const r = await grantExp(uid, expNum, expReason)
      setAskExp(false); setExpAmt(''); setExpReason('')
      onToast(`EXP ${expNum.toLocaleString()} 지급 완료 · 총 ${r.total_exp.toLocaleString()} (Lv.${r.level})`)
      setDetailKey(k => k + 1)   // 예상값이 아니라 실제 값을 다시 읽는다
    } catch (e) {
      setAskExp(false)
      onToast(errText(e))        // 실패하면 예상 EXP 를 화면에 반영하지 않는다
    } finally {
      setExpBusy(false)
    }
  }

  return (
    <div className={styles.detail}>
      <div className={styles.detailHead}>
        <Avatar url={d.avatar_url} large />
        <div style={{ minWidth: 0 }}>
          <div className={styles.detailTitleRow}>
            <span className={styles.detailName}>{d.nickname || '(닉네임 없음)'}</span>
            <span className={`${styles.badge} ${st.cls}`}>{st.label}</span>
            <span className={`${styles.badge} ${d.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}`}>
              {roleLabel(d.role)}
            </span>
            {d.is_beta && <span className={`${styles.badge} ${styles.badgeNeutral}`}>베타테스터</span>}
          </div>
          <div className={styles.detailMeta}>
            Lv.{d.level} · EXP {d.total_exp.toLocaleString()}
          </div>
        </div>
        {hasText(d.nickname) && (
          <span className={styles.detailActs}>
            <a className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              href={`/user/${encodeURIComponent(d.nickname)}`} target="_blank" rel="noopener noreferrer">
              사용자 화면 보기 <AdminIcon name="external" size={14} />
            </a>
          </span>
        )}
      </div>

      <div className={styles.dTabs} role="tablist" aria-label="회원 상세">
        {([['overview', '개요'], ['activity', '활동'], ['ops', '권한·운영']] as [DetailTab, string][]).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={`${styles.dTab} ${tab === id ? styles.dTabOn : ''}`}
            onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── 개요 ── */}
      {tab === 'overview' && (
        <>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>기본 정보</div>
            <div className={styles.infoBox}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>UID</span>
                <span className={styles.uidRow}>
                  <span className={`${styles.infoValue} ${styles.mono}`}>{d.id}</span>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                    onClick={copyUid} aria-label="UID 복사">
                    <AdminIcon name="copy" size={14} />복사
                  </button>
                </span>
              </div>
              <Info k="가입일" v={fmtDateTime(d.created_at)} />
              <Info k="역할" v={roleLabel(d.role)} />
              <Info k="계정 상태" v={st.label} />
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>최근 활동</span>
                {lastAct
                  ? <span className={styles.infoValue}>{relTime(lastAct)} ({fmtDate(lastAct)})</span>
                  : <span className={styles.infoEmpty}>활동 기록 없음</span>}
              </div>
            </div>
          </div>

          {/* 정지 데이터가 실제로 있을 때만 설명을 붙인다 */}
          {d.status === 'suspended' && (
            <div className={`${styles.note} ${styles.noteWarn}`} style={{ marginTop: 12 }}>
              정지 상태로 기록됨{d.suspended_until ? ` · ${fmtDateTime(d.suspended_until)}까지` : ' · 기간 없음(영구)'}.
              현재 시스템 접근을 실제로 제한하지 않습니다.
            </div>
          )}

          <div className={styles.section}>
            <div className={styles.sectionTitle}>유입 경로</div>
            <div className={styles.infoBox}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>가입 채널</span>
                {hasText(src?.signup_channel)
                  ? <span className={styles.infoValue}>{src!.signup_channel}</span>
                  : <span className={styles.infoEmpty}>기록 없음</span>}
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>referrer</span>
                {hasText(src?.signup_referrer) ? (
                  safeHttpUrl(src!.signup_referrer)
                    ? <a className={`${styles.infoValue} ${styles.infoLink} ${styles.mono}`}
                        href={safeHttpUrl(src!.signup_referrer)!} target="_blank" rel="noopener noreferrer">
                        {src!.signup_referrer}
                      </a>
                    : <span className={`${styles.infoValue} ${styles.mono}`}>{src!.signup_referrer}</span>
                ) : <span className={styles.infoEmpty}>기록 없음</span>}
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>첫 방문 페이지</span>
                {hasText(src?.signup_landing_path)
                  ? <span className={`${styles.infoValue} ${styles.mono}`}>{src!.signup_landing_path}</span>
                  : <span className={styles.infoEmpty}>기록 없음</span>}
              </div>
            </div>

            {(hasText(src?.signup_utm_source) || hasText(src?.signup_utm_medium) || hasText(src?.signup_utm_campaign)) && (
              <div className={styles.fold}>
                <button type="button" className={styles.foldBtn} aria-expanded={srcOpen}
                  onClick={() => setSrcOpen(o => !o)}>
                  유입 상세 {srcOpen ? '접기' : '펼치기'}
                </button>
                {srcOpen && (
                  <div className={styles.infoBox} style={{ marginTop: 8 }}>
                    {hasText(src?.signup_utm_source) && <Info k="utm_source" v={src!.signup_utm_source!} mono />}
                    {hasText(src?.signup_utm_medium) && <Info k="utm_medium" v={src!.signup_utm_medium!} mono />}
                    {hasText(src?.signup_utm_campaign) && <Info k="utm_campaign" v={src!.signup_utm_campaign!} mono />}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── 활동 ── */}
      {tab === 'activity' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>활동 요약</div>
          <div className={styles.stats}>
            {ACT_TILES.map(t => {
              const v = t.pick(d)
              const on = openKind === t.kind
              return (
                <button key={t.kind} type="button" disabled={v === 0} aria-expanded={on}
                  className={`${styles.stat} ${on ? styles.statOn : ''}`}
                  onClick={() => setOpenKind(on ? null : t.kind)}>
                  <span className={styles.statValue}>{v.toLocaleString()}</span>
                  <span className={styles.statLabel}>{t.label}</span>
                </button>
              )
            })}
          </div>
          {openKind && (
            <MemberItemList uid={uid} kind={openKind}
              label={ACT_TILES.find(t => t.kind === openKind)?.label ?? ''} />
          )}
        </div>
      )}

      {/* ── 권한·운영 ── */}
      {tab === 'ops' && (
        <>
          <div className={styles.opCard}>
            <div className={styles.opTitle}>역할</div>
            <p className={styles.opDesc}>
              관리자는 모든 관리 화면과 관리자 전용 조회를 쓸 수 있습니다.
              {isSelf && ' 자기 자신의 역할은 바꿀 수 없습니다.'}
            </p>
            <div className={styles.field}>
              <select className={styles.select} value={role} disabled={isSelf || roleBusy}
                aria-label="역할 선택"
                onChange={e => setRole(e.target.value as MemberRole)}>
                {ROLE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div className={styles.opActs}>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={!roleDirty || isSelf || roleBusy}
                onClick={() => setAskRole(role)}>
                역할 변경
              </button>
            </div>

            <div className={styles.opDivider} />

            <div className={styles.opTitle}>관리자 메모</div>
            <p className={styles.opDesc}>관리자에게만 보입니다. 회원 본인은 볼 수 없습니다.</p>
            <textarea className={styles.textarea} rows={4} value={note} maxLength={NOTE_MAX}
              onChange={e => setNote(e.target.value)}
              aria-label="관리자 메모"
              placeholder="예: 오프라인 행사 제보를 자주 해주는 회원 / 도배 주의" />
            <div className={styles.counter}>{note.length} / {NOTE_MAX}</div>
            <div className={styles.opActs}>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={!noteDirty || noteBusy} onClick={applyNote}>
                {noteBusy ? '저장 중…' : '메모 저장'}
              </button>
            </div>
          </div>

          <div className={styles.opCard}>
            <div className={styles.opTitle}>배지 지급</div>
            <p className={styles.opDesc}>수동 지급 배지만 고를 수 있습니다. 회수 기능은 없습니다.</p>
            {manual.length === 0 ? (
              <p className={styles.stateDesc}>수동 지급 배지가 없습니다.</p>
            ) : (
              <>
                <div className={styles.field}>
                  <select className={styles.select} value={tierId} aria-label="지급할 배지"
                    disabled={badgeBusy} onChange={e => setTierId(e.target.value)}>
                    {manual.map(b => (
                      <option key={b.id} value={b.id} disabled={held.has(b.id)}>
                        {b.name}{held.has(b.id) ? ' (보유 중)' : ''}
                      </option>
                    ))}
                  </select>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`}
                    disabled={badgeBusy || !tierId || held.has(tierId)} onClick={applyBadge}>
                    {badgeBusy ? '지급 중…' : '배지 지급'}
                  </button>
                </div>
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>보유 배지</div>
                  {badgesError ? (
                    <p className={styles.stateDesc}>보유 배지를 불러오지 못했어요.</p>
                  ) : badges === null ? (
                    <p className={styles.stateDesc}>불러오는 중…</p>
                  ) : badges.length === 0 ? (
                    <p className={styles.stateDesc}>보유한 배지가 없습니다.</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {badges.map(b => (
                        <span key={b.tierId} className={`${styles.badge} ${styles.badgeNeutral}`}>{b.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className={styles.opCard}>
            <div className={styles.opTitle}>EXP 지급</div>
            <p className={styles.opDesc}>
              현재 EXP {d.total_exp.toLocaleString()} · Lv.{d.level} · 지급만 가능하고 차감은 되지 않습니다.
            </p>
            <div className={styles.field}>
              <input className={styles.input} style={{ width: 110 }} value={expAmt} inputMode="numeric"
                aria-label="지급할 EXP" placeholder="EXP"
                onChange={e => setExpAmt(e.target.value)} disabled={expBusy} />
              <input className={styles.input} style={{ flex: 1, minWidth: 160 }} value={expReason}
                aria-label="지급 사유" placeholder="지급 사유 (비우면 '관리자 지급')"
                onChange={e => setExpReason(e.target.value)} disabled={expBusy} />
            </div>
            {expAmt.trim() !== '' && !expValid && (
              <p className={styles.stateDesc} style={{ textAlign: 'left', marginTop: 8 }}>
                1 이상의 정수만 지급할 수 있습니다.
              </p>
            )}
            <div className={styles.opActs}>
              <button type="button" className={`${styles.btn} ${styles.btnExp}`}
                disabled={!expValid || expBusy} onClick={() => setAskExp(true)}>
                EXP 지급
              </button>
            </div>
          </div>

          <div className={styles.opCard}>
            <div className={styles.opTitle}>베타테스터</div>
            <p className={styles.opDesc}>
              profiles.is_beta 플래그입니다. 지금은 관리자 화면 표시 외의 효과가 없습니다.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, minHeight: 44 }}>
              <input type="checkbox" checked={d.is_beta} disabled={betaBusy}
                onChange={e => applyBeta(e.target.checked)} style={{ width: 18, height: 18 }} />
              베타테스터로 지정
            </label>
          </div>

          <div className={styles.note} style={{ marginTop: 14 }}>
            계정 제재 기능은 아직 실제 로그인·활동 제한과 연결되지 않았습니다.
          </div>
        </>
      )}

      {askRole !== null && (
        <AdminConfirmModal
          labelledById="member-role-title"
          title={askRole === 'admin' ? '관리자로 올릴까요?' : '일반 회원으로 내릴까요?'}
          body={<><b>{d.nickname || '(닉네임 없음)'}</b>
            <span style={{ color: 'var(--muted)' }}> · {roleLabel(d.role)} → {roleLabel(askRole)}</span></>}
          description={askRole === 'admin'
            ? '이 회원이 모든 관리 화면과 관리자 전용 조회·처리 기능을 쓸 수 있게 됩니다.'
            : '이 회원의 관리자 권한이 사라집니다. 마지막 관리자는 서버에서 강등이 거부됩니다.'}
          confirmLabel={askRole === 'admin' ? '관리자로 변경' : '일반 회원으로 변경'}
          tone={askRole === 'admin' ? 'normal' : 'danger'}
          busy={roleBusy}
          onCancel={() => { if (!roleBusy) { setAskRole(null); setRole(d.role === 'admin' ? 'admin' : 'user') } }}
          onConfirm={applyRole}
        />
      )}

      {askExp && (
        <AdminConfirmModal
          labelledById="member-exp-title"
          title="EXP를 지급할까요?"
          body={<><b>{d.nickname || '(닉네임 없음)'}</b>
            <span style={{ color: 'var(--muted)' }}> · {d.total_exp.toLocaleString()} → {(d.total_exp + expNum).toLocaleString()}</span></>}
          description={<>지급량 {expNum.toLocaleString()} EXP · 사유 {expReason.trim() || '관리자 지급'}</>}
          confirmLabel="지급"
          tone="warn"
          busy={expBusy}
          busyLabel="지급 중…"
          onCancel={() => { if (!expBusy) setAskExp(false) }}
          onConfirm={applyExp}
        />
      )}
    </div>
  )
}

function Info({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{k}</span>
      {hasText(v)
        ? <span className={`${styles.infoValue} ${mono ? styles.mono : ''}`}>{v}</span>
        : <span className={styles.infoEmpty}>기록 없음</span>}
    </div>
  )
}

/* 활동 타일을 눌렀을 때 펼쳐지는 목록. 여섯 종류가 같은 모양이라 하나로 렌더한다.
   이 조회가 실패해도 목록·상세는 그대로 남는다(상태를 따로 들고 있다). */
function MemberItemList({ uid, kind, label }: { uid: string; kind: MemberItemKind; label: string }) {
  /* 어떤 (회원, 종류, 재시도)의 결과인지 키를 같이 들고 있다가, 지금 보는 것과 다르면
     로딩으로 본다. effect 안에서 곧바로 setState 하지 않기 위한 방식이다
     (react-hooks/set-state-in-effect). */
  const [retry, setRetry] = useState(0)
  const [got, setGot] = useState<{ key: string; rows: MemberItem[] | null; failed: boolean } | null>(null)
  const key = `${uid}|${kind}|${retry}`

  useEffect(() => {
    let alive = true
    getMemberItems(uid, kind)
      .then(r => { if (alive) setGot({ key, rows: r, failed: false }) })
      .catch(e => {
        if (!alive) return
        console.error('[회원 활동 목록] 조회 실패:', e)
        setGot({ key, rows: null, failed: true })
      })
    return () => { alive = false }
  }, [key, uid, kind])

  const cur = got && got.key === key ? got : null
  const rows = cur?.rows ?? null
  const failed = cur?.failed ?? false

  return (
    <div className={styles.items}>
      <div className={styles.itemsHead}>{label}{rows ? ` ${rows.length}건` : ''}</div>
      {failed ? (
        <div className={styles.state} style={{ padding: '24px 16px' }}>
          <p className={styles.stateDesc}>활동 목록을 불러오지 못했어요.</p>
          <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm} ${styles.stateBtn}`}
            onClick={() => setRetry(k => k + 1)}>다시 시도</button>
        </div>
      ) : rows === null ? (
        <div className={styles.state} style={{ padding: '24px 16px' }}>
          <p className={styles.stateDesc}>불러오는 중…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.state} style={{ padding: '24px 16px' }}>
          <p className={styles.stateDesc}>내역이 없습니다.</p>
        </div>
      ) : (
        <div className={styles.itemsBody}>
          {rows.map((r, i) => (
            <div key={`${r.item_id}-${i}`} className={styles.item}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.itemTitle}>{r.title}</div>
                {r.subtitle && <div className={styles.itemSub}>{r.subtitle}</div>}
              </div>
              {r.badge && <span className={styles.itemTag}>{r.badge}</span>}
              {r.at && <span className={styles.rowDate}>{fmtDate(r.at)}</span>}
              {r.href && (
                <a href={r.href} target="_blank" rel="noopener noreferrer"
                  className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>열기</a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
