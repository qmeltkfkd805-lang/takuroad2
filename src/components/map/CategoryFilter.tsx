'use client'
import { CATEGORIES } from '@/lib/constants/categories'

interface CategoryFilterProps {
  selected: string
  onChange: (cat: string) => void
}

// 라인아트 아이콘을 mask로 색칠 (선택=흰색, 비선택=카테고리색)
function CatIcon({ name, color }: { name: string; color: string }) {
  return (
    <span
      style={{
        width: 16, height: 16, display: 'inline-block', flexShrink: 0,
        backgroundColor: color,
        WebkitMaskImage: `url(/icons/${name}.png)`,
        maskImage: `url(/icons/${name}.png)`,
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain', maskSize: 'contain',
        WebkitMaskPosition: 'center', maskPosition: 'center',
      }}
    />
  )
}

export default function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  const isAll = selected === '전체'

  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      {/* 칩 가로 스크롤 */}
      <div style={{
        display: 'flex', gap: '6px', overflowX: 'auto',
        padding: '8px 12px', scrollbarWidth: 'none', flex: 1, minWidth: 0,
      }}>
        {/* 전체 */}
        <button
          onClick={() => onChange('전체')}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 13px', borderRadius: '20px',
            border: `1.5px solid ${isAll ? 'var(--accent)' : 'var(--border)'}`,
            background: isAll ? 'var(--accent)' : 'var(--surface)',
            color: isAll ? '#fff' : 'var(--text)',
            fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}
        >
          <CatIcon name="shop" color={isAll ? '#fff' : 'var(--muted)'} />
          전체
        </button>

        {CATEGORIES.map(cat => {
          const on = selected === cat.name
          return (
            <button
              key={cat.slug}
              onClick={() => onChange(cat.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 13px', borderRadius: '20px',
                border: `1.5px solid ${on ? cat.color : 'var(--border)'}`,
                background: on ? cat.color : 'var(--surface)',
                color: on ? '#fff' : 'var(--text)',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}
            >
              <CatIcon name={cat.icon} color={on ? '#fff' : cat.color} />
              {cat.name}
            </button>
          )
        })}
      </div>

      {/* 오른쪽 필터 버튼 (지금은 모양만) */}
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
          margin: '0 12px 0 4px', padding: '6px 13px', borderRadius: '20px',
          border: '1.5px solid var(--border)', background: 'var(--surface)',
          color: 'var(--text)', fontSize: '12px', fontWeight: 700,
          cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
        }}
      >
        <CatIcon name="service" color="var(--muted)" />
        필터
      </button>
    </div>
  )
}
