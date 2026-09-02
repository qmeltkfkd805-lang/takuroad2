'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getPendingShops, approveShop, rejectShop,
  getPendingVerifyRequests, approveVerifyRequest, rejectVerifyRequest,
  getEvidenceFileUrl,
} from '@/services/shopService'
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
import PlaceAdminTab from './PlaceAdminTab'
import ContactAdminTab from './ContactAdminTab'
import SuggestionAdminTab from './SuggestionAdminTab'
import AdminSidebar from './AdminSidebar'
import { getAdminTodoSummary, getAdminBadgeCounts, AdminBadgeCounts, AdminTodoSummary } from '@/services/adminDashboardService'
import styles from './admin.module.css'

/* 인증 신청 한 건. getPendingVerifyRequests()의 select와 아래 JSX가 쓰는 필드만 적었다.
   (Database 타입이 any라 서비스에서 형태가 안 잡힌다 — 화면에서 쓰는 만큼만 좁게 명시) */
interface VerifyRequest {
  id: string
  shop_id: string
  user_id: string
  note: string | null
  evidence_url: string | null
  created_at: string
  extra: {
    transfer?: boolean
    manager?: string; position?: string; phone?: string; email?: string
    bizName?: string; bizNo?: string; owner?: string
    features?: string[]
  } | null
  shops: { id: string; name: string; slug: string } | null
  profiles: { id: string; nickname: string } | null
}

type Tab = 'dashboard' | 'hero' | 'shops' | 'shopmanage' | 'works' | 'members' | 'verify' | 'routes' | 'events' | 'reported' | 'postreports' | 'places' | 'contacts' | 'partners' | 'suggestions'

export default function AdminPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [pendingShops, setPendingShops] = useState<Shop[]>([])
  const [verifyRequests, setVerifyRequests] = useState<VerifyRequest[]>([])
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
        // supabase-js는 select 문자열만 보고 조인을 배열로 추론하지만, FK가 to-one이라
        // 런타임에는 객체 하나가 온다. 기존 화면도 req.shops?.name 으로 쓰고 있다.
        setVerifyRequests(requests as unknown as VerifyRequest[])
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
  }, [user, profile, authLoading, ready])


  async function handleApproveShop(shopId: string) {
    await approveShop(shopId)
    setPendingShops(prev => prev.filter(s => s.id !== shopId))
  }

  async function handleRejectShop(shopId: string) {
    if (!confirm('이 샵을 거절할까요?')) return
    await rejectShop(shopId)
    setPendingShops(prev => prev.filter(s => s.id !== shopId))
  }

  async function handleApproveVerify(req: VerifyRequest) {
    await approveVerifyRequest(req.id, req.shop_id, req.user_id)
    setVerifyRequests(prev => prev.filter(r => r.id !== req.id))
  }

  async function handleRejectVerify(requestId: string) {
    const reason = prompt('거절 사유를 입력하세요. (신청자에게 표시됩니다)')
    if (reason === null) return
    await rejectVerifyRequest(requestId, reason)
    setVerifyRequests(prev => prev.filter(r => r.id !== requestId))
  }

  async function handleViewEvidence(path: string | null) {
    if (!path) return
    const url = await getEvidenceFileUrl(path)
    if (url) window.open(url, '_blank')
  }

  if (!ready) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
        불러오는 중...
      </div>
    )
  }

  // 사이드바 배지용 미처리 건수. 값이 없거나 조회 실패면 배지를 숨긴다
  const sidebarCounts = {
    shops: pendingShops.length,
    verify: verifyRequests.length,
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
        onSelect={(t) => setTab(t as Tab)}
        onViewSite={() => window.open(ROUTES.home, '_blank', 'noopener')}
      />

      <div className={styles.content}>
      {tab === 'dashboard' && (
        <AdminDashboardPage
          onNavigate={(t) => setTab(t as Tab)}
          todo={todo}
          pendingShops={pendingShops.length}
          pendingVerify={verifyRequests.length}
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

      {tab === 'verify' && (
        <div>
          {verifyRequests.length === 0 ? (
            <EmptyState text="심사 대기 중인 인증 신청이 없어요" />
          ) : (
            verifyRequests.map(req => (
              <div key={req.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Link href={ROUTES.shop(req.shops?.slug ?? '')} target="_blank" style={{ fontWeight: 700, fontSize: '15px' }}>
                      {req.shops?.name ?? '알 수 없음'}
                    </Link>
                    {req.extra?.transfer && <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '9999px' }}>인증 이전 요청</span>}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {new Date(req.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
                  신청자: {req.profiles?.nickname ?? '알 수 없음'}
                </p>
                {req.extra && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--muted)', margin: '0 0 8px' }}>기본 정보</div>
                    <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '13px' }}>
                      {req.extra.manager && <div><span style={{ color: 'var(--muted)', marginRight: 6 }}>담당자</span><b>{req.extra.manager}{req.extra.position ? ' (' + req.extra.position + ')' : ''}</b></div>}
                      {req.extra.phone && <div><span style={{ color: 'var(--muted)', marginRight: 6 }}>연락처</span><b>{req.extra.phone}</b></div>}
                      {req.extra.email && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--muted)', marginRight: 6 }}>이메일</span><b>{req.extra.email}</b></div>}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--muted)', margin: '0 0 8px' }}>사업자 정보</div>
                    <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '13px' }}>
                      {req.extra.bizName && <div><span style={{ color: 'var(--muted)', marginRight: 6 }}>상호</span><b>{req.extra.bizName}</b></div>}
                      {req.extra.bizNo && <div><span style={{ color: 'var(--muted)', marginRight: 6 }}>사업자번호</span><b>{req.extra.bizNo}</b></div>}
                      {req.extra.owner && <div><span style={{ color: 'var(--muted)', marginRight: 6 }}>대표자</span><b>{req.extra.owner}</b></div>}
                    </div>
                    {Array.isArray(req.extra.features) && req.extra.features.length > 0 && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--muted)', margin: '0 0 8px' }}>관리 희망 기능</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {req.extra.features.map((f: string) => (
                            <span key={f} style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '9999px', background: 'var(--accent-l)', color: 'var(--accent)' }}>{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {req.note && !req.extra && (
                  <p style={{
                    fontSize: '13px', lineHeight: 1.6, color: 'var(--text)',
                    background: 'var(--surface2)', borderRadius: '8px',
                    padding: '10px', marginBottom: '10px',
                  }}>
                    {req.note}
                  </p>
                )}
                {req.evidence_url && (
                  <button
                    onClick={() => handleViewEvidence(req.evidence_url)}
                    style={{
                      fontSize: '12px', color: 'var(--cyan)', background: 'none',
                      border: '1px solid var(--cyan)', borderRadius: '6px',
                      padding: '4px 10px', cursor: 'pointer', marginBottom: '10px',
                    }}
                  >
                    📎 첨부파일 보기
                  </button>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleApproveVerify(req)}
                    style={{
                      flex: 1, padding: '9px', borderRadius: '8px',
                      background: 'var(--green)', color: '#fff', border: 'none',
                      fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >인증 승인</button>
                  <button
                    onClick={() => handleRejectVerify(req.id)}
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

      {tab === 'shopmanage' && <ShopAdminTab />}
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