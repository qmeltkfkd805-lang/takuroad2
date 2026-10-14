/* 링크 미리보기 카드 HTML (2026-10-14)
   글쓰기 편집기 안, 링크가 있는 줄 바로 아래에 이 카드를 끼워 넣고 → 글 내용(HTML)에 그대로 저장한다.
   그래서 글 화면에서도 쓴 그대로(링크 바로 아래) 보인다. 네이버 블로그 링크 카드와 같은 방식.
   · 바깥: <div data-link-card data-url contenteditable="false"> — 편집기에서 한 덩어리로 다뤄진다
   · 편집기에서만 ✕ 버튼(data-lp-remove) — 저장할 때 뺀다
   · 스타일은 전부 인라인(글 화면에서도 같은 모양) */

export type LinkPreview = { url: string; ok: boolean; title: string | null; description: string | null; image: string | null; siteName: string | null }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }

// 크기 — 너비 300px (위 이미지 + 아래 글, 2026-10-14 사용자가 표시한 크기)
/* 카드 모양 버전 — 모양을 바꾸면 올린다. 이미 지금 모양인 카드는 다시 그리지 않는다(깜빡임·요청 줄이기) */
export const LINK_CARD_VERSION = '3'
export const LINK_CARD_HOLDER_STYLE = 'position:relative;max-width:300px;margin:6px 0 10px;'

export const REMOVE_BTN = '<button type="button" data-lp-remove="1" aria-label="링크 카드 빼기" style="position:absolute;top:4px;right:4px;z-index:2;width:18px;height:18px;border-radius:9999px;border:none;background:rgba(0,0,0,.5);color:#fff;cursor:pointer;font-size:9px;line-height:18px;padding:0;text-align:center">✕</button>'

export function linkCardLoadingHtml(url: string): string {
  return `${REMOVE_BTN}<div style="border:1px solid var(--border);border-radius:10px;padding:6px 10px;font-size:11px;color:var(--muted);background:var(--surface)">링크 미리보기를 불러오는 중… · ${esc(host(url))}</div>`
}

export function linkCardHtml(url: string, p: LinkPreview, editable: boolean): string {
  const h = host(url)
  const one = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
  // 위: 대표 이미지(1.91:1) / 아래: 제목 · 설명 2줄 · 도메인 — 처음 카드 모양 그대로, 너비만 300px
  const img = p.image
    ? `<div style="width:100%;aspect-ratio:1.91/1;overflow:hidden;background:var(--surface2)"><img src="${esc(p.image)}" alt="" referrerpolicy="no-referrer" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:0;max-width:none;margin:0" /></div>`
    : ''
  const title = p.title ? `<div style="font-size:13px;font-weight:800;color:var(--text);line-height:1.35;${one}">${esc(p.title)}</div>` : ''
  const desc = p.description ? `<div style="margin-top:2px;font-size:11.5px;color:var(--muted);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.description)}</div>` : ''
  const site = p.siteName && p.siteName !== h ? `${esc(p.siteName)} · ${esc(h)}` : esc(h)
  return `${editable ? REMOVE_BTN : ''}<a data-lp="1" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow ugc" style="display:block;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface);text-decoration:none;color:inherit">${img}<div style="padding:9px 12px 10px;${img ? 'border-top:1px solid var(--border);' : ''}">${title}${desc}<div style="margin-top:4px;font-size:11px;font-weight:600;color:var(--green,#14B8A0);${one}">${site}</div></div></a>`
}

/** 저장 직전: 편집기용 ✕ 버튼과 아직 불러오는 중인 카드를 뺀 HTML */
export function cleanLinkCards(root: HTMLElement): HTMLElement {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-lp-remove]').forEach(n => n.remove())
  clone.querySelectorAll('[data-link-card][data-loading]').forEach(n => n.remove())
  return clone
}
