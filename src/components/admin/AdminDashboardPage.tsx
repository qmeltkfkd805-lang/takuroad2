'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getAdminTodoSummary } from '@/services/adminDashboardService'
import { ROUTES } from '@/lib/constants/routes'

export default function AdminDashboardPage({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminTodoSummary().then(data => {
      setSummary(data)
      setLoading(false)
    })
  }, [])

  if (loading || !summary) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  }

  return (
    <div style={{ padding: '16px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '16px' }}>🏠 운영자 할 일</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        <TodoRow
          icon="📝" label="승인 대기 제보" count={summary.pendingSuggestions}
          onClick={() => onNavigate('reported')}
        />
        <TodoRow
          icon="✅" label="인증 신청 대기" count={summary.pendingVerifyRequests}
          onClick={() => onNavigate('verify')}
        />
        <TodoRow
          icon="❓" label="한번도 확인 안 된 굿즈 정보" count={summary.unconfirmedProducts}
        />
      </div>

      {summary.staleShops.length > 0 && (
        <div>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)', marginBottom: '10px' }}>
            🔥 인기 있는데 오래된 정보
          </h3>
          {summary.staleShops.map((shop: any) => (
            <Link
              key={shop.id}
              href={ROUTES.shopEdit(shop.slug)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
                textDecoration: 'none', color: 'inherit',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 700 }}>{shop.name}</span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                방문 {shop.visit_count}회 · {new Date(shop.info_last_confirmed_at).toLocaleDateString('ko-KR')} 갱신
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function TodoRow({ icon, label, count, onClick }: { icon: string; label: string; count: number; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 14px', borderRadius: '10px',
        border: '1px solid var(--border)', cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 700 }}>{icon} {label}</span>
      <span style={{
        fontSize: '13px', fontWeight: 900,
        color: count > 0 ? 'var(--accent)' : 'var(--muted)',
      }}>
        {count}건
      </span>
    </div>
  )
}