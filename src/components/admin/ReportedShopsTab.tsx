'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getMostReportedShops, getShopSuggestions, resolveSuggestion,
} from '@/services/shopReportService'
import { ROUTES } from '@/lib/constants/routes'

export default function ReportedShopsTab() {
  const { user } = useAuth()
  const [reportedShops, setReportedShops] = useState<any[]>([])
  const [selectedShop, setSelectedShop] = useState<any | null>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReported()
  }, [])

  async function loadReported() {
    const data = await getMostReportedShops()
    setReportedShops(data)
    setLoading(false)
  }

  async function openShopDetail(shop: any) {
    setSelectedShop(shop)
    const data = await getShopSuggestions(shop.id)
    setSuggestions(data)
  }

  async function handleResolve(suggestionId: string, status: 'approved' | 'rejected') {
    if (!user || !selectedShop) return
    await resolveSuggestion(suggestionId, status, user.id)
    const data = await getShopSuggestions(selectedShop.id)
    setSuggestions(data)
    loadReported()
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>

  if (selectedShop) {
    return (
      <div>
        <div style={{
          padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
        }}>
          <button
            onClick={() => setSelectedShop(null)}
            style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer' }}
          >← 목록으로</button>
          <Link
            href={ROUTES.shopEdit(selectedShop.slug)}
            target="_blank"
            style={{
              padding: '8px 14px', borderRadius: '8px',
              background: 'var(--accent)', color: '#fff',
              fontWeight: 700, fontSize: '13px', textDecoration: 'none',
            }}
          >
            ✏️ {selectedShop.name} 수정하기
          </Link>
        </div>

        {suggestions.length === 0 ? (
          <p style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>신고 내역이 없어요</p>
        ) : (
          suggestions.map(s => (
            <div key={s.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>
                  {s.payload?.reason ?? s.suggestion_type}
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 700,
                  color: s.status === 'pending' ? 'var(--accent)' : s.status === 'approved' ? 'var(--green)' : 'var(--muted)',
                }}>
                  {s.status === 'pending' ? '대기중' : s.status === 'approved' ? '승인됨' : '거절됨'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
                신고자: {s.profiles?.nickname ?? '알 수 없음'} · {new Date(s.created_at).toLocaleDateString('ko-KR')}
              </p>
              {s.status === 'pending' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleResolve(s.id, 'approved')}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                      background: 'var(--green)', color: '#fff', fontWeight: 700,
                      fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >확인함 (반영)</button>
                  <button
                    onClick={() => handleResolve(s.id, 'rejected')}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px',
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--muted)', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >무시</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <div>
      {reportedShops.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>신고된 샵이 없어요</p>
        </div>
      ) : (
        reportedShops.map(({ shop, count }) => (
          <div
            key={shop.id}
            onClick={() => openShopDetail(shop)}
            style={{
              padding: '16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <div>
              <Link
                href={ROUTES.shop(shop.slug)}
                target="_blank"
                onClick={e => e.stopPropagation()}
                style={{ fontWeight: 700, fontSize: '15px' }}
              >
                {shop.name}
              </Link>
            </div>
            <span style={{
              fontSize: '12px', fontWeight: 900, color: '#fff',
              background: 'var(--red)', borderRadius: '12px', padding: '4px 10px',
            }}>
              신고 {count}건
            </span>
          </div>
        ))
      )}
    </div>
  )
}