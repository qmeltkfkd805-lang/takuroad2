/* 유튜브 링크 → 본문 속 영상 (2026-10-15)
   글쓰기: 링크 카드 대신 썸네일+재생 버튼 블록(data-yt)을 넣는다 — 편집 중엔 가볍게 그림만.
   글 화면: hydrateYoutube()가 그 블록을 실제 재생기(youtube-nocookie iframe)로 바꾼다.
   본문 HTML 에는 iframe 을 저장하지 않는다(저장·표시 때 iframe 은 걸러진다). 영상 id 만 저장하고 화면에서 만든다. */
import { LINK_CARD_VERSION } from './linkCardHtml'

const ID = /^[A-Za-z0-9_-]{11}$/

/** 유튜브 주소면 영상 id, 아니면 null (watch?v= · youtu.be · shorts · embed · live · m./music.) */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null
  let u: URL
  try { u = new URL(url) } catch { return null }
  const host = u.hostname.replace(/^(www|m|music)\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v')
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/)
      if (m) id = m[2]
    }
  }
  return id && ID.test(id) ? id : null
}

const PLAY = '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none"><span style="width:62px;height:42px;border-radius:12px;background:#ff0033;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.3)"><span style="width:0;height:0;border-left:16px solid #fff;border-top:10px solid transparent;border-bottom:10px solid transparent;margin-left:4px"></span></span></span>'

export const YT_HOLDER_STYLE = 'position:relative;max-width:560px;width:100%;aspect-ratio:16/9;margin:8px 0 12px;border-radius:12px;overflow:hidden;background:#000;'

/** 편집기·저장용 블록 안쪽 (썸네일 + 재생 버튼). removeBtn 은 편집기에서만 */
export function youtubeInnerHtml(id: string, removeBtn = ''): string {
  return removeBtn
    + `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:0;max-width:none" />`
    + PLAY
}

/** 블록 하나 통째로 (data-link-card 도 달아서 카드와 같은 규칙 — 줄 바로 아래·✕ 지우기·사진 목록 제외 — 을 그대로 탄다) */
export function youtubeBlockHtml(id: string, url: string, removeBtn = ''): string {
  return `<div data-link-card="1" data-yt="${id}" data-url="${url.replace(/"/g, '&quot;')}" data-v="${LINK_CARD_VERSION}" contenteditable="false" style="${YT_HOLDER_STYLE}">${youtubeInnerHtml(id, removeBtn)}</div>`
}

/** 글 화면: 영상 블록을 실제 재생기로 */
export function hydrateYoutube(root: HTMLElement | null) {
  if (!root) return
  root.querySelectorAll<HTMLElement>('[data-yt]').forEach(el => {
    const id = el.getAttribute('data-yt') || ''
    if (!ID.test(id) || el.querySelector('iframe')) return
    el.setAttribute('style', YT_HOLDER_STYLE)
    const f = document.createElement('iframe')
    f.src = `https://www.youtube-nocookie.com/embed/${id}?rel=0`
    f.title = 'YouTube 영상'
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
    f.allowFullscreen = true
    f.loading = 'lazy'
    f.referrerPolicy = 'strict-origin-when-cross-origin'
    f.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;border:0')
    el.innerHTML = ''
    el.appendChild(f)
  })
}
