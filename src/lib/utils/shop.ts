import * as hangulRomanization from 'hangul-romanization'

/**
 * 한글/영문 샵 이름 → URL slug 변환
 * 예: "애니메이트 홍대" → "aenimeiteu-hongdae"
 * 한글이 포함되어 있으면 자동으로 로마자 변환
 */
export function generateSlug(text: string): string {
 const romanized = /[가-힣]/.test(text) ? hangulRomanization.convert(text) : text

  const slug = romanized
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!slug) {
    return `shop-${Math.random().toString(36).slice(2, 8)}`
  }
  return slug
}

/**
 * 중복 slug 처리
 * animate-hongdae → animate-hongdae-2 → animate-hongdae-3
 */
export function generateUniqueSlug(base: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(base)) return base

  let count = 2
  while (existingSlugs.includes(`${base}-${count}`)) {
    count++
  }
  return `${base}-${count}`
}

/**
 * 별점 문자열 변환
 * 4.5 → "★★★★☆"
 */
export function starsToString(rating: number): string {
  const rounded = Math.round(rating)
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded)
}

/**
 * 숫자 축약
 * 1234 → "1.2k"
 */
export function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return String(count)
}