'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getMyVerifyRequests } from '@/services/shopService'
import { ROUTES } from '@/lib/constants/routes'
import { LoadingState, EmptyState } from './SavedShopsTab'

export default function VerifyStatusTab({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyVerifyRequests(userId).then(data => {
      setRequests(data)
      setLoading(false)
    })
  }, [userId])

  if (loading) return <LoadingState />
  if (requests.length === 0) return <EmptyState icon="✅" text="인증 신청 내역이 없어요" />

  const statusInfo: Record<string, { label: string; color: string; icon: string }> = {
    pending:  { label: '심사중', color: 'var(--yellow)', icon: '⏳' },
    approved: { label: '승인됨', color: 'var(--green)', icon: '✅' },
    rejected: { label: '거절됨', color: 'var(--red)', icon: '❌' },
  }

  return (
    <div>
      {requests.map(req => {
        const info = statusInfo[req.status] ?? { label: req.status, color: 'var(--muted)', icon: '❔' }
        return (
          <Link
            key={req.id}
            href={ROUTES.shop(req.shops?.slug ?? '')}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{req.shops?.name ?? '알 수 없음'}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: info.color }}>
                  {info.icon} {info.label}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                신청일: {new Date(req.created_at).toLocaleDateString('ko-KR')}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}