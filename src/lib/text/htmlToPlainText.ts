/* 글 본문(HTML) → 표시용 순수 텍스트.
   커뮤니티 글 본문은 편집기가 HTML(<p>, <img>, <br> …)로 저장한다.
   전시관처럼 본문을 "글자"로만 보여주는 곳에서 태그가 그대로 드러나지 않게 쓴다.
   - 이미지·스크립트·스타일은 버린다(사진은 따로 캐러셀로 보여준다)
   - 줄바꿈 태그는 줄바꿈으로 바꾼다
   - 결과는 React 텍스트로 렌더한다(innerHTML 금지) → XSS 여지 없음 */
export function htmlToPlainText(html: string | null | undefined): string | null {
  if (html == null) return null
  let s = String(html)
  if (!/<[a-z!/]/i.test(s)) return s.trim() || null   // 태그가 없으면 원문 그대로

  s = s
    .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/<[^>]*$/, '')          // 잘린 요약 끝에 남은 닫히지 않은 태그

  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&amp;/gi, '&')

  s = s
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return s || null
}
