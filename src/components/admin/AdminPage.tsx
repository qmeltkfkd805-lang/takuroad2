'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getPendingShops, approveShop, rejectShop, getPendingVerifyRequests } from '@/services/shopService'
import { Shop } from '@/types/shop'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import OfficialRouteTab from './OfficialRouteTab'
import SeasonalEventTab from './SeasonalEventTab'
import ReportedShopsTab from './ReportedShopsTab'
import PostReportsTab from './PostReportsTab'
import AdminDashboardPage from './AdminDashboardPage'
import WorkAdminTab from './WorkAdminTab'
import HeroAdminTab from './HeroAdminTab'
import MemberAdminTab from './MemberAdminTab'
import ShopAdminTab from './ShopAdminTab'
import ShopReviewTab from './ShopReviewTab'
import VerifyReviewTab from './VerifyReviewTab'
import PlaceAdminTab from './PlaceAdminTab'
import ContactAdminTab from './ContactAdminTab'
import SuggestionAdminTab from './SuggestionAdminTab'
import AdminSidebar from './AdminSidebar'
import { getAdminTodoSummary, getAdminBadgeCounts, AdminBadgeCounts, AdminTodoSummary } from '@/services/adminDashboardService'
import styles from './admin.module.css'

/* 탭 목록을 배열로 둔다 — 주소창의 ?tab= 값이 진짜 탭인지 런타임에 확인해야 해서.
   (타입만 있으면 검사할 수가 없다. 유니온 타입은 배열에서 뽑는다) */
const TABS = [
  'dashboard', 'hero', 'shops', 'shopmanage', 'shopreview', 'works', 'members', 'verify',
  'routes', 'events', 'reported', 'postreports', 'places', 'contacts', 'partners', 'suggestions',
] as const
type Tab = typeof TABS[number]

const DEFAULT_TAB: Tab = 'dashboard'

function toTab(raw: string | null): Tab {
  return TABS.includes(raw as Tab) ? (raw as Tab) : DEFAULT_TAB
}

export default function AdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, profile, loading: authLoading } = useAuth()

  /* 현재 탭은 주소(?tab=)에 남긴다 — 새로고침해도 보던 화면 그대로 돌아오게.
     화면 state를 따로 두는 이유는 탭 전환을 네비게이션이 끝날 때까지 기다리지 않고
     바로 보여주기 위해서다. 주소가 먼저 바뀌는 경우(뒤로/앞으로 가기, 링크 진입)에는
     아래 파생 조정으로 화면이 주소를 따라간다. */
  const urlTab = toTab(searchParams.get('tab'))
  const [tab, setTab] = useState<Tab>(urlTab)
  const [prevUrlTab, setPrevUrlTab] = useState<Tab>(urlTab)
  if (urlTab !== prevUrlTab) { setPrevUrlTab(urlTab); setTab(urlTab) }

  function goTab(next: Tab) {
    setTab(next)
    // 기본 탭은 쿼리 없이 깔끔하게. scroll:false — 탭만 바뀌는데 위로 튀지 않게
    router.replace(next === DEFAULT_TAB ? '/admin' : `/admin?tab=${next}`, { scroll: false })
  }
  const [pendingShops, setPendingShops] = useState<Shop[]>([])
  /* 사이드바 배지·대시보드에 쓸 대기 건수만 들고 있는다. 목록 자체는
     VerifyReviewTab이 직접 조회한다. 처리하고 나면 그 컴포넌트가 새 개수를 올려준다. */
  const [verifyPending, setVerifyPending] = useState(0)
  const [ready, setReady] = useState(false)
  // 사이드바 배지 + 대시보드가 함께 쓰는 미처리 건수. 한 번만 불러 내려준다
  const [todo, setTodo] = useState<AdminTodoSummary | null>(null)
  const [badges, setBadges] = useState<AdminBadgeCounts | null>(null)

  /* 권한 확인 후 최초 1회 조회.
     setState는 전부 then 콜백 안에 둔다 — effect 본문에서 동기로 부르면
     렌더가 한 번 더 돈다(react-hooks/set-state-in-effect). */
  useEffect(() => {
    if (authLoading) return
    // 로그인 안 됨 → 홈
    if (!user) { router.push(ROUTES.home); return }
    // user는 있는데 profile이 아직 안 옴 → 기다림 (홈으로 튕기지 않음)
    if (!profile) return
    // profile까지 왔는데 관리자 아님 → 홈
    if (profile.role !== 'admin') { router.push(ROUTES.home); return }
    if (ready) return

    let alive = true
    Promise.all([getPendingShops(), getPendingVerifyRequests()])
      .then(([shops, requests]) => {
        if (!alive) return
        setPendingShops(shops)
        setVerifyPending(requests.length)
        setReady(true)
      })
      .catch(e => { if (alive) { console.error('[관리자] 목록 조회 실패:', e); setReady(true) } })

    // 배지·업무 건수는 화면을 막지 않는다. 실패해도 나머지는 그대로 보인다
    getAdminTodoSummary()
      .then(t => { if (alive) setTodo(t) })
      .catch(e => { if (alive) { console.error('[관리자] 업무 요약 실패:', e); setTodo(null) } })
    getAdminBadgeCounts()
      .then(b => { if (alive) setBadges(b) })
      .catch(e => { if (alive) { console.error('[관리자] 배지 건수 실패:', e); setBadges(null) } })

    return () => { alive = false }
    // router는 App Router에서 참조가 안정적이라 넣어도 재실행되지 않는다
  }, [user, profile, authLoading, ready, router])


  async function handleApproveShop(shopId: string) {
    await approveShop(shopId)
    setPendingShops(prev => prev.filter(s => s.id !== shopId))
  }

  async function handleRejectShop(shopId: string) {
    if (!confirm('이 샵을 거절할까요?')) return
    await rejectShop(shopId)
    setPendingShops(prev => prev.filter(s => s.id !== shopId))
  }

  if (!ready) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
        불러오는 중...
      </div>
    )
  }

  // 사이드바 배지용 미처리 건수. 값이 없거나 조회 실패면 배지를 숨긴다
  /* 검수 완료 처리 후 사이드바 배지를 다시 맞춘다. 전역 상태를 새로 두지 않고
     이 한 함수를 내려보내 필요한 곳에서만 부른다. */
  async function refreshBadges() {
    try { setBadges(await getAdminBadgeCounts()) }
    catch (e) { console.error('[관리자] 배지 건수 갱신 실패:', e) }
  }

  const sidebarCounts = {
    shops: pendingShops.length,
    shopreview: badges?.shopReview ?? null,
    verify: verifyPending,
    reported: todo?.pendingSuggestions ?? null,     // shop_suggestions status='pending'
    postreports: badges?.hiddenPosts ?? null,
    contacts: badges?.openContacts ?? null,
    partners: badges?.openPartners ?? null,
  }

  return (
    <div className={styles.layout}>
      <AdminSidebar
        tab={tab}
        counts={sidebarCounts}
        onSelect={(t) => goTab(toTab(t))}
        onViewSite={() => window.open(ROUTES.home, '_blank', 'noopener')}
      />

      <div className={styles.content}>
      {tab === 'dashboard' && (
        <AdminDashboardPage
          onNavigate={(t) => goTab(toTab(t))}
          todo={todo}
          pendingVerify={verifyPending}
          badges={badges}
        />
      )}
      {tab === 'hero' && <HeroAdminTab />}
  
      {tab === 'shops' && (
        <div>
          {pendingShops.length === 0 ? (
            <EmptyState text="승인 대기 중인 샵이 없어요" />
          ) : (
            pendingShops.map(shop => (
              <div key={shop.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <Link href={ROUTES.shop(shop.slug)} target="_blank" style={{ fontWeight: 700, fontSize: '15px' }}>
                    {shop.name}
                  </Link>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {new Date(shop.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
                  📍 {shop.addr || '주소 없음'}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
                  카테고리: {shop.cats.join(', ') || '없음'}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleApproveShop(shop.id)}
                    style={{
                      flex: 1, padding: '9px', borderRadius: '8px',
                      background: 'var(--green)', color: '#fff', border: 'none',
                      fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >승인</button>
                  <button
                    onClick={() => handleRejectShop(shop.id)}
                    style={{
                      flex: 1, padding: '9px', borderRadius: '8px',
                      background: 'var(--surface2)', color: 'var(--red)',
                      border: '1px solid var(--border)',
                      fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >거절</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'verify' && <VerifyReviewTab onPendingCount={setVerifyPending} />}

      {tab === 'shopmanage' && <ShopAdminTab />}
      {tab === 'shopreview' && <ShopReviewTab onReviewed={refreshBadges} />}
      {tab === 'works' && <WorkAdminTab />}
      {tab === 'places' && <PlaceAdminTab />}
      {tab === 'members' && <MemberAdminTab />}
      {tab === 'reported' && <ReportedShopsTab />}
      {tab === 'postreports' && <PostReportsTab />}
      {tab === 'contacts' && <ContactAdminTab excludeType="partner" />}
      {tab === 'partners' && <ContactAdminTab onlyType="partner" />}
      {tab === 'suggestions' && <SuggestionAdminTab />}
      {tab === 'routes' && <OfficialRouteTab />}
      {tab === 'events' && <SeasonalEventTab />}
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
      <p style={{ color: 'var(--muted)', fontSize: '14px' }}>{text}</p>
    </div>
  )
}