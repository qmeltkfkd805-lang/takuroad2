'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { createCheckIn, getMyCheckInStatus, getShopCheckInCount } from '@/services/checkInService'
import { getShopTags } from '@/services/shopProductService'
import { addTagToCollection, getMyCollectedTagIds } from '@/services/tagCollectionService'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/tds/Button'

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
  const [pickerTags, setPickerTags] = useState<any[] | null>(null)
  const [pickedTagIds, setPickedTagIds] = useState<string[]>([])

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

      const [shopTags, myCollected] = await Promise.all([
        getShopTags(shopId),
        getMyCollectedTagIds(user.id),
      ])
      const pickable = shopTags.filter((t: any) => !myCollected.includes(t.id))
      if (pickable.length > 0) {
        setTimeout(() => setPickerTags(pickable), 600)
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

  function togglePickedTag(tagId: string) {
    setPickedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  async function handleSaveCollection() {
    if (!user) return
    for (const tagId of pickedTagIds) {
      await addTagToCollection(user.id, tagId, shopId)
    }
    setPickerTags(null)
    setPickedTagIds([])
  }

  function handleSkipCollection() {
    setPickerTags(null)
    setPickedTagIds([])
  }

  const checkinIcon = (
    <img src="/icons/checkin.png" alt="" width={19} height={19} style={{ filter: 'brightness(0) invert(1)', display: 'block', position: 'relative', top: '1px' }} />
  )

  return (
    <div style={{ marginBottom: '20px', position: 'relative' }}>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleCheckIn}
        disabled={submitting || checkedInToday || locating}
        leftIcon={!checkedInToday && !locating && !submitting ? checkinIcon : undefined}
      >
        {checkedInToday
          ? '오늘 체크인 완료'
          : locating
            ? '위치 확인 중...'
            : submitting
              ? '체크인 중...'
              : '체크인하기'}
      </Button>

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

      {pickerTags && pickerTags.length > 0 && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,.6)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div style={{
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            width: '100%', maxWidth: '680px', padding: '24px 20px',
          }}>
            <div style={{ fontSize: '36px', textAlign: 'center', marginBottom: '8px' }}>📖</div>
            <h3 style={{ fontSize: '16px', fontWeight: 900, textAlign: 'center', marginBottom: '6px' }}>
              이 곳에서 관심 있는 작품이 있나요?
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', marginBottom: '18px' }}>
              선택한 작품은 내 컬렉션에 기록돼요
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', justifyContent: 'center' }}>
              {pickerTags.map(tag => {
                const isPicked = pickedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => togglePickedTag(tag.id)}
                    style={{
                      padding: '9px 16px', borderRadius: '20px', cursor: 'pointer',
                      border: `1.5px solid ${isPicked ? 'var(--accent)' : 'var(--border)'}`,
                      background: isPicked ? 'var(--accent-l)' : 'var(--surface2)',
                      color: isPicked ? 'var(--accent)' : 'var(--text)',
                      fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
                    }}
                  >
                    {isPicked && '✓ '}{tag.name}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSkipCollection}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                건너뛰기
              </button>
              <button
                onClick={handleSaveCollection}
                disabled={pickedTagIds.length === 0}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                  background: pickedTagIds.length > 0 ? accentColor : 'var(--border)',
                  color: '#fff', fontSize: '14px', fontWeight: 700,
                  cursor: pickedTagIds.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                }}
              >
                컬렉션에 추가 ({pickedTagIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



