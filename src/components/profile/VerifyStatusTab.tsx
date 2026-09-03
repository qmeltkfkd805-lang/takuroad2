'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getMyVerifyRequests } from '@/services/shopService'
import { ROUTES } from '@/lib/constants/routes'
import AppIcon from '@/components/tds/AppIcon'
import { LoadingState } from './SavedShopsTab'
import styles from './verifyStatus.module.css'

/* 마이페이지 > 인증 현황.

   데이터는 shopService.getMyVerifyRequests 가 주는 것만 쓴다(RLS 상 본인 것만 내려온다).
   요약 숫자·필터·최신 신청 판별은 전부 이 목록에서 계산하고 추가 조회를 하지 않는다.

   note 를 '거절 사유'라고 단정하지 않는다 — 신청할 때 사업자 정보 문자열이 들어가고
   (`[사업자] … / 등록번호 …`), 거절할 때 사유를 적으면 그걸 덮어쓴다. 사유가 적히지
   않은 채 거절되면 신청 원문이 그대로 남는다. 둘을 구분할 컬럼이 없어서
   중립적으로 '안내 내용'이라고만 쓴다. (후속: 거절 사유 전용 컬럼 분리) */

interface VerifyShop {
  id: string
  name: string | null
  slug: string | null
  is_claimed: boolean | null
  owner_id: string | null
}

interface VerifyRow {
  id: string
  status: string
  note: string | null
  created_at: string
  updated_at: string | null
  shops: VerifyShop | null
}

type Filter = 'all' | 'pending' | 'done'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '심사 중' },
  { key: 'done', label: '처리 완료' },
]

// 화면 전체에서 같은 형식을 쓴다
const fmtDate = (s: string | null | undefined) => {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR')
}

const hasText = (v: string | null | undefined): v is string => typeof v === 'string' && v.trim() !== ''

export default function VerifyStatusTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<VerifyRow[]>([])
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  /* 로딩을 별도 state 로 두지 않고 "요청 키 != 반영된 키"로 파생시킨다.
     effect 본문에서 setLoading(true) 를 부르면 렌더가 한 번 더 돈다
     (react-hooks/set-state-in-effect). 다시 시도 중에는 loading 이 true 라
     버튼이 disabled 가 되어 중복 요청이 나가지 않는다. */
  const key = `${userId}:${reloadKey}`
  const loading = loadedKey !== key

  useEffect(() => {
    let alive = true
    getMyVerifyRequests(userId)
      .then(data => {
        if (!alive) return
        setRows((data ?? []) as unknown as VerifyRow[])
        setFailed(false)
        setLoadedKey(`${userId}:${reloadKey}`)
      })
      .catch(() => {
        if (!alive) return
        setRows([])
        setFailed(true)
        setLoadedKey(`${userId}:${reloadKey}`)
      })
    return () => { alive = false }
  }, [userId, reloadKey])

  function retry() {
    if (loading) return
    setReloadKey(k => k + 1)
  }

  if (loading) return <LoadingState />

  if (failed) {
    return (
      <div className={styles.wrap}>
        <div className={styles.state}>
          <AppIcon name="warning" size={40} color="var(--muted)" style={{ margin: '0 auto 14px', display: 'block' }} />
          <p className={styles.stateTitle}>인증 현황을 불러오지 못했습니다</p>
          <p className={styles.stateDesc}>잠시 후 다시 시도해주세요.</p>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={retry}>다시 시도</button>
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.state}>
          <AppIcon name="shield" size={40} color="var(--muted)" style={{ margin: '0 auto 14px', display: 'block' }} />
          <p className={styles.stateTitle}>아직 인증 신청 내역이 없습니다</p>
          <p className={styles.stateDesc}>샵을 운영하고 있다면 사장님 인증을 신청해보세요.</p>
          <Link href="/shop/claim" className={`${styles.btn} ${styles.btnPrimary}`}>인증 신청하기</Link>
        </div>
      </div>
    )
  }

  /* 요약 — 지금 목록에서만 센다.
     '처리 완료'는 승인 + 거절. 알 수 없는 status 는 어느 쪽으로도 넣지 않으므로
     전체 >= 심사 중 + 처리 완료 가 될 수 있다(추측하지 않는다). */
  const pendingCount = rows.filter(r => r.status === 'pending').length
  const doneCount = rows.filter(r => r.status === 'approved' || r.status === 'rejected').length

  const shown = rows.filter(r => {
    if (filter === 'pending') return r.status === 'pending'
    if (filter === 'done') return r.status === 'approved' || r.status === 'rejected'
    return true
  })

  /* 같은 샵의 '가장 최근' 신청을 찾아둔다. 목록이 최신순이라 처음 나오는 행이 최신이다.
     재신청 버튼은 최신 건에만 붙인다 — 과거 거절 건에 달면 눌러봐야
     "심사 중"으로 막히는 막다른 길이 된다. 회차를 판별할 필드는 없으므로
     행을 합치거나 지우지는 않는다. */
  const latestIds = new Set<string>()
  const seenShops = new Set<string>()
  for (const r of rows) {
    const sid = r.shops?.id
    if (!sid) continue
    if (!seenShops.has(sid)) { seenShops.add(sid); latestIds.add(r.id) }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.intro}>
        <div className={styles.introText}>
          <h2 className={styles.title}>인증 현황</h2>
          <p className={styles.lead}>사장님 인증 신청 내역과 처리 결과를 확인하세요</p>
        </div>
      </div>

      <div className={styles.summary}>
        <SumCard icon="receipt" tint="var(--accent-l)" color="var(--accent)" label="전체 신청" value={rows.length} />
        <SumCard icon="clock" tint="rgba(245,177,0,.14)" color="#A87A00" label="심사 중" value={pendingCount} />
        <SumCard icon="check" tint="var(--green-l)" color="#0E8C7C" label="처리 완료" value={doneCount} />
      </div>

      <div className={styles.filters} role="group" aria-label="상태 필터">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            className={`${styles.chip} ${filter === f.key ? styles.chipOn : ''}`}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className={styles.state}>
          <AppIcon name="search" size={36} color="var(--muted)" style={{ margin: '0 auto 14px', display: 'block' }} />
          <p className={styles.stateTitle}>이 상태에 해당하는 신청이 없습니다</p>
          <p className={styles.stateDesc}>다른 상태를 선택해보세요.</p>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setFilter('all')}>전체 보기</button>
        </div>
      ) : (
        <div className={styles.list}>
          {shown.map(r => (
            <RequestCard key={r.id} row={r} userId={userId} isLatest={latestIds.has(r.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function SumCard({ icon, tint, color, label, value }: {
  icon: string; tint: string; color: string; label: string; value: number
}) {
  return (
    <div className={styles.sumCard}>
      <span className={styles.sumIcon} style={{ background: tint }}>
        <AppIcon name={icon} size={19} color={color} />
      </span>
      <div className={styles.sumBody}>
        <div className={styles.sumLabel}>{label}</div>
        <div className={styles.sumValue}>{value}</div>
      </div>
    </div>
  )
}

function RequestCard({ row, userId, isLatest }: { row: VerifyRow; userId: string; isLatest: boolean }) {
  const shop = row.shops
  const slug = shop && hasText(shop.slug) ? shop.slug : null
  const isPending = row.status === 'pending'
  const isApproved = row.status === 'approved'
  const isRejected = row.status === 'rejected'
  const isKnown = isPending || isApproved || isRejected

  // 처리일 전용 컬럼이 없다. updated_at 은 pending 이면 생성 시각과 같으므로 쓰지 않는다.
  const decidedAt = !isPending && isKnown ? fmtDate(row.updated_at) : ''
  const appliedAt = fmtDate(row.created_at)

  // 승인돼 있어도 지금 이 사람이 소유자가 아니면(소유권 이전 등) 관리 화면에 못 들어간다.
  // /shop/[slug]/manage 가 서버에서 같은 조건을 보고 아니면 redirect 한다.
  // 관리자 여부는 이 화면에서 판단하지 않는다.
  const canManage = isApproved && slug !== null && shop?.is_claimed === true && shop.owner_id === userId
  const canReapply = isRejected && isLatest && slug !== null

  const badge = isPending ? { cls: styles.badgePending, icon: 'clock', text: '심사 중' }
    : isApproved ? { cls: styles.badgeApproved, icon: 'check', text: '인증 완료' }
    : isRejected ? { cls: styles.badgeRejected, icon: 'close', text: '인증 거절' }
    : { cls: styles.badgeUnknown, icon: 'shield', text: row.status }

  const iconTint = isApproved ? 'var(--green-l)' : isRejected ? 'var(--red-l)' : isPending ? 'rgba(245,177,0,.14)' : 'var(--surface2)'
  const iconColor = isApproved ? '#0E8C7C' : isRejected ? '#D64545' : isPending ? '#A87A00' : 'var(--muted)'

  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.shopIcon} style={{ background: iconTint }}>
          <AppIcon name="shop" size={22} color={iconColor} />
        </span>
        <div className={styles.headText}>
          {slug ? (
            <Link href={ROUTES.shop(slug)} className={styles.shopName}>{shop?.name ?? '이름 없는 샵'}</Link>
          ) : (
            <span className={styles.shopName}>{shop?.name ?? '삭제된 샵'}</span>
          )}
          <div className={styles.dates}>
            신청일 {appliedAt}
            {decidedAt && <><span className={styles.dateSep}>·</span>처리일 {decidedAt}</>}
          </div>
        </div>
        <span className={`${styles.badge} ${badge.cls}`}>
          <AppIcon name={badge.icon} size={13} color="currentColor" />
          {badge.text}
        </span>
      </div>

      {isPending && (
        <div className={`${styles.note} ${styles.notePending}`}>
          <div className={`${styles.noteHead} ${styles.noteHeadPending}`}>
            <AppIcon name="clock" size={15} color="currentColor" />신청 내용을 확인하고 있어요
          </div>
          <p className={styles.noteBody}>운영진이 확인한 뒤 결과를 알림으로 알려드릴게요.</p>
        </div>
      )}

      {isApproved && (
        <div className={`${styles.note} ${styles.noteApproved}`}>
          <div className={`${styles.noteHead} ${styles.noteHeadApproved}`}>
            <AppIcon name="check" size={15} color="currentColor" />사장님 인증이 완료되었습니다
          </div>
          {canManage && (
            <p className={styles.noteBody}>기본 정보·영업시간·휴무 공지·이벤트·사진을 직접 관리할 수 있어요.</p>
          )}
        </div>
      )}

      {isRejected && (
        <div className={`${styles.note} ${styles.noteRejected}`}>
          {hasText(row.note) ? (
            <>
              {/* 이 값이 거절 사유인지 신청할 때 적힌 메모인지 구분할 방법이 없어
                  '거절 사유'라고 단정하지 않는다. */}
              <div className={`${styles.noteHead} ${styles.noteHeadRejected}`}>
                <AppIcon name="warning" size={15} color="currentColor" />안내 내용
              </div>
              <p className={styles.noteBody}>{row.note}</p>
              <p className={styles.noteHint}>부족한 정보를 보완한 뒤 다시 신청할 수 있어요.</p>
            </>
          ) : (
            <p className={styles.noteBody}>
              자세한 사유는 확인되지 않습니다. 정보를 확인한 후 다시 신청해주세요.
            </p>
          )}
        </div>
      )}

      <div className={styles.foot}>
        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={`${styles.stepDot} ${styles.stepDone}`}><AppIcon name="check" size={12} color="currentColor" /></span>
            <span className={styles.stepText}>
              <span className={styles.stepLabel}>신청 접수</span>
              <span className={styles.stepSub}> {appliedAt}</span>
            </span>
          </div>
          <span className={styles.stepLine} aria-hidden="true" />
          <div className={styles.step}>
            <span className={`${styles.stepDot} ${isApproved ? styles.stepDone : isRejected ? styles.stepFail : styles.stepWait}`}>
              <AppIcon name={isApproved ? 'check' : isRejected ? 'close' : 'clock'} size={12} color="currentColor" />
            </span>
            <span className={styles.stepText}>
              <span className={styles.stepLabel}>심사 완료</span>
              <span className={styles.stepSub}> {decidedAt || '대기 중'}</span>
            </span>
          </div>
        </div>

        {(canReapply || canManage) && (
          <div className={styles.actions}>
            {canManage && (
              <Link href={`/shop/${slug}/manage`} className={`${styles.btn} ${styles.btnGhost}`}>샵 관리하기</Link>
            )}
            {canReapply && (
              <Link href={`/shop/claim/${slug}`} className={`${styles.btn} ${styles.btnPrimary}`}>다시 신청하기</Link>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
