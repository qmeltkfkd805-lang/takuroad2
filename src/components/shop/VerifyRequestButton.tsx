'use client'
import AppIcon from '@/components/tds/AppIcon'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyVerifyRequest } from '@/services/shopService'

interface Props {
  shopId: string
  shopName: string
  slug: string
  accentColor: string
}

export default function VerifyRequestButton({ shopId, shopName, slug, accentColor }: Props) {
  const { user } = useAuth()
  const [myRequest, setMyRequest] = useState<{ status: string; note: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getMyVerifyRequest(shopId, user.id).then(req => { setMyRequest(req); setLoading(false) })
  }, [shopId, user])

  if (loading) return null
  if (!user) return null

  if (myRequest) {
    const statusInfo = {
      pending:  { label: '인증 심사 중', color: 'var(--yellow)', icon: 'clock' },
      approved: { label: '인증 완료', color: 'var(--green)', icon: 'check' },
      rejected: { label: '인증 거절됨', color: 'var(--red)', icon: 'close' },
    }[myRequest.status] ?? { label: '상태 없음', color: 'var(--muted)', icon: 'question' }

    return (
      <div style={{
        padding: '12px 14px', borderRadius: '10px',
        background: `${statusInfo.color}15`, border: `1px solid ${statusInfo.color}40`,
        marginBottom: '20px', fontSize: '13px', fontWeight: 700, color: statusInfo.color,
      }}>
        <AppIcon name={statusInfo.icon} size={13} color={statusInfo.color} style={{ verticalAlign: '-2px', marginRight: 3 }} />{statusInfo.label}
        {myRequest.status === 'rejected' && (
          <Link
            href={`/shop/claim/${slug}`}
            style={{
              marginLeft: '10px', textDecoration: 'underline',
              color: statusInfo.color, fontWeight: 700,
            }}
          >다시 신청</Link>
        )}
      </div>
    )
  }

  return (
    <Link
      href={`/shop/claim/${slug}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        width: '100%', padding: '12px', borderRadius: '12px', boxSizing: 'border-box',
        border: '1.5px dashed var(--border)', background: 'transparent', cursor: 'pointer',
        fontSize: '13.5px', fontWeight: 700, color: accentColor, textDecoration: 'none',
        marginBottom: '20px',
      }}
    >
      <span aria-hidden style={{ width: 16, height: 16, display: 'inline-block', flexShrink: 0, backgroundColor: accentColor, WebkitMaskImage: 'url(/icons/shop.png)', maskImage: 'url(/icons/shop.png)', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskPosition: 'center', maskPosition: 'center' }} />
      이 샵의 사장님이신가요? 인증하기
    </Link>
  )
}