'use client'

import Link from 'next/link'
import AppIcon from '@/components/tds/AppIcon'

const PALETTE = [
  { bg: '#EEEDFE', fg: '#3C3489' }, { bg: '#E1F5EE', fg: '#0F6E56' },
  { bg: '#FAECE7', fg: '#993C1D' }, { bg: '#E6F1FB', fg: '#185FA5' },
  { bg: '#FBEAF0', fg: '#993556' }, { bg: '#FAEEDA', fg: '#854F0B' },
  { bg: '#EAF3DE', fg: '#3B6D11' }, { bg: '#FCEBEB', fg: '#A32D2D' },
]
function workColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

interface HeroSlotProps {
  reason: string
  work: { id: string; name: string; slug: string }
  goodsCount: number
  shopCount: number
}

export default function HeroSlot({ reason, work, goodsCount, shopCount }: HeroSlotProps) {
  const color = workColor(work.id)

  return (
    <Link href={`/work/${work.slug}`} style={{ textDecoration: 'none', display: 'block', padding: '16px' }}>
      <div style={{
        borderRadius: 'var(--r)', overflow: 'hidden',
        border: '1px solid var(--border)', background: 'var(--surface)',
        boxShadow: 'var(--sh-md)',
      }}>
        {/* 이유(reason) — 가변. 슬롯은 그냥 띄우기만 */}
        <div style={{
          padding: '10px 16px', fontSize: '13px', fontWeight: 700,
          color: 'var(--accent)', borderBottom: '1px solid var(--border)',
        }}>
          {reason}
        </div>

        {/* 관계의 작품 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
          <div style={{
            flexShrink: 0, width: '72px', height: '72px',
            borderRadius: 'var(--r-sm)', background: color.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 700, color: color.fg,
          }}>
            {work.name.slice(0, 2)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text)', marginBottom: '6px' }}>
              {work.name}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              <AppIcon name="bag" size={13} style={{ marginRight: 4 }} />판매 중 {goodsCount} · <AppIcon name="pin" size={13} style={{ margin: '0 4px 0 2px' }} />{shopCount}곳
            </div>
          </div>
          <span style={{ fontSize: '20px', color: 'var(--muted)' }}>→</span>
        </div>
      </div>
    </Link>
  )
}