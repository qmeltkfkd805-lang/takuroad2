'use client'
import { useState, useEffect } from 'react'

// 이미지에서 대표색(평균) 추출 → hex. CORS 막히면 null(폴백).
export function useDominantColor(url?: string | null): string | null {
  const [color, setColor] = useState<string | null>(null)
  useEffect(() => {
    if (!url) { setColor(null); return }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        const w = 24, h = 24
        c.width = w; c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, w, h)
        const d = ctx.getImageData(0, 0, w, h).data
        let r = 0, g = 0, b = 0, n = 0
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 125) continue
          const rr = d[i], gg = d[i + 1], bb = d[i + 2]
          const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb)
          if (mx > 245 && mn > 245) continue
          if (mx < 18) continue
          r += rr; g += gg; b += bb; n++
        }
        if (n === 0 || cancelled) return
        const hx = (v: number) => Math.round(v / n).toString(16).padStart(2, '0')
        setColor('#' + hx(r) + hx(g) + hx(b))
      } catch { /* tainted (CORS) */ }
    }
    img.src = url
    return () => { cancelled = true }
  }, [url])
  return color
}