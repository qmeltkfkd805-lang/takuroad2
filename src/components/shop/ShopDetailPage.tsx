'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shop } from '@/types/shop'
import { deleteShop } from '@/services/shopService'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import { getTodayStatus, formatBusinessHours, getPopupStatus } from '@/lib/utils/date'
import { parseParkingRows } from '@/lib/utils/parkingNote'
import { ROUTES } from '@/lib/constants/routes'
import { useAuth } from '@/components/layout/AuthProvider'
import { useSaved } from '@/hooks/useSaved'
import VerifyRequestButton from './VerifyRequestButton'
import ReportIssueButton from './ReportIssueButton'
import CheckInButton from './CheckInButton'
import ReviewSection from './ReviewSection'
import ShopEventList from './ShopEventList'
import ShopAmenityBadges from './ShopAmenityBadges'
import ShopHighlights from './ShopHighlights'
import ShopTagBadges from './ShopTagBadges'
import ShopGallery from './ShopGallery'
import ShopHeader from './ShopHeader'
import ShopDetailPageDesktop from './ShopDetailPageDesktop'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { Button } from '@/components/tds/Button'

interface Props {
  shop: Shop
}

export default function ShopDetailPage({ shop }: Props) {
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const { isSaved, toggleSave } = useSaved()
  const isDesktop = useIsDesktop()

  /* 히어로 더보기(⋯). 데스크톱과 같은 항목을 모바일에도 둔다.
     드롭다운 대신 바텀시트다 — ShopGallery 컨테이너가 overflow:hidden 이라
     그 안에서는 드롭다운이 잘리고, 모바일에서는 바텀시트가 더 자연스럽다. */
  const [menuOpen, setMenuOpen] = useState(false)
  const canManage = isAdmin || (!!user && shop.owner_id === user.id)
  const canOwnerManage = isAdmin || (!!user && shop.owner_id === user.id && shop.is_claimed)

  async function handleDelete() {
    setMenuOpen(false)
    if (!user) return
    if (!window.confirm('정말 이 샵을 삭제할까요? 되돌릴 수 없어요.')) return
    const ok = await deleteShop(shop.id, user.id)
    if (ok) router.push('/map')
    else window.alert('삭제에 실패했어요. 권한이 없거나 연결된 데이터가 있을 수 있어요.')
  }

  const catInfo = CATEGORY_NAME_MAP[shop.cat]
  const color = catInfo?.color ?? '#e8006f'
  const todayStatus = getTodayStatus(shop.hours)
  const popupStatus = getPopupStatus(shop.start_date, shop.end_date)
  const hoursFormatted = formatBusinessHours(shop.hours)

  if (isDesktop) return <ShopDetailPageDesktop shop={shop} />

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', background: 'var(--surface)', minHeight: '100dvh' }}>
      <ShopGallery
        images={shop.images}
        shopName={shop.name}
        onBack={() => router.back()}
        isSaved={isSaved(shop.id)}
        onToggleSave={() => { toggleSave(shop.id) }}
        onShare={() => { if (navigator.share) { navigator.share({ title: shop.name, url: window.location.href }) } else { navigator.clipboard?.writeText(window.location.href) } }}
        onMore={() => setMenuOpen(true)}
        fallbackIcon={catInfo?.icon ?? 'shop'}
        fallbackBg={catInfo?.bgColor ?? 'var(--surface2)'}
      />

      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            role="dialog" aria-modal="true" aria-label="샵 메뉴"
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '680px', padding: '10px 0 18px' }}
          >
            <div style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--border)', margin: '0 auto 8px' }} />
            {canOwnerManage && (
              <button onClick={() => { setMenuOpen(false); router.push(`/shop/${shop.slug}/manage`) }}
                style={{ ...sheetItem, fontWeight: 800, color }}>매장 관리</button>
            )}
            {canManage && (
              <button onClick={() => { setMenuOpen(false); router.push(ROUTES.shopEdit(shop.slug)) }} style={sheetItem}>수정하기</button>
            )}
            {/* 모달이 닫힐 때 시트도 닫는다 — 열 때 닫으면 버튼이 언마운트돼 모달까지 사라진다 */}
            <ReportIssueButton
              shopId={shop.id}
              label="신고하기"
              variant="menu"
              style={sheetItem}
              onClose={() => setMenuOpen(false)}
            />
            {canManage && (
              <button onClick={handleDelete} style={{ ...sheetItem, color: '#e04343', borderTop: '1px solid var(--border)' }}>샵 삭제하기</button>
            )}
            <button onClick={() => setMenuOpen(false)} style={{ ...sheetItem, color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>닫기</button>
          </div>
        </div>
      )}

      <div style={{ padding: '20px 16px', position: 'relative', marginTop: '-20px', background: 'var(--surface)', borderRadius: '24px 24px 0 0' }}>

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
          isClaimed={shop.is_claimed}
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" /><path d="M17.7 16.7 12 22l-5.7-5.3a8 8 0 1 1 11.4 0z" /></svg>{shop.floor_info}
              </span>
            )}
            {shop.parking !== null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M9 17V7h3.5a2.5 2.5 0 0 1 0 5H9" /></svg>
                <span style={{ color: shop.parking ? 'var(--text)' : 'var(--muted)' }}>
                  {shop.parking ? '주차 가능' : '주차 불가'}
                </span>
                {shop.parking_note && !/\r?\n/.test(shop.parking_note) && parseParkingRows(shop.parking_note).length <= 1 && (
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {shop.parking_note}</span>
                )}
              </span>
            )}
          </div>
        )}
        {shop.parking_note && /\r?\n/.test(shop.parking_note) ? (
          <div style={{
            margin: '10px 0 0', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10,
            fontSize: '13px', lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-line',
            wordBreak: 'keep-all', overflowWrap: 'anywhere',
          }}>
            {shop.parking_note}
          </div>
        ) : shop.parking_note && parseParkingRows(shop.parking_note).length > 1 ? (
          <ul style={{
            listStyle: 'none', margin: '10px 0 0', padding: '10px 12px',
            background: 'var(--surface2)', borderRadius: 10,
            display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            {parseParkingRows(shop.parking_note).map((r, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.5, alignItems: 'baseline' }}>
                {r.label != null && (
                  <span style={{ color: 'var(--muted)', minWidth: 72, flexShrink: 0, wordBreak: 'keep-all' }}>{r.label}</span>
                )}
                <span style={{ color: 'var(--text)', fontWeight: 600, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{r.value}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {/* === ActionBar (체크인 + 길찾기 + 저장) === */}
        <div style={{ marginTop: '20px' }}>


          <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
            {shop.addr && (
              <Button
                variant="action"
                fullWidth
                onClick={() => window.open(`https://map.kakao.com/link/search/${encodeURIComponent(shop.name)}`, '_blank', 'noopener')}
                leftIcon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" /><path d="M17.7 16.7 12 22l-5.7-5.3a8 8 0 1 1 11.4 0z" /></svg>}
              >
                길찾기
              </Button>
            )}
            <Button
              variant="action"
              fullWidth
              active={isSaved(shop.id)}
              activeColor={color}
              onClick={async () => {
                if (!user) { router.push(ROUTES.login); return }
                await toggleSave(shop.id)
              }}
              leftIcon={<svg width="17" height="17" viewBox="0 0 24 24" fill={isSaved(shop.id) ? color : 'none'} stroke={isSaved(shop.id) ? color : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>}
            >
              {isSaved(shop.id) ? '저장됨' : '저장'}
            </Button>
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
          onClick={() => router.push(`/event/new?shop=${shop.slug}`)}
          style={{ marginTop: '4px', marginBottom: '24px' }}
        >
          + 이벤트 등록하기
        </Button>

        {/* === 취급 작품 / 굿즈 === */}
        <ShopHighlights shopId={shop.id} />
        <ShopTagBadges shopId={shop.id} />

        {/* === 편의시설 === */}
        <ShopAmenityBadges shopId={shop.id} />

        <div style={{ height: '1px', background: 'var(--border)', margin: '24px 0 20px' }} />

        {/* === 상세 정보 === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>

          {shop.place_slug && shop.place_name && (
            <a
              href={`/place/${shop.place_slug}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '11px 13px', borderRadius: '12px',
                background: 'var(--accent-l)', textDecoration: 'none',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" /><path d="M17.7 16.7 12 22l-5.7-5.3a8 8 0 1 1 11.4 0z" /></svg>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 800, color: 'var(--accent)' }}>{shop.place_name}</span>
                <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--muted)' }}>이 장소의 다른 샵·이벤트 보기</span>
              </span>
              <span style={{ color: 'var(--accent)', fontSize: '16px' }}>›</span>
            </a>
          )}

          {shop.addr && (
            <InfoRow icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" /><path d="M17.7 16.7 12 22l-5.7-5.3a8 8 0 1 1 11.4 0z" /></svg>} label="주소">
              {shop.addr}
              {shop.floor_info && (
                <span style={{ color: 'var(--accent)', fontWeight: 700, marginLeft: '6px' }}>
                  ({shop.floor_info})
                </span>
              )}
            </InfoRow>
          )}

          {shop.shop_link && (
            <InfoRow icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 15l6-6" /><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1" /><path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1" /></svg>} label="링크">
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
          <VerifyRequestButton shopId={shop.id} shopName={shop.name} slug={shop.slug} accentColor={color} />
        )}

        <ReviewSection shopId={shop.id} shopName={shop.name} accentColor={color} />


      </div>
    </div>
  )
}

/* 바텀시트 한 줄. 최소 높이 44px 로 터치 영역을 확보한다 */
const sheetItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', minHeight: 52, padding: '15px 20px',
  border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
  color: 'var(--text)', cursor: 'pointer',
}

function InfoRow({ icon, label, children }: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <span style={{ flexShrink: 0, marginTop: '1px', display: 'flex' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '14px', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  )
}

















