'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { useCurrentLocation, formatDistance } from '@/hooks/useCurrentLocation'
import { createCheckIn, getMyCheckInStatus, getShopCheckInCount } from '@/services/checkInService'

interface Props {
  shopId: string
  shopName: string
  shopLat: number | null
  shopLng: number | null
  accentColor: string
}

export default function CheckInButton({ shopId, shopName, shopLat, shopLng, accentColor }: Props) {
  const { user } = useAuth()
  const { location, loading: locating, error: locError, requestLocation } = useCurrentLocation()
  const [checkedInToday, setCheckedInToday] = useState(false)
  const [checkInCount, setCheckInCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      getMyCheckInStatus(user.id, shopId).then(s => setCheckedInToday(s.checkedInToday))
    }
    getShopCheckInCount(shopId).then(setCheckInCount)
  }, [user, shopId])

  if (!shopLat || !shopLng) return null

  const distance = location ? Math.round(
    Math.sqrt((location.lat - shopLat) ** 2 + (location.lng - shopLng) ** 2) * 111000
  ) : null

  async function handleCheckIn() {
    if (!user) return

    if (!location) {
      requestLocation()
      return
    }

    setSubmitting(true)
    const result = await createCheckIn(
      user.id, shopId, shopLat!, shopLng!, shopName,
      location.lat, location.lng
    )

    if (result.success) {
      setCheckedInToday(true)
      setCheckInCount(c => c + 1)
      setToast('체크인 완료!')
      setTimeout(() => setToast(null), 2500)
    } else {
      setToast(result.error ?? '체크인에 실패했어요')
      setTimeout(() => setToast(null), 2500)
    }
    setSubmitting(false)
  }

  return (
    <div style={{ marginBottom: '20px', position: 'relative' }}>
      <button
        onClick={handleCheckIn}
        disabled={submitting || checkedInToday || locating}
        style={{
          width: '100%', padding: '12px', borderRadius: '12px',
          border: 'none',
          background: checkedInToday ? 'var(--surface2)' : accentColor,
          color: checkedInToday ? 'var(--muted)' : '#fff',
          fontWeight: 900, fontSize: '15px',
          cursor: checkedInToday ? 'default' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {checkedInToday
          ? '✓ 오늘 체크인 완료'
          : locating
            ? '위치 확인 중...'
            : submitting
              ? '체크인 중...'
              : !location
                ? '📍 체크인하기'
                : '📍 체크인하기'}
      </button>

      {checkInCount > 0 && (
        <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '6px' }}>
          {checkInCount}명이 다녀갔어요
        </p>
      )}

      {locError && (
        <p style={{ fontSize: '12px', color: 'var(--red)', textAlign: 'center', marginTop: '6px' }}>
          {locError}
        </p>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--text)', color: '#fff',
          padding: '12px 20px', borderRadius: '24px',
          fontSize: '14px', fontWeight: 700,
          boxShadow: 'var(--sh-lg)', zIndex: 999,
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}