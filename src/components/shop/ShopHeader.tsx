'use client'
import { useState } from 'react'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'

interface TodayStatus {
  isOpen: boolean
  label: string
  todayHours?: string | null
}

interface HourRow {
  day: string
  label: string
  hours: string
  isOpen: boolean
}

interface ShopHeaderProps {
  name: string
  isVerified: boolean
  cats: string[]
  ratingAvg: number
  ratingCount: number
  todayStatus: TodayStatus
  hoursFormatted: HourRow[]
  color: string
}

export default function ShopHeader({
  name, isVerified, cats, ratingAvg, ratingCount, todayStatus, hoursFormatted, color,
}: ShopHeaderProps) {
  const [hoursOpen, setHoursOpen] = useState(false)

  // 연중무휴 판단: 7일 모두 영업 + 시간 동일
  const allOpen = hoursFormatted.length === 7 && hoursFormatted.every(h => h.isOpen)
  const sameHours = allOpen && hoursFormatted.every(h => h.hours === hoursFormatted[0].hours)
  const isAlwaysOpen = sameHours
  const hasHours = hoursFormatted.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.25, letterSpacing: '-.02em', margin: 0 }}>
          {name}
        </h1>
        {isVerified && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 12, color: 'var(--cyan)', fontWeight: 800,
            background: '#E8F4FF', borderRadius: 8, padding: '3px 8px',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
            인증
          </span>
        )}
      </div>

      {ratingCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#F5B100" stroke="#F5B100" strokeWidth="1" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span style={{ fontWeight: 900, fontSize: 16 }}>{ratingAvg.toFixed(1)}</span>
          <span style={{ color: 'var(--muted)', fontSize: 14 }}>({ratingCount})</span>
        </div>
      )}

      {cats.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {cats.map((cat) => {
            const ci = CATEGORY_NAME_MAP[cat]
            const c = ci?.color ?? color
            return (
              <span key={cat} style={{
                fontSize: 13, padding: '5px 12px', borderRadius: 999,
                background: ci?.bgColor ?? 'var(--surface2)', color: c,
                border: `1px solid ${c}33`, fontWeight: 700,
              }}>{cat}</span>
            )
          })}
        </div>
      )}

      {/* 영업 상태 + 시간 + 아코디언 (카드) */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <button
          onClick={() => hasHours && setHoursOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            background: hoursOpen ? 'var(--surface2)' : 'var(--surface)', border: 'none',
            padding: '13px 14px', margin: 0,
            cursor: hasHours ? 'pointer' : 'default', fontFamily: 'inherit', textAlign: 'left',
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 13, fontWeight: 800, padding: '5px 11px', borderRadius: 999,
            background: todayStatus.isOpen ? '#E1F7F2' : '#FFEAE8',
            color: todayStatus.isOpen ? '#0E7A63' : '#C0392B',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: todayStatus.isOpen ? '#1FAE8C' : '#E05A4D',
            }} />
            {todayStatus.label}
          </span>
          {todayStatus.todayHours && (
            <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
              {todayStatus.todayHours}
            </span>
          )}
          {isAlwaysOpen && (
            <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>· 연중무휴</span>
          )}
          {hasHours && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              style={{ marginLeft: 'auto', flexShrink: 0, transform: hoursOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </button>

        {/* 요일별 시간표 (펼침) */}
        {hoursOpen && hasHours && (
          <div style={{
            padding: '12px 14px', borderTop: '1px solid var(--border)',
            background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            {hoursFormatted.map(h => (
              <div key={h.day} style={{ display: 'flex', gap: 14, fontSize: 13 }}>
                <span style={{ width: 22, color: 'var(--muted)', fontWeight: 700 }}>{h.label}</span>
                <span style={{ color: h.isOpen ? 'var(--text)' : 'var(--muted)', fontWeight: h.isOpen ? 600 : 400 }}>{h.hours}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


