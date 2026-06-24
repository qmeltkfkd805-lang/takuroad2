'use client'

import { CATEGORIES } from '@/lib/constants/categories'

interface CategoryFilterProps {
  selected: string
  onChange: (cat: string) => void
}

export default function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div style={{
      display: 'flex',
      gap: '6px',
      overflowX: 'auto',
      padding: '8px 12px',
      scrollbarWidth: 'none',
    }}>
      {/* 전체 버튼 */}
      <button
        onClick={() => onChange('전체')}
        style={{
          padding: '6px 14px',
          borderRadius: '20px',
          border: `1.5px solid ${selected === '전체' ? 'var(--accent)' : 'var(--border)'}`,
          background: selected === '전체' ? 'var(--accent)' : 'var(--surface)',
          color: selected === '전체' ? '#fff' : 'var(--text)',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
        }}
      >
        🗾 전체
      </button>

      {CATEGORIES.map(cat => (
        <button
          key={cat.slug}
          onClick={() => onChange(cat.name)}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            border: `1.5px solid ${selected === cat.name ? cat.color : 'var(--border)'}`,
            background: selected === cat.name ? cat.color : 'var(--surface)',
            color: selected === cat.name ? '#fff' : 'var(--text)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontFamily: 'inherit',
          }}
        >
          {cat.icon} {cat.name}
        </button>
      ))}
    </div>
  )
}