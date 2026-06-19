'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getSavedShops } from '@/services/shopService'
import { createRoute } from '@/services/routeService'
import { calcDistance, formatDistance } from '@/hooks/useCurrentLocation'
import { Shop } from '@/types/shop'
import { ROUTES } from '@/lib/constants/routes'

function estimateWalkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters / 1000) * 15))
}

export default function RouteBuilder() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [savedShops, setSavedShops] = useState<Shop[]>([])
  const [selected, setSelected] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<'select' | 'order'>('select')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push(ROUTES.login)
      return
    }
    getSavedShops(user.id).then(data => {
      setSavedShops(data.filter(s => s.lat && s.lng))
      setLoading(false)
    })
  }, [user, authLoading, router])

  function toggleSelect(shop: Shop) {
    setSelected(prev =>
      prev.some(s => s.id === shop.id)
        ? prev.filter(s => s.id !== shop.id)
        : [...prev, shop]
    )
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    setSelected(prev => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  function moveDown(idx: number) {
    if (idx === selected.length - 1) return
    setSelected(prev => {
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  function removeSelected(shopId: string) {
    setSelected(prev => prev.filter(s => s.id !== shopId))
  }

  // 총 거리/시간 미리 계산
  const segments = selected.map((shop, i) => {
    if (i === 0) return { distance: 0, duration: 0 }
    const prev = selected[i - 1]
    const distance = calcDistance(prev.lat!, prev.lng!, shop.lat!, shop.lng!)
    return { distance, duration: estimateWalkMinutes(distance) }
  })
  const totalDistance = segments.reduce((sum, s) => sum + s.distance, 0)
  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0)

  async function handleSubmit() {
    if (!user || !title.trim() || selected.length < 2) return

    setSubmitting(true)
    const result = await createRoute(
      user.id,
      title.trim(),
      description.trim(),
      selected.map(s => ({ shopId: s.id, lat: s.lat!, lng: s.lng! }))
    )

    if (result) {
      router.push(ROUTES.profile)
    } else {
      alert('루트 생성에 실패했어요')
    }
    setSubmitting(false)
  }

  if (loading || authLoading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)', paddingBottom: '100px' }}>

      {/* 헤더 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <button
          onClick={() => step === 'order' ? setStep('select') : router.back()}
          style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
        >←</button>
        <h1 style={{ fontSize: '16px', fontWeight: 900 }}>
          {step === 'select' ? '샵 선택하기' : '순서 정하기'}
        </h1>
      </div>

      {/* Step 1: 샵 선택 */}
      {step === 'select' && (
        <div>
          {savedShops.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔖</div>
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                먼저 지도에서 샵을 찜해주세요. 위치 정보가 있는 샵만 루트에 추가할 수 있어요.
              </p>
            </div>
          ) : (
            <>
              <p style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--muted)' }}>
                루트에 포함할 샵을 2개 이상 선택해주세요 ({selected.length}개 선택됨)
              </p>
              {savedShops.map(shop => {
                const isSelected = selected.some(s => s.id === shop.id)
                return (
                  <div
                    key={shop.id}
                    onClick={() => toggleSelect(shop)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--surface2)' : 'var(--surface)',
                    }}
                  >
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: '#fff', fontSize: '12px',
                    }}>
                      {isSelected && '✓'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{shop.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{shop.addr}</div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* 다음 버튼 */}
          {selected.length >= 2 && (
            <div style={{
              position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: '100%', maxWidth: '680px', padding: '16px',
              background: 'var(--surface)', borderTop: '1px solid var(--border)',
            }}>
              <button
                onClick={() => setStep('order')}
                style={{
                  width: '100%', padding: '13px', borderRadius: '12px',
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  fontWeight: 900, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                다음 ({selected.length}개 선택됨)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: 순서 정하기 + 정보 입력 */}
      {step === 'order' && (
        <div style={{ padding: '16px' }}>

          {/* 루트 정보 */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="루트 이름 (예: 홍대 덕질 코스)"
            style={{
              width: '100%', padding: '11px 12px', marginBottom: '8px',
              border: '1.5px solid var(--border)', borderRadius: '10px',
              fontSize: '14px', fontFamily: 'inherit',
              background: 'var(--surface2)', color: 'var(--text)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="루트 소개 (선택)"
            rows={2}
            style={{
              width: '100%', padding: '11px 12px', marginBottom: '16px',
              border: '1.5px solid var(--border)', borderRadius: '10px',
              fontSize: '14px', fontFamily: 'inherit', lineHeight: 1.6,
              background: 'var(--surface2)', color: 'var(--text)',
              outline: 'none', boxSizing: 'border-box', resize: 'vertical',
            }}
          />

          {/* 총 거리/시간 */}
          <div style={{
            display: 'flex', gap: '16px', padding: '12px 16px',
            background: 'var(--surface2)', borderRadius: '10px', marginBottom: '16px',
          }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>총 거리</div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--accent)' }}>
                {formatDistance(totalDistance)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>예상 시간</div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--accent)' }}>
                도보 {totalDuration}분
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>경유지</div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--accent)' }}>
                {selected.length}곳
              </div>
            </div>
          </div>

          {/* 순서 목록 */}
          {selected.map((shop, i) => (
            <div key={shop.id}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', background: 'var(--surface2)',
                borderRadius: '10px', marginBottom: i < selected.length - 1 ? '4px' : '0',
              }}>
                <div style={{
                  width: '26px', height: '26px', borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 900, flexShrink: 0,
                }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>{shop.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{shop.addr}</div>
                </div>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    style={{
                      background: 'none', border: 'none', fontSize: '16px',
                      cursor: i === 0 ? 'not-allowed' : 'pointer',
                      color: i === 0 ? 'var(--border)' : 'var(--muted)', padding: '4px',
                    }}
                  >↑</button>
                  <button
                    onClick={() => moveDown(i)}
                    disabled={i === selected.length - 1}
                    style={{
                      background: 'none', border: 'none', fontSize: '16px',
                      cursor: i === selected.length - 1 ? 'not-allowed' : 'pointer',
                      color: i === selected.length - 1 ? 'var(--border)' : 'var(--muted)', padding: '4px',
                    }}
                  >↓</button>
                  <button
                    onClick={() => removeSelected(shop.id)}
                    style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', color: 'var(--red)', padding: '4px' }}
                  >✕</button>
                </div>
              </div>
              {/* 다음 샵까지 도보 시간 */}
              {i < selected.length - 1 && (
                <div style={{
                  textAlign: 'center', fontSize: '11px', color: 'var(--muted)',
                  padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                }}>
                  <span>↓</span>
                  <span>도보 {segments[i + 1].duration}분 ({formatDistance(segments[i + 1].distance)})</span>
                </div>
              )}
            </div>
          ))}

          {/* 저장 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || selected.length < 2}
            style={{
              width: '100%', padding: '13px', borderRadius: '12px', marginTop: '24px',
              background: submitting || !title.trim() ? 'var(--border)' : 'var(--accent)',
              color: '#fff', border: 'none',
              fontWeight: 900, fontSize: '15px',
              cursor: submitting || !title.trim() ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {submitting ? '저장 중...' : '루트 저장하기'}
          </button>
        </div>
      )}
    </div>
  )
}