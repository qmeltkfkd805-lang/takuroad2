'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  getPendingVerifyRequests, getCompletedVerifyRequests,
  approveVerifyRequest, rejectVerifyRequest, getEvidenceFileUrl,
} from '@/services/shopService'
import { ROUTES } from '@/lib/constants/routes'
import AdminIcon, { AdminIconName } from './AdminIcon'
import styles from './verifyReview.module.css'

/* 관리자 > 인증 심사.

   예전에는 AdminPage 안에 인라인으로 있었다. 목록과 상세를 좌우로 나눠
   한 건씩 검토하는 형태로 바꾼다.

   데이터는 shop_verify_requests 가 주는 것만 쓴다. 신청자의 계정 이메일은
   profiles 에 없고 auth.users 를 열 생각도 없으므로, 화면에 보이는 이메일·연락처는
   전부 '신청서에 적힌 값'(extra)이다. 라벨에서 그걸 분명히 한다.

   승인·거절은 /api/admin/shop-verify 로만 간다. 클라이언트는 requestId 만 넘기고
   shop_id·user_id·owner_id 를 정하지 않는다. */

interface Extra {
  transfer?: boolean
  manager?: string; position?: string; phone?: string; email?: string
  bizName?: string; bizNo?: string; owner?: string
  features?: string[]
}

export interface VerifyRequestRow {
  id: string
  shop_id: string
  user_id: string
  note: string | null
  reject_reason: string | null
  evidence_url: string | null
  extra: Extra | null
  status: string
  created_at: string
  updated_at: string | null
  reviewed_by: string | null
  shops: { id: string; name: string | null; slug: string | null } | null
  /** 신청자 — user_id FK */
  profiles: { id: string; nickname: string | null } | null
  /** 처리자 — reviewed_by FK (shop_verify_requests_reviewed_by_fkey → profiles.id) */
  reviewer: { id: string; nickname: string | null } | null
}

type TabId = 'pending' | 'completed'
type SortId = 'old' | 'new'

/* 신청 폼(ClaimFormPage)이 실제로 필수로 받는 항목.
   값이 있는지만 확인할 수 있을 뿐 진위를 검증하는 기능은 없어서
   '확인 필요'가 아니라 '필수 정보 누락'이라고 쓴다. */
const REQUIRED_EXTRA: { key: keyof Extra; label: string }[] = [
  { key: 'manager', label: '담당자' },
  { key: 'email', label: '신청서 이메일' },
  { key: 'phone', label: '연락처' },
  { key: 'bizName', label: '상호' },
  { key: 'bizNo', label: '사업자등록번호' },
]

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

/** 경과 시간. SLA·지연 같은 판단은 하지 않고 얼마나 지났는지만 말한다. */
function elapsedText(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const min = Math.floor((Date.now() - t) / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간`
  return `${Math.floor(hour / 24)}일`
}

/** 필수 항목 중 비어 있는 것들. evidence_url 은 extra 밖이라 따로 본다. */
function missingLabels(r: VerifyRequestRow): string[] {
  const out = REQUIRED_EXTRA.filter(f => !hasText(r.extra?.[f.key])).map(f => f.label)
  if (!hasText(r.evidence_url)) out.push('증빙 자료')
  return out
}

/** 저장 경로의 확장자만 본다. 원본 파일명은 저장하지 않으므로 추측하지 않는다. */
function evidenceKind(path: string): 'image' | 'pdf' | 'other' {
  const clean = path.split('?')[0].split('#')[0]
  const ext = (clean.split('.').pop() ?? '').toLowerCase()
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  return 'other'
}
const EVIDENCE_LABEL = { image: '증빙 자료 (이미지)', pdf: '증빙 자료 (PDF)', other: '증빙 자료' } as const

export default function VerifyReviewTab({ onPendingCount }: {
  /** 사이드바 배지·대시보드 숫자를 맞추기 위해 대기 건수를 위로 올린다 */
  onPendingCount?: (n: number) => void
}) {
  const [tab, setTab] = useState<TabId>('pending')
  const [sort, setSort] = useState<SortId>('old')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  // 대기 목록 — 화면에 들어오면 바로 조회한다
  const [pending, setPending] = useState<VerifyRequestRow[]>([])
  const [pFailed, setPFailed] = useState(false)
  const [pReload, setPReload] = useState(0)
  const [pLoaded, setPLoaded] = useState(-1)
  const pLoading = pLoaded !== pReload

  /* 처리 완료 — 탭을 처음 열 때만 조회한다(지연 조회). 같은 탭을 다시 열어도
     cLoaded === cReload 라 재조회하지 않는다. 대기 목록과 상태를 분리해 둬서
     한쪽 조회가 실패해도 다른 쪽이 멀쩡하다. */
  const [completed, setCompleted] = useState<VerifyRequestRow[]>([])
  const [cFailed, setCFailed] = useState(false)
  const [cAsked, setCAsked] = useState(false)
  const [cReload, setCReload] = useState(0)
  const [cLoaded, setCLoaded] = useState(-1)
  const cLoading = cAsked && cLoaded !== cReload

  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  const [busy, setBusy] = useState(false)          // 승인·거절 진행 중
  const [downloading, setDownloading] = useState(false)
  const [modal, setModal] = useState<null | 'approve' | 'reject'>(null)
  const [reason, setReason] = useState('')

  const [msg, setMsg] = useState<string | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])
  function toast(m: string) {
    setMsg(m)
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setMsg(null), 3200)
  }

  // 로딩을 state 로 두지 않고 "요청 키 != 반영된 키"로 파생시킨다
  // (effect 본문의 setState 를 피한다 — react-hooks/set-state-in-effect)
  useEffect(() => {
    let alive = true
    getPendingVerifyRequests()
      .then(rows => {
        if (!alive) return
        const list = (rows ?? []) as unknown as VerifyRequestRow[]
        setPending(list); setPFailed(false); setPLoaded(pReload); setCheckedAt(new Date())
      })
      .catch(e => {
        if (!alive) return
        console.error('[인증 심사] 대기 목록 조회 실패:', e)
        setPending([]); setPFailed(true); setPLoaded(pReload)
      })
    return () => { alive = false }
  }, [pReload])

  /* 사이드바 배지·대시보드에 대기 건수를 알린다. 렌더 중이 아니라 커밋 후에 알린다.
     조회에 실패했을 때는 알리지 않는다 — 0건과 조회 실패는 다른 상태다.
     같은 값으로 다시 부르면 React 가 알아서 넘기므로 루프가 생기지 않는다. */
  useEffect(() => {
    if (pLoading || pFailed) return
    onPendingCount?.(pending.length)
  }, [pending.length, pLoading, pFailed, onPendingCount])

  useEffect(() => {
    if (!cAsked) return
    let alive = true
    getCompletedVerifyRequests()
      .then(rows => {
        if (!alive) return
        setCompleted((rows ?? []) as unknown as VerifyRequestRow[])
        setCFailed(false); setCLoaded(cReload); setCheckedAt(new Date())
      })
      .catch(e => {
        if (!alive) return
        console.error('[인증 심사] 처리 완료 조회 실패:', e)
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
    setSelectedId(null)
    if (next === 'completed') setCAsked(true)   // 처음 열 때만 실제 조회가 돈다
  }

  const source = tab === 'pending' ? pending : completed
  const loading = tab === 'pending' ? pLoading : cLoading
  const failed = tab === 'pending' ? pFailed : cFailed

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q === '' ? source : source.filter(r =>
      (r.shops?.name ?? '').toLowerCase().includes(q) ||
      (r.profiles?.nickname ?? '').toLowerCase().includes(q))
    const key = (r: VerifyRequestRow) => new Date(r.created_at).getTime()
    return [...filtered].sort((a, b) => sort === 'old' ? key(a) - key(b) : key(b) - key(a))
  }, [source, query, sort])

  // 첫 항목 자동 선택 — 목록이 비면 선택하지 않는다. state 를 따로 안 두고 파생시킨다.
  const selected = shown.find(r => r.id === selectedId) ?? shown[0] ?? null

  const summary = useMemo(() => {
    const missing = pending.filter(r => missingLabels(r).length > 0).length
    const oldest = pending.reduce<string | null>((acc, r) =>
      !acc || new Date(r.created_at) < new Date(acc) ? r.created_at : acc, null)
    return { total: pending.length, missing, oldest }
  }, [pending])

  function selectRow(r: VerifyRequestRow) {
    setSelectedId(r.id)
    setMobileOpen(true)
  }

  /* ── 승인·거절 ── */
  async function doApprove() {
    if (!selected || busy) return
    setBusy(true)
    const res = await approveVerifyRequest(selected.id)
    setBusy(false)
    if (!res.ok) { toast(res.error ?? '승인에 실패했어요'); return }   // 행을 지우지 않는다
    setModal(null)
    removeFromPending(selected.id)
    toast(`${selected.shops?.name ?? '샵'} 인증을 승인했어요`)
  }

  async function doReject() {
    if (!selected || busy) return
    setBusy(true)
    const res = await rejectVerifyRequest(selected.id, reason)
    setBusy(false)
    if (!res.ok) { toast(res.error ?? '거절에 실패했어요'); return }   // 입력한 사유도 그대로 둔다
    setModal(null)
    setReason('')
    removeFromPending(selected.id)
    toast(`${selected.shops?.name ?? '샵'} 인증 신청을 거절했어요`)
  }

  /* 서버가 성공을 준 뒤에만 목록에서 뺀다(낙관적 갱신 없음).
     처리 완료 목록은 다음에 열 때 새로 받도록 표시만 해둔다.
     대기 건수는 아래 effect 가 알린다 — setState 업데이터 안에서 부모 상태를
     바꾸면 "렌더 중 다른 컴포넌트 갱신" 오류가 난다. */
  function removeFromPending(id: string) {
    setPending(prev => prev.filter(r => r.id !== id))
    setSelectedId(null)
    setMobileOpen(false)
    setCAsked(false); setCLoaded(-1)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.h1}>인증 심사</h1>
          <p className={styles.headSub}>샵 운영자의 인증 신청과 증빙 자료를 검토하세요</p>
        </div>
        <div className={styles.headRight}>
          {checkedAt && <span className={styles.updatedAt}>마지막 확인 {fmtTime(checkedAt)}</span>}
          <button type="button" className={styles.refreshBtn} onClick={refresh} disabled={loading}>
            <AdminIcon name="refresh" size={16} />
            {loading ? '불러오는 중' : '새로고침'}
          </button>
        </div>
      </div>

      {/* 요약 — 대기 목록만으로 계산되는 것만 둔다.
          '오늘 처리'는 처리 완료를 지연 조회하므로 초기에 알 수 없어 넣지 않았다. */}
      <div className={styles.summary}>
        {/* 색은 규칙대로 — 주황은 대기·누락에만. 0건이면 회색으로 낮춰 눈이 덜 간다 */}
        <SumCard icon="verify"
          tint={summary.total > 0 ? 'rgba(245,177,0,.14)' : 'var(--surface2)'}
          color={summary.total > 0 ? '#A87A00' : 'var(--muted)'}
          label="심사 대기" value={pLoading ? '—' : String(summary.total)} />
        <SumCard icon="alert"
          tint={summary.missing > 0 ? 'rgba(245,177,0,.14)' : 'var(--surface2)'}
          color={summary.missing > 0 ? '#A87A00' : 'var(--muted)'}
          label="필수 정보 누락" value={pLoading ? '—' : String(summary.missing)} />
        <SumCard icon="clock" tint="var(--surface2)" color="var(--muted)"
          label="가장 오래 대기" small
          value={pLoading ? '—' : summary.oldest ? elapsedText(summary.oldest) : '—'} />
      </div>

      <div className={styles.tabs} role="tablist" aria-label="인증 심사 목록">
        {([['pending', '심사 대기'], ['completed', '처리 완료']] as [TabId, string][]).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabOn : ''}`}
            onClick={() => openTab(id)}>
            {label}
            {id === 'pending' && !pLoading && pending.length > 0 && (
              <span className={styles.tabCount}>{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.split}>
        {/* ── 목록 ── */}
        <section className={styles.card}>
          <div className={styles.listHead}>
            <h2 className={styles.listTitle}>{tab === 'pending' ? '심사 대기' : '처리 완료'}</h2>
            <span className={styles.listCount}>{loading ? '—' : `${shown.length}건`}</span>
          </div>
          <div className={styles.tools}>
            <span className={styles.searchWrap}>
              <span className={styles.searchIcon}><AdminIcon name="search" size={17} /></span>
              <input className={styles.search} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="샵명 또는 신청자" aria-label="샵명 또는 신청자 검색" />
            </span>
            <select className={styles.sort} value={sort} onChange={e => setSort(e.target.value as SortId)} aria-label="정렬">
              <option value="old">오래된 신청순</option>
              <option value="new">최근 신청순</option>
            </select>
          </div>

          {loading ? (
            <>
              {[0, 1, 2].map(i => (
                <div key={i} className={styles.skelRow}>
                  <div className={styles.skel} style={{ width: 38, height: 38 }} />
                  <div style={{ flex: 1 }}>
                    <div className={styles.skel} style={{ width: '55%', height: 14, marginBottom: 7 }} />
                    <div className={styles.skel} style={{ width: '35%', height: 11 }} />
                  </div>
                </div>
              ))}
            </>
          ) : failed ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="alert" size={32} /></span>
              <strong className={styles.stateStrong}>목록을 불러오지 못했어요</strong>
              <p className={styles.stateDesc}>잠시 후 다시 시도해주세요.</p>
              <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.stateBtn}`} onClick={refresh}>다시 시도</button>
            </div>
          ) : shown.length === 0 ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="checkCircle" size={32} /></span>
              {query.trim() !== '' ? (
                <>
                  <strong className={styles.stateStrong}>검색 결과가 없습니다</strong>
                  <p className={styles.stateDesc}>다른 샵명이나 신청자로 찾아보세요.</p>
                </>
              ) : tab === 'pending' ? (
                <>
                  <strong className={styles.stateStrong}>현재 심사 대기 중인 신청이 없습니다</strong>
                  <p className={styles.stateDesc}>새로운 인증 신청이 접수되면 이곳에 표시됩니다.</p>
                </>
              ) : (
                <>
                  <strong className={styles.stateStrong}>처리한 신청이 없습니다</strong>
                  <p className={styles.stateDesc}>승인하거나 거절한 신청이 이곳에 쌓입니다.</p>
                </>
              )}
            </div>
          ) : (
            <div className={styles.rows}>
              {shown.map(r => {
                const missing = missingLabels(r)
                const on = selected?.id === r.id
                return (
                  <button key={r.id} type="button" aria-current={on ? 'true' : undefined}
                    className={`${styles.row} ${on ? styles.rowOn : ''}`} onClick={() => selectRow(r)}>
                    <span className={styles.rowIcon}><AdminIcon name="shop" size={19} /></span>
                    <span className={styles.rowBody}>
                      <span className={styles.rowTop}>
                        <span className={styles.rowName}>{r.shops?.name ?? '삭제된 샵'}</span>
                        <StatusBadge status={r.status} />
                      </span>
                      <span className={styles.rowMeta}>신청자 {r.profiles?.nickname ?? '알 수 없음'}</span>
                      <span className={styles.rowMeta}>
                        신청일 {fmtDate(r.created_at)}
                        {r.status !== 'pending' && r.updated_at && <> · 처리일 {fmtDate(r.updated_at)}</>}
                      </span>
                      {(missing.length > 0 || r.extra?.transfer) && (
                        <span className={styles.rowFlags}>
                          {r.extra?.transfer && <span className={`${styles.badge} ${styles.badgeTransfer}`}>인증 이전</span>}
                          {missing.length > 0 && (
                            <span className={`${styles.badge} ${styles.badgeMissing}`}>
                              <AdminIcon name="alert" size={11} />필수 정보 누락 {missing.length}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* ── 상세 ── */}
        <section className={`${styles.card} ${styles.detailPanel} ${mobileOpen ? '' : styles.detailPanelHidden}`}>
          {selected ? (
            <DetailPanel
              req={selected}
              readOnly={tab === 'completed'}
              busy={busy}
              downloading={downloading}
              onClose={() => setMobileOpen(false)}
              onDownloadState={setDownloading}
              onToast={toast}
              onApprove={() => setModal('approve')}
              onReject={() => { setReason(''); setModal('reject') }}
            />
          ) : !loading && !failed ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="verify" size={32} /></span>
              <strong className={styles.stateStrong}>검토할 신청을 선택하세요</strong>
              <p className={styles.stateDesc}>왼쪽 목록에서 신청을 고르면 상세 내용이 표시됩니다.</p>
            </div>
          ) : null}
        </section>
      </div>

      {modal === 'approve' && selected && (
        <ConfirmModal
          title="인증을 승인할까요?"
          confirmLabel="인증 승인"
          confirmClass={styles.btnApprove}
          busy={busy}
          onCancel={() => setModal(null)}
          onConfirm={doApprove}
        >
          <p className={styles.modalBody}>
            <b>{selected.shops?.name ?? '샵'}</b>의 사장님을 <b>{selected.profiles?.nickname ?? '신청자'}</b>님으로 지정합니다.
          </p>
          <p className={styles.modalMuted}>
            승인하면 이 분이 매장 정보·영업시간·사진을 직접 관리할 수 있게 됩니다.
            공식 샵 표시(is_verified)는 이 처리로 바뀌지 않습니다.
            처리 결과는 신청자 알림과 인증 현황에 표시됩니다.
          </p>
        </ConfirmModal>
      )}

      {modal === 'reject' && selected && (
        <ConfirmModal
          title="인증 신청을 거절할까요?"
          confirmLabel="거절"
          confirmClass={styles.btnDanger}
          busy={busy}
          initialFocus="textarea"
          onCancel={() => setModal(null)}
          onConfirm={doReject}
        >
          <p className={styles.modalBody}>
            <b>{selected.shops?.name ?? '샵'}</b> · 신청자 <b>{selected.profiles?.nickname ?? '알 수 없음'}</b>
          </p>
          <label className={styles.label} htmlFor="verify-reject-reason">거절 사유 (선택)</label>
          <textarea
            id="verify-reject-reason"
            className={styles.textarea}
            value={reason}
            maxLength={500}
            onChange={e => setReason(e.target.value)}
            placeholder="신청자가 무엇을 보완해야 하는지 적어주세요"
          />
          <div className={styles.counter}>{reason.length} / 500</div>
          {reason.trim() === '' && (
            <p className={styles.modalWarn}>
              사유 없이 거절됩니다. 신청자는 거절 사실만 보고 무엇을 고쳐야 하는지 알 수 없어요.
            </p>
          )}
          <p className={styles.modalMuted}>
            사유는 신청자에게 그대로 표시됩니다. 처리 결과는 신청자 알림과 인증 현황에 표시됩니다.
          </p>
        </ConfirmModal>
      )}

      {msg && <div className={styles.toast} role="status">{msg}</div>}
    </div>
  )
}

function SumCard({ icon, tint, color, label, value, small }: {
  icon: AdminIconName; tint: string; color: string; label: string; value: string; small?: boolean
}) {
  return (
    <div className={styles.sumCard}>
      <span className={styles.sumIcon} style={{ background: tint }}>
        <AdminIcon name={icon} size={20} color={color} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className={styles.sumLabel}>{label}</div>
        <div className={small ? styles.sumValueSm : styles.sumValue}>{value}</div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: AdminIconName; text: string }> = {
    pending: { cls: styles.badgePending, icon: 'clock', text: '심사 대기' },
    approved: { cls: styles.badgeApproved, icon: 'checkCircle', text: '승인' },
    rejected: { cls: styles.badgeRejected, icon: 'close', text: '거절' },
  }
  const s = map[status]
  // 알 수 없는 status 는 원문을 그대로 보여준다(추측하지 않는다)
  if (!s) return <span className={`${styles.badge} ${styles.badgeMissing}`}>{status}</span>
  return (
    <span className={`${styles.badge} ${s.cls}`}>
      <AdminIcon name={s.icon} size={11} />{s.text}
    </span>
  )
}

/* ── 상세 패널 ───────────────────────────────────────────── */
function DetailPanel({ req, readOnly, busy, downloading, onClose, onDownloadState, onToast, onApprove, onReject }: {
  req: VerifyRequestRow
  readOnly: boolean
  busy: boolean
  downloading: boolean
  onClose: () => void
  onDownloadState: (v: boolean) => void
  onToast: (m: string) => void
  onApprove: () => void
  onReject: () => void
}) {
  const extra = req.extra
  const missing = missingLabels(req)
  const kind = req.evidence_url ? evidenceKind(req.evidence_url) : null

  // 이미지일 때만 서명 URL을 받아 인라인 미리보기. PDF는 렌더러를 새로 붙이지 않는다.
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgFailed, setImgFailed] = useState(false)
  useEffect(() => {
    if (!req.evidence_url || kind !== 'image') return
    let alive = true
    getEvidenceFileUrl(req.evidence_url)
      .then(u => { if (alive) { setImgUrl(u); setImgFailed(!u) } })
      .catch(() => { if (alive) { setImgUrl(null); setImgFailed(true) } })
    return () => { alive = false }
  }, [req.evidence_url, kind])

  async function openEvidence() {
    if (!req.evidence_url) return
    const url = await getEvidenceFileUrl(req.evidence_url)
    if (!url) { onToast('증빙 자료를 여는 데 실패했어요'); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  async function downloadEvidence() {
    if (!req.evidence_url || downloading) return
    onDownloadState(true)
    const url = await getEvidenceFileUrl(req.evidence_url, { download: true })
    onDownloadState(false)
    if (!url) { onToast('내려받기 링크를 만들지 못했어요'); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); onToast(`${what}를 복사했어요`) }
    catch { onToast('복사하지 못했어요') }
  }

  return (
    <div>
      {/* 모바일 전용 상단 바 */}
      <div className={styles.mobileBar}>
        <button type="button" className={styles.btnGhost} style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border)' }}
          onClick={onClose}>
          <AdminIcon name="chevron" size={15} style={{ transform: 'rotate(180deg)' }} /> 목록으로
        </button>
      </div>

      <div className={styles.detail}>
        {/* 1. 신청 개요 */}
        <div className={styles.detailHead}>
          <div style={{ minWidth: 0 }}>
            <div className={styles.detailTitleRow}>
              <StatusBadge status={req.status} />
              {req.extra?.transfer && <span className={`${styles.badge} ${styles.badgeTransfer}`}>인증 이전 요청</span>}
            </div>
            <div className={styles.detailTitle}>{req.shops?.name ?? '삭제된 샵'}</div>
            <div className={styles.detailMeta}>
              신청일 {fmtDate(req.created_at)}
              {/* 처리일 전용 컬럼이 없어 updated_at 을 쓴다 — pending 에서는 생성 시각과 같아 표시하지 않는다 */}
              {req.status !== 'pending' && req.updated_at && <> · 처리일 {fmtDateTime(req.updated_at)}</>}
              {/* 처리자는 reviewed_by FK 조인 결과가 있을 때만 */}
              {req.status !== 'pending' && hasText(req.reviewer?.nickname) && <> · 처리자 {req.reviewer!.nickname}</>}
            </div>
          </div>
          {req.shops?.slug && (
            <Link href={ROUTES.shop(req.shops.slug)} target="_blank" rel="noopener noreferrer" className={styles.shopLink}>
              샵 보기 <AdminIcon name="external" size={13} />
            </Link>
          )}
        </div>

        {missing.length > 0 && (
          <div className={styles.modalWarn} style={{ marginTop: 0 }}>
            필수 정보 누락: {missing.join(', ')}
          </div>
        )}

        {/* 2·3. 신청자 정보 / 사업자 정보 — 좌우 카드 */}
        <div className={styles.section}>
          <div className={styles.infoCards}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}>신청자 정보</div>
              <InfoRow label="신청자" value={req.profiles?.nickname ?? null} hint="계정 닉네임" />
              <InfoRow label="담당자" value={hasText(extra?.manager)
                ? extra!.manager + (hasText(extra?.position) ? ` (${extra!.position})` : '') : null} />
              <InfoRow label="연락처" value={extra?.phone ?? null}
                onCopy={hasText(extra?.phone) ? () => copy(extra!.phone!, '연락처') : undefined} />
              <InfoRow label="신청서 이메일" value={extra?.email ?? null}
                onCopy={hasText(extra?.email) ? () => copy(extra!.email!, '이메일') : undefined} />
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}>사업자 정보 <span style={{ fontWeight: 600, color: 'var(--muted)' }}>(신청서 입력)</span></div>
              <InfoRow label="상호" value={extra?.bizName ?? null} />
              <InfoRow label="사업자등록번호" value={extra?.bizNo ?? null}
                onCopy={hasText(extra?.bizNo) ? () => copy(extra!.bizNo!, '사업자등록번호') : undefined} />
              <InfoRow label="대표자명" value={extra?.owner ?? null} optional />
            </div>
          </div>
        </div>

        {Array.isArray(extra?.features) && extra!.features!.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>관리하고 싶은 기능</div>
            <div className={styles.chips}>
              {extra!.features!.map(f => <span key={f} className={styles.chip}>{f}</span>)}
            </div>
          </div>
        )}

        {/* note 는 extra 를 문자열로 다시 쓴 값이다. extra 가 있으면 중복이라 안 보여준다. */}
        {!extra && hasText(req.note) && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>신청 내용</div>
            <div className={styles.noteBox}>
              <div className={styles.noteBody}>{req.note}</div>
            </div>
          </div>
        )}

        {/* 4. 제출한 증빙 자료 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>제출한 증빙 자료</div>
          {!req.evidence_url ? (
            <div className={styles.evidence}>
              <span className={styles.infoEmpty}>
                증빙 자료가 제출되지 않았습니다
                <span className={`${styles.badge} ${styles.badgeMissing}`}>필수 정보 누락</span>
              </span>
            </div>
          ) : (
            <div className={styles.evidence}>
              <div className={styles.evidenceTop}>
                <span className={styles.evidenceIcon}><AdminIcon name="doc" size={20} /></span>
                <span className={styles.evidenceName}>{EVIDENCE_LABEL[kind ?? 'other']}</span>
                <span className={styles.evidenceActs}>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={openEvidence}>
                    <AdminIcon name="external" size={15} />새 탭에서 보기
                  </button>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={downloadEvidence} disabled={downloading}>
                    {downloading ? '준비 중…' : '내려받기'}
                  </button>
                </span>
              </div>

              {kind === 'image' && (
                <div className={styles.preview}>
                  {imgUrl && !imgFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrl} alt="신청자가 제출한 증빙 자료" className={styles.previewImg}
                      onError={() => setImgFailed(true)} />
                  ) : (
                    <p className={styles.previewMsg}>
                      {imgFailed ? '미리보기를 불러오지 못했어요. 새 탭에서 열어보세요.' : '미리보기를 불러오는 중…'}
                    </p>
                  )}
                </div>
              )}
              {kind === 'pdf' && <p className={styles.previewMsg} style={{ padding: '14px 0 0' }}>PDF는 새 탭에서 확인할 수 있어요.</p>}
            </div>
          )}
        </div>

        {/* 5. 처리 작업 */}
        {readOnly ? (
          <div className={styles.readonlyNote}>
            이미 처리된 신청입니다. 내용과 증빙은 읽기 전용입니다.
            {req.status === 'rejected' && (
              <div className={styles.reasonBox}>
                <div className={styles.reasonHead}>거절 사유</div>
                <div className={styles.reasonBody}>{hasText(req.reject_reason) ? req.reject_reason : '사유 미입력'}</div>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.actions}>
            <p className={styles.actionsNote}>
              신청자와 사업자 정보를 확인한 뒤 처리해주세요. 처리 결과는 신청자 알림과 인증 현황에 표시됩니다.
            </p>
            <div className={styles.actionsBtns}>
              <button type="button" className={`${styles.btn} ${styles.btnReject}`} onClick={onReject} disabled={busy}>거절</button>
              <button type="button" className={`${styles.btn} ${styles.btnApprove}`} onClick={onApprove} disabled={busy}>
                {busy ? '처리 중…' : '인증 승인'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** 라벨 / 값 한 줄. optional 인 항목은 비어도 누락 배지를 붙이지 않는다. */
function InfoRow({ label, value, onCopy, optional, hint }: {
  label: string; value: string | null | undefined
  onCopy?: () => void; optional?: boolean; hint?: string
}) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}{hint && <><br />({hint})</>}</span>
      {hasText(value) ? (
        <span className={styles.infoValue}>
          {value}
          {onCopy && (
            <button type="button" className={styles.copyBtn} onClick={onCopy} aria-label={`${label} 복사`}>
              <AdminIcon name="copy" size={13} />
            </button>
          )}
        </span>
      ) : (
        <span className={styles.infoEmpty}>
          미입력
          {!optional && <span className={`${styles.badge} ${styles.badgeMissing}`}>필수 정보 누락</span>}
        </span>
      )}
    </div>
  )
}

/* ── 확인 모달 ────────────────────────────────────────────
   ESC 닫기, 초기 포커스, Tab 순환(focus trap), 닫을 때 원래 버튼으로 포커스 복귀. */
function ConfirmModal({ title, children, confirmLabel, confirmClass, busy, initialFocus, onCancel, onConfirm }: {
  title: string
  children: React.ReactNode
  confirmLabel: string
  confirmClass: string
  busy: boolean
  initialFocus?: 'textarea'
  onCancel: () => void
  onConfirm: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)

  /* onCancel 을 의존성에 넣으면 안 된다.
     부모가 인라인 화살표 함수를 넘기면 매 렌더 새 함수가 되어 effect 가 다시 돌고,
     그때마다 textarea.focus() 가 재실행된다. 한글은 조합 중에 포커스가 다시 들어오면
     조합이 끊겨 '신청'이 '시ㅊㅇ'처럼 깨진다.
     그래서 최신 콜백은 ref 로만 들고, 아래 effect 는 마운트에 한 번만 돌린다. */
  const cancelRef = useRef(onCancel)
  useEffect(() => { cancelRef.current = onCancel })

  useEffect(() => {
    openerRef.current = document.activeElement
    const box = boxRef.current
    const target = initialFocus === 'textarea'
      ? box?.querySelector<HTMLElement>('textarea')
      : box?.querySelector<HTMLElement>('[data-confirm]')
    target?.focus()

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cancelRef.current(); return }
      if (e.key !== 'Tab' || !box) return
      const items = box.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea, input, a[href], [tabindex]:not([tabindex="-1"])')
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
    // 마운트에 한 번만. 위 주석 참고 — 의존성을 늘리면 한글 입력이 깨진다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div ref={boxRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="verify-modal-title"
        onClick={e => e.stopPropagation()}>
        <h2 id="verify-modal-title" className={styles.modalTitle}>{title}</h2>
        {children}
        <div className={styles.modalActs}>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onCancel} disabled={busy}>취소</button>
          <button type="button" data-confirm className={`${styles.btn} ${confirmClass}`} onClick={onConfirm} disabled={busy}>
            {busy ? '처리 중…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
