'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { getAdminShopsExcludingDeleted } from '@/services/shopService'
import { changeShopStatus } from '@/services/shopReportService'
import { getAdminStats, AdminStats } from '@/services/adminDashboardService'
import { useAuth } from '@/components/layout/AuthProvider'
import { Shop } from '@/types/shop'
import { SHOP_STATUS_LABEL } from '@/lib/constants/categories'
import { quickCompleteness, shopRegion, QuickCheck } from '@/lib/shop/quickCompleteness'
import AdminIcon, { AdminIconName } from './AdminIcon'
import styles from './shopAdmin.module.css'

/* ============================================================
   샵 관리

   데이터: getAdminShopsExcludingDeleted() — 삭제 제외 전부(대시보드 RPC의
   shops_total과 같은 기준). 사용자용 getShops()는 active만 내려주므로 쓰지 않는다.
   요약 카드: getAdminStats() (RPC 한 번). 추가 조회 없음.

   완성도 계산 기준은 quickCompleteness()를 그대로 쓴다 — 여기서 바꾸지 않는다.
   서버 페이지네이션이 없어서(전체가 이미 메모리에 있음) 클라이언트에서 자른다.
   순서: 전체 → 검색 → 상태·지역 필터 → 정렬 → 페이지네이션 → 현재 페이지만 렌더
   ============================================================ */

const PAGE_SIZES = [25, 50, 100]

/* 상태 라벨은 공용 상수(SHOP_STATUS_LABEL)를 그대로 쓴다 — 화면마다 표기가 갈리지 않게 */
const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: SHOP_STATUS_LABEL.active },
  { value: 'temporary_closed', label: SHOP_STATUS_LABEL.temporary_closed },
  { value: 'closed', label: SHOP_STATUS_LABEL.closed },
]

const STATUS_CLASS: Record<string, string> = {
  active: styles.stActive,
  temporary_closed: styles.stTemp,
  closed: styles.stClosed,
}

type SortKey = 'recent' | 'name' | 'meta' | 'visit'
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: '최근 등록순' },
  { value: 'name', label: '샵명 가나다순' },
  { value: 'meta', label: '완성도 낮은순' },
  { value: 'visit', label: '방문 많은순' },
]

/* 완성도 "충족" 경계 — 기존 pct()의 초록 기준(80%)과 같은 값. 계산 기준은 그대로다 */
const COMPLETE_MIN = 80

const NO_REGION = '지역 미정' // shopRegion()이 돌려주는 값

/* 삭제 처리를 열어줄 상태.
   숨김(hidden)은 신고 반려·비공개 처리로 내려간 샵이라 여기서 정리한다.
   운영중·임시휴업·폐업 샵은 실수로 지우면 손해가 커서 이 화면에서는 막아둔다
   (샵 신고 탭의 상태 변경 메뉴에서는 여전히 가능하다). */
const DELETABLE_STATUSES = ['hidden']

interface Row {
  shop: Shop
  region: string
  percent: number
  done: number
  totalChecks: number
  missing: string[]
}

export default function ShopAdminTab() {
  const { user } = useAuth()
  const [shops, setShops] = useState<Shop[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  // 다시 불러오기는 키를 올려서 요청한다 (effect 안에서 곧바로 setState 하지 않기 위해)
  const [reloadKey, setReloadKey] = useState(0)
  const [loadedKey, setLoadedKey] = useState(-1)
  const loading = loadedKey !== reloadKey

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [region, setRegion] = useState('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [page, setPage] = useState(0)

  const [copied, setCopied] = useState<{ id: string; ok: boolean } | null>(null)
  const [liveMsg, setLiveMsg] = useState('')
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    const key = reloadKey
    // 통계가 실패해도 목록은 보여야 하고, 그 반대도 마찬가지다
    Promise.allSettled([getAdminShopsExcludingDeleted(), getAdminStats()]).then(([sh, st]) => {
      if (!alive) return
      setShops(sh.status === 'fulfilled' ? sh.value : [])
      setStats(st.status === 'fulfilled' ? st.value : null)
      setLoadedKey(key)
    })
    return () => { alive = false }
  }, [reloadKey])

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
  }, [])

  const rows: Row[] = useMemo(() => shops.map((s) => {
    const cp = quickCompleteness(s)
    return {
      shop: s,
      region: shopRegion(s),
      percent: cp.percent,
      done: cp.checks.filter((c: QuickCheck) => c.ok).length,
      totalChecks: cp.checks.length,
      missing: cp.checks.filter((c: QuickCheck) => !c.ok).map((c: QuickCheck) => c.label),
    }
  }), [shops])

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = { all: rows.length }
    for (const r of rows) m[r.shop.status] = (m[r.shop.status] ?? 0) + 1
    return m
  }, [rows])

  // 지역 목록은 이미 로드된 데이터에서만 만든다 (추가 조회 없음)
  const regionOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.region))
    return Array.from(set).sort((a, b) => {
      if (a === NO_REGION) return 1
      if (b === NO_REGION) return -1
      return a.localeCompare(b, 'ko')
    })
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = rows
    if (q) {
      out = out.filter((r) =>
        r.shop.name.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.shop.slug.toLowerCase().includes(q))
    }
    if (status !== 'all') out = out.filter((r) => r.shop.status === status)
    if (region !== 'all') out = out.filter((r) => r.region === region)

    const sorted = [...out]
    if (sort === 'name') sorted.sort((a, b) => a.shop.name.localeCompare(b.shop.name, 'ko'))
    else if (sort === 'meta') sorted.sort((a, b) => a.percent - b.percent)
    else if (sort === 'visit') sorted.sort((a, b) => (b.shop.visit_count ?? 0) - (a.shop.visit_count ?? 0))
    // 'recent'는 조회 순서(created_at 내림차순) 그대로 둔다
    return sorted
  }, [rows, query, status, region, sort])

  // 조건이 바뀌면 1페이지로 (effect 대신 렌더 중 파생 상태 조정)
  const listKey = `${query}|${status}|${region}|${sort}|${pageSize}`
  const [prevListKey, setPrevListKey] = useState(listKey)
  if (listKey !== prevListKey) { setPrevListKey(listKey); setPage(0) }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)   // 범위를 벗어나면 마지막 페이지로 보정
  const from = safePage * pageSize
  const pageRows = filtered.slice(from, from + pageSize)

  async function copyPath(s: Shop) {
    const path = `/shop/${s.slug}`
    let ok = true
    try { await navigator.clipboard.writeText(path) } catch { ok = false }
    setCopied({ id: s.id, ok })
    setLiveMsg(ok ? '경로가 복사되었습니다' : '복사에 실패했어요. 주소창에서 직접 복사해 주세요')
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => { setCopied(null); setLiveMsg('') }, 2400)
  }

  /* 삭제 = 소프트 삭제. 기존 관리자 API(/api/admin/shop-status)를 그대로 쓴다.
     행이 지워지는 게 아니라 status가 'deleted'로 바뀌고 deleted_at·deleted_by·
     delete_reason이 기록된다. 목록과 요약 카드 둘 다 deleted를 제외하므로
     성공하면 reloadKey를 올려 양쪽을 함께 새로고침한다. */
  async function handleDelete(s: Shop) {
    if (!user) {
      showNotice(false, '로그인 정보를 확인할 수 없어요. 새로고침 후 다시 시도해 주세요.')
      return
    }
    const okToGo = window.confirm(
      `"${s.name}" 샵을 삭제 처리할까요?\n\n`
      + '목록·통계에서 빠지고 사용자 사이트에도 나오지 않습니다.\n'
      + '데이터가 지워지지는 않지만, 되돌리려면 DB에서 직접 상태를 바꿔야 해요.'
    )
    if (!okToGo) return

    const reason = window.prompt(
      '삭제 이유 (비워도 됩니다. 예: 중복 등록, 폐업 확인)\n\n'
      + '※ [취소]를 누르면 삭제하지 않습니다.'
    )
    // prompt는 취소하면 null을 준다 — 되돌리기 어려운 작업이라 취소는 취소로 처리한다
    if (reason === null) return

    setBusyId(s.id)
    setNotice(null)
    const ok = await changeShopStatus(s.id, 'deleted', user.id, reason.trim() || undefined)
    setBusyId(null)
    if (ok) {
      showNotice(true, `"${s.name}" 샵을 삭제 처리했어요.`)
      setReloadKey((k) => k + 1)   // 목록과 요약 카드를 함께 다시 불러온다
    } else {
      showNotice(false, `"${s.name}" 삭제에 실패했어요. 관리자 권한을 확인하거나 잠시 후 다시 시도해 주세요.`)
    }
  }

  function showNotice(ok: boolean, text: string) {
    setNotice({ ok, text })
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    // 성공 안내만 자동으로 사라지게 한다. 실패는 읽고 조치할 때까지 남긴다
    if (ok) noticeTimer.current = setTimeout(() => setNotice(null), 5000)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.h1}>샵 관리</h1>
          <p className={styles.headSub}>등록된 샵의 운영 상태와 정보 완성도를 관리하세요</p>
        </div>
        <Link href="/shop/new" className={styles.primaryBtn}>
          <AdminIcon name="plus" size={18} strokeWidth={2.2} />새 샵 등록
        </Link>
      </div>

      {/* 요약 — getAdminStats() RPC 한 번에서 온 값. 로딩 중에는 숫자 대신 — */}
      <div className={styles.summary}>
        <Stat label="전체 샵" value={stats?.shopsTotal} loading={loading} icon="shop" iconClass={styles.iconNeutral} />
        <Stat label={SHOP_STATUS_LABEL.active} value={stats?.shopsActive} loading={loading} icon="checkCircle" iconClass={styles.iconGreen} toneClass={styles.toneGreen} />
        <Stat label={SHOP_STATUS_LABEL.temporary_closed} value={stats?.shopsTemp} loading={loading} icon="alert" iconClass={styles.iconAmber} toneClass={styles.toneAmber} />
        <Stat label={SHOP_STATUS_LABEL.closed} value={stats?.shopsClosed} loading={loading} icon="close" iconClass={styles.iconRed} toneClass={styles.toneRed} />
        <Stat label="공식 샵" value={stats?.shopsOfficial} loading={loading} icon="verify" iconClass={styles.iconPink} toneClass={styles.tonePink} />
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

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchRow}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}><AdminIcon name="search" size={18} /></span>
              <input
                className={styles.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="샵명, 지역 또는 slug 검색"
                aria-label="샵명, 지역 또는 slug 검색"
              />
            </div>
            <select
              className={`${styles.select} ${styles.sortSelect}`}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="정렬 기준"
            >
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.chips}>
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={status === f.value ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                  aria-pressed={status === f.value}
                  onClick={() => setStatus(f.value)}
                >
                  {f.label}<span className={styles.chipCount}>{statusCounts[f.value] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className={styles.rightTools}>
              <select className={styles.select} value={region} onChange={(e) => setRegion(e.target.value)} aria-label="지역 필터">
                <option value="all">지역 전체</option>
                {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <span className={styles.total}>{filtered.length.toLocaleString()}개 표시</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skelRow}>
                <div className={styles.skel} style={{ width: 48, height: 48 }} />
                <div style={{ flex: 1 }}>
                  <div className={styles.skel} style={{ width: '38%', height: 14, marginBottom: 7 }} />
                  <div className={styles.skel} style={{ width: '22%', height: 11 }} />
                </div>
                <div className={styles.skel} style={{ width: 150, height: 12 }} />
                <div className={styles.skel} style={{ width: 170, height: 36 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.state}>
            {rows.length === 0 ? (
              <>
                <strong className={styles.stateStrong}>샵을 불러오지 못했거나 아직 등록된 샵이 없어요</strong>
                조회에 실패했을 수 있어요. 다시 시도해 주세요.
                <div>
                  <button type="button" className={styles.retryBtn} onClick={() => setReloadKey((k) => k + 1)}>
                    다시 불러오기
                  </button>
                </div>
              </>
            ) : (
              <>
                <strong className={styles.stateStrong}>조건에 맞는 샵이 없어요</strong>
                검색어나 필터를 바꿔보세요.
              </>
            )}
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">샵</th>
                    <th scope="col" className={styles.colRegion}>지역</th>
                    <th scope="col" className={styles.colMeta}>정보 완성도</th>
                    <th scope="col" className={styles.colStatus}>운영 상태</th>
                    <th scope="col" className={styles.colOfficial}>공식 여부</th>
                    <th scope="col" className={styles.colAction}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <ShopRow
                      key={r.shop.id}
                      row={r}
                      copied={copied && copied.id === r.shop.id ? copied.ok : null}
                      onCopy={() => copyPath(r.shop)}
                      deletable={DELETABLE_STATUSES.includes(r.shop.status)}
                      busy={busyId === r.shop.id}
                      onDelete={() => handleDelete(r.shop)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.pager}>
              <div className={styles.pagerLeft}>
                <span className={styles.range}>
                  {(from + 1).toLocaleString()}–{Math.min(from + pageSize, filtered.length).toLocaleString()} / {filtered.length.toLocaleString()}
                </span>
                <select
                  className={styles.select}
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  aria-label="페이지당 표시 개수"
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}개씩</option>)}
                </select>
              </div>
              <Pager page={safePage} totalPages={totalPages} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* 복사 결과는 화면에도(버튼 옆) 스크린리더에도 알린다 */}
      <p className={styles.srOnly} aria-live="polite">{liveMsg}</p>
    </div>
  )
}

function ShopRow({ row, copied, onCopy, deletable, busy, onDelete }: {
  row: Row; copied: boolean | null; onCopy: () => void
  deletable: boolean; busy: boolean; onDelete: () => void
}) {
  const s = row.shop
  const thumb = s.images?.[0]
  const label = SHOP_STATUS_LABEL[s.status] ?? s.status ?? '상태 미정'
  const complete = row.percent >= COMPLETE_MIN
  const hasSlug = !!s.slug
  const metaTitle = row.missing.length > 0
    ? `빠진 항목: ${row.missing.join(', ')}`
    : '모든 항목이 채워져 있어요'

  return (
    <tr>
      <td className={styles.cellShop}>
        <div className={styles.shopCell}>
          <span className={styles.thumb}>
            {thumb
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={thumb} alt="" />
              : <AdminIcon name="shop" size={22} />}
          </span>
          <span className={styles.shopText}>
            <span className={styles.shopName} title={s.name}>{s.name}</span>
            <span className={styles.slugRow}>
              <span className={styles.slug} title={s.slug || '경로 없음'}>{s.slug || '경로 없음'}</span>
              {hasSlug && (
                <button type="button" className={styles.copyBtn} onClick={onCopy} aria-label="샵 경로 복사" title="경로 복사">
                  <AdminIcon name="copy" size={15} />
                </button>
              )}
              {copied !== null && (
                <span className={copied ? styles.copyMsg : `${styles.copyMsg} ${styles.copyMsgFail}`} aria-hidden="true">
                  {copied ? '복사됨' : '복사 실패'}
                </span>
              )}
            </span>
          </span>
        </div>
      </td>

      <td className={styles.cellRegion}>
        {row.region === NO_REGION
          ? <span className={styles.regionNone}>지역 미등록</span>
          : <span className={styles.region}>{row.region}</span>}
      </td>

      <td className={styles.cellMeta}>
        <span className={styles.metaCell} title={metaTitle}>
          <span className={styles.bar} aria-hidden="true">
            {Array.from({ length: row.totalChecks }).map((_, i) => (
              <span
                key={i}
                className={i < row.done ? `${styles.seg} ${complete ? styles.segAll : styles.segDone}` : styles.seg}
              />
            ))}
          </span>
          <span className={styles.metaText}>
            <span className={styles.metaCount}>{row.done}/{row.totalChecks}</span>
            <span className={complete ? styles.metaOk : styles.metaWarn}>
              {' · '}{row.percent}%{complete ? '' : ' 보완 필요'}
            </span>
          </span>
        </span>
      </td>

      <td className={styles.cellStatus}>
        <span className={`${styles.statusBadge} ${STATUS_CLASS[s.status] ?? styles.stMuted}`}>
          <span className={styles.dot} aria-hidden="true" />{label}
        </span>
      </td>

      <td className={styles.cellOfficial}>
        {s.is_verified
          ? <span className={styles.officialBadge}>공식</span>
          : <span className={styles.dash} aria-label="공식 샵 아님">—</span>}
      </td>

      <td className={styles.cellAction}>
        <div className={styles.actionCell}>
          {hasSlug ? (
            <a className={styles.ghostBtn} href={`/shop/${s.slug}`} target="_blank" rel="noreferrer">사이트 보기</a>
          ) : (
            <button type="button" className={`${styles.ghostBtn} ${styles.btnOff}`} disabled title="경로(slug)가 없어서 사이트 페이지를 열 수 없어요">
              사이트 보기
            </button>
          )}
          {hasSlug ? (
            <Link className={styles.editBtn} href={`/shop/${s.slug}/edit`}>편집</Link>
          ) : (
            <button type="button" className={`${styles.editBtn} ${styles.btnOff}`} disabled title="경로(slug)가 없어서 편집 화면을 열 수 없어요">
              편집
            </button>
          )}
          {deletable && (
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={onDelete}
              disabled={busy}
              title="목록과 사용자 사이트에서 빼고 삭제 상태로 기록합니다"
            >
              {busy ? '처리 중…' : '삭제'}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function Stat({ label, value, loading, icon, iconClass, toneClass }: {
  label: string; value: number | undefined; loading: boolean
  icon: AdminIconName; iconClass: string; toneClass?: string
}) {
  return (
    <div className={`${styles.card} ${styles.stat}`}>
      <span className={styles.statBody}>
        <span className={styles.statLabel}>{label}</span>
        <span className={`${styles.statValue} ${toneClass ?? ''}`}>
          {loading || value === undefined ? '—' : value.toLocaleString()}
        </span>
      </span>
      <span className={`${styles.statIcon} ${iconClass}`}><AdminIcon name={icon} size={20} /></span>
    </div>
  )
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  const nums: (number | 'gap')[] = []
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1) nums.push(i)
    else if (nums[nums.length - 1] !== 'gap') nums.push('gap')
  }
  return (
    <div className={styles.pageBtns}>
      <button type="button" className={styles.pageBtn} disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="이전 페이지">‹</button>
      {nums.map((n, i) => n === 'gap'
        ? <span key={`g${i}`} className={styles.gap}>…</span>
        : (
          <button
            key={n}
            type="button"
            className={n === page ? `${styles.pageBtn} ${styles.pageOn}` : styles.pageBtn}
            aria-current={n === page ? 'page' : undefined}
            aria-label={`${n + 1}페이지`}
            onClick={() => onChange(n)}
          >{n + 1}</button>
        ))}
      <button type="button" className={styles.pageBtn} disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)} aria-label="다음 페이지">›</button>
    </div>
  )
}
