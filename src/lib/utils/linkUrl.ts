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

/* 글쓰기 편집기 안에서 첫 링크 찾기 — 글자로 쓴 주소 + 붙여넣기로 들어온 링크(<a href>) 둘 다.
   브라우저 주소를 복사해 붙이면 주소 대신 '페이지 제목'이 링크로 들어오는 경우가 많아서 href 도 본다.
   우리가 올린 첨부파일 링크(📎, 저장소 주소)는 카드로 만들지 않는다. */
export function firstLinkIn(root: HTMLElement | null): string | null {
  if (!root || typeof document === 'undefined') return null
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement
      if (el.tagName !== 'A') continue
      if (el.getAttribute('contenteditable') === 'false' || (el.textContent ?? '').includes('📎')) continue
      const u = firstUrl(el.getAttribute('href'))
      if (u && !/\/storage\/v1\/object\//.test(u)) return u
    } else {
      const u = firstUrl(n.textContent)
      if (u && !/\/storage\/v1\/object\//.test(u)) return u
    }
  }
  return null
}

/* 글 화면에서 카드 링크가 들어 있는 줄(블록) 찾기 — 카드를 그 줄 바로 아래에 붙이려고.
   <a href> 가 같은 주소면 그것, 없으면 글자로 쓴 주소. 본문 바로 아래 단계의 블록(p·div 등)을 돌려준다. */
export function findLinkBlock(root: HTMLElement, url: string): HTMLElement | null {
  let hit: Node | null = null
  for (const a of Array.from(root.querySelectorAll('a[href]'))) {
    if (firstUrl(a.getAttribute('href')) === url) { hit = a; break }
  }
  if (!hit) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (firstUrl(n.textContent) === url) { hit = n; break }
    }
  }
  if (!hit) return null
  let el: HTMLElement | null = hit.nodeType === Node.ELEMENT_NODE ? (hit as HTMLElement) : hit.parentElement
  if (!el || el === root || !root.contains(el)) return null   // 본문에 줄 구분 없이 바로 들어간 글 → 맨 아래로
  while (el.parentElement && el.parentElement !== root) el = el.parentElement
  return el
}

/* 편집기 안의 링크들과 각 링크가 들어 있는 줄(편집기 바로 아래 단계 블록). 순서대로, 주소 중복 없이.
   이미 붙은 카드 안의 링크, 첨부파일(📎·저장소 주소)은 뺀다. */
export function linkBlocksIn(root: HTMLElement | null): { url: string; block: HTMLElement | null }[] {
  if (!root || typeof document === 'undefined') return []
  const out: { url: string; block: HTMLElement | null }[] = []
  const seen = new Set<string>()
  const topBlock = (n: Node): HTMLElement | null => {
    let el: HTMLElement | null = n.nodeType === Node.ELEMENT_NODE ? (n as HTMLElement) : n.parentElement
    if (!el || el === root || !root.contains(el)) return null
    while (el.parentElement && el.parentElement !== root) el = el.parentElement
    return el
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const host = n.nodeType === Node.ELEMENT_NODE ? (n as HTMLElement) : n.parentElement
    if (host?.closest('[data-link-card]')) continue
    let u: string | null = null
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement
      if (el.tagName !== 'A' || el.getAttribute('contenteditable') === 'false' || (el.textContent ?? '').includes('📎')) continue
      u = firstUrl(el.getAttribute('href'))
    } else {
      if (n.parentElement?.closest('a')) continue   // 링크 글자는 위에서 href 로 처리
      u = firstUrl(n.textContent)
    }
    if (!u || /\/storage\/v1\/object\//.test(u) || seen.has(u)) continue
    seen.add(u)
    out.push({ url: u, block: topBlock(n) })
  }
  return out
}
