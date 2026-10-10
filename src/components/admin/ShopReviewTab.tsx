'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { getShopsForReview, setShopReviewStatus, processShopRequest, ShopReviewStatus } from '@/services/shopService'
import { Shop } from '@/types/shop'
import { quickCompleteness, shopRegion, QuickCheck } from '@/lib/shop/quickCompleteness'
import AdminIcon, { AdminIconName } from './AdminIcon'
import styles from './shopReview.module.css'

/* ============================================================
   샵 등록 요청 (2026-10-10 — 예전 '신규 샵 검수'를 바꿨다)

   일반 사용자가 등록한 샵은 바로 공개되지 않고 status='pending'(등록 요청)으로 들어온다.
   여기서 정보를 확인하고
     확인하고 공개  → active + 확인 완료 + 등록자 경험치(15) + 알림
     보완 요청      → 임시(hidden)로 되돌리고 '보완 요청' + 알림(사유)
   두 동작은 서버(/api/admin/shop-request, service_role)가 처리한다.
   관리자·인증 사장님이 등록한 샵은 지금처럼 바로 공개된다.

   ↓ 아래는 예전 설명 — 이미 공개된 샵(예전 방식)의 검수 대기도 '등록 요청' 탭에 같이 보인다.

   샵은 등록 즉시 공개된다(status='active'). 여기서 다루는 건 공개 여부가 아니라
   운영 검수 진행도(review_status)다 — 축이 다르다.
     pending          검수 대기
     needs_attention  추가 확인 필요
     reviewed         검수 완료
   기능 도입(2026-09-02) 전에 등록된 샵은 review_status가 NULL이라 여기 안 잡힌다.

   값은 DB 트리거가 강제한다. reviewed_at·reviewed_by를 클라이언트가 보내지 않고,
   관리자가 아니면 update 자체가 42501로 거부된다.

   정보 편집은 새로 만들지 않고 기존 /shop/{slug}/edit 화면을 그대로 쓴다.
   편집했다고 자동으로 '검수 완료'가 되지는 않는다 — 돌아와서 직접 눌러야 한다.
   ============================================================ */

const TABS: { value: ShopReviewStatus; label: string; icon: AdminIconName }[] = [
  { value: 'pending', label: '등록 요청', icon: 'inbox' },
  { value: 'needs_attention', label: '보완 요청', icon: 'alert' },
  { value: 'reviewed', label: '확인 완료', icon: 'checkCircle' },
]

const BADGE_CLASS: Record<ShopReviewStatus, string> = {
  pending: styles.badgePending,
  needs_attention: styles.badgeAttention,
  reviewed: styles.badgeReviewed,
}
const BADGE_LABEL: Record<ShopReviewStatus, string> = {
  pending: '등록 요청',
  needs_attention: '보완 요청',
  reviewed: '확인 완료',
}

/** 공개 상태를 사람 말로 */
const PUBLIC_LABEL: Record<string, string> = {
  pending: '등록 요청 · 비공개',
  hidden: '임시저장 · 비공개',
  active: '공개 중',
  temporary_closed: '임시휴업',
  closed: '폐업',
}

/** 완성도 '충족' 경계 — 샵 관리 화면과 같은 기준(기존 pct()의 초록 기준) */
const COMPLETE_MIN = 80
/** 이 시간을 넘게 기다린 건만 절제된 경고색. 운영 기준이 따로 없어 표시용으로만 쓴다 */
const LONG_WAIT_HOURS = 24

function waitedText(createdAt: string, now: number): { text: string; long: boolean } {
  const ms = now - new Date(createdAt).getTime()
  const h = Math.floor(ms / 3600000)
  if (h < 1) return { text: `${Math.max(0, Math.floor(ms / 60000))}분 대기`, long: false }
  if (h < 24) return { text: `${h}시간 대기`, long: h >= LONG_WAIT_HOURS }
  return { text: `${Math.floor(h / 24)}일 ${h % 24}시간 대기`, long: true }
}

/** javascript: 같은 스킴을 걸러낸다 */
function safeUrl(raw: string | null): string | null {
  if (!raw) return null
  const v = raw.trim()
  if (!v) return null
  try {
    const u = new URL(v.startsWith('http') ? v : `https://${v}`)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch { return null }
}

export default function ShopReviewTab({ onReviewed }: { onReviewed?: () => void }) {
  const [tab, setTab] = useState<ShopReviewStatus>('pending')
  const [shops, setShops] = useState<Shop[]>([])
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [reloadKey, setReloadKey] = useState(0)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const loadKey = `${tab}|${reloadKey}`
  const loading = loadedKey !== loadKey

  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 대기시간 계산 기준 시각. 렌더마다 Date.now()를 부르면 순수하지 않으므로 한 번만 잡는다
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    const key = loadKey
    getShopsForReview(tab)
      .then((rows) => {
        if (!alive) return
        setShops(rows)
        setFailed(false)
        setFetchedAt(new Date())
        setNow(Date.now())
        setLoadedKey(key)
      })
      .catch((e) => {
        if (!alive) return
        console.error('[샵 검수] 목록 실패:', e)
        setShops([])
        setFailed(true)
        setLoadedKey(key)
      })
    return () => { alive = false }
  }, [loadKey, tab])

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current) }, [])

  function showNotice(ok: boolean, text: string) {
    setNotice({ ok, text })
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    if (ok) noticeTimer.current = setTimeout(() => setNotice(null), 5000)
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? shops.filter((s) =>
          s.name.trim().toLowerCase().includes(needle) ||
          (s.name_en ?? '').toLowerCase().includes(needle) ||   // 영문 이름으로도
          shopRegion(s).toLowerCase().includes(needle))
      : shops
    return list.map((s) => ({ shop: s, cp: quickCompleteness(s), region: shopRegion(s) }))
  }, [shops, q])

  // 목록이 바뀌면 선택을 첫 항목으로. 비어 있으면 아무것도 선택하지 않는다
  const listKey = `${tab}|${reloadKey}|${rows.map((r) => r.shop.id).join(',')}`
  const [prevListKey, setPrevListKey] = useState(listKey)
  if (listKey !== prevListKey) {
    setPrevListKey(listKey)
    const stillThere = selectedId && rows.some((r) => r.shop.id === selectedId)
    if (!stillThere) setSelectedId(rows.length > 0 ? rows[0].shop.id : null)
  }

  const selected = rows.find((r) => r.shop.id === selectedId) ?? null

  /** 확인하고 공개(경험치 지급) / 보완 요청 — 서버가 처리한다 */
  async function processRequest(s: Shop, action: 'approve' | 'return') {
    let note = ''
    if (action === 'approve') {
      if (!confirm(`"${s.name}"을(를) 확인 완료하고 ${s.status === 'active' ? '' : '지도에 공개하고 '}등록자에게 경험치를 줄까요?`)) return
    } else {
      // ⚠️ prompt 는 취소하면 null — 취소를 '빈 사유로 진행'으로 받으면 안 된다
      const v = window.prompt(`"${s.name}" 등록자에게 보완 요청을 보내요.\n무엇을 채우면 좋을지 적어 주세요 (비워도 돼요).`, '')
      if (v === null) return
      note = v.trim()
    }
    setBusyId(s.id)
    const res = await processShopRequest(s.id, action, note)
    setBusyId(null)
    const label = action === 'approve' ? '공개' : '보완 요청'
    if (!res.ok) {
      showNotice(false, `"${s.name}" ${label} 처리에 실패했어요. ${res.error ?? ''}`)
      return
    }
    showNotice(!res.rewardFailed, action === 'approve'
      ? (res.rewardFailed
          ? `"${s.name}"은(는) 공개됐지만 경험치 지급에 실패했어요. '확인 완료' 탭에서 다시 눌러 주세요.`
          : `"${s.name}"을(를) 공개했어요.${res.rewarded ? ' 등록자에게 경험치를 줬어요.' : ''}`)
      : `"${s.name}" 등록자에게 보완 요청을 보냈어요.`)
    setReloadKey((k) => k + 1)
    onReviewed?.()
  }

  async function changeStatus(s: Shop, next: ShopReviewStatus, label: string) {
    if (!confirm(`"${s.name}"을(를) ${label} 처리할까요?`)) return
    setBusyId(s.id)
    const res = await setShopReviewStatus(s.id, next)
    setBusyId(null)
    if (!res.ok) {
      showNotice(false, `"${s.name}" ${label} 처리에 실패했어요. ${res.error ?? ''}`)
      return
    }
    showNotice(true, `"${s.name}"을(를) ${label} 처리했어요.`)
    setReloadKey((k) => k + 1)   // 목록·개수 다시 불러오기
    onReviewed?.()               // 사이드바 배지·대시보드 갱신
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.h1}>샵 등록 요청</h1>
          <p className={styles.headSub}>사용자가 등록한 샵이에요. 정보가 잘 적혀 있으면 ‘확인하고 공개’를 눌러 주세요 — 지도에 공개되고 등록자에게 경험치 15가 지급돼요.</p>
        </div>
        <div className={styles.headRight}>
          {fetchedAt && (
            <span className={styles.updatedAt}>
              {fetchedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
            </span>
          )}
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
          >
            <AdminIcon name="checkin" size={16} />{loading ? '불러오는 중…' : '새로고침'}
          </button>
        </div>
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

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={tab === t.value ? `${styles.tab} ${styles.tabOn}` : styles.tab}
            aria-pressed={tab === t.value}
            onClick={() => setTab(t.value)}
          >
            {t.label}
            {tab === t.value && !loading && <span className={styles.tabCount}>{shops.length}</span>}
          </button>
        ))}
      </div>

      <div className={styles.split}>
        {/* ── 목록 ── */}
        <section className={styles.card}>
          <div className={styles.listHead}>
            <h2 className={styles.listTitle}>{BADGE_LABEL[tab]}</h2>
            <span className={styles.listCount}>{loading ? '—' : `${rows.length}건`}</span>
          </div>

          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}><AdminIcon name="search" size={18} /></span>
            <input
              className={styles.search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="샵명(한글·영문) 또는 지역 검색"
              aria-label="샵명(한글·영문) 또는 지역 검색"
            />
          </div>

          {loading ? (
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.skelRow}>
                  <div className={styles.skel} style={{ width: 46, height: 46 }} />
                  <div style={{ flex: 1 }}>
                    <div className={styles.skel} style={{ width: '50%', height: 14, marginBottom: 7 }} />
                    <div className={styles.skel} style={{ width: '32%', height: 11 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : failed ? (
            <div className={styles.state}>
              <strong className={styles.stateStrong}>목록을 불러오지 못했어요</strong>
              잠시 후 다시 시도해 주세요.
              <div>
                <button type="button" className={styles.ghostBtn} style={{ marginTop: 14 }} onClick={() => setReloadKey((k) => k + 1)}>
                  다시 불러오기
                </button>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="checkCircle" size={34} /></span>
              {q.trim() ? (
                <>
                  <strong className={styles.stateStrong}>검색 결과가 없습니다</strong>
                  다른 검색어로 찾아보세요.
                </>
              ) : tab === 'pending' ? (
                <>
                  <strong className={styles.stateStrong}>등록 요청이 없습니다</strong>
                  사용자가 샵을 등록 요청하면 이곳에 표시됩니다.
                </>
              ) : (
                <>
                  <strong className={styles.stateStrong}>{BADGE_LABEL[tab]} 상태인 샵이 없습니다</strong>
                </>
              )}
            </div>
          ) : (
            <div className={styles.rows}>
              {rows.map(({ shop: s, cp, region }) => {
                const w = waitedText(s.created_at, now)
                const done = cp.checks.filter((c: QuickCheck) => c.ok).length
                const on = s.id === selectedId
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={on ? `${styles.row} ${styles.rowOn}` : styles.row}
                    aria-current={on ? 'true' : undefined}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <span className={styles.thumb}>
                      {s.images?.[0]
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={s.images[0]} alt="" />
                        : <AdminIcon name="shop" size={20} />}
                    </span>
                    <span className={styles.rowBody}>
                      <span className={styles.rowName}>{s.name}</span>
                      <span className={styles.rowMeta}>{region} · 정보 {done}/{cp.checks.length}</span>
                    </span>
                    <span className={styles.rowRight}>
                      <span className={w.long ? `${styles.waited} ${styles.waitedLong}` : styles.waited}>{w.text}</span>
                      <span className={styles.bar} aria-hidden="true">
                        {cp.checks.map((c: QuickCheck, i: number) => (
                          <span
                            key={c.label}
                            className={i < done
                              ? `${styles.seg} ${cp.percent >= COMPLETE_MIN ? styles.segAll : styles.segDone}`
                              : styles.seg}
                          />
                        ))}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* ── 상세 검토 ── */}
        <section className={styles.card}>
          {!selected ? (
            <div className={styles.state}>
              <span className={styles.stateIcon}><AdminIcon name="doc" size={34} /></span>
              왼쪽에서 샵을 선택하면 상세 정보가 표시됩니다.
            </div>
          ) : (
            <ShopReviewDetail
              row={selected}
              busy={busyId === selected.shop.id}
              tab={tab}
              onChange={changeStatus}
              onProcess={processRequest}
            />
          )}
        </section>
      </div>
    </div>
  )
}

function ShopReviewDetail({ row, busy, tab, onChange, onProcess }: {
  row: { shop: Shop; cp: ReturnType<typeof quickCompleteness>; region: string }
  busy: boolean
  tab: ShopReviewStatus
  onChange: (s: Shop, next: ShopReviewStatus, label: string) => void
  onProcess: (s: Shop, action: 'approve' | 'return') => void
}) {
  const s = row.shop
  const done = row.cp.checks.filter((c: QuickCheck) => c.ok).length
  const missing = row.cp.checks.filter((c: QuickCheck) => !c.ok).map((c: QuickCheck) => c.label)
  const complete = row.cp.percent >= COMPLETE_MIN
  const link = safeUrl(s.shop_link)

  return (
    <>
      <div className={styles.detailHead}>
        <div style={{ minWidth: 0 }}>
          <h2 className={styles.detailName}>{s.name}</h2>
          <span className={styles.detailSub}>
            등록 {new Date(s.created_at).toLocaleString('ko-KR')} · {PUBLIC_LABEL[s.status] ?? s.status}
          </span>
        </div>
        <span className={`${styles.badge} ${BADGE_CLASS[tab]}`}>{BADGE_LABEL[tab]}</span>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>기본 정보</h3>
        <Field k="샵명" v={s.name} />
        <Field k="카테고리" v={s.cats?.length ? s.cats.join(', ') : null} />
        <Field k="주소" v={s.addr} />
        <Field k="지역" v={row.region} />
        <Field k="좌표" v={s.lat != null && s.lng != null ? `${s.lat}, ${s.lng}` : null} />
        <Field k="소개" v={s.description} />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>연락처와 링크</h3>
        <Field k="전화번호" v={s.phone} />
        <div className={styles.field}>
          <span className={styles.fieldKey}>웹사이트</span>
          <span className={styles.fieldVal}>
            {link
              ? <a className={styles.extLink} href={link} target="_blank" rel="noreferrer noopener">{link} ↗</a>
              : <span className={styles.empty}>미등록</span>}
          </span>
        </div>
        <Field k="영업시간" v={s.hours ? '등록됨' : null} />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>등록 이미지 {s.images?.length ? `(${s.images.length}장)` : ''}</h3>
        {s.images?.length ? (
          <div className={styles.photos}>
            {s.images.map((url, i) => (
              <a key={url} className={styles.photo} href={url} target="_blank" rel="noreferrer noopener"
                 aria-label={`${s.name} 등록 이미지 ${i + 1} 원본 보기`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${s.name} 등록 이미지 ${i + 1}`} />
              </a>
            ))}
          </div>
        ) : (
          <span className={styles.empty}>등록된 이미지가 없습니다</span>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>정보 완성도</h3>
        <div className={styles.metaRow}>
          <span className={styles.metaBar} aria-hidden="true">
            {row.cp.checks.map((c: QuickCheck, i: number) => (
              <span key={c.label}
                    className={i < done ? `${styles.metaSeg} ${complete ? styles.segAll : styles.segDone}` : styles.metaSeg} />
            ))}
          </span>
          <span className={styles.metaText}>
            <span className={styles.metaCount}>{done}/{row.cp.checks.length}</span>
            <span className={complete ? styles.metaOk : styles.metaWarn}>
              {' · '}{row.cp.percent}%{complete ? '' : ' 보완 필요'}
            </span>
          </span>
        </div>
        {missing.length > 0 && (
          <div className={styles.missing}>
            {missing.map((m) => <span key={m} className={styles.missingChip}>{m} 없음</span>)}
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <Link className={styles.ghostBtn} href={`/shop/${s.slug}/edit`}>
          <AdminIcon name="edit" size={16} />정보 편집
        </Link>
        {s.status === 'active' && (
          <a className={styles.ghostBtn} href={`/shop/${s.slug}`} target="_blank" rel="noreferrer noopener">
            사이트 보기
          </a>
        )}
        {tab !== 'reviewed' && (
          <button type="button" className={styles.primaryBtn} disabled={busy}
                  onClick={() => onProcess(s, 'approve')}>
            {busy ? '처리 중…' : s.status === 'active' ? '확인 완료 · 경험치 지급' : '확인하고 공개'}
          </button>
        )}
        {tab === 'pending' && (
          <button type="button" className={styles.warnBtn} disabled={busy}
                  onClick={() => onProcess(s, 'return')}>
            보완 요청
          </button>
        )}
        {tab === 'reviewed' && (
          <>
            {/* 공개는 됐는데 경험치만 실패한 경우 — 다시 눌러도 경험치는 한 번만 지급된다 */}
            <button type="button" className={styles.ghostBtn} disabled={busy}
                    onClick={() => onProcess(s, 'approve')}>
              경험치 다시 지급
            </button>
            <button type="button" className={styles.ghostBtn} disabled={busy}
                    onClick={() => onChange(s, 'pending', '등록 요청으로 되돌리기')}>
              등록 요청으로
            </button>
          </>
        )}
      </div>
      <p className={styles.actionNote}>
        정보가 부족하면 ‘정보 편집’에서 직접 채우거나 ‘보완 요청’으로 등록자에게 돌려보내세요.
        보완 요청한 샵은 비공개 임시저장으로 돌아가고, 등록자가 고쳐서 다시 등록 요청하면 이 탭에 다시 나타나요.
        공개하면 지도에 바로 보이고 등록자에게 경험치 15와 알림이 가요(같은 샵은 한 번만).
      </p>
    </>
  )
}

function Field({ k, v }: { k: string; v: string | null }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldKey}>{k}</span>
      <span className={styles.fieldVal}>
        {v && v.trim() ? v : <span className={styles.empty}>미등록</span>}
      </span>
    </div>
  )
}
