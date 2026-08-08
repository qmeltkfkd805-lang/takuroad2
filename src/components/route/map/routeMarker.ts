/* 루트 마커 DOM 빌더 — Kakao CustomOverlay content 로 쓰는 HTMLElement.
   · 일반 스팟: 물방울형 핀 + 번호 (핀 끝이 좌표를 정확히 가리킴 → yAnchor:1)
   · 출발/도착: 플래그(pill) + 아래 꼬리
   · 선택: 크게 + 핑크 채움 + 그림자 / 그 외: 선택이 있으면 약하게 */

const ACCENT = '#e8006f'
const ACCENT_DARK = '#c30059'

export type MarkerKind = 'start' | 'end' | 'normal'

export function markerKind(index: number, total: number): MarkerKind {
  if (index === 0) return 'start'
  if (index === total - 1) return 'end'
  return 'normal'
}

/** 마커 element 반환. Kakao CustomOverlay 는 yAnchor:1, xAnchor:0.5 로 붙일 것(핀 끝/꼬리 = 좌표). */
export function buildMarkerEl(opts: {
  index: number
  total: number
  selected: boolean
  dim?: boolean
}): HTMLElement {
  const { index, total, selected, dim } = opts
  const kind = markerKind(index, total)

  const wrap = document.createElement('div')
  const dimCss = dim ? 'opacity:.4;' : ''
  wrap.style.cssText = `cursor:pointer;transform-origin:bottom center;transform:scale(${selected ? 1.2 : 1});transition:transform .15s,opacity .15s;${dimCss}`

  if (kind === 'start' || kind === 'end') {
    const isStart = kind === 'start'
    const bg = isStart ? ACCENT : ACCENT_DARK
    const pill = document.createElement('div')
    pill.style.cssText = `background:${bg};color:#fff;font-size:11px;font-weight:800;padding:3.5px 9px;border-radius:9999px;white-space:nowrap;box-shadow:0 2px 7px rgba(0,0,0,.32);border:2.5px solid #fff`
    pill.textContent = isStart ? '출발' : '도착'
    // 꼬리(뾰족) — 흰 삼각형 위에 핑크 삼각형을 겹쳐 흰 테두리 효과
    const tail = document.createElement('div')
    tail.style.cssText = 'position:relative;width:14px;height:9px;margin:-1px auto 0'
    const tw = document.createElement('div')  // 흰 테두리
    tw.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid #fff'
    const tp = document.createElement('div')  // 핑크 채움
    tp.style.cssText = `position:absolute;left:2px;top:0;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6.5px solid ${bg}`
    tail.appendChild(tw); tail.appendChild(tp)
    wrap.appendChild(pill); wrap.appendChild(tail)
    return wrap
  }

  // 일반 번호 핀 (물방울형). 끝점이 정확히 좌표를 가리킴.
  const fill = selected ? ACCENT_DARK : '#fff'
  const stroke = selected ? '#ffffff' : ACCENT
  const textColor = selected ? '#ffffff' : ACCENT
  const strokeW = selected ? 2.2 : 1.8
  wrap.innerHTML =
    `<svg width="22" height="28" viewBox="0 0 22 28" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">` +
    `<path d="M11 1C5.5 1 1 5.5 1 11c0 7 10 16 10 16s10-9 10-16C21 5.5 16.5 1 11 1z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>` +
    `<text x="11" y="11" text-anchor="middle" dominant-baseline="central" style="font:700 9px -apple-system,system-ui,sans-serif" fill="${textColor}">${index + 1}</text>` +
    `</svg>`
  return wrap
}

/** 원래(개편 전) 스타일 — 핑크 원형 번호 마커. 상세 페이지 미리보기용. */
export function buildCircleMarkerEl(opts: {
  index: number
  total: number
  selected: boolean
  dim?: boolean
}): HTMLElement {
  const { index, total, selected, dim } = opts
  const kind = markerKind(index, total)
  const dimCss = dim ? 'opacity:.5;' : ''
  const wrap = document.createElement('div')
  wrap.style.cssText = `display:flex;flex-direction:column;align-items:center;cursor:pointer;transform:translateY(-50%);transition:opacity .15s;${dimCss}`

  const dot = document.createElement('div')
  const bg = selected ? ACCENT_DARK : ACCENT
  const scale = selected ? 1.35 : 1
  dot.style.cssText = `width:30px;height:30px;border-radius:50%;background:${bg};border:2.5px solid #fff;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,.3);transform:scale(${scale});transition:transform .15s`
  dot.textContent = String(index + 1)
  wrap.appendChild(dot)

  if (kind === 'start' || kind === 'end') {
    const lab = document.createElement('div')
    lab.style.cssText = `margin-top:3px;background:#fff;color:${ACCENT};font-size:10px;font-weight:800;padding:1px 6px;border-radius:9999px;box-shadow:0 1px 3px rgba(0,0,0,.25);white-space:nowrap`
    lab.textContent = kind === 'start' ? '출발' : '도착'
    wrap.appendChild(lab)
  }
  return wrap
}

/** 밀집 구간 묶음 마커 — 예: "14–17 · 4곳". 클릭하면 확대해 개별 번호 표시. */
export function buildClusterEl(fromNo: number, toNo: number, count: number): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = `cursor:pointer;display:inline-flex;align-items:center;gap:4px;background:#fff;border:2px solid ${ACCENT};color:${ACCENT};font-size:10.5px;font-weight:800;padding:4px 9px;border-radius:9999px;white-space:nowrap;box-shadow:0 2px 7px rgba(0,0,0,.28)`
  el.textContent = `${fromNo}–${toNo} · ${count}곳`
  return el
}

/** 방향 화살표 오버레이 element */
export function buildArrowEl(angle: number, color: string = ACCENT): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = `transform:rotate(${angle}deg);color:${color};font-size:13px;line-height:1;font-weight:900;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;pointer-events:none;opacity:.9`
  el.textContent = '▲'
  return el
}

/** '회차' 라벨 — 되돌아가기 시작점. */
export function buildTurnLabelEl(): HTMLElement {
  const el = document.createElement('div')
  el.title = '되돌아가는 구간 · 같은 길로 이동'
  el.style.cssText = `background:${ACCENT_DARK};color:#fff;font-size:10px;font-weight:800;padding:2.5px 8px;border-radius:9999px;white-space:nowrap;box-shadow:0 1px 5px rgba(0,0,0,.3);border:2px solid #fff;transform:translateY(-50%)`
  el.textContent = '회차'
  return el
}
