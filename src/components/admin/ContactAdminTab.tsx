'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getAdminContactMessages, updateContactMessage, ContactMessage,
} from '@/services/contactService'
import { CONTACT_TYPES, FIELD_DEFS, FieldKey } from '@/components/contact/contactConfig'
import { PARTNER_TYPES, P_FIELD_DEFS, COLLAB_FIELDS, PFieldKey } from '@/components/contact/partnerConfig'
import AdminIcon, { AdminIconName } from './AdminIcon'
import styles from './contactAdmin.module.css'

/* 관리자 > 문의 관리 · 제휴 문의.
   같은 컴포넌트를 onlyType / excludeType 으로 나눠 쓴다(AdminPage 가 그렇게 넘긴다).

   조회는 get_admin_contact_messages RPC 를 거친다. 예전에는 select('*') 로 테이블을
   직접 읽었는데, 그러면 admin_note(내부 메모)의 SELECT 권한을 authenticated 에서
   회수할 수 없었다 — 회수하면 관리자 화면도 같이 막히기 때문이다.
   type 필터도 서버에서 건다. 예전에는 전부 받아와 JS 에서 걸러서, 문의 관리 탭이
   제휴 문의 행까지 받아 버렸다.

   status 와 검색은 화면에서 거른다. 탭을 옮길 때마다 다시 조회하지 않기 위해서다.

   문의 내용은 전부 사용자 입력이라 항상 일반 텍스트로만 그린다. */

type TabId = 'open' | 'done'
type SortId = 'old' | 'new'

const STATUS_LABEL: Record<string, string> = { pending: '대기', processing: '처리중', done: '완료' }
const STATUS_CLASS: Record<string, string> = {
  pending: styles.badgePending, processing: styles.badgeProcessing, done: styles.badgeDone,
}

const typeLabel = (t: string) =>
  CONTACT_TYPES.find(c => c.key === t)?.label ?? t

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

/** 첨부 URL 은 사용자 업로드 경로다. http(s) 만 링크로 연다. */
function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = new globalThis.URL(raw.trim())
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null
  } catch { return null }
}

interface Row { label: string; value: string }

/** 문의 원문을 라벨/값 목록으로. 값이 없는 필드는 아예 넣지 않는다. */
function generalRows(m: ContactMessage): Row[] {
  const x = (m.extra ?? {}) as Record<string, unknown>
  const type = CONTACT_TYPES.find(t => t.key === m.type)
  const fields: FieldKey[] = type?.fields?.length ? type.fields : (['title', 'content'] as FieldKey[])
  const rows: Row[] = []
  for (const f of fields) {
    const def = FIELD_DEFS[f]
    if (!def) continue
    const v = f === 'title' ? m.title : f === 'content' ? m.content : x[f]
    if (hasText(v)) rows.push({ label: def.label, value: v })
  }
  return rows
}

function partnerRows(m: ContactMessage): Row[] {
  const x = (m.extra ?? {}) as Record<string, unknown>
  const type = PARTNER_TYPES.find(t => t.label === x.partnerType)
  const rows: Row[] = []
  const push = (label: string, v: unknown) => { if (hasText(v)) rows.push({ label, value: v }) }

  push('제휴 유형', x.partnerType)
  push('담당자', x.manager)
  push('회사/매장명', x.company)
  push('연락처', x.phone)
  push('홈페이지', x.homepage)
  push('Instagram', x.instagram)
  push('X', x.x)
  push('기타 SNS', x.snsEtc)

  for (const f of (type?.fields ?? []) as PFieldKey[]) {
    const def = P_FIELD_DEFS[f]
    if (def) push(def.label, x[f])
  }

  const collab = Array.isArray(x.collab) ? (x.collab as string[]).filter(c => COLLAB_FIELDS.includes(c)) : []
  const collabEtc = collab.includes('기타') && hasText(x.collabEtc) ? ` (${x.collabEtc})` : ''
  if (collab.length) rows.push({ label: '예상 협업 분야', value: collab.join(', ') + collabEtc })

  if (hasText(m.content)) rows.push({ label: '제휴 내용', value: m.content })
  return rows
}

export default function ContactAdminTab({ onlyType, excludeType, onSaved }: {
  onlyType?: string
  excludeType?: string
  /** 처리하고 나면 상위(AdminPage)의 사이드바 배지를 다시 맞춘다 */
  onSaved?: () => void
} = {}) {
  const isPartner = onlyType === 'partner'
  const [tab, setTab] = useState<TabId>('open')
  const [sort, setSort] = useState<SortId>('old')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const [items, setItems] = useState<ContactMessage[]>([])
  const [failed, setFailed] = useState(false)
  const [reload, setReload] = useState(0)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const key = `${onlyType ?? ''}|${excludeType ?? ''}|${reload}`
  const loading = loadedKey !== key

  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  const [busy, setBusy] = useState(false)

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
    getAdminContactMessages({ onlyType, excludeType })
      .then(rows => {
        if (!alive) return
        setItems(rows); setFailed(false); setLoadedKey(key); setCheckedAt(new Date())
      })
      .catch(e => {
        if (!alive) return
        console.error('[문의 관리] 조회 실패:', e)
        setItems([]); setFailed(true); setLoadedKey(key)
      })
    return () => { alive = false }
  }, [key, onlyType, excludeType])

  const summary = useMemo(() => ({
    open: items.filter(m => m.status !== 'done').length,
    pending: items.filter(m => m.status === 'pending').length,
    done: items.filter(m => m.status === 'done').length,
  }), [items])

  /* 이 목록에 실제로 들어 있는 유형만 필터 선택지로 만든다.
     폼에는 5종이 정의돼 있지만 접수된 적 없는 유형을 고를 수 있으면 헷갈린다. */
  const typeOptions = useMemo(() => {
    const seen = Array.from(new Set(items.map(m => m.type)))
    return seen.sort((a, b) => typeLabel(a).localeCompare(typeLabel(b), 'ko'))
  }, [items])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = items.filter(m => {
      if (tab === 'open' ? m.status === 'done' : m.status !== 'done') return false
      if (typeFilter && m.type !== typeFilter) return false
      if (q === '') return true
      return (m.title ?? '').toLowerCase().includes(q)
        || (m.content ?? '').toLowerCase().includes(q)
        || (m.email ?? '').toLowerCase().includes(q)
    })
    const t = (m: ContactMessage) => new Date(m.created_at).getTime()
    return [...filtered].sort((a, b) => sort === 'old' ? t(a) - t(b) : t(b) - t(a))
  }, [items, tab, typeFilter, query, sort])

  // 첫 항목 자동 선택 — 상태로 두지 않고 파생값으로 구한다
  const selected = shown.find(m => m.id === selectedId) ?? shown[0] ?? null

  async function save(nextStatus: string, answer: string, note: string) {
    if (!selected || busy) return
    setBusy(true)
    const res = await updateContactMessage(selected.id, {
      status: nextStatus, answer, adminNote: note,
    })
    setBusy(false)
    if (!res.ok) { toast(res.error ?? '저장에 실패했어요'); return }

    const now = new Date().toISOString()
    setItems(prev => prev.map(m => m.id === selected.id
      ? { ...m, status: nextStatus, answer, admin_note: note,
          answered_at: nextStatus === 'done' ? (m.answered_at ?? now) : m.answered_at }
      : m))
    onSaved?.()
    toast(nextStatus === 'done' ? '답변을 완료 처리했어요' : '저장했어요')
  }

  const title = isPartner ? '제휴 문의' : '문의 관리'
  const listCount = shown.length

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.h1}>{title}</h1>
          <p className={styles.headSub}>
            {isPartner
              ? '접수된 제휴 문의를 확인하고 답변하세요'
              : '접수된 문의를 확인하고 답변하세요. 답변을 완료하면 문의자에게 알림이 갑니다'}
          </p>
        </div>
        <div className={styles.headRight}>
          {checkedAt && <span className={styles.updatedAt}>마지막 확인 {fmtTime(checkedAt)}</span>}
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => { if (!loading) setReload(k => k + 1) }} disabled={loading}>
            <AdminIcon name="refresh" size={16} />{loading ? '불러오는 중' : '새로고침'}
          </button>
        </div>
      </div>

      <div className={styles.summary}>
        <SumCard icon="inbox" on={summary.open > 0} label="미처리" value={loading ? '—' : String(summary.open)} />
        <SumCard icon="clock" on={summary.pending > 0} label="대기" value={loading ? '—' : String(summary.pending)} />
        <SumCard icon="checkCircle" on={false} label="완료" value={loading ? '—' : String(summary.done)} />
      </div>

      <div className={styles.tabs} role="tablist" aria-label={title}>
        {([['open', '미처리'], ['done', '완료']] as [TabId, string][]).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabOn : ''}`}
            onClick={() => { setTab(id); setSelectedId(null); setMobileOpen(false) }}>
            {label}
            {id === 'open' && !loading && summary.open > 0 && <span className={styles.tabCount}>{summary.open}</span>}
          </button>
        ))}
      </div>

      <div className={styles.split}>
        <section className={styles.card}>
          <div className={styles.listHead}>
            <h2 className={styles.listTitle}>{tab === 'open' ? '미처리' : '완료'}</h2>
            <span className={styles.listCount}>{loading ? '—' : `${listCount}건`}</span>
          </div>
          <div className={styles.tools}>
            <span className={styles.searchWrap}>
              <span className={styles.searchIcon}><AdminIcon name="search" size={17} /></span>
              <input className={styles.search} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="제목, 내용 또는 이메일" aria-label="문의 검색" />
            </span>
            {!isPartner && typeOptions.length > 1 && (
              <select className={styles.select} value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="문의 유형 필터">
                <option value="">유형 전체</option>
                {typeOptions.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
              </select>
            )}
            <select className={styles.select} value={sort} onChange={e => setSort(e.target.value as SortId)} aria-label="정렬">
              <option value="old">오래된 순</option>
              <option value="new">최근 순</option>
            </select>
          </div>

          {loading ? (
            [0, 1, 2].map(i => (
              <div key={i} className={styles.skelRow}>
                <div className={styles.skel} style={{ width: '60%', height: 14 }} />
                <div className={styles.skel} style={{ width: '40%', height: 11 }} />
              </div>
            ))
          ) : failed ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="alert" size={32} /></span>
              <strong className={styles.stateStrong}>목록을 불러오지 못했어요</strong>
              <p className={styles.stateDesc}>잠시 후 다시 시도해주세요.</p>
              <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.stateBtn}`}
                onClick={() => setReload(k => k + 1)}>다시 시도</button>
            </div>
          ) : listCount === 0 ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="checkCircle" size={34} /></span>
              {query.trim() !== '' || typeFilter !== '' ? (
                <>
                  <strong className={styles.stateStrong}>검색 결과가 없습니다</strong>
                  <p className={styles.stateDesc}>다른 검색어나 유형으로 찾아보세요.</p>
                </>
              ) : tab === 'open' ? (
                <>
                  <strong className={styles.stateStrong}>처리할 문의가 없습니다</strong>
                  <p className={styles.stateDesc}>
                    새 문의가 접수되면 이곳에 표시됩니다.
                    {checkedAt && <><br />마지막 확인 {fmtTime(checkedAt)}</>}
                  </p>
                </>
              ) : (
                <>
                  <strong className={styles.stateStrong}>완료한 문의가 없습니다</strong>
                  <p className={styles.stateDesc}>답변을 완료한 문의가 이곳에 쌓입니다.</p>
                </>
              )}
            </div>
          ) : (
            <div className={styles.rows}>
              {shown.map(m => {
                const on = selected?.id === m.id
                return (
                  <button key={m.id} type="button" aria-current={on ? 'true' : undefined}
                    className={`${styles.row} ${on ? styles.rowOn : ''}`}
                    onClick={() => { setSelectedId(m.id); setMobileOpen(true) }}>
                    <span className={styles.rowTop}>
                      <span className={styles.rowTitle}>{m.title?.trim() || '제목 없음'}</span>
                      <span className={`${styles.badge} ${STATUS_CLASS[m.status] ?? styles.badgeType}`}>
                        {STATUS_LABEL[m.status] ?? m.status}
                      </span>
                    </span>
                    <span className={styles.rowMeta}>
                      {!isPartner && <>{typeLabel(m.type)} · </>}{m.email || '이메일 없음'}
                    </span>
                    <span className={styles.rowMeta}>접수 {fmtDate(m.created_at)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className={`${styles.card} ${styles.detailPanel} ${mobileOpen ? '' : styles.detailPanelHidden}`}>
          {selected ? (
            <div>
              <div className={styles.mobileBar}>
                <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => setMobileOpen(false)}>
                  <AdminIcon name="chevron" size={15} style={{ transform: 'rotate(180deg)' }} /> 목록으로
                </button>
              </div>
              <DetailPanel key={selected.id} m={selected} isPartner={isPartner} busy={busy} onSave={save} />
            </div>
          ) : !loading && !failed ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="contact" size={32} /></span>
              <strong className={styles.stateStrong}>문의를 선택하세요</strong>
              <p className={styles.stateDesc}>왼쪽 목록에서 문의를 고르면 내용과 답변 작성란이 표시됩니다.</p>
            </div>
          ) : null}
        </section>
      </div>

      {msg && <div className={styles.toast} role="status">{msg}</div>}
    </div>
  )
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

/* ── 상세 ───────────────────────────────────────────────────
   key={selected.id} 로 마운트를 새로 하므로, 문의를 바꾸면 답변·메모 입력값이
   effect 없이 초기화된다(react-hooks/set-state-in-effect 회피). */
function DetailPanel({ m, isPartner, busy, onSave }: {
  m: ContactMessage
  isPartner: boolean
  busy: boolean
  onSave: (status: string, answer: string, note: string) => void
}) {
  const [answer, setAnswer] = useState(m.answer ?? '')
  const [note, setNote] = useState(m.admin_note ?? '')

  const rows = isPartner ? partnerRows(m) : generalRows(m)
  const isDone = m.status === 'done'
  const canComplete = answer.trim() !== ''
  const files = (m.attachment_urls ?? []).filter(hasText)

  return (
    <div className={styles.detail}>
      <div className={styles.detailHead}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.detailTitleRow}>
            {!isPartner && <span className={`${styles.badge} ${styles.badgeType}`}>{typeLabel(m.type)}</span>}
            <span className={`${styles.badge} ${STATUS_CLASS[m.status] ?? styles.badgeType}`}>
              {STATUS_LABEL[m.status] ?? m.status}
            </span>
          </div>
          <div className={styles.detailTitle}>{m.title?.trim() || '제목 없음'}</div>
          <div className={styles.detailMeta}>
            접수 {fmtDateTime(m.created_at)} · 접수번호 #{m.id.slice(0, 8)}
          </div>
        </div>
      </div>

      {/* 1. 문의 원문 — 전부 사용자 입력이라 일반 텍스트로만 그린다 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>문의 내용</div>
        <div className={styles.infoBox}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>답변 받을 이메일</span>
            {hasText(m.email)
              ? <span className={styles.infoValue}>{m.email}</span>
              : <span className={styles.infoEmpty}>없음</span>}
          </div>
          {rows.map((r, i) => (
            <div key={i} className={styles.infoRow}>
              <span className={styles.infoLabel}>{r.label}</span>
              <span className={styles.infoValue}>{r.value}</span>
            </div>
          ))}
          {hasText(m.page_url) && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>문의한 화면</span>
              <span className={styles.infoValue}>{m.page_label || m.page_url}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. 첨부 */}
      {files.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>첨부 {files.length}개</div>
          <div className={styles.files}>
            {files.map((url, i) => {
              const safe = safeHttpUrl(url)
              return safe ? (
                <a key={i} href={safe} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
                  <AdminIcon name="doc" size={15} />첨부 {i + 1}
                </a>
              ) : (
                <span key={i} className={styles.fileLink} style={{ color: 'var(--muted)' }}>
                  첨부 {i + 1} (열 수 없는 주소)
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. 답변 */}
      <div className={styles.section}>
        <label className={styles.label} htmlFor={`answer-${m.id}`}>
          답변<span className={styles.labelHint}>문의자에게 그대로 보입니다</span>
        </label>
        <textarea id={`answer-${m.id}`} className={styles.textarea} rows={6}
          value={answer} onChange={e => setAnswer(e.target.value)}
          placeholder="문의자에게 전달할 답변을 작성하세요." />
        {m.answered_at && <div className={styles.answered}>답변 완료 · {fmtDateTime(m.answered_at)}</div>}
      </div>

      {/* 4. 내부 메모 */}
      <div className={styles.section}>
        <label className={styles.label} htmlFor={`note-${m.id}`}>
          내부 메모<span className={styles.labelHint}>관리자만 봅니다</span>
        </label>
        <textarea id={`note-${m.id}`} className={styles.textarea} rows={3}
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="예: 재현 불가, 메일 발송 완료, 개발 예정…" />
      </div>

      {/* 5. 처리 작업 */}
      <div className={styles.actions}>
        <p className={styles.actionsNote}>
          {isDone
            ? '이미 완료 처리된 문의입니다. 답변을 고쳐 저장해도 알림은 다시 가지 않습니다.'
            : '답변 완료로 저장하면 문의자에게 알림이 갑니다. 아직 정리 중이면 처리중으로 저장해두세요.'}
        </p>
        <div className={styles.actionsBtns}>
          {!isDone && (
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => onSave('processing', answer, note)} disabled={busy}>
              처리중으로 저장
            </button>
          )}
          <button type="button" className={`${styles.btn} ${styles.btnDone}`}
            onClick={() => onSave('done', answer, note)} disabled={busy || !canComplete}
            title={canComplete ? undefined : '답변을 먼저 작성해주세요'}>
            {busy ? '저장 중…' : isDone ? '저장' : '답변 완료'}
          </button>
        </div>
      </div>
    </div>
  )
}
