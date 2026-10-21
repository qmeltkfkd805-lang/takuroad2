'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { createCheckIn, getMyCheckInStatus, getShopCheckInCount, kstToday } from '@/services/checkInService'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/tds/Button'
import AppIcon from '@/components/tds/AppIcon'

interface Props {
  shopId: string
  shopName: string
  shopLat: number | null
  shopLng: number | null
  accentColor: string
}

export default function CheckInButton({ shopId, shopName, shopLat, shopLng }: Props) {
  const { user } = useAuth()
  const [checkedInToday, setCheckedInToday] = useState(false)
  // 내 방문 횟수(하루 1번씩) · 마지막 방문일 — 다른 날 다시 오면 +1
  const [mine, setMine] = useState<{ count: number; lastDate: string | null }>({ count: 0, lastDate: null })
  const [checkInCount, setCheckInCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [newBadge, setNewBadge] = useState<{ name: string; rarity: string } | null>(null)
  // 잘못 눌러 바로 기록되는 걸 막는 확인 창 (2026-10-21)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!confirmOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmOpen])

  useEffect(() => {
    if (user) {
      getMyCheckInStatus(user.id, shopId).then(s => { setCheckedInToday(s.checkedInToday); setMine({ count: s.count, lastDate: s.lastDate }) })
    }
    getShopCheckInCount(shopId).then(setCheckInCount)
  }, [user, shopId])

  async function handleCheckIn() {
    if (!user) return

    setConfirmOpen(false)
    setSubmitting(true)
    // 방문 기록 — GPS 없이, 갔다 와서 눌러도 된다
    const result = await createCheckIn(
      user.id, shopId, shopLat ?? 0, shopLng ?? 0, shopName
    )

    if (result.success) {
      const wasToday = checkedInToday
      setCheckedInToday(true)
      if (!wasToday) {
        setCheckInCount(c => c + 1)
        setMine(m => ({ count: m.count + 1, lastDate: kstToday() }))
      }
      setToast(mine.count > 0 ? `${mine.count + 1}번째 방문을 기록했어요!` : '방문 기록 완료!')
      setTimeout(() => setToast(null), 2500)

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
      setToast(result.error ?? '방문 기록에 실패했어요')
      setTimeout(() => setToast(null), 2500)
    }
    setSubmitting(false)
  }

  const checkinIcon = (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', position: 'relative', top: '1px' }}>
      <path d="M12 21c4-4.5 7-7.8 7-11a7 7 0 1 0-14 0c0 3.2 3 6.5 7 11z" />
      <path d="M9 9.8l2 2 3.5-3.5" />
    </svg>
  )

  return (
    <div style={{ marginBottom: '20px', position: 'relative' }}>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={() => { if (user) setConfirmOpen(true) }}
        disabled={submitting || checkedInToday}
        leftIcon={!checkedInToday && !submitting ? checkinIcon : undefined}
      >
        {/* 문구는 이벤트의 '다녀왔어요'와 맞춘다 (2026-10-18 — 같은 행동인데 샵은 '방문했어요', 이벤트는 '다녀왔어요'였다) */}
        {checkedInToday
          ? '오늘 다녀온 기록을 남겼어요'
          : submitting
            ? '기록 중...'
            : mine.count > 0 ? '또 다녀왔어요' : '다녀왔어요'}
      </Button>

      {/* 내 방문 횟수 — 같은 샵은 하루 1번씩 센다 */}
      {user && mine.count > 0 && (
        <div style={{ marginTop: 8, textAlign: 'center', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
          내 방문 <b style={{ color: 'var(--text)', fontWeight: 800 }}>{mine.count}번</b>
          {mine.lastDate && <> · 마지막 {mine.lastDate.replace(/-/g, '.')}</>}
        </div>
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

      {confirmOpen && (
        <div
          onClick={() => setConfirmOpen(false)}
          role="presentation"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkin-confirm-title"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: '20px',
              padding: '28px 24px 20px', width: '100%', maxWidth: '360px',
              textAlign: 'center', boxShadow: 'var(--sh-lg)',
            }}
          >
            <p id="checkin-confirm-title" style={{ fontSize: '17px', fontWeight: 900, marginBottom: '8px', wordBreak: 'keep-all' }}>
              {shopName}에 다녀오셨나요?
            </p>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '22px', wordBreak: 'keep-all' }}>
              {mine.count > 0
                ? `${mine.count + 1}번째 방문으로 기록돼요.`
                : '방문 기록이 남아요.'}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <Button variant="action" fullWidth onClick={() => setConfirmOpen(false)} style={{ padding: '7px 14px', fontSize: 14, borderRadius: 12 }}>
                  취소
                </Button>
              </div>
              <div style={{ flex: 1 }}>
                <Button variant="primary" fullWidth onClick={handleCheckIn} style={{ padding: '7px 14px', fontSize: 14, borderRadius: 12 }}>
                  다녀왔어요
                </Button>
              </div>
            </div>
          </div>
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
            <AppIcon name="sparkle" size={48} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>새 배지 획득!</p>
            <AppIcon name="medal" size={36} color="var(--accent)" style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '16px', fontWeight: 900 }}>{newBadge.name}</p>
          </div>
        </div>
      )}

    </div>
  )
}



