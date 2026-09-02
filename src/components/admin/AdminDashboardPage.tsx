'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getAdminStats, getTopShops, AdminStats, TopShop, AdminBadgeCounts, AdminTodoSummary } from '@/services/adminDashboardService'
import { getActiveWorks, ActiveWork } from '@/services/activeWorksService'
import { getTodayCounts, TodayCounts } from '@/services/trafficService'
import { ROUTES } from '@/lib/constants/routes'
import TrafficSection from './TrafficSection'
import VisitPathsSection from './VisitPathsSection'
import BadgeReevalButton from './BadgeReevalButton'
import AdminIcon, { AdminIconName } from './AdminIcon'
import styles from './adminDashboard.module.css'

/* 관리자 대시보드.
   숫자는 전부 실제 조회값이다. 하드코딩된 수치는 없다.
   미처리 건수(todo/badges)와 승인 대기 수는 AdminPage가 한 번 불러 내려준다. */

interface Props {
  onNavigate: (tab: string) => void
  /** getAdminTodoSummary 결과. null이면 아직 안 왔거나 실패 */
  todo: AdminTodoSummary | null
  pendingShops: number
  pendingVerify: number
  badges: AdminBadgeCounts | null
}

export default function AdminDashboardPage({ onNavigate, todo, pendingShops, pendingVerify, badges }: Props) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [topWorks, setTopWorks] = useState<ActiveWork[] | null>(null)
  const [topShops, setTopShops] = useState<TopShop[] | null>(null)
  const [today, setToday] = useState<TodayCounts | null>(null)
  const [statsError, setStatsError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    // 서로 막지 않게 따로 받는다. 하나가 실패해도 나머지는 그대로 그려진다
    getAdminStats()
      .then(s => { setStats(s); setUpdatedAt(new Date()) })
      .catch(e => { console.error('[대시보드] 통계 실패:', e); setStatsError(true) })
    getActiveWorks(5).then(setTopWorks).catch(() => setTopWorks([]))
    getTopShops(5).then(setTopShops).catch(() => setTopShops([]))
    getTodayCounts().then(setToday).catch(() => setToday(null))
  }, [])

  // 처리해야 할 업무 — 각 값의 출처는 기존 관리 화면과 같다
  const todos: { key: string; label: string; icon: AdminIconName; count: number | null; tab?: string }[] = [
    { key: 'goods',    label: '미확인 굿즈 정보', icon: 'inbox',    count: todo ? todo.unconfirmedProducts : null },
    { key: 'shops',    label: '샵 승인',         icon: 'approve',  count: pendingShops, tab: 'shops' },
    { key: 'verify',   label: '인증 심사',       icon: 'verify',   count: pendingVerify, tab: 'verify' },
    { key: 'contacts', label: '문의',            icon: 'contact',  count: badges ? badges.openContacts : null, tab: 'contacts' },
  ]

  // 처리 필요 합계 — 아직 안 온 값은 빼고 센다(없는 수를 지어내지 않는다)
  const knownTodos = todos.map(t => t.count).filter((n): n is number => typeof n === 'number')
  const todoTotal = knownTodos.length > 0 ? knownTodos.reduce((a, b) => a + b, 0) : null

  // 신규 회원 전일 대비 — 오늘 값은 기존 통계(newMembersToday), 어제 값은 시계열
  const signupDelta =
    stats && today?.signupsYesterday != null ? stats.newMembersToday - today.signupsYesterday : null

  const staleShops = todo?.staleShops ?? []

  return (
    <div className={styles.page}>
      {/* ── 헤더 ── */}
      <header className={styles.head}>
        <div>
          <h1 className={styles.h1}>대시보드</h1>
          <p className={styles.headSub}>오늘의 운영 상태를 한눈에 확인하세요</p>
        </div>
        <div className={styles.headRight}>
          <span className={styles.updatedAt}>
            {updatedAt
              ? `최근 업데이트 ${String(updatedAt.getHours()).padStart(2, '0')}:${String(updatedAt.getMinutes()).padStart(2, '0')}`
              : '불러오는 중…'}
          </span>
          <a className={styles.siteBtn} href={ROUTES.home} target="_blank" rel="noreferrer">
            <AdminIcon name="external" size={16} />사이트 보기
          </a>
        </div>
      </header>

      {statsError && (
        <div className={styles.error} style={{ marginBottom: 16 }}>
          통계를 불러오지 못했어요. 잠시 후 새로고침해 주세요.
        </div>
      )}

      {/* ── 요약 지표 ── */}
      <div className={styles.kpiRow}>
        <Kpi icon="inbox"    label="처리 필요"   value={todoTotal} />
        <Kpi icon="visitor"  label="오늘 방문자" value={today ? today.visitors : null} delta={today?.visitorsDelta ?? null} />
        <Kpi icon="userPlus" label="신규 회원"   value={stats ? stats.newMembersToday : null} delta={signupDelta} />
        <Kpi icon="checkin"  label="오늘 체크인" value={today ? today.checkins : null} delta={today?.checkinsDelta ?? null} />
      </div>

      {/* ── 업무 + 트래픽 ── */}
      <div className={styles.split}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>처리해야 할 업무</h2>
          </div>
          <div className={styles.todoList}>
            {todos.map(t => (
              <button
                key={t.key}
                type="button"
                className={styles.todoRow}
                disabled={!t.tab}
                onClick={() => t.tab && onNavigate(t.tab)}
              >
                <AdminIcon name={t.icon} size={18} className={styles.todoIcon} />
                <span className={styles.todoLabel}>{t.label}</span>
                {t.count === null
                  ? <Skeleton w={22} h={16} />
                  : <span className={`${styles.todoCount} ${t.count > 0 ? styles.todoCountOn : styles.todoCountOff}`}>{t.count}</span>}
                {t.tab && <AdminIcon name="arrowRight" size={16} className={styles.todoArrow} />}
              </button>
            ))}
          </div>
        </section>

        {/* 트래픽 — 기존 TrafficSection을 그대로 쓴다(차트를 새로 만들지 않는다) */}
        <section style={{ minWidth: 0 }}>
          <TrafficSection />
        </section>
      </div>

      {/* ── 콘텐츠 현황 + 데이터 점검 ── */}
      <div className={styles.split}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>콘텐츠 현황</h2>
          </div>
          <div className={styles.statGrid}>
            <StatBox icon="work"   label="작품"      value={stats?.works}     onClick={() => onNavigate('works')} />
            <StatBox icon="shop"   label="샵"        value={stats?.shops}     onClick={() => onNavigate('shopmanage')} />
            <StatBox icon="season" label="이벤트"    value={stats?.events}    onClick={() => onNavigate('events')} />
            <StatBox icon="hero"   label="배너"      value={stats?.banners}   onClick={() => onNavigate('hero')} />
            <StatBox icon="member" label="회원"      value={stats?.members}   onClick={() => onNavigate('members')} />
            <StatBox icon="approve" label="최애 등록" value={stats?.favorites} />
          </div>
        </section>

        {/* 시안의 '운영 이상 징후' 중 실제로 계산되는 항목만 남겼다 */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>데이터 점검</h2>
            <span className={styles.cardNote}>180일 넘게 확인 안 된 샵</span>
          </div>
          {todo === null ? (
            <div className={styles.empty}>불러오는 중…</div>
          ) : staleShops.length === 0 ? (
            <div className={styles.empty}>확인이 밀린 샵이 없어요.</div>
          ) : (
            staleShops.map(shop => (
              <Link key={shop.id} href={ROUTES.shopEdit(shop.slug)} className={styles.checkRow}>
                <AdminIcon name="alert" size={18} className={styles.checkIcon} />
                <span className={styles.checkBody}>
                  <span className={styles.checkName}>{shop.name}</span>
                  <span className={styles.checkMeta}>
                    방문 {shop.visit_count ?? 0}회 · {shop.info_last_confirmed_at
                      ? new Date(shop.info_last_confirmed_at).toLocaleDateString('ko-KR')
                      : '확인 기록 없음'} 갱신
                  </span>
                </span>
                <AdminIcon name="arrowRight" size={16} className={styles.todoArrow} />
              </Link>
            ))
          )}
        </section>
      </div>

      {/* ── TOP 5 ── */}
      <div className={styles.split}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>인기 작품 TOP 5</h2>
            <span className={styles.cardNote}>최근 7일 활동</span>
          </div>
          {topWorks === null ? <div className={styles.empty}>불러오는 중…</div>
            : topWorks.length === 0 ? <div className={styles.empty}>활동 데이터가 쌓이면 표시돼요.</div> : (
            <table className={styles.table}>
              <thead><tr><th>순위</th><th>작품</th></tr></thead>
              <tbody>
                {topWorks.map((w, i) => (
                  <tr key={w.id}>
                    <td className={styles.rank}>{i + 1}</td>
                    <td className={styles.ellipsis}>
                      <Link href={`/work/${w.slug}`} target="_blank" className={styles.cellLink}>{w.name}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>인기 장소 TOP 5</h2>
            <span className={styles.cardNote}>누적 방문 수</span>
          </div>
          {topShops === null ? <div className={styles.empty}>불러오는 중…</div>
            : topShops.length === 0 ? <div className={styles.empty}>아직 샵이 없어요.</div> : (
            <table className={styles.table}>
              <thead><tr><th>순위</th><th>장소</th><th className={styles.num}>방문</th></tr></thead>
              <tbody>
                {topShops.map((s, i) => (
                  <tr key={s.id}>
                    <td className={styles.rank}>{i + 1}</td>
                    <td className={styles.ellipsis}>
                      <Link href={ROUTES.shop(s.slug)} target="_blank" className={styles.cellLink}>{s.name}</Link>
                    </td>
                    <td className={styles.num}>{(s.visit_count ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* ── 방문 경로 (기존 기능 유지) ── */}
      <section style={{ marginBottom: 16 }}>
        <VisitPathsSection />
      </section>

      <BadgeReevalButton />
    </div>
  )
}

/* ── 조각들 ─────────────────────────────────────────── */

function Kpi({ icon, label, value, delta }: {
  icon: AdminIconName; label: string; value: number | null; delta?: number | null
}) {
  return (
    <div className={`${styles.card} ${styles.kpi}`}>
      <span className={styles.kpiIcon}><AdminIcon name={icon} size={22} /></span>
      <span className={styles.kpiBody}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiValue}>
          {value === null ? <Skeleton w={44} h={26} /> : value.toLocaleString()}
        </span>
        {delta != null && (
          <span className={`${styles.kpiDelta} ${delta > 0 ? styles.up : delta < 0 ? styles.down : styles.flat}`}>
            {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'} {Math.abs(delta).toLocaleString()} 전일 대비
          </span>
        )}
      </span>
    </div>
  )
}

function StatBox({ icon, label, value, onClick }: {
  icon: AdminIconName; label: string; value?: number; onClick?: () => void
}) {
  return (
    <button type="button" className={styles.statBox} onClick={onClick} disabled={!onClick}>
      <span className={styles.statBoxLabel}><AdminIcon name={icon} size={15} />{label}</span>
      <span className={styles.statBoxValue}>
        {value === undefined ? <Skeleton w={36} h={20} /> : value.toLocaleString()}
      </span>
    </button>
  )
}

/** 로딩 중 숫자 자리 — 레이아웃이 튀지 않게 크기를 유지한다 */
function Skeleton({ w, h }: { w: number; h: number }) {
  return <span className={styles.skel} style={{ width: w, height: h }} aria-hidden="true" />
}
