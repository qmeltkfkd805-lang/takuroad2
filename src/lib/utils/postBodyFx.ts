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
].join('') + decorCss('.taku-post-body')

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


/* 글 꾸미기 (2026-10-19) — 소제목·형광펜·강조 박스·별점·단계·꾸밈 구분선.
   글쓰기 편집기(.taku-editor)와 글 화면(.taku-post-body)이 같은 모양이 되도록 같은 규칙을 범위만 바꿔 쓴다.
   저장된 HTML 엔 data-* 표시만 있다 — 강조 박스의 이름표(💡 꿀팁 등)·단계 번호·구분선 무늬는 CSS 가 그린다. */
export function decorCss(s: string): string {
  return [
    // 소제목 — 장식 없이 글씨 크기·굵기만 (색·형광펜은 쓰는 사람이 직접). 큰(h2) / 작은(h3)
    `${s} h2{font-size:1.4em;font-weight:900;line-height:1.4;margin:24px 0 12px;padding:0;border:none;background:none}`,
    `${s} h3{font-size:1.1em;font-weight:800;line-height:1.45;margin:16px 0 6px}`,
    // 강조 박스
    `${s} div[data-callout]{position:relative;margin:12px 0;padding:34px 16px 12px;border-radius:12px;border:1px solid;line-height:1.65}`,
    `${s} div[data-callout]::before{position:absolute;top:10px;left:16px;font-size:.85em;font-weight:900}`,
    `${s} div[data-callout] > :first-child{margin-top:0}`,
    `${s} div[data-callout] > :last-child{margin-bottom:0}`,
    `${s} div[data-callout="tip"]{background:rgba(255,86,146,.08);border-color:rgba(255,86,146,.35)}`,
    `${s} div[data-callout="tip"]::before{content:'💡 꿀팁';color:#E8006F}`,
    `${s} div[data-callout="info"]{background:rgba(123,198,255,.12);border-color:rgba(59,155,232,.35)}`,
    `${s} div[data-callout="info"]::before{content:'📌 정보';color:#1F7BC9}`,
    `${s} div[data-callout="warn"]{background:rgba(245,177,0,.12);border-color:rgba(245,177,0,.45)}`,
    `${s} div[data-callout="warn"]::before{content:'⚠️ 주의';color:#A87500}`,
    `${s} div[data-callout="check"]{background:rgba(110,220,202,.16);border-color:rgba(20,184,160,.4)}`,
    `${s} div[data-callout="check"]::before{content:'✅ 체크';color:#0E8A78}`,
    // 별점 — "이름 ★★★★☆" 한 줄
    `${s} div[data-stars]{display:flex;align-items:center;gap:10px;margin:10px 0;padding:10px 14px;border-radius:12px;background:var(--surface2);font-weight:800}`,
    `${s} div[data-stars] [data-stars-value]{color:#FFB400;letter-spacing:2px;font-size:1.15em}`,
    // 단계 — 번호 동그라미 카드
    `${s} ol[data-steps]{list-style:none;counter-reset:step;padding:0;margin:12px 0}`,
    `${s} ol[data-steps] > li{counter-increment:step;position:relative;margin:0 0 8px;padding:12px 14px 12px 52px;border:1px solid var(--border);border-radius:12px;background:var(--surface);min-height:24px;line-height:1.6}`,
    `${s} ol[data-steps] > li::before{content:counter(step);position:absolute;left:14px;top:11px;width:26px;height:26px;border-radius:9999px;background:var(--accent);color:#fff;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center}`,
    // 링크 단 사진 — 누르면 링크로 가니까 손가락 모양
    `${s} img[data-href]{cursor:pointer}`,
    // 샵·이벤트 카드 — 이름 길이·설명 줄 유무와 상관없이 늘 같은 크기 (이미 올라간 글의 카드도 같이 맞춘다)
    // (예전 '내 루트' 카드는 data-embed 표시가 없어서 주소+모양으로 찾는다)
    `${s} a[data-embed],${s} a[href^="/route/"][style*="display:flex"],${s} a[href^="/route/"][style*="display: flex"]{width:100% !important;max-width:460px !important;height:90px !important;box-sizing:border-box !important;overflow:hidden}`,
    `${s} a[data-embed] > span:last-child,${s} a[href^="/route/"][style*="flex"] > span:last-child{flex:1 1 auto;min-width:0}`,
    `${s} a[href^="/route/"][style*="flex"] > span:last-child > span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`,
    // 목록 모양 — 기본 점(•)·숫자(1.)는 브라우저 그대로, 나머지는 data-list 표시를 보고 그린다
    `${s} ul,${s} ol{padding-left:1.6em;margin:8px 0}`,
    // 사이트 기본 CSS(Tailwind)가 목록 표시를 없애 둬서 기본 점·숫자를 다시 켠다 (체크리스트·단계 블록은 제외)
    `${s} ul:not([data-list]):not([data-checklist]){list-style:disc}`,
    `${s} ol:not([data-list]):not([data-steps]){list-style:decimal}`,
    `${s} ul ul:not([data-list]):not([data-checklist]){list-style:circle}`,
    `${s} ul[data-list]{list-style:none}`,
    `${s} ul[data-list] > li{position:relative}`,
    `${s} ul[data-list] > li::before{position:absolute;left:-1.35em;top:0;color:var(--accent);font-weight:900}`,
    `${s} ul[data-list="circle"] > li::before{content:'\\25E6';font-size:1.2em;line-height:1.3}`,
    `${s} ul[data-list="heart"] > li::before{content:'\\2665';font-size:.72em;line-height:2.1}`,
    `${s} ul[data-list="star"] > li::before{content:'\\2605';font-size:.72em;line-height:2.1}`,
    `${s} ul[data-list="check"] > li::before{content:'\\2713'}`,
    `${s} ul[data-list="arrow"] > li::before{content:'\\2192'}`,
    `${s} ol[data-list="circle"]{list-style:none;counter-reset:dl}`,
    `${s} ol[data-list="circle"] > li{position:relative;counter-increment:dl}`,
    `${s} ol[data-list="circle"] > li::before{content:counter(dl);position:absolute;left:-1.55em;top:.2em;width:1.25em;height:1.25em;border-radius:9999px;background:var(--accent);color:#fff;font-size:.8em;font-weight:900;display:flex;align-items:center;justify-content:center}`,
    `${s} ol[data-list="hangul"]{list-style-type:hangul}`,
    `${s} ol[data-list="alpha"]{list-style-type:upper-alpha}`,
    // 인용구 모양 (기본 <blockquote> = 왼쪽 핑크 세로줄은 그대로)
    `${s} blockquote[data-quote]{border-left:none;color:var(--text);margin:14px 0}`,
    `${s} blockquote[data-quote="mark"]{position:relative;text-align:center;padding:30px 36px 26px;font-weight:600}`,
    `${s} blockquote[data-quote="mark"]::before,${s} blockquote[data-quote="mark"]::after{position:absolute;font-size:44px;line-height:1;color:var(--accent);font-family:Georgia,serif;opacity:.85}`,
    `${s} blockquote[data-quote="mark"]::before{content:'\\201C';left:6px;top:2px}`,
    `${s} blockquote[data-quote="mark"]::after{content:'\\201D';right:6px;bottom:-14px}`,
    `${s} blockquote[data-quote="bubble"]{position:relative;background:var(--surface2);border-radius:16px;padding:14px 18px;margin-bottom:22px}`,
    `${s} blockquote[data-quote="bubble"]::after{content:'';position:absolute;left:24px;bottom:-10px;border:10px solid transparent;border-top-color:var(--surface2);border-bottom:0}`,
    `${s} blockquote[data-quote="box"]{border:1.5px solid var(--border);border-radius:12px;padding:14px 18px}`,
    `${s} blockquote[data-quote="note"]{background:#FFF4B8;color:#3a3200;border-radius:4px;padding:16px 18px;box-shadow:0 2px 6px rgba(0,0,0,.08)}`,
    // 구분선 — 기본(<hr>)도 점선과 같은 색·두께의 실선
    `${s} hr:not([data-divider]){border:none;border-top:2px solid var(--border);height:0;margin:18px 0;background:none}`,
    `${s} hr[data-divider]{border:none;height:auto;margin:18px 0;text-align:center;overflow:visible;background:none}`,
    `${s} hr[data-divider="dot"]{border-top:2px dashed var(--border)}`,
    `${s} hr[data-divider="heart"]::after{content:'♡  ♡  ♡';color:var(--accent);font-size:15px;letter-spacing:4px}`,
    `${s} hr[data-divider="star"]::after{content:'✦  ✦  ✦';color:var(--accent);font-size:14px;letter-spacing:4px}`,
    `${s} hr[data-divider="wave"]{height:10px;background:radial-gradient(circle at 6px -3px,transparent 6px,var(--accent) 6.5px,var(--accent) 8px,transparent 8.5px) 0 0/12px 10px repeat-x;opacity:.55}`,
  ].join('')
}
