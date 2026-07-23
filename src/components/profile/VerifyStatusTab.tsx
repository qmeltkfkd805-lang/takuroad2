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
  if (requests.length === 0) return <EmptyState icon="shield" text="인증 신청 내역이 없어요" />
  const statusInfo: Record<string, { label: string; color: string }> = {
    pending:  { label: '심사중', color: 'var(--yellow)' },
    approved: { label: '승인됨', color: 'var(--green)' },
    rejected: { label: '거절됨', color: 'var(--red)' },
  }
  return (
    <div>
      {requests.map(req => {
        const info = statusInfo[req.status] ?? { label: req.status, color: 'var(--muted)' }
        return (
          <div key={req.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <Link href={ROUTES.shop(req.shops?.slug ?? '')} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{req.shops?.name ?? '삭제된 샵'}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: info.color }}>{info.label}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                신청일: {new Date(req.created_at).toLocaleDateString('ko-KR')}
              </div>
            </Link>
            {req.status === 'rejected' && req.note && (
              <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--red-l, #fef2f2)', borderRadius: 8, fontSize: 12, color: 'var(--red)', lineHeight: 1.5 }}>
                <b>거절 사유</b><br />{req.note}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}