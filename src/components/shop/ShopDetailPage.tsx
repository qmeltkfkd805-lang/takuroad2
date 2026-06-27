'use client'

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
import ConfirmInfoButton from './ConfirmInfoButton'
import ShopProductAccordion from './ShopProductAccordion'
import ShopAmenityBadges from './ShopAmenityBadges'
import ShopHighlights from './ShopHighlights'
import ShopTagBadges from './ShopTagBadges'
import ShopGallery from './ShopGallery'
import ShopHeader from './ShopHeader'
import { Button } from '@/components/tds/Button'

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

        {/* === Header === */}
        <ShopHeader
          name={shop.name}
          isVerified={shop.is_verified}
          cats={shop.cats}
          ratingAvg={shop.rating_avg}
          ratingCount={shop.rating_count}
          todayStatus={todayStatus}
          hoursFormatted={hoursFormatted}
          color={color}
        />

        {/* === 빠른 정보 (층 / 주차) === */}
        {(shop.floor_info || shop.parking !== null) && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: '14px',
            fontSize: '13px', fontWeight: 700, color: 'var(--text)',
          }}>
            {shop.floor_info && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '15px' }}>📍</span>{shop.floor_info}
              </span>
            )}
            {shop.parking !== null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '15px' }}>🅿️</span>
                <span style={{ color: shop.parking ? 'var(--text)' : 'var(--muted)' }}>
                  {shop.parking ? '주차 가능' : '주차 불가'}
                </span>
                {shop.parking && shop.parking_note && (
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {shop.parking_note}</span>
                )}
              </span>
            )}
          </div>
        )}
        {/* === ActionBar (체크인 + 길찾기 + 저장) === */}
        <div style={{ marginTop: '20px' }}>


          <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
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

          <CheckInButton
            shopId={shop.id}
            shopName={shop.name}
            shopLat={shop.lat}
            shopLng={shop.lng}
            accentColor={color}
          />
        </div>

        <div style={{ height: '1px', background: 'var(--border)', margin: '24px 0' }} />

        {/* === 오늘의 이벤트 / 소식 === */}
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

        <ShopEventList shopId={shop.id} />
        <Button
          variant="dashed"
          fullWidth
          onClick={() => router.push(`/event/submit?shop=${shop.slug}`)}
          style={{ marginTop: '4px', marginBottom: '24px' }}
        >
          + 이벤트 제보하기
        </Button>

        {/* === 취급 작품 / 굿즈 === */}
        <ShopHighlights shopId={shop.id} />
        <ShopTagBadges shopId={shop.id} />
        <ShopProductAccordion shopId={shop.id} />

        {/* === 편의시설 === */}
        <ShopAmenityBadges shopId={shop.id} />

        <div style={{ height: '1px', background: 'var(--border)', margin: '24px 0 20px' }} />

        {/* === 상세 정보 === */}
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

          {shop.shop_link && (
            <InfoRow icon="🔗" label="링크">
              <a href={shop.shop_link} target="_blank" rel="noopener noreferrer"
                style={{ color: color, wordBreak: 'break-all' }}>
                {shop.shop_link}
              </a>
            </InfoRow>
          )}
        </div>

        {/* === 소개 === */}
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

        {/* === 리뷰 === */}
        {!shop.is_claimed && (
          <VerifyRequestButton shopId={shop.id} shopName={shop.name} accentColor={color} />
        )}

        <ReviewSection shopId={shop.id} shopName={shop.name} accentColor={color} />

        {/* === 정보 신고 === */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <ReportIssueButton shopId={shop.id} />
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









