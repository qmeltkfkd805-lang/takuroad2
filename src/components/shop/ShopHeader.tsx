'use client'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'

interface TodayStatus {
  isOpen: boolean
  label: string
  todayHours?: string | null
}

interface ShopHeaderProps {
  name: string
  isVerified: boolean
  cats: string[]
  ratingAvg: number
  ratingCount: number
  todayStatus: TodayStatus
  color: string
}

export default function ShopHeader({
  name, isVerified, cats, ratingAvg, ratingCount, todayStatus, color,
}: ShopHeaderProps) {
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
      </div>
    </div>
  )
}
