'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { createCheckIn, getMyCheckInStatus, getShopCheckInCount } from '@/services/checkInService'
import { collectTagsFromCheckIn } from '@/services/tagCollectionService'
import { createClient } from '@/lib/supabase/client'

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
  const [newBadge, setNewBadge] = useState<{ name: string; rarity: string } | null>(null)
  const [newTags, setNewTags] = useState<string[] | null>(null)

  useEffect(() => {
    if (user) {
      getMyCheckInStatus(user.id, shopId).then(s => setCheckedInToday(s.checkedInToday))
    }
    getShopCheckInCount(shopId).then(setCheckInCount)
  }, [user, shopId])

  if (!shopLat || !shopLng) return null

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

      // 이 샵의 취급 작품을 컬렉션에 자동 획득
      const { newlyCollected } = await collectTagsFromCheckIn(user.id, shopId)
      if (newlyCollected.length > 0) {
        setTimeout(() => setNewTags(newlyCollected), 600)
      }

      if (result.newTierIds && result.newTierIds.length > 0) {
        const supabase = createClient()
        const { data } = await supabase
          .from('badge_tiers')
          .select('name, rarity')
          .eq('id', result.newTierIds[0])
          .maybeSingle()
        if (data) {
          setTimeout(() => {
            setNewBadge({ name: data.name, rarity: data.rarity })
          }, 600)
        }
      }
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

      {newBadge && (
        <div
          onClick={() => setNewBadge(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{
            background: 'var(--surface)', borderRadius: '20px',
            padding: '32px 28px', textAlign: 'center', maxWidth: '300px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>새 배지 획득!</p>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏅</div>
            <p style={{ fontSize: '16px', fontWeight: 900 }}>{newBadge.name}</p>
          </div>
        </div>
      )}

      {newTags && newTags.length > 0 && (
        <div
          onClick={() => setNewTags(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{
            background: 'var(--surface)', borderRadius: '20px',
            padding: '32px 28px', textAlign: 'center', maxWidth: '320px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📚</div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
              새 작품 컬렉션 획득!
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {newTags.map(name => (
                <p key={name} style={{
                  fontSize: '15px', fontWeight: 900, padding: '8px 16px',
                  borderRadius: '10px', background: 'var(--accent-l)', color: 'var(--accent)',
                }}>
                  ✔ {name}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}