/* 글 화면 본문 꾸밈 (2026-10-15) — 저장된 HTML 엔 표시용 data-* 표시만 있고, 움직임은 화면에서 붙인다.
   - 부분 스포일러 [data-spoiler]: 가려져 있다가 누르면 보인다
   - 슬라이드 사진첩 [data-slides]: 옆으로 넘기기 + 화살표 + "1 / 5"
   글 화면(PostUI)과 올리기 전 미리보기가 같이 쓴다. */

/** 본문 모양 — 글 화면·미리보기용(.taku-post-body) */
export const POST_FX_CSS = [
  // 부분 스포일러
  '.taku-post-body span[data-spoiler]:not(.sp-open){background:#3b3b3b;color:transparent !important;border-radius:4px;cursor:pointer;user-select:none;text-decoration:none !important;transition:background .15s}',
  '.taku-post-body span[data-spoiler]:not(.sp-open) *{visibility:hidden}',
  '.taku-post-body span[data-spoiler]:not(.sp-open):hover{background:#555}',
  '.taku-post-body span[data-spoiler].sp-open{background:rgba(232,0,111,.08);border-radius:4px}',
  '.taku-post-body img[data-spoiler]:not(.sp-open){filter:blur(24px) brightness(.85);cursor:pointer;transition:filter .2s}',
  // 체크리스트
  '.taku-post-body ul[data-checklist]{list-style:none;padding-left:2px;margin:8px 0}',
  '.taku-post-body ul[data-checklist] li{position:relative;padding-left:28px;margin:4px 0;list-style:none}',
  ".taku-post-body ul[data-checklist] li::before{content:'';position:absolute;left:2px;top:.32em;width:16px;height:16px;border:2px solid #c9c9cf;border-radius:5px;box-sizing:border-box;background:#fff}",
  '.taku-post-body ul[data-checklist] li[data-checked="1"]::before{background:#e8006f;border-color:#e8006f}',
  ".taku-post-body ul[data-checklist] li[data-checked=\"1\"]::after{content:'';position:absolute;left:7.5px;top:calc(.32em + 3px);width:4px;height:8px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}",
  '.taku-post-body ul[data-checklist] li[data-checked="1"]{color:var(--muted);text-decoration:line-through}',
  // 접기
  '.taku-post-body details[data-fold]{border:1px solid var(--border);border-radius:12px;padding:10px 14px;margin:10px 0;background:var(--surface)}',
  '.taku-post-body details[data-fold] > summary{cursor:pointer;font-weight:800;color:var(--accent);list-style:none}',
  ".taku-post-body details[data-fold] > summary::before{content:'▸ ';display:inline-block;transition:transform .15s}",
  ".taku-post-body details[data-fold][open] > summary::before{content:'▾ '}",
  '.taku-post-body details[data-fold] > summary::-webkit-details-marker{display:none}',
  '.taku-post-body details[data-fold][open] > summary{margin-bottom:8px}',
  // 사진첩
  '.taku-post-body .sl-wrap{position:relative;max-width:640px;margin:10px 0 14px}',
  '.taku-post-body [data-slides]{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;border-radius:12px;background:#111;aspect-ratio:4/3}',
  '.taku-post-body [data-slides]::-webkit-scrollbar{display:none}',
  '.taku-post-body [data-slides] img{flex:0 0 100%;width:100%;height:100%;object-fit:contain;scroll-snap-align:center;border-radius:0 !important;max-width:none !important}',
  '.taku-post-body .sl-btn{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:9999px;border:none;background:rgba(0,0,0,.45);color:#fff;font-size:20px;line-height:36px;cursor:pointer;padding:0}',
  '.taku-post-body .sl-btn[disabled]{opacity:0;pointer-events:none}',
  '.taku-post-body .sl-count{position:absolute;right:10px;top:10px;padding:2px 9px;border-radius:9999px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;font-weight:700}',
  // 샵·이벤트 카드
  '.taku-post-body a[data-embed],.taku-post-body a[data-embed] *{text-decoration:none !important;color:inherit !important}',
].join('')

/** 본문에 스포일러·사진첩 움직임을 붙인다. 돌려주는 함수로 떼어낸다 */
export function bindPostBody(root: HTMLElement | null): () => void {
  if (!root) return () => {}
  // 스포일러: 누르면 보인다(라이트박스·링크보다 먼저)
  const onClick = (e: MouseEvent) => {
    const t = (e.target as HTMLElement | null)?.closest?.('[data-spoiler]:not(.sp-open)')
    if (!t || !root.contains(t)) return
    e.preventDefault(); e.stopPropagation()
    t.classList.add('sp-open')
  }
  root.addEventListener('click', onClick, true)
  root.querySelectorAll<HTMLElement>('[data-spoiler]').forEach(el => { if (!el.title) el.title = '스포일러 · 누르면 보여요' })

  // 사진첩
  const cleanups: (() => void)[] = []
  root.querySelectorAll<HTMLElement>('[data-slides]').forEach(box => {
    if (box.parentElement?.classList.contains('sl-wrap')) return
    box.removeAttribute('contenteditable')
    box.querySelectorAll('[data-lp-remove]').forEach(n => n.remove())
    const imgs = box.querySelectorAll('img')
    if (!imgs.length) return
    const wrap = document.createElement('div')
    wrap.className = 'sl-wrap'
    box.before(wrap); wrap.appendChild(box)
    const prev = document.createElement('button'); prev.type = 'button'; prev.className = 'sl-btn'; prev.style.left = '8px'; prev.textContent = '‹'; prev.setAttribute('aria-label', '이전 사진')
    const next = document.createElement('button'); next.type = 'button'; next.className = 'sl-btn'; next.style.right = '8px'; next.textContent = '›'; next.setAttribute('aria-label', '다음 사진')
    const count = document.createElement('span'); count.className = 'sl-count'
    wrap.append(prev, next, count)
    const update = () => {
      const i = Math.round(box.scrollLeft / Math.max(1, box.clientWidth))
      count.textContent = `${Math.min(imgs.length, i + 1)} / ${imgs.length}`
      prev.disabled = i <= 0
      next.disabled = i >= imgs.length - 1
    }
    const go = (d: number) => box.scrollBy({ left: d * box.clientWidth, behavior: 'smooth' })
    const onPrev = (e: Event) => { e.stopPropagation(); go(-1) }
    const onNext = (e: Event) => { e.stopPropagation(); go(1) }
    prev.addEventListener('click', onPrev); next.addEventListener('click', onNext)
    box.addEventListener('scroll', update, { passive: true })
    update()
    cleanups.push(() => { prev.removeEventListener('click', onPrev); next.removeEventListener('click', onNext); box.removeEventListener('scroll', update) })
  })
  return () => { root.removeEventListener('click', onClick, true); cleanups.forEach(f => f()) }
}
