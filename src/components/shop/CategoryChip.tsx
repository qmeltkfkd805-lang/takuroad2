'use client'
// 카테고리 칩 — cat(카테고리명) 하나 받아 CATEGORY_NAME_MAP에서 색을 찾아 렌더.
// 카테고리 색 규칙을 캡슐화. (StockBadge와 별개 역할: 분류 표시, 색이 데이터에서 옴)
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'

export function CategoryChip({ cat, fallbackColor }: { cat: string; fallbackColor?: string }) {
  const ci = CATEGORY_NAME_MAP[cat]
  const c = ci?.color ?? fallbackColor ?? 'var(--accent)'
  return (
    <span style={{
      fontSize: 13, padding: '5px 12px', borderRadius: 999, fontWeight: 700,
      background: ci?.bgColor ?? 'var(--surface2)', color: c,
      border: `1px solid ${c}33`,
    }}>
      {cat}
    </span>
  )
}
