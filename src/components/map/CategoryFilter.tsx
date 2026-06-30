'use client'
import { useRef } from 'react'
import { CATEGORIES } from '@/lib/constants/categories'
import styles from './CategoryFilter.module.css'

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

  // 마우스로 칩 영역 드래그 스크롤
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: false })

  const onMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current
    if (!el) return
    drag.current = { down: true, startX: e.pageX, startScroll: el.scrollLeft, moved: false }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    const el = scrollRef.current
    if (!el || !drag.current.down) return
    const dx = e.pageX - drag.current.startX
    if (Math.abs(dx) > 4) drag.current.moved = true
    el.scrollLeft = drag.current.startScroll - dx
  }
  const endDrag = () => { drag.current.down = false }
  // 드래그였으면 칩 클릭(카테고리 선택) 무시
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) { e.preventDefault(); e.stopPropagation() }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      {/* 칩 가로 스크롤 (마우스 드래그 가능) */}
      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onClickCapture={onClickCapture}
        style={{
          display: 'flex', gap: '6px', overflowX: 'auto',
          padding: '8px 12px', scrollbarWidth: 'none', flex: 1, minWidth: 0,
          cursor: 'grab', userSelect: 'none',
        }}
      >
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
            whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0,
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
                whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              <CatIcon name={cat.icon} color={on ? '#fff' : cat.color} />
              {cat.name}
            </button>
          )
        })}
      </div>

      {/* 오른쪽 필터 버튼 — SVG 아이콘 + 드롭다운 화살표 (좁으면 동그란 아이콘만) */}
      <button className={styles.filterBtn}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          style={{ color: 'var(--muted)' }}>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="7" y1="12" x2="17" y2="12" />
          <line x1="10" y1="18" x2="14" y2="18" />
        </svg>
        <span className={styles.filterLabel}>필터</span>
        <svg className={styles.filterChevron} width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--muted)' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  )
}
