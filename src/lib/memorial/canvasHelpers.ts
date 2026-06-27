'use client'

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`이미지 로드 실패: ${src}`))
    img.src = src
  })
}

export async function loadImagesOptional(
  map: Record<string, string | undefined>,
): Promise<Record<string, HTMLImageElement | undefined>> {
  const entries = Object.entries(map)
  const results = await Promise.all(
    entries.map(async ([key, src]) => {
      if (!src) return [key, undefined] as const
      try { return [key, await loadImage(src)] as const }
      catch { return [key, undefined] as const }
    }),
  )
  return Object.fromEntries(results)
}

export function drawStampMultiply(
  ctx: CanvasRenderingContext2D,
  stamp: HTMLImageElement,
  cx: number, cy: number, size: number, rotateDeg: number, opacity = 0.8,
) {
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = opacity
  ctx.translate(cx, cy)
  ctx.rotate((rotateDeg * Math.PI) / 180)
  ctx.drawImage(stamp, -size / 2, -size / 2, size, size)
  ctx.restore()
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}

// ===== 손맛(동인지) 유틸 =====

export function wobblyLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, width = 4, wob = 2, seg = 16, seed = 0,
) {
  let s = seed * 9301 + 49297
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return (s / 233280 - 0.5) * 2 }
  const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / seg))
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = x1 + (x2 - x1) * t + rnd() * wob
    const y = y1 + (y2 - y1) * t + rnd() * wob
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke(); ctx.restore()
}

export function dashedH(ctx: CanvasRenderingContext2D, y: number, x1: number, x2: number, color: string, width = 4, seed = 10) {
  let s = seed * 9301 + 49297
  const rnd = (a: number, b: number) => { s = (s * 9301 + 49297) % 233280; return a + (s / 233280) * (b - a) }
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'
  let x = x1
  while (x < x2) {
    const dl = rnd(18, 30)
    ctx.beginPath(); ctx.moveTo(x, y + rnd(-2.5, 2.5)); ctx.lineTo(x + dl, y + rnd(-2.5, 2.5)); ctx.stroke()
    x += dl + rnd(12, 20)
  }
  ctx.restore()
}

export function dashedV(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, color: string, width = 4, seed = 20) {
  let s = seed * 9301 + 49297
  const rnd = (a: number, b: number) => { s = (s * 9301 + 49297) % 233280; return a + (s / 233280) * (b - a) }
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'
  let y = y1
  while (y < y2) {
    const dl = rnd(18, 30)
    ctx.beginPath(); ctx.moveTo(x + rnd(-2.5, 2.5), y); ctx.lineTo(x + rnd(-2.5, 2.5), y + dl); ctx.stroke()
    y += dl + rnd(12, 20)
  }
  ctx.restore()
}

export function doodleStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, width = 3) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    const ox = cx + Math.cos(a) * r, oy = cy + Math.sin(a) * r
    i === 0 ? ctx.moveTo(ox, oy) : ctx.lineTo(ox, oy)
    const a2 = a + Math.PI / 5
    ctx.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45)
  }
  ctx.closePath(); ctx.stroke(); ctx.restore()
}

export function drawCrumpledPaper(ctx: CanvasRenderingContext2D, w: number, h: number, seed = 7) {
  const id = ctx.getImageData(0, 0, w, h); const px = id.data
  let s = seed
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  for (let i = 0; i < px.length; i += 4) {
    const n = (rnd() - 0.5) * 8
    px[i] += n; px[i + 1] += n; px[i + 2] += n
  }
  ctx.putImageData(id, 0, 0)
  ctx.save()
  for (let k = 0; k < 30; k++) {
    const x0 = rnd() * w, y0 = rnd() * h
    const ang = rnd() * Math.PI, ln = 150 + rnd() * 350
    const x1 = x0 + Math.cos(ang) * ln, y1 = y0 + Math.sin(ang) * ln
    const grad = ctx.createLinearGradient(x0, y0, x1, y1)
    const light = rnd() > 0.5
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.5, light ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.strokeStyle = grad; ctx.lineWidth = 14 + rnd() * 16
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
  }
  ctx.restore()
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const loadedFonts = new Set<string>()
export async function ensureFont(family: string, url: string): Promise<void> {
  if (loadedFonts.has(family)) return
  if (typeof (globalThis as any).FontFace === 'undefined') return
  try {
    const face = new FontFace(family, `url(${url})`)
    await face.load()
    ;(document as any).fonts.add(face)
    loadedFonts.add(family)
  } catch { /* 실패해도 기본폰트로 진행 */ }
}
