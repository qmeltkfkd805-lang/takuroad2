/* 글 본문에서 카드로 만들 첫 링크 찾기 (링크 미리보기, 2026-10-14)
   글쓰기 화면의 본문 글자(innerText)에서 http(s) 주소를 찾는다.
   문장 끝의 마침표·괄호·따옴표는 주소에서 뺀다. */
const URL_RE = /https?:\/\/[^\s<>"'`]+/i

export function firstUrl(text: string | null | undefined): string | null {
  if (!text) return null
  const m = text.match(URL_RE)
  if (!m) return null
  let u = m[0].replace(/[.,!?;:)\]}>」』）。、]+$/u, '')
  // 괄호가 짝이 맞게 들어간 주소(위키 등)는 닫는 괄호를 살린다
  if ((u.match(/\(/g) ?? []).length > (u.match(/\)/g) ?? []).length && m[0].length > u.length && m[0][u.length] === ')') u += ')'
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch { return null }
}

export function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' }
}
