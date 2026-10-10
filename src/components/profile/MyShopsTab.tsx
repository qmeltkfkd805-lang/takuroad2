'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getMyShops } from '@/services/shopService'
import { Shop } from '@/types/shop'
import { ROUTES } from '@/lib/constants/routes'
import { SHOP_STATUS_LABEL } from '@/lib/constants/categories'
import { LoadingState, EmptyState } from './SavedShopsTab'
import AppIcon from '@/components/tds/AppIcon'
export default function MyShopsTab({ userId }: { userId: string }) {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    getMyShops(userId).then(data => {
      setShops(data)
      setLoading(false)
    })
  }, [userId])
  if (loading) return <LoadingState />
  if (shops.length === 0) return <EmptyState icon="shop" text="등록한 샵이 없어요" />
  const statusColor: Record<string, string> = {
    pending: 'var(--yellow)',
    active: 'var(--green)',
    hidden: 'var(--muted)',
    closed: 'var(--red)',
    temporary_closed: 'var(--yellow)',
  }
  return (
    <div>
      {shops.map(shop => {
        const handedOver = shop.owner_id && shop.owner_id !== userId
        // 아직 공개 전인 샵(등록 요청 중·보완 필요·임시저장)은 샵 화면이 열리지 않는다 → 수정 화면으로
        const unpublished = shop.status === 'pending' || shop.status === 'hidden'
        const needsFix = shop.status === 'hidden' && shop.review_status === 'needs_attention'
        const label = shop.status === 'pending' ? '등록 요청 중'
          : needsFix ? '보완 필요'
          : shop.status === 'hidden' ? '임시저장'
          : (SHOP_STATUS_LABEL[shop.status] ?? shop.status)
        const color = needsFix ? 'var(--red)' : statusColor[shop.status] ?? 'var(--muted)'
        return (
          <Link key={shop.id} href={unpublished ? ROUTES.shopEdit(shop.slug) : ROUTES.shop(shop.slug)} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{shop.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{shop.addr || '주소 없음'}</div>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 700,
                  color,
                  border: '1px solid ' + color,
                  borderRadius: '6px', padding: '3px 8px', flexShrink: 0,
                }}>
                  {label}
                </span>
              </div>
              {shop.status === 'pending' && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  타쿠로드가 정보를 확인하고 있어요. 공개되면 알림과 경험치를 드려요.
                </div>
              )}
              {needsFix && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', lineHeight: 1.5 }}>
                  정보 보완 요청이 왔어요. 눌러서 고친 뒤 다시 등록 요청해 주세요. 자세한 내용은 알림에서 볼 수 있어요.
                </div>
              )}
              {shop.status === 'hidden' && !needsFix && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  아직 등록 요청 전이에요. 눌러서 마저 입력하고 등록 요청해 주세요.
                </div>
              )}
              {handedOver && (
                <div style={{
                  marginTop: 10, padding: '10px 12px',
                  background: 'linear-gradient(135deg, #fff7ed, #fef3c7)',
                  border: '1px solid #fcd34d', borderRadius: 10,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <AppIcon name="medal" size={18} color="var(--accent)" />
                  <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                    <b>사장님에게 소유권이 이전되었어요.</b><br />
                    이 샵은 공식 사장님이 인증받아 직접 관리하고 있어요. 첫 등록자로서의 기여는 계속 남아있어요.
                  </div>
                </div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}