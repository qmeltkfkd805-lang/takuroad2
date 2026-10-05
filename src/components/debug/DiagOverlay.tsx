'use client'

/* 🔎 화면 진단 패널 — 주소 끝에 ?diag=1 을 붙였을 때만 뜬다. (평소엔 코드도 안 불러옴)
   크롬 / 네이버 앱처럼 같은 폰에서 모양이 다를 때, 두 브라우저의 실제 값을 비교하려고 만든 것.
   읽기만 한다 — 저장·전송하는 것 없음. '복사' 버튼으로 결과 글을 클립보드에 담을 수 있다. */
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'

const MQ = [
  '(hover: hover)', '(hover: none)', '(pointer: fine)', '(pointer: coarse)', '(pointer: none)',
  '(any-hover: hover)', '(any-hover: none)', '(any-pointer: fine)', '(any-pointer: coarse)',
  '(hover: none) and (pointer: coarse)',                       // 예전 '모바일' 기준 (네이버 앱은 false 였음)
  '(pointer: coarse) and (max-width: 1023px)',
  '(hover: hover) and (pointer: fine)',                        // 사이트의 'PC' 기준
  '(hover: none) and (pointer: coarse) and (max-width: 640px)',
  '(hover: none) and (pointer: coarse) and (max-width: 1023px)',
  '(max-width: 640px)', '(max-width: 1023px)', '(min-width: 1024px)',
]

const PROPS = ['font-size', 'line-height', 'height', 'min-height', 'padding', 'border-radius', 'display', 'width']

type RuleHit = { selector: string; media: string | null; mediaActive: boolean | null; sheet: string; set: Record<string, string> }

function shortUrl(u: string | null | undefined) {
  if (!u) return '(inline)'
  try { const x = new URL(u, location.href); return x.pathname.split('/').slice(-1)[0] || x.pathname } catch { return u.slice(-60) }
}

/** el 에 걸리는 CSS 규칙 중 PROPS 를 지정한 것 — 미디어쿼리 안쪽이면 그 조건과 지금 맞는지까지 */
function rulesFor(el: Element): RuleHit[] {
  const hits: RuleHit[] = []
  const walk = (rules: CSSRuleList, media: string | null, sheet: string) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSMediaRule) { walk(r.cssRules, (media ? media + ' & ' : '') + r.conditionText, sheet); continue }
      if (!(r instanceof CSSStyleRule)) { if ((r as any).cssRules) walk((r as any).cssRules, media, sheet); continue }
      let ok = false
      try { ok = el.matches(r.selectorText) } catch { ok = false }
      if (!ok) continue
      const set: Record<string, string> = {}
      for (const p of PROPS) {
        const v = r.style.getPropertyValue(p)
        if (v) set[p] = v + (r.style.getPropertyPriority(p) ? ' !important' : '')
      }
      if (Object.keys(set).length === 0) continue
      let active: boolean | null = null
      if (media) { try { active = media.split(' & ').every(m => matchMedia(m).matches) } catch { active = null } }
      hits.push({ selector: r.selectorText, media, mediaActive: active, sheet, set })
    }
  }
  for (const s of Array.from(document.styleSheets)) {
    try { walk(s.cssRules, null, shortUrl(s.href)) } catch { /* 다른 도메인 시트(구글 폰트 등)는 못 읽음 */ }
  }
  return hits
}

function inspect(name: string, sel: string) {
  const el = document.querySelector(sel)
  if (!el) return { name, found: false }
  const cs = getComputedStyle(el)
  const rect = el.getBoundingClientRect()
  const computed: Record<string, string> = {}
  for (const p of PROPS) computed[p] = cs.getPropertyValue(p)
  return {
    name, found: true,
    className: (el as HTMLElement).className?.toString().slice(0, 160),
    box: { w: Math.round(rect.width), h: Math.round(rect.height), x: Math.round(rect.left) },
    computed,
    rules: rulesFor(el),
  }
}

function collect(loggedIn: boolean) {
  const vv = window.visualViewport
  const meta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '(없음)'
  // 글자 확대(네이버 앱 글자 크기·안드로이드 WebView textZoom) 감지 — 16px 로 지정한 글자가 실제 몇 px 로 계산·그려지는지
  const probe = document.createElement('span')
  probe.textContent = '가나다ABC'
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;font-size:16px;line-height:1;white-space:nowrap;font-family:sans-serif'
  document.body.appendChild(probe)
  const probeFont = getComputedStyle(probe).fontSize
  const probeH = probe.getBoundingClientRect().height
  probe.remove()

  const w = window as any
  return {
    time: new Date().toISOString(),
    url: location.href,
    login: loggedIn ? '로그인' : '비로그인',
    build: {
      commit: (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || '(모름)',
      scripts: Array.from(document.scripts).map(s => s.src).filter(s => s.includes('/_next/')).map(shortUrl),
      css: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => shortUrl((l as HTMLLinkElement).href)),
    },
    ua: navigator.userAgent,
    viewport: {
      meta,
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      visualViewport: vv ? { width: Math.round(vv.width * 10) / 10, scale: vv.scale } : '(미지원)',
      devicePixelRatio: window.devicePixelRatio,
      screen: `${screen.width}x${screen.height}`,
    },
    media: Object.fromEntries(MQ.map(q => [q, matchMedia(q).matches])),
    textZoom: {
      htmlFontSize: getComputedStyle(document.documentElement).fontSize,
      probe16pxComputed: probeFont,
      probe16pxHeight: Math.round(probeH * 10) / 10,
      textSizeAdjust: getComputedStyle(document.documentElement).getPropertyValue('-webkit-text-size-adjust') || '(없음)',
    },
    cssSupport: {
      dvh: CSS.supports('height', '100dvh'),
      has: CSS.supports('selector(:has(a))'),
      overscrollBehavior: CSS.supports('overscroll-behavior', 'none'),
      mediaHover: matchMedia('(hover)').media !== 'not all',
    },
    errors: (w.__TAKU_DIAG_ERRORS ?? []).slice(0, 20),
    elements: [
      inspect('헤더', '[data-diag="header"]'),
      inspect('헤더-프로필', '[data-diag="header-user"]'),
      inspect('배너-바깥', '[data-diag="hero-wrap"]'),
      inspect('배너-틀', '[data-diag="hero-viewport"]'),
      inspect('배너-카드', '[data-diag="hero-slide"]'),
      inspect('배너-제목', '[data-diag="hero-title"]'),
      inspect('하단탭', 'nav'),
    ],
  }
}

export default function DiagOverlay() {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // 화면이 다 그려진 뒤에 잰다
    const t = setTimeout(() => setText(JSON.stringify(collect(!!user), null, 1)), 1200)
    return () => clearTimeout(t)
  }, [user])

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true) }
    catch { const ta = document.getElementById('taku-diag-text') as HTMLTextAreaElement | null; ta?.select(); document.execCommand?.('copy'); setCopied(true) }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ position: 'fixed', right: 8, top: 8, zIndex: 99999, padding: '6px 10px', borderRadius: 8, border: 'none', background: '#222', color: '#fff', fontSize: 12, fontWeight: 800 }}>진단</button>
  )
  return (
    <div style={{ position: 'fixed', inset: '8px 8px auto 8px', zIndex: 99999, maxHeight: '70vh', display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 12, background: 'rgba(20,20,28,.95)', color: '#fff', fontSize: 12, boxShadow: '0 8px 28px rgba(0,0,0,.4)' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <b style={{ flex: 1 }}>화면 진단 {text ? '' : '(재는 중…)'}</b>
        <button onClick={copy} disabled={!text} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#e8006f', color: '#fff', fontWeight: 800, fontSize: 12 }}>{copied ? '복사됨' : '전체 복사'}</button>
        <button onClick={() => setOpen(false)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#444', color: '#fff', fontWeight: 800, fontSize: 12 }}>접기</button>
      </div>
      <textarea id="taku-diag-text" readOnly value={text} style={{ flex: 1, minHeight: 240, width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: 10.5, lineHeight: 1.35, background: '#000', color: '#9f9', border: 'none', borderRadius: 8, padding: 8 }} />
    </div>
  )
}
