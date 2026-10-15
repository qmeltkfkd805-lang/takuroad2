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
export function linkBlocksIn(root: HTMLElement | null): { url: string; block: HTMLElement | null; node: Node }[] {
  if (!root || typeof document === 'undefined') return []
  const out: { url: string; block: HTMLElement | null; node: Node }[] = []
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
    out.push({ url: u, block: topBlock(n), node: n })
  }
  return out
}

/* 링크가 줄 구분(<p>·<div>) 없이 편집기에 바로 들어가 있을 때 — 첫 줄을 그냥 치거나, 빈 편집기에 링크를 붙여넣은 경우.
   그 링크가 있는 '한 줄'(앞뒤로 <br>·블록이 나올 때까지)을 <p> 로 감싸서 돌려준다. 카드를 그 줄 바로 아래에 붙이려고. */
const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'FIGURE', 'HR', 'SECTION'])
export function wrapLineOf(root: HTMLElement, node: Node): HTMLElement | null {
  let top: Node | null = node
  while (top && top.parentNode !== root) top = top.parentNode
  if (!top) return null
  if (top.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((top as HTMLElement).tagName)) return top as HTMLElement
  const isBreak = (n: Node | null) => !!n && n.nodeType === Node.ELEMENT_NODE && ((n as HTMLElement).tagName === 'BR' || BLOCK_TAGS.has((n as HTMLElement).tagName))
  let first: Node = top
  while (first.previousSibling && !isBreak(first.previousSibling)) first = first.previousSibling
  let last: Node = top
  while (last.nextSibling && !isBreak(last.nextSibling)) last = last.nextSibling
  // 줄 끝의 <br> 은 줄과 함께 감싼다(빈 줄이 생기지 않게)
  const tail = last.nextSibling
  const takeBr = !!tail && tail.nodeType === Node.ELEMENT_NODE && (tail as HTMLElement).tagName === 'BR'
  const p = document.createElement('p')
  root.insertBefore(p, first)
  let cur: Node | null = first
  while (cur) {
    const next: Node | null = cur.nextSibling
    p.appendChild(cur)
    if (cur === last) break
    cur = next
  }
  if (takeBr && p.nextSibling && (p.nextSibling as HTMLElement).tagName === 'BR') p.nextSibling.remove()
  return p
}

/* 링크가 들어 있는 '그 한 줄'을 찾는다 — 카드를 바로 그 아래에 넣으려고 (2026-10-15 다시 고침)
   예전엔 편집기 바로 아래 단계 블록을 썼는데, 붙여넣은 글이 큰 <div>·<span> 하나에 통째로 싸여 있으면
   그 덩어리 전체 = '한 줄'로 잡혀서 카드가 글 맨 아래로 갔다.
   이제는 링크에서 위로 올라가며, 형제 중에 줄바꿈(<br>)·블록이 있는 첫 단계에서 그 줄만 잘라 감싼다.
   링크 혼자 들어 있는 작은 블록(<p>·<div>·<li> 등)을 만나면 그 블록이 곧 그 줄이다. */
const isLineBreak = (n: Node | null) => !!n && n.nodeType === Node.ELEMENT_NODE && ((n as HTMLElement).tagName === 'BR' || BLOCK_TAGS.has((n as HTMLElement).tagName))
const hasBreakSibling = (n: Node) => {
  for (let x = n.previousSibling; x; x = x.previousSibling) if (isLineBreak(x)) return true
  for (let x = n.nextSibling; x; x = x.nextSibling) if (isLineBreak(x)) return true
  return false
}
function wrapRun(parent: Node, cur: Node): HTMLElement {
  let first: Node = cur
  while (first.previousSibling && !isLineBreak(first.previousSibling)) first = first.previousSibling
  let last: Node = cur
  while (last.nextSibling && !isLineBreak(last.nextSibling)) last = last.nextSibling
  const tail = last.nextSibling
  const wrap = document.createElement('div')
  parent.insertBefore(wrap, first)
  let x: Node | null = first
  while (x) { const next: Node | null = x.nextSibling; wrap.appendChild(x); if (x === last) break; x = next }
  if (tail && tail.nodeType === Node.ELEMENT_NODE && (tail as HTMLElement).tagName === 'BR') tail.parentNode?.removeChild(tail)
  return wrap
}
export function lineOf(root: HTMLElement, node: Node): HTMLElement | null {
  if (!root.contains(node) || node === root) return null
  let cur: Node = node
  while (cur.parentNode && cur.parentNode !== root) {
    const parent = cur.parentNode as HTMLElement
    if (hasBreakSibling(cur)) return wrapRun(parent, cur)            // 이 단계에서 줄이 나뉜다 → 그 줄만 감싸기
    if (BLOCK_TAGS.has(parent.tagName)) return parent                // 링크 줄 하나만 든 블록
    cur = parent
  }
  if (cur.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((cur as HTMLElement).tagName)) return cur as HTMLElement
  return wrapRun(root, cur)
}
