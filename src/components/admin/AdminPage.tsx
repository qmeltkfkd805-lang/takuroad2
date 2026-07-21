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
import BannerAdminTab from './BannerAdminTab'
import MemberAdminTab from './MemberAdminTab'
import ShopAdminTab from './ShopAdminTab'
import PlaceAdminTab from './PlaceAdminTab'
import ContactAdminTab from './ContactAdminTab'
import styles from './admin.module.css'

type Tab = 'dashboard' | 'shops' | 'shopmanage' | 'works' | 'banners' | 'members' | 'verify' | 'routes' | 'events' | 'reported' | 'postreports' | 'places' | 'contacts'

export default function AdminPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [pendingShops, setPendingShops] = useState<Shop[]>([])
  const [verifyRequests, setVerifyRequests] = useState<any[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (authLoading) return
    // 로그인 안 됨 → 홈
    if (!user) { router.push(ROUTES.home); return }
    // user는 있는데 profile이 아직 안 옴 → 기다림 (홈으로 튕기지 않음)
    if (!profile) return
    // profile까지 왔는데 관리자 아님 → 홈
    if (profile.role !== 'admin') { router.push(ROUTES.home); return }
    if (!ready) loadData()
  }, [user, profile, authLoading, ready])

  async function loadData() {
    const [shops, requests] = await Promise.all([
      getPendingShops(),
      getPendingVerifyRequests(),
    ])
    setPendingShops(shops)
    setVerifyRequests(requests)
    setReady(true)
  }

  async function handleApproveShop(shopId: string) {
    await approveShop(shopId)
    setPendingShops(prev => prev.filter(s => s.id !== shopId))
  }

  async function handleRejectShop(shopId: string) {
    if (!confirm('이 샵을 거절할까요?')) return
    await rejectShop(shopId)
    setPendingShops(prev => prev.filter(s => s.id !== shopId))
  }

  async function handleApproveVerify(req: any) {
    await approveVerifyRequest(req.id, req.shop_id, req.user_id)
    setVerifyRequests(prev => prev.filter(r => r.id !== req.id))
  }

  async function handleRejectVerify(requestId: string) {
    const reason = prompt('거절 사유를 입력하세요. (신청자에게 표시됩니다)')
    if (reason === null) return
    await rejectVerifyRequest(requestId, reason)
    setVerifyRequests(prev => prev.filter(r => r.id !== requestId))
  }

  async function handleViewEvidence(path: string) {
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

  return (
    <div className={styles.layout}>

      <div className={styles.tabBar}>
        <div className={styles.sideTitle}>관리자</div>
        <h1 className={styles.title}>관리자 페이지</h1>

        <div className={styles.tabs}>
          <TabButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')}>
            🏠 대시보드
          </TabButton>
          <TabButton active={tab === 'shops'} onClick={() => setTab('shops')}>
            샵 승인 {pendingShops.length > 0 && `(${pendingShops.length})`}
          </TabButton>
          <TabButton active={tab === 'shopmanage'} onClick={() => setTab('shopmanage')}>
            🏪 샵 관리
          </TabButton>
          <TabButton active={tab === 'works'} onClick={() => setTab('works')}>
            🎬 작품 메타
          </TabButton>
          <TabButton active={tab === 'places'} onClick={() => setTab('places')}>
            장소(Place)
          </TabButton>
          <TabButton active={tab === 'banners'} onClick={() => setTab('banners')}>
            🖼️ 배너
          </TabButton>
          <TabButton active={tab === 'members'} onClick={() => setTab('members')}>
            👥 회원
          </TabButton>
          <TabButton active={tab === 'verify'} onClick={() => setTab('verify')}>
            인증 심사 {verifyRequests.length > 0 && `(${verifyRequests.length})`}
          </TabButton>
          <TabButton active={tab === 'reported'} onClick={() => setTab('reported')}>
            ⚠️ 신고된 샵
          </TabButton>
          <TabButton active={tab === 'postreports'} onClick={() => setTab('postreports')}>
            🎨 게시글 신고
          </TabButton>
          <TabButton active={tab === 'contacts'} onClick={() => setTab('contacts')}>
            ✉️ 문의 관리
          </TabButton>
          <TabButton active={tab === 'routes'} onClick={() => setTab('routes')}>
            추천 루트
          </TabButton>
          <TabButton active={tab === 'events'} onClick={() => setTab('events')}>
            시즌 이벤트
          </TabButton>
        </div>
      </div>

      <div className={styles.content}>
      {tab === 'dashboard' && <AdminDashboardPage onNavigate={(t) => setTab(t as Tab)} />}
  
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
      {tab === 'banners' && <BannerAdminTab />}
      {tab === 'members' && <MemberAdminTab />}
      {tab === 'reported' && <ReportedShopsTab />}
      {tab === 'postreports' && <PostReportsTab />}
      {tab === 'contacts' && <ContactAdminTab />}
      {tab === 'routes' && <OfficialRouteTab />}
      {tab === 'events' && <SeasonalEventTab />}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={active ? styles.tab + ' ' + styles.tabActive : styles.tab}
    >
      {children}
    </button>
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