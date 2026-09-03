'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getPendingShopReports, getCompletedShopReports, resolveSuggestion, changeShopStatus,
  ShopReportRow, ShopReportShop,
} from '@/services/shopReportService'
import { ROUTES } from '@/lib/constants/routes'
import AdminIcon, { AdminIconName } from './AdminIcon'
import styles from './reportedShops.module.css'

/* 관리자 > 샵 신고.

   저장소는 shop_suggestions 다. 신고 한 건에는 payload.reason(사유 한 줄)만 있고
   '구체 내용'을 담는 필드가 없다. admin_note 같은 처리 메모 컬럼도 없다.
   그래서 시안의 구체 내용·처리 메모 영역은 만들지 않는다.

   샵 상태 변경과 신고 처리는 **따로** 간다. 둘을 묶는 트랜잭션이 없고, 같은 샵의
   신고들이 서로 다른 내용일 수 있으며, 상태를 바꿨다는 이유만으로 모든 신고가
   사실로 확인된 것도 아니기 때문이다. 상태를 바꾼 뒤에도 신고는 pending 으로 남고
   관리자가 건별로 처리한다. */

type TabId = 'pending' | 'completed'
type SortId = 'old' | 'new'

/** ReportIssueButton 이 제시하는 고정 사유. '기타'는 '기타: 자유입력'으로 저장된다. */
const REASONS = [
  '영업시간이 달라요',
  '연락처/SNS 정보가 틀려요',
  '굿즈/작품 정보가 달라요',
  '사진이 오래됐어요',
  '폐업했어요',
  '다른 곳으로 이전했어요',
  '중복 등록된 샵이에요',
  '존재하지 않는 샵이에요',
  '기타',
] as const

const SHOP_STATUS: { value: 'active' | 'temporary_closed' | 'closed' | 'deleted'; name: string; desc: string; dot: string; danger?: boolean }[] = [
  { value: 'active', name: '정상 운영', desc: '탐색·지도에 정상 노출됩니다.', dot: 'var(--green)' },
  { value: 'temporary_closed', name: '임시 휴업', desc: '잠시 문을 닫았고 다시 열 예정일 때.', dot: '#F5B100' },
  { value: 'closed', name: '폐점', desc: '영업을 완전히 끝냈을 때.', dot: 'var(--muted)' },
  { value: 'deleted', name: '샵 삭제', desc: '중복 등록이나 허위 등록일 때. 사이트에서 사라집니다.', dot: 'var(--red)', danger: true },
]
const SHOP_STATUS_LABEL: Record<string, string> = {
  active: '운영 중', temporary_closed: '임시 휴업', closed: '폐점',
  deleted: '삭제됨', hidden: '숨김', pending: '대기',
}

const hasText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
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

/** 신고 사유 원문. 사용자가 '기타'에 자유 입력한 문자열이 그대로 들어올 수 있다. */
const reasonOf = (r: ShopReportRow) => r.payload?.reason?.trim() ?? ''
/** 필터용 분류 — '기타: ...' 는 전부 '기타' 로 묶는다. */
function reasonGroup(r: ShopReportRow): string {
  const raw = reasonOf(r)
  if (raw === '') return '기타'
  return (REASONS as readonly string[]).includes(raw) ? raw : '기타'
}
const regionOf = (s: ShopReportShop | null) =>
  [s?.region, s?.district ?? s?.city].filter(hasText).join(' ')

/** 대표 이미지 — is_cover 우선, 없으면 sort_order 최소 (toShop 과 같은 규칙) */
function coverOf(s: ShopReportShop | null): string | null {
  const imgs = (s?.shop_images ?? []).filter(i => hasText(i.image_url))
  if (imgs.length === 0) return null
  const sorted = [...imgs].sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1
    if (!a.is_cover && b.is_cover) return 1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
  return sorted[0].image_url
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

interface Group {
  shopId: string
  shop: ShopReportShop | null
  reports: ShopReportRow[]   // 미처리만, 오래된 순
  oldest: number
  newest: number
}

export default function ReportedShopsTab({ onResolved }: {
  /** 신고를 처리하면 상위(AdminPage)의 배지를 다시 맞춘다 */
  onResolved?: () => void
}) {
  const { user } = useAuth()
  const [tab, setTab] = useState<TabId>('pending')
  const [sort, setSort] = useState<SortId>('old')
  const [query, setQuery] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const [pending, setPending] = useState<ShopReportRow[]>([])
  const [pFailed, setPFailed] = useState(false)
  const [pReload, setPReload] = useState(0)
  const [pLoaded, setPLoaded] = useState(-1)
  const pLoading = pLoaded !== pReload

  // 처리 완료는 탭을 처음 열 때만 조회한다. 상태를 분리해 pending 을 깨뜨리지 않는다.
  const [completed, setCompleted] = useState<ShopReportRow[]>([])
  const [cFailed, setCFailed] = useState(false)
  const [cAsked, setCAsked] = useState(false)
  const [cReload, setCReload] = useState(0)
  const [cLoaded, setCLoaded] = useState(-1)
  const cLoading = cAsked && cLoaded !== cReload

  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)     // 처리 중인 신고 id
  const [statusBusy, setStatusBusy] = useState(false)
  const [statusChanged, setStatusChanged] = useState<string | null>(null)  // 안내 배너
  const [confirmReport, setConfirmReport] = useState<ShopReportRow | null>(null)
  const [statusModal, setStatusModal] = useState(false)

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
    getPendingShopReports()
      .then(rows => {
        if (!alive) return
        setPending(rows); setPFailed(false); setPLoaded(pReload); setCheckedAt(new Date())
      })
      .catch(e => {
        if (!alive) return
        console.error('[샵 신고] 미처리 조회 실패:', e)
        setPending([]); setPFailed(true); setPLoaded(pReload)
      })
    return () => { alive = false }
  }, [pReload])

  useEffect(() => {
    if (!cAsked) return
    let alive = true
    getCompletedShopReports()
      .then(rows => {
        if (!alive) return
        setCompleted(rows); setCFailed(false); setCLoaded(cReload); setCheckedAt(new Date())
      })
      .catch(e => {
        if (!alive) return
        console.error('[샵 신고] 처리 완료 조회 실패:', e)
        setCompleted([]); setCFailed(true); setCLoaded(cReload)
      })
    return () => { alive = false }
  }, [cAsked, cReload])

  function refresh() {
    if (tab === 'pending') { if (!pLoading) setPReload(k => k + 1) }
    else if (!cLoading) { setCAsked(true); setCReload(k => k + 1) }
  }
  function openTab(next: TabId) {
    setTab(next)
    setSelectedShopId(null)
    setStatusChanged(null)
    if (next === 'completed') setCAsked(true)
  }

  /* 미처리는 shop_id 로 묶는다. 같은 사용자의 중복 신고도 DB 제약이 없으므로
     임의로 제거하지 않고 전부 남긴다. */
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    for (const r of pending) {
      const t = new Date(r.created_at).getTime()
      const g = map.get(r.shop_id)
      if (g) {
        g.reports.push(r)
        g.oldest = Math.min(g.oldest, t)
        g.newest = Math.max(g.newest, t)
      } else {
        map.set(r.shop_id, { shopId: r.shop_id, shop: r.shops, reports: [r], oldest: t, newest: t })
      }
    }
    for (const g of map.values()) {
      g.reports.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }
    return Array.from(map.values())
  }, [pending])

  const summary = useMemo(() => ({
    reports: pending.length,
    shops: groups.length,
    multi: groups.filter(g => g.reports.length >= 2).length,
  }), [pending.length, groups])

  const shownGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = groups.filter(g => {
      if (reasonFilter && !g.reports.some(r => reasonGroup(r) === reasonFilter)) return false
      if (q === '') return true
      if ((g.shop?.name ?? '').toLowerCase().includes(q)) return true
      return g.reports.some(r => reasonOf(r).toLowerCase().includes(q))
    })
    // 오래된 신고순 = 그룹의 가장 오래된 접수일 / 최근 신고순 = 그룹의 가장 최근 접수일
    return [...filtered].sort((a, b) => sort === 'old' ? a.oldest - b.oldest : b.newest - a.newest)
  }, [groups, query, reasonFilter, sort])

  const shownCompleted = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = completed.filter(r => {
      if (reasonFilter && reasonGroup(r) !== reasonFilter) return false
      if (q === '') return true
      return (r.shops?.name ?? '').toLowerCase().includes(q) || reasonOf(r).toLowerCase().includes(q)
    })
    const key = (r: ShopReportRow) => new Date(r.created_at).getTime()
    return [...filtered].sort((a, b) => sort === 'old' ? key(a) - key(b) : key(b) - key(a))
  }, [completed, query, reasonFilter, sort])

  const selected = shownGroups.find(g => g.shopId === selectedShopId) ?? shownGroups[0] ?? null
  const loading = tab === 'pending' ? pLoading : cLoading
  const failed = tab === 'pending' ? pFailed : cFailed
  const listCount = tab === 'pending' ? shownGroups.length : shownCompleted.length

  /* 신고 한 건 처리. 여러 건을 Promise.all 로 묶지 않는다 —
     일부만 성공했을 때 전체가 완료된 것처럼 보이면 안 된다. */
  async function resolveOne(r: ShopReportRow, status: 'approved' | 'rejected') {
    if (!user || busyId) return
    setBusyId(r.id)
    const res = await resolveSuggestion(r.id, status, user.id)
    setBusyId(null)
    if (!res.ok) { toast(res.error ?? '처리에 실패했어요'); return }   // 신고를 유지한다

    setPending(prev => prev.filter(x => x.id !== r.id))
    setCAsked(false); setCLoaded(-1)   // 처리 완료 목록은 다음에 열 때 새로 받는다
    setConfirmReport(null)
    onResolved?.()
    toast(status === 'approved' ? '신고를 처리 완료했어요' : '신고를 반려했어요')
  }

  async function applyStatus(value: 'active' | 'temporary_closed' | 'closed' | 'deleted', reason?: string) {
    if (!user || !selected?.shop || statusBusy) return
    setStatusBusy(true)
    const res = await changeShopStatus(selected.shop.id, value, user.id, reason)
    setStatusBusy(false)
    if (!res.ok) { toast(res.error ?? '상태 변경에 실패했어요'); return }

    // 신고는 자동으로 처리하지 않는다. 화면의 샵 상태만 갱신하고 안내를 띄운다.
    const shopId = selected.shopId
    setPending(prev => prev.map(x => x.shop_id === shopId && x.shops
      ? { ...x, shops: { ...x.shops, status: value } } : x))
    setStatusModal(false)
    setStatusChanged(SHOP_STATUS.find(s => s.value === value)?.name ?? value)
    toast('샵 상태를 변경했어요')
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.h1}>샵 신고</h1>
          <p className={styles.headSub}>신고 내용을 확인하고 샵 정보에 필요한 조치를 처리하세요</p>
        </div>
        <div className={styles.headRight}>
          {checkedAt && <span className={styles.updatedAt}>마지막 확인 {fmtTime(checkedAt)}</span>}
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={refresh} disabled={loading}>
            <AdminIcon name="refresh" size={16} />{loading ? '불러오는 중' : '새로고침'}
          </button>
        </div>
      </div>

      <div className={styles.summary}>
        <SumCard icon="flagShop" on={summary.reports > 0} label="미처리 신고" value={pLoading ? '—' : String(summary.reports)} />
        <SumCard icon="shop" on={summary.shops > 0} label="신고된 샵" value={pLoading ? '—' : String(summary.shops)} />
        <SumCard icon="alert" on={summary.multi > 0} label="복수 신고 샵" value={pLoading ? '—' : String(summary.multi)} />
      </div>

      <div className={styles.tabs} role="tablist" aria-label="샵 신고 목록">
        {([['pending', '미처리'], ['completed', '처리 완료']] as [TabId, string][]).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabOn : ''}`} onClick={() => openTab(id)}>
            {label}
            {id === 'pending' && !pLoading && groups.length > 0 && <span className={styles.tabCount}>{groups.length}</span>}
          </button>
        ))}
      </div>

      <div className={styles.split}>
        <section className={styles.card}>
          <div className={styles.listHead}>
            <h2 className={styles.listTitle}>{tab === 'pending' ? '미처리 신고' : '처리 완료'}</h2>
            <span className={styles.listCount}>{loading ? '—' : `${listCount}건`}</span>
          </div>
          <div className={styles.tools}>
            <span className={styles.searchWrap}>
              <span className={styles.searchIcon}><AdminIcon name="search" size={17} /></span>
              <input className={styles.search} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="샵명 또는 신고 사유" aria-label="샵명 또는 신고 사유 검색" />
            </span>
            <select className={styles.select} value={reasonFilter} onChange={e => setReasonFilter(e.target.value)} aria-label="신고 사유 필터">
              <option value="">신고 사유 전체</option>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className={styles.select} value={sort} onChange={e => setSort(e.target.value as SortId)}
              aria-label="정렬"
              title={tab === 'pending' ? '그룹에서 가장 오래된/최근 접수일 기준' : '접수일 기준'}>
              <option value="old">오래된 신고순</option>
              <option value="new">최근 신고순</option>
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
                  <p className={styles.stateDesc}>다른 샵명이나 신고 사유로 찾아보세요.</p>
                </>
              ) : tab === 'pending' ? (
                <>
                  <strong className={styles.stateStrong}>현재 처리할 샵 신고가 없습니다</strong>
                  <p className={styles.stateDesc}>
                    새로운 신고가 접수되면 이곳에 표시됩니다.
                    {checkedAt && <><br />마지막 확인 {fmtTime(checkedAt)}</>}
                  </p>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.stateBtn}`} onClick={refresh} disabled={loading}>새로고침</button>
                </>
              ) : (
                <>
                  <strong className={styles.stateStrong}>처리한 신고가 없습니다</strong>
                  <p className={styles.stateDesc}>처리 완료하거나 반려한 신고가 이곳에 쌓입니다.</p>
                </>
              )}
            </div>
          ) : tab === 'pending' ? (
            <div className={styles.rows}>
              {shownGroups.map(g => {
                const on = selected?.shopId === g.shopId
                const cover = coverOf(g.shop)
                return (
                  <button key={g.shopId} type="button" aria-current={on ? 'true' : undefined}
                    className={`${styles.row} ${on ? styles.rowOn : ''}`}
                    onClick={() => { setSelectedShopId(g.shopId); setStatusChanged(null); setMobileOpen(true) }}>
                    <Thumb src={cover} />
                    <span className={styles.rowBody}>
                      <span className={styles.rowTop}>
                        <span className={styles.rowName}>{g.shop?.name ?? '삭제된 샵'}</span>
                        <span className={`${styles.badge} ${styles.badgePending}`}>미처리 {g.reports.length}건</span>
                      </span>
                      {hasText(regionOf(g.shop)) && <span className={styles.rowMeta}>{regionOf(g.shop)}</span>}
                      <span className={styles.rowMeta}>최초 접수 {fmtDate(new Date(g.oldest).toISOString())}</span>
                      <span className={styles.rowFlags}>
                        <span className={`${styles.badge} ${styles.badgeReason}`}>{reasonOf(g.reports[0]) || '사유 없음'}</span>
                        {g.reports.length >= 2 && <span className={`${styles.badge} ${styles.badgeMulti}`}>복수 신고</span>}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className={styles.rows}>
              {shownCompleted.map(r => (
                <div key={r.id} className={styles.row} style={{ cursor: 'default' }}>
                  <Thumb src={coverOf(r.shops)} />
                  <span className={styles.rowBody}>
                    <span className={styles.rowTop}>
                      <span className={styles.rowName}>{r.shops?.name ?? '삭제된 샵'}</span>
                      <span className={`${styles.badge} ${r.status === 'approved' ? styles.badgeApproved : styles.badgeRejected}`}>
                        {r.status === 'approved' ? '처리 완료' : r.status === 'rejected' ? '반려' : r.status}
                      </span>
                    </span>
                    <span className={styles.reportReason} style={{ fontSize: 13.5 }}>{reasonOf(r) || '사유 없음'}</span>
                    <span className={styles.rowMeta}>
                      신고자 {r.profiles?.nickname ?? '알 수 없음'} · 접수 {fmtDate(r.created_at)}
                      {r.reviewed_at && <> · 처리 {fmtDate(r.reviewed_at)}</>}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`${styles.card} ${styles.detailPanel} ${mobileOpen ? '' : styles.detailPanelHidden}`}>
          {tab === 'pending' && selected ? (
            <div>
              <div className={styles.mobileBar}>
                <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => setMobileOpen(false)}>
                  <AdminIcon name="chevron" size={15} style={{ transform: 'rotate(180deg)' }} /> 목록으로
                </button>
              </div>
              <DetailPanel
                group={selected}
                busyId={busyId}
                statusBusy={statusBusy}
                statusChanged={statusChanged}
                onResolveDone={r => resolveOne(r, 'approved')}
                onAskReject={setConfirmReport}
                onOpenStatus={() => setStatusModal(true)}
              />
            </div>
          ) : tab === 'completed' ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="checkCircle" size={32} /></span>
              <strong className={styles.stateStrong}>처리 완료 목록</strong>
              <p className={styles.stateDesc}>왼쪽 목록에서 처리 결과와 처리일을 확인할 수 있습니다.<br />처리된 신고는 다시 되돌릴 수 없습니다.</p>
            </div>
          ) : !loading && !failed ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="flagShop" size={32} /></span>
              <strong className={styles.stateStrong}>검토할 신고를 선택하세요</strong>
              <p className={styles.stateDesc}>왼쪽 목록에서 샵을 고르면 접수된 신고가 표시됩니다.</p>
            </div>
          ) : null}
        </section>
      </div>

      {/* 신고 반려 확인 */}
      {confirmReport && (
        <Modal title="이 신고를 반려할까요?" onCancel={() => setConfirmReport(null)}
          confirmLabel="신고 반려" confirmClass={styles.btnGhost} busy={busyId === confirmReport.id}
          onConfirm={() => resolveOne(confirmReport, 'rejected')}>
          <p className={styles.modalBody}>
            <b>{confirmReport.shops?.name ?? '샵'}</b> · {reasonOf(confirmReport) || '사유 없음'}
          </p>
          <p className={styles.modalMuted}>
            이 신고 <b>한 건만</b> 반려됩니다. 같은 샵의 다른 신고는 그대로 남습니다.
            반려한 신고는 되돌릴 수 없습니다.
          </p>
        </Modal>
      )}

      {/* 샵 상태 변경 */}
      {statusModal && selected?.shop && (
        <StatusModal
          shopName={selected.shop.name ?? '샵'}
          current={selected.shop.status ?? null}
          pendingCount={selected.reports.length}
          busy={statusBusy}
          onCancel={() => setStatusModal(false)}
          onApply={applyStatus}
        />
      )}

      {msg && <div className={styles.toast} role="status">{msg}</div>}
    </div>
  )
}

function Thumb({ src }: { src: string | null }) {
  if (!src) return <span className={styles.thumbEmpty}><AdminIcon name="shop" size={20} /></span>
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
function DetailPanel({ group, busyId, statusBusy, statusChanged, onResolveDone, onAskReject, onOpenStatus }: {
  group: Group
  busyId: string | null
  statusBusy: boolean
  statusChanged: string | null
  onResolveDone: (r: ShopReportRow) => void
  onAskReject: (r: ShopReportRow) => void
  onOpenStatus: () => void
}) {
  const shop = group.shop
  const cover = coverOf(shop)
  const region = regionOf(shop)
  const confirmDays = daysSince(shop?.info_last_confirmed_at)
  const statusKey = shop?.status ?? ''
  const statusCls = statusKey === 'active' ? styles.badgeShopActive
    : statusKey === 'temporary_closed' ? styles.badgeShopWarn
    : statusKey === 'deleted' ? styles.badgeShopDanger
    : styles.badgeShopMuted

  return (
    <div className={styles.detail}>
      {/* 1. 대상 샵 개요 */}
      <div className={styles.detailHead}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.detailTitleRow}>
            <span className={`${styles.badge} ${statusCls}`}>{SHOP_STATUS_LABEL[statusKey] ?? statusKey ?? '상태 미상'}</span>
            <span className={`${styles.badge} ${styles.badgePending}`}>미처리 {group.reports.length}건</span>
          </div>
          <div className={styles.detailTitle}>{shop?.name ?? '삭제된 샵'}</div>
          <div className={styles.detailMeta}>{hasText(region) ? region : '지역 정보 없음'}</div>
        </div>
        {hasText(shop?.slug) && (
          <Link href={ROUTES.shop(shop!.slug!)} target="_blank" rel="noopener noreferrer" className={styles.shopLink}>
            샵 페이지 보기 (새 탭) <AdminIcon name="external" size={13} />
          </Link>
        )}
      </div>

      {statusChanged && (
        <div className={styles.notice} role="status">
          <AdminIcon name="alert" size={15} />
          샵 상태가 &lsquo;{statusChanged}&rsquo;(으)로 변경되었습니다. 관련 신고를 확인한 뒤 처리해주세요.
        </div>
      )}

      {/* 2. 접수된 미처리 신고 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>접수된 미처리 신고 {group.reports.length}건</div>
        <div className={styles.reportList}>
          {group.reports.map((r, i) => {
            const busy = busyId === r.id
            return (
              <div key={r.id} className={styles.reportCard}>
                <div className={styles.reportTop}>
                  <span className={styles.reportNo}>{i + 1}</span>
                  <div className={styles.reportBody}>
                    {/* 사용자가 입력한 문자열이 섞일 수 있어 항상 일반 텍스트로만 그린다 */}
                    <div className={styles.reportReason}>{reasonOf(r) || '사유 없음'}</div>
                    <div className={styles.reportMeta}>
                      신고자 {r.profiles?.nickname ?? '알 수 없음'} · 접수 {fmtDateTime(r.created_at)}
                    </div>
                  </div>
                  <span className={`${styles.badge} ${styles.badgePending}`}>미처리</span>
                </div>
                <div className={styles.reportActs}>
                  <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDone}`}
                    onClick={() => onResolveDone(r)} disabled={!!busyId}>
                    {busy ? '처리 중…' : '처리 완료'}
                  </button>
                  <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
                    onClick={() => onAskReject(r)} disabled={!!busyId}>
                    신고 반려
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. 현재 샵 정보 — 신고 내용과 나란히 보되 사실 여부를 자동 판정하지 않는다 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>현재 샵 정보</div>
        <div className={styles.shopInfo}>
          {cover
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={cover} alt={`${shop?.name ?? '샵'} 대표 사진`} className={styles.shopPhoto} />
            : <span className={styles.shopPhotoEmpty}><AdminIcon name="image" size={28} /></span>}
          <div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>운영 상태</span>
              <span className={styles.infoValue}>{SHOP_STATUS_LABEL[statusKey] ?? statusKey ?? '미상'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>주소</span>
              {hasText(shop?.addr) ? <span className={styles.infoValue}>{shop!.addr}</span> : <span className={styles.infoEmpty}>미등록</span>}
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>전화번호</span>
              {hasText(shop?.phone) ? <span className={styles.infoValue}>{shop!.phone}</span> : <span className={styles.infoEmpty}>미등록</span>}
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>최근 정보 확인일</span>
              {shop?.info_last_confirmed_at ? (
                <span className={styles.infoValue}>
                  {fmtDate(shop.info_last_confirmed_at)}
                  {confirmDays !== null && <span style={{ fontWeight: 500, color: 'var(--muted)' }}> · {confirmDays}일 경과</span>}
                </span>
              ) : <span className={styles.infoEmpty}>확인 기록 없음</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 4. 처리 작업 */}
      <div className={styles.actions}>
        <p className={styles.actionsNote}>
          샵 정보를 고치거나 상태를 바꾼 뒤에도 신고는 자동으로 처리되지 않습니다.
          위에서 신고를 건별로 처리해주세요.
        </p>
        <div className={styles.actionsBtns}>
          {hasText(shop?.slug) && (
            <Link href={ROUTES.shopEdit(shop!.slug!)} target="_blank" rel="noopener noreferrer"
              className={`${styles.btn} ${styles.btnGhost}`}>
              <AdminIcon name="edit" size={15} />샵 정보 수정 (새 탭)
            </Link>
          )}
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onOpenStatus} disabled={statusBusy || !shop}>
            샵 상태 변경
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── 샵 상태 변경 모달 ─────────────────────────────────────
   hidden 은 이 화면에서 쓰지 않는다. 기존 4개 상태만 그대로 쓰고
   삭제는 아래 위험 영역으로 분리해 사유 입력을 받는다. */
function StatusModal({ shopName, current, pendingCount, busy, onCancel, onApply }: {
  shopName: string
  current: string | null
  pendingCount: number
  busy: boolean
  onCancel: () => void
  onApply: (v: 'active' | 'temporary_closed' | 'closed' | 'deleted', reason?: string) => void
}) {
  const [deleteMode, setDeleteMode] = useState(false)
  const [reason, setReason] = useState('')
  const safe = SHOP_STATUS.filter(s => !s.danger)
  const danger = SHOP_STATUS.find(s => s.danger)!

  return (
    <Modal title="샵 상태 변경" onCancel={onCancel} busy={busy} hideConfirm>
      <p className={styles.modalBody}>
        <b>{shopName}</b>
        <span style={{ color: 'var(--muted)' }}> · 현재 {SHOP_STATUS_LABEL[current ?? ''] ?? '상태 미상'}</span>
      </p>
      <p className={styles.modalMuted}>
        상태를 바꿔도 이 샵의 미처리 신고 {pendingCount}건은 그대로 남습니다. 신고는 건별로 처리해주세요.
      </p>

      <div className={styles.statusList}>
        {safe.map(s => {
          const isCurrent = current === s.value
          return (
            <button key={s.value} type="button" disabled={busy}
              className={`${styles.statusItem} ${isCurrent ? styles.statusItemOn : ''}`}
              onClick={() => onApply(s.value)}>
              <span className={styles.statusDot} style={{ background: s.dot }} />
              <span style={{ minWidth: 0 }}>
                <span className={styles.statusName}>
                  {s.name}{isCurrent && <span className={styles.statusCurrent}>현재 상태</span>}
                </span>
                <span className={styles.statusDesc}>{s.desc}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerTitle}>위험 — 되돌리기 어려운 작업</div>
        {!deleteMode ? (
          <button type="button" className={`${styles.btn} ${styles.btnDangerLine}`} onClick={() => setDeleteMode(true)} disabled={busy}>
            {danger.name}
          </button>
        ) : (
          <>
            <p className={styles.modalWarn}>
              샵 삭제는 신고 한 건만으로 결정하지 마세요. 중복 등록이나 허위 등록이 확인됐을 때만 사용합니다.
              사이트와 지도에서 사라집니다.
            </p>
            <label className={styles.label} htmlFor="shop-delete-reason">삭제 사유</label>
            <input id="shop-delete-reason" className={styles.input} value={reason} maxLength={200}
              onChange={e => setReason(e.target.value)} placeholder="예: 중복 등록" />
            <div className={styles.modalActs}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setDeleteMode(false)} disabled={busy}>취소</button>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} disabled={busy || reason.trim() === ''}
                onClick={() => onApply('deleted', reason.trim())}>
                {busy ? '처리 중…' : '샵 삭제'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/* ── 공용 모달 ─────────────────────────────────────────────
   ESC 닫기, 초기 포커스, Tab 순환, 닫을 때 포커스 복귀.
   onCancel 을 의존성에 넣지 않는다 — 부모가 인라인 함수를 넘기면 매 렌더 effect 가
   다시 돌아 focus() 가 재실행되고, 한글 조합 중이면 글자가 깨진다. */
function Modal({ title, children, confirmLabel, confirmClass, busy, hideConfirm, onCancel, onConfirm }: {
  title: string
  children: React.ReactNode
  confirmLabel?: string
  confirmClass?: string
  busy: boolean
  hideConfirm?: boolean
  onCancel: () => void
  onConfirm?: () => void
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

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div ref={boxRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="report-modal-title"
        onClick={e => e.stopPropagation()}>
        <h2 id="report-modal-title" className={styles.modalTitle}>{title}</h2>
        {children}
        {!hideConfirm && (
          <div className={styles.modalActs}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onCancel} disabled={busy}>취소</button>
            <button type="button" data-autofocus className={`${styles.btn} ${confirmClass ?? styles.btnPrimary}`}
              onClick={onConfirm} disabled={busy}>
              {busy ? '처리 중…' : confirmLabel}
            </button>
          </div>
        )}
        {hideConfirm && (
          <div className={styles.modalActs}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onCancel} disabled={busy}>닫기</button>
          </div>
        )}
      </div>
    </div>
  )
}
