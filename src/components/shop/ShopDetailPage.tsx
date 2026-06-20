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

interface Props {
  shop: Shop
}

export default function ShopDetailPage({ shop }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const { isSaved, toggleSave } = useSaved()
  const [imgIdx, setImgIdx] = useState(0)

  const catInfo = CATEGORY_NAME_MAP[shop.cat]
  const color = catInfo?.color ?? '#e8006f'
  const todayStatus = getTodayStatus(shop.hours)
  const popupStatus = getPopupStatus(shop.start_date, shop.end_date)
  const hoursFormatted = formatBusinessHours(shop.hours)
  const canEdit = user && (user.id === shop.owner_id || user.id === shop.added_by)

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', background: 'var(--surface)', minHeight: '100dvh' }}>

      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 4px' }}
        >
          ←
        </button>
        <span style={{ fontWeight: 900, fontSize: '16px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shop.name}
        </span>
        {canEdit && (
          <Link
            href={ROUTES.shopEdit(shop.slug)}
            style={{
              fontSize: '13px', color: 'var(--muted)',
              padding: '6px 12px', border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
          >
            수정
          </Link>
        )}
      </div>

      {shop.images.length > 0 ? (
        <div style={{ position: 'relative', height: '260px', background: 'var(--surface2)', overflow: 'hidden' }}>
          <img
            src={shop.images[imgIdx]}
            alt={shop.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {shop.images.length > 1 && (
            <>
              <div style={{
                position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
                display: 'flex', gap: '5px',
              }}>
                {shop.images.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setImgIdx(i)}
                    style={{
                      width: i === imgIdx ? '18px' : '6px', height: '6px',
                      borderRadius: '3px',
                      background: i === imgIdx ? '#fff' : 'rgba(255,255,255,.5)',
                      cursor: 'pointer', transition: 'all .2s',
                    }}
                  />
                ))}
              </div>
              {imgIdx > 0 && (
                <button onClick={() => setImgIdx(i => i - 1)} style={{
                  position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,.4)', border: 'none', color: '#fff',
                  width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px',
                }}>‹</button>
              )}
              {imgIdx < shop.images.length - 1 && (
                <button onClick={() => setImgIdx(i => i + 1)} style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,.4)', border: 'none', color: '#fff',
                  width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px',
                }}>›</button>
              )}
            </>
          )}
        </div>
      ) : (
        <div style={{
          height: '160px', background: catInfo?.bgColor ?? 'var(--surface2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px',
        }}>
          {catInfo?.icon ?? '🏪'}
        </div>
      )}

      <div style={{ padding: '20px 16px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 900, lineHeight: 1.3 }}>{shop.name}</h1>
          {shop.is_verified && (
            <span style={{
              fontSize: '12px', color: 'var(--cyan)', fontWeight: 700,
              border: '1px solid var(--cyan)', borderRadius: '6px', padding: '2px 6px',
            }}>✓ 인증</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {shop.cats.map(cat => {
            const ci = CATEGORY_NAME_MAP[cat]
            return (
              <span key={cat} style={{
                fontSize: '12px', padding: '4px 10px', borderRadius: '12px',
                background: ci?.bgColor ?? 'var(--surface2)',
                color: ci?.color ?? color,
                border: `1px solid ${(ci?.color ?? color)}40`,
                fontWeight: 700,
              }}>{cat}</span>
            )
          })}
        </div>

        {shop.rating_count > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
            <span style={{ color: '#f59e0b', fontSize: '16px' }}>
              {'★'.repeat(Math.round(shop.rating_avg))}{'☆'.repeat(5 - Math.round(shop.rating_avg))}
            </span>
            <span style={{ fontWeight: 900, fontSize: '15px' }}>{shop.rating_avg.toFixed(1)}</span>
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>({shop.rating_count}개 리뷰)</span>
          </div>
        )}

        {popupStatus.status && (
          <div style={{
            padding: '10px 14px', borderRadius: '10px',
            background: 'var(--surface2)', marginBottom: '16px',
            fontSize: '13px', fontWeight: 700,
          }}>
            {popupStatus.emoji} 팝업 {popupStatus.label}
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

        {/* 체크인 버튼 */}
        <CheckInButton
          shopId={shop.id}
          shopName={shop.name}
          shopLat={shop.lat}
          shopLng={shop.lng}
          accentColor={color}
        />

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            onClick={() => router.push(`/?shop=${shop.slug}`)}
            style={{
              flex: 1, padding: '11px', borderRadius: '10px',
              background: color, color: '#fff', border: 'none',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            🗺️ 지도에서 보기
          </button>

          <button
            onClick={async () => {
              if (!user) {
                router.push(ROUTES.login)
                return
              }
              await toggleSave(shop.id)
            }}
            style={{
              padding: '11px 16px', borderRadius: '10px',
              border: `1.5px solid ${isSaved(shop.id) ? color : 'var(--border)'}`,
              background: isSaved(shop.id) ? `${color}15` : 'var(--surface)',
              fontWeight: 700, fontSize: '14px',
              color: isSaved(shop.id) ? color : 'var(--text)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {isSaved(shop.id) ? '🔖 찜함' : '🏷️ 찜하기'}
          </button>

          {shop.shop_link && (
            
              <a href={shop.shop_link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '11px 16px', borderRadius: '10px',
                border: '1.5px solid var(--border)', fontWeight: 700,
                fontSize: '14px', color: 'var(--text)',
              }}
            >🔗</a>
          )}

          {shop.addr && (
            
             <a href={`https://map.kakao.com/link/search/${encodeURIComponent(shop.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '11px 16px', borderRadius: '10px',
                border: '1.5px solid var(--border)', fontWeight: 700,
                fontSize: '14px', color: 'var(--text)',
              }}
            >길찾기</a>
          )}
        </div>

        <div style={{ height: '1px', background: 'var(--border)', margin: '0 0 20px' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>

          {shop.addr && (
            <InfoRow icon="📍" label="주소">
              {shop.addr}
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