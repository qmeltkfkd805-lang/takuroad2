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

type Tab = 'shops' | 'verify'

export default function AdminPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<Tab>('shops')
  const [pendingShops, setPendingShops] = useState<Shop[]>([])
  const [verifyRequests, setVerifyRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user || profile?.role !== 'admin') {
      router.push(ROUTES.home)
      return
    }
    loadData()
  }, [user, profile, authLoading])

  async function loadData() {
    setLoading(true)
    const [shops, requests] = await Promise.all([
      getPendingShops(),
      getPendingVerifyRequests(),
    ])
    setPendingShops(shops)
    setVerifyRequests(requests)
    setLoading(false)
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
    if (!confirm('이 인증 신청을 거절할까요?')) return
    await rejectVerifyRequest(requestId)
    setVerifyRequests(prev => prev.filter(r => r.id !== requestId))
  }

  async function handleViewEvidence(path: string) {
    const url = await getEvidenceFileUrl(path)
    if (url) window.open(url, '_blank')
  }

  if (authLoading || loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>

      {/* 헤더 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 16px',
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '12px' }}>관리자 페이지</h1>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <TabButton active={tab === 'shops'} onClick={() => setTab('shops')}>
            샵 승인 {pendingShops.length > 0 && `(${pendingShops.length})`}
          </TabButton>
          <TabButton active={tab === 'verify'} onClick={() => setTab('verify')}>
            인증 심사 {verifyRequests.length > 0 && `(${verifyRequests.length})`}
          </TabButton>
        </div>
      </div>

      {/* 샵 승인 탭 */}
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

      {/* 인증 심사 탭 */}
      {tab === 'verify' && (
        <div>
          {verifyRequests.length === 0 ? (
            <EmptyState text="심사 대기 중인 인증 신청이 없어요" />
          ) : (
            verifyRequests.map(req => (
              <div key={req.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <Link href={ROUTES.shop(req.shops?.slug ?? '')} target="_blank" style={{ fontWeight: 700, fontSize: '15px' }}>
                    {req.shops?.name ?? '알 수 없음'}
                  </Link>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {new Date(req.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
                  신청자: {req.profiles?.nickname ?? '알 수 없음'}
                </p>
                {req.note && (
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
      style={{
        padding: '8px 14px', borderRadius: '8px',
        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        background: active ? 'var(--accent)' : 'var(--surface2)',
        color: active ? '#fff' : 'var(--text)',
        fontWeight: 700, fontSize: '13px',
      }}
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