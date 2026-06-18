/**
 * 한글/영문 샵 이름 → URL slug 변환
 * 예: "애니메이트 홍대" → "animate-hongdae"
 *
 * 주의: 한글 → 로마자 변환은 클라이언트에서 직접 입력받거나
 * 등록 시 영문명을 별도 입력받는 방식을 권장.
 * 여기서는 기본 정제 로직만 제공.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣-]/g, '')  // 특수문자 제거
    .replace(/\s+/g, '-')            // 공백 → 하이픈
    .replace(/-+/g, '-')             // 연속 하이픈 정리
    .replace(/^-|-$/g, '')           // 앞뒤 하이픈 제거
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
