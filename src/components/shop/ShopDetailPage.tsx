'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shop } from '@/types/shop'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import { getTodayStatus, formatBusinessHours, getPopupStatus } from '@/lib/utils/date'
import { ROUTES } from '@/lib/constants/routes'
import { useAuth } from '@/components/layout/AuthProvider'
import { useSaved } from '@/hooks/useSaved'
import VerifyRequestButton from './VerifyRequestButton'
import CheckInButton from './CheckInButton'
import ReviewSection from './ReviewSection'
import ReportIssueButton from './ReportIssueButton'
import ShopEventList from './ShopEventList'
import ShopHistoryPanel from './ShopHistoryPanel'
import ConfirmInfoButton from './ConfirmInfoButton'
import ShopProductAccordion from './ShopProductAccordion'
import ShopAmenityBadges from './ShopAmenityBadges'
import ShopHighlights from './ShopHighlights'
import ShopTagBadges from './ShopTagBadges'
import ShopGallery from './ShopGallery'
import ShopHeader from './ShopHeader'

interface Props {
  shop: Shop
}

export default function ShopDetailPage({ shop }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const { isSaved, toggleSave } = useSaved()

  const catInfo = CATEGORY_NAME_MAP[shop.cat]
  const color = catInfo?.color ?? '#e8006f'
  const todayStatus = getTodayStatus(shop.hours)
  const popupStatus = getPopupStatus(shop.start_date, shop.end_date)
  const hoursFormatted = formatBusinessHours(shop.hours)
  const canEdit = user && (user.id === shop.owner_id || user.id === shop.added_by)

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', background: 'var(--surface)', minHeight: '100dvh' }}>
      <ShopGallery
        images={shop.images}
        shopName={shop.name}
        onBack={() => router.back()}
        isSaved={isSaved(shop.id)}
        onToggleSave={() => { toggleSave(shop.id) }}
        onShare={() => { if (navigator.share) { navigator.share({ title: shop.name, url: window.location.href }) } else { navigator.clipboard?.writeText(window.location.href) } }}
        fallbackIcon={catInfo?.icon ?? '🏪'}
        fallbackBg={catInfo?.bgColor ?? 'var(--surface2)'}
      />

      <div style={{ padding: '20px 16px' }}>

        {(shop.status === 'temporary_closed' || shop.status === 'closed') && (
          <div style={{
            padding: '12px 14px', borderRadius: '10px', marginBottom: '16px',
            background: shop.status === 'closed' ? 'var(--surface2)' : '#fef3c7',
            color: shop.status === 'closed' ? 'var(--muted)' : '#92400e',
            fontWeight: 700, fontSize: '13px', textAlign: 'center',
          }}>
            {shop.status === 'closed' ? '폐점한 곳이에요' : '현재 임시 휴업 중이에요'}
          </div>
        )}

        <ShopHeader
          name={shop.name}
          isVerified={shop.is_verified}
          cats={shop.cats}
          ratingAvg={shop.rating_avg}
          ratingCount={shop.rating_count}
          todayStatus={todayStatus}
          color={color}
        />

        {popupStatus.status && (
          <div style={{
            padding: '10px 14px', borderRadius: '10px',
            background: 'var(--surface2)', marginBottom: '16px',
            fontSize: '13px', fontWeight: 700,
          }}>
            팝업 {popupStatus.label}
            {shop.start_date && shop.end_date && (
              <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: '8px' }}>
                {shop.start_date} ~ {shop.end_date}
              </span>
            )}
            {shop.event_info && (
              <p style={{ marginTop: '6px', fontWeight: 400, color: 'var(--text)', lineHeight: 1.6 }}>
                {shop.event_info}
              </p>
            )}
          </div>
        )}

        <ShopHighlights shopId={shop.id} />
        <ShopTagBadges shopId={shop.id} />
        <ShopProductAccordion shopId={shop.id} />
        <ShopEventList shopId={shop.id} />

        <button
          onClick={() => router.push(`/event/submit?shop=${shop.slug}`)}
          style={{
            width: '100%', padding: '13px', marginTop: '4px',
            borderRadius: 'var(--r-sm)', border: '1.5px dashed var(--accent)',
            background: 'var(--surface)', color: 'var(--accent)',
            fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + 이벤트 제보하기
        </button>

        <ShopAmenityBadges shopId={shop.id} />

        <CheckInButton
          shopId={shop.id}
          shopName={shop.name}
          shopLat={shop.lat}
          shopLng={shop.lng}
          accentColor={color}
        />

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          {shop.addr && (
            <a href={`https://map.kakao.com/link/search/${encodeURIComponent(shop.name)}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                flex: 1, padding: '13px', borderRadius: '12px',
                border: '1.5px solid var(--border)', fontWeight: 700,
                fontSize: '14px', color: 'var(--text)', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                background: 'var(--surface)',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" /><path d="M17.7 16.7 12 22l-5.7-5.3a8 8 0 1 1 11.4 0z" /></svg>
              길찾기
            </a>
          )}
          <button
            onClick={async () => {
              if (!user) { router.push(ROUTES.login); return }
              await toggleSave(shop.id)
            }}
            style={{
              flex: 1, padding: '13px', borderRadius: '12px',
              border: `1.5px solid ${isSaved(shop.id) ? color : 'var(--border)'}`,
              background: isSaved(shop.id) ? `${color}15` : 'var(--surface)',
              fontWeight: 700, fontSize: '14px',
              color: isSaved(shop.id) ? color : 'var(--text)',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill={isSaved(shop.id) ? color : 'none'} stroke={isSaved(shop.id) ? color : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
            {isSaved(shop.id) ? '저장됨' : '저장'}
          </button>
        </div>

        <div style={{ height: '1px', background: 'var(--border)', margin: '0 0 20px' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>

          {shop.addr && (
            <InfoRow icon="📍" label="주소">
              {shop.addr}
              {shop.floor_info && (
                <span style={{ color: 'var(--accent)', fontWeight: 700, marginLeft: '6px' }}>
                  ({shop.floor_info})
                </span>
              )}
            </InfoRow>
          )}

          {shop.hours && (
            <InfoRow icon="🕐" label="영업시간">
              <span style={{ color: todayStatus.isOpen ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                {todayStatus.label}
              </span>
              {todayStatus.todayHours && (
                <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>{todayStatus.todayHours}</span>
              )}
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {hoursFormatted.map(h => (
                  <div key={h.day} style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                    <span style={{ width: '20px', color: 'var(--muted)', fontWeight: 700 }}>{h.label}</span>
                    <span style={{ color: h.isOpen ? 'var(--text)' : 'var(--muted)' }}>{h.hours}</span>
                  </div>
                ))}
                <div style={{ marginTop: '8px' }}>
                  <ConfirmInfoButton
                    shopId={shop.id}
                    targetTable="shops"
                    targetField="hours"
                    targetId={shop.id}
                  />
                </div>
              </div>
            </InfoRow>
          )}

          {shop.parking !== null && (
            <InfoRow icon="🅿️" label="주차">
              {shop.parking ? '가능' : '불가'}
              {shop.parking_note && <span style={{ color: 'var(--muted)', marginLeft: '6px' }}>{shop.parking_note}</span>}
            </InfoRow>
          )}

          {shop.shop_link && (
            <InfoRow icon="🔗" label="링크">
              <a href={shop.shop_link} target="_blank" rel="noopener noreferrer"
                style={{ color: color, wordBreak: 'break-all' }}>
                {shop.shop_link}
              </a>
            </InfoRow>
          )}
        </div>

        {shop.description && (
          <>
            <h2 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '10px' }}>소개</h2>
            <p style={{
              fontSize: '14px', lineHeight: 1.8, color: 'var(--text)',
              background: 'var(--surface2)', borderRadius: '10px', padding: '14px',
              marginBottom: '24px', whiteSpace: 'pre-wrap',
            }}>
              {shop.description}
            </p>
          </>
        )}

        <div style={{ height: '1px', background: 'var(--border)', margin: '0 0 24px' }} />

        {!shop.is_claimed && (
          <VerifyRequestButton shopId={shop.id} shopName={shop.name} accentColor={color} />
        )}

        <ReviewSection shopId={shop.id} shopName={shop.name} accentColor={color} />

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <ReportIssueButton shopId={shop.id} />
          <div style={{ marginTop: '32px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '12px' }}>변경 이력</h2>
            <ShopHistoryPanel shopId={shop.id} />
          </div>
        </div>

      </div>
    </div>
  )
}

function InfoRow({ icon, label, children }: {
  icon: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '14px', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  )
}



