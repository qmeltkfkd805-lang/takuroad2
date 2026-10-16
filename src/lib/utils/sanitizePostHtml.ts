/* 커뮤니티 글 본문 HTML 걸러내기 — 허용 목록 방식 (2026-10-16)
   예전엔 정규식 4줄로 나쁜 것만 지웠는데, 줄바꿈으로 속성을 나누거나(`<img\nonerror=…>`)
   HTML 엔티티로 숨긴 `javascript:` 를 못 걸러서 글에 스크립트를 심을 수 있었다(저장형 XSS).
   이제는 브라우저가 HTML 을 실제로 해석한 결과(DOM)를 한 노드씩 보면서
   - 허용한 태그·속성만 남기고 (그 밖의 태그는 껍데기만 벗기고 글자는 살림)
   - 위험한 태그(script·iframe·form 등)는 안의 내용까지 통째로 지우고
   - 링크·사진 주소는 http(s)·mailto·사이트 안 주소만 남긴다.
   글쓰기 기능이 쓰는 것(링크 카드·유튜브·사진첩·스포일러·체크리스트·접기·멘션·샵/이벤트/루트 카드·표·글꼴)은 그대로 통과한다. */

const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'textarea',
  'select', 'option', 'button', 'link', 'meta', 'base', 'noscript', 'template', 'math', 'foreignobject',
  'animate', 'animatemotion', 'animatetransform', 'set', 'use', 'image', 'audio', 'track', 'portal', 'dialog',
])

const ALLOWED_TAGS = new Set([
  'p', 'div', 'span', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins', 'sub', 'sup', 'small', 'mark',
  'font', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'a', 'img', 'video', 'source',
  'figure', 'figcaption', 'hr', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col', 'caption',
  'details', 'summary',
  // 카드 속 작은 아이콘(svg) — 모양 그리는 요소만
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
])

const COMMON_ATTRS = new Set(['style', 'class', 'title', 'align', 'dir', 'lang', 'role', 'aria-label', 'aria-hidden'])
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading']),
  video: new Set(['src', 'controls', 'playsinline', 'muted', 'loop', 'poster', 'width', 'height', 'preload']),
  source: new Set(['src', 'type']),
  font: new Set(['face', 'color', 'size']),
  ol: new Set(['start', 'type']),
  td: new Set(['colspan', 'rowspan', 'width']),
  th: new Set(['colspan', 'rowspan', 'width', 'scope']),
  col: new Set(['span', 'width']),
  colgroup: new Set(['span']),
  details: new Set(['open']),
  svg: new Set(['viewbox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'xmlns']),
}
const SVG_SHAPE_ATTRS = new Set([
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'width', 'height', 'transform',
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-rule', 'clip-rule',
])
const SVG_SHAPES = new Set(['g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'])
const URL_ATTRS = new Set(['href', 'src', 'poster'])

/** 링크·사진 주소: 사이트 안 주소(/…, #…, 상대 경로)나 http·https·mailto 만 */
function safeUrl(raw: string, forHref: boolean): string | null {
  const v = raw.replace(/[\u0000- \u007f-\u009f]+/g, '')   // 숨겨 넣은 공백·제어 문자 제거 후 판단
  if (!v) return null
  const scheme = v.match(/^([a-z][a-z0-9+.-]*):/i)
  if (!scheme) return v.startsWith('//') ? 'https:' + v : raw.trim()
  const s = scheme[1].toLowerCase()
  if (s === 'http' || s === 'https') return raw.trim()
  if (forHref && s === 'mailto') return raw.trim()
  return null
}

/** style: 위험한 것(스크립트·외부 불러오기·화면 덮기)이 하나라도 있으면 그 style 통째로 버림 */
function safeStyle(v: string): string | null {
  if (/expression\s*\(|javascript:|vbscript:|-moz-binding|behavior\s*:|@import|url\s*\(|\\/i.test(v)) return null
  return v.replace(/position\s*:\s*(fixed|sticky)\s*;?/gi, '')   // 화면 전체를 덮는 배치는 빼기
}

function cleanNode(node: Node, doc: Document) {
  const kids = Array.from(node.childNodes)
  for (const child of kids) {
    if (child.nodeType === 3) continue                      // 글자
    if (child.nodeType !== 1) { child.parentNode?.removeChild(child); continue }   // 주석 등
    const el = child as Element
    const tag = el.tagName.toLowerCase()
    if (DROP_WITH_CONTENT.has(tag)) { el.remove(); continue }
    if (!ALLOWED_TAGS.has(tag)) {                            // 모르는 태그 → 껍데기만 벗기고 안쪽은 살려서 다시 검사
      const frag = doc.createDocumentFragment()
      while (el.firstChild) frag.appendChild(el.firstChild)
      cleanNode(frag, doc)
      el.replaceWith(frag)
      continue
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const ok = COMMON_ATTRS.has(name)
        || /^data-[a-z0-9_-]+$/.test(name)
        || TAG_ATTRS[tag]?.has(name)
        || (SVG_SHAPES.has(tag) && SVG_SHAPE_ATTRS.has(name))
      if (!ok) { el.removeAttribute(attr.name); continue }
      if (URL_ATTRS.has(name)) {
        const u = safeUrl(attr.value, name === 'href')
        if (u === null) el.removeAttribute(attr.name); else if (u !== attr.value) el.setAttribute(attr.name, u)
      } else if (name === 'style') {
        const st = safeStyle(attr.value)
        if (st === null) el.removeAttribute('style'); else if (st !== attr.value) el.setAttribute('style', st)
      } else if (name === 'target') {
        el.setAttribute('target', '_blank')
      }
    }
    if (tag === 'a' && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer')
    cleanNode(el, doc)
  }
}

/** 본문 HTML → 안전한 HTML. 브라우저가 아니면(서버 렌더) 태그를 모두 지운 글자만 돌려준다 */
export function sanitizePostHtml(html: string | null | undefined): string {
  if (!html) return ''
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/[<>]/g, '')
  }
  const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, 'text/html')
  cleanNode(doc.body, doc)
  return doc.body.innerHTML
}
