'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/* 정사각 아바타 크롭 — 외부 라이브러리 없이 canvas.
   확대(휠·핀치)·이동(드래그·터치), 최종 출력은 정사각 WebP Blob.

   안정성 처리:
   - MIME + 매직바이트(파일 시그니처) 검증 → JPEG/PNG/WebP 만 허용, SVG·GIF 거부
   - EXIF 회전: createImageBitmap({ imageOrientation: 'from-image' })
   - 디코딩 실패 시 명확한 오류 메시지
   - 출력 크기 상한(512px)으로 메모리·용량 제한
   - Object URL 은 만들지 않음(ImageBitmap 사용) — 결과 Blob 의 URL 은 부모가 revoke
   - 저사양/초대형 원본은 try/catch 로 감싸 오류 메시지 처리

   ⚠️ P1: 여기서 만든 Blob 은 "로컬 미리보기" 전용이다. 실제 업로드는 P2(정책 승인 후). */

const OUTPUT = 512          // 출력 정사각 px
const VIEW = 280            // 미리보기 뷰포트 px
const MIME_OK = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024

type Decoded = { bmp: ImageBitmap; w: number; h: number }

async function validateSignature(file: File): Promise<{ ok: boolean; message?: string }> {
  if (file.size > MAX_BYTES) return { ok: false, message: '5MB 이하 이미지만 올릴 수 있어요.' }
  if (!MIME_OK.has(file.type)) return { ok: false, message: 'JPG, PNG, WebP 이미지만 지원해요.' }
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const hex = (n: number) => buf[n]
  // SVG/텍스트 방어
  const head = new TextDecoder().decode(buf).trim().toLowerCase()
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return { ok: false, message: 'SVG 이미지는 지원하지 않아요.' }
  // JPEG FFD8FF
  if (hex(0) === 0xff && hex(1) === 0xd8 && hex(2) === 0xff) return { ok: true }
  // PNG 89504E47
  if (hex(0) === 0x89 && hex(1) === 0x50 && hex(2) === 0x4e && hex(3) === 0x47) return { ok: true }
  // WebP: RIFF....WEBP
  if (hex(0) === 0x52 && hex(1) === 0x49 && hex(2) === 0x46 && hex(3) === 0x46
    && hex(8) === 0x57 && hex(9) === 0x45 && hex(10) === 0x42 && hex(11) === 0x50) return { ok: true }
  // GIF 4749463 8 → 거부
  if (hex(0) === 0x47 && hex(1) === 0x49 && hex(2) === 0x46) return { ok: false, message: 'GIF 이미지는 지원하지 않아요.' }
  return { ok: false, message: '지원하지 않는 이미지 형식이에요.' }
}

export default function AvatarCropper({
  file, onCancel, onDone,
}: {
  file: File
  onCancel: () => void
  onDone: (result: { blob: Blob; url: string }) => void
}) {
  const [decoded, setDecoded] = useState<Decoded | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const pinch = useRef<{ dist: number; scale: number } | null>(null)

  // ── 파일 검증 + 디코딩 ──
  useEffect(() => {
    let alive = true
    let bmpRef: ImageBitmap | null = null
    ;(async () => {
      const v = await validateSignature(file)
      if (!alive) return
      if (!v.ok) { setErr(v.message ?? '이미지를 열 수 없어요.'); return }
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any)
        if (!alive) { bmp.close?.(); return }
        bmpRef = bmp
        const base = VIEW / Math.min(bmp.width, bmp.height) // 짧은 변이 뷰를 꽉 채우는 배율
        setDecoded({ bmp, w: bmp.width, h: bmp.height })
        setMinScale(base); setScale(base); setOffset({ x: 0, y: 0 })
      } catch {
        if (alive) setErr('이미지를 여는 데 실패했어요. 다른 파일을 시도해주세요.')
      }
    })()
    return () => { alive = false; bmpRef?.close?.() }
  }, [file])

  // ── 미리보기 렌더 ──
  const clampOffset = useCallback((o: { x: number; y: number }, s: number, d: Decoded) => {
    const dw = d.w * s, dh = d.h * s
    const maxX = Math.max(0, (dw - VIEW) / 2)
    const maxY = Math.max(0, (dh - VIEW) / 2)
    return { x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) }
  }, [])

  useEffect(() => {
    const c = canvasRef.current, d = decoded
    if (!c || !d) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, VIEW, VIEW)
    const dw = d.w * scale, dh = d.h * scale
    const dx = (VIEW - dw) / 2 + offset.x
    const dy = (VIEW - dh) / 2 + offset.y
    ctx.imageSmoothingQuality = 'high'
    try { ctx.drawImage(d.bmp, dx, dy, dw, dh) } catch { /* noop */ }
  }, [decoded, scale, offset])

  // ── 상호작용 ──
  function onPointerDown(e: React.PointerEvent) {
    if (!decoded) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !decoded) return
    const nx = drag.current.ox + (e.clientX - drag.current.x)
    const ny = drag.current.oy + (e.clientY - drag.current.y)
    setOffset(clampOffset({ x: nx, y: ny }, scale, decoded))
  }
  function onPointerUp() { drag.current = null }

  function onWheel(e: React.WheelEvent) {
    if (!decoded) return
    const factor = e.deltaY < 0 ? 1.08 : 0.92
    const ns = Math.min(minScale * 6, Math.max(minScale, scale * factor))
    setScale(ns); setOffset(o => clampOffset(o, ns, decoded))
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!decoded || e.touches.length !== 2) return
    const [a, b] = [e.touches[0], e.touches[1]]
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    if (!pinch.current) { pinch.current = { dist, scale }; return }
    const ns = Math.min(minScale * 6, Math.max(minScale, pinch.current.scale * (dist / pinch.current.dist)))
    setScale(ns); setOffset(o => clampOffset(o, ns, decoded))
  }
  function onTouchEnd() { pinch.current = null }

  // ── 확정: 뷰포트와 동일 비율로 출력 캔버스에 그려 정사각 WebP ──
  async function confirm() {
    const d = decoded
    if (!d) return
    setBusy(true)
    try {
      const out = document.createElement('canvas')
      out.width = OUTPUT; out.height = OUTPUT
      const ctx = out.getContext('2d')
      if (!ctx) throw new Error('no ctx')
      const k = OUTPUT / VIEW
      const dw = d.w * scale * k, dh = d.h * scale * k
      const dx = (OUTPUT - dw) / 2 + offset.x * k
      const dy = (OUTPUT - dh) / 2 + offset.y * k
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(d.bmp, dx, dy, dw, dh)
      const blob: Blob = await new Promise((res, rej) =>
        out.toBlob(b => (b ? res(b) : rej(new Error('blob'))), 'image/webp', 0.9),
      )
      const url = URL.createObjectURL(blob)
      onDone({ blob, url })
    } catch {
      setErr('이미지 처리에 실패했어요. 다른 파일을 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>사진 편집</div>

        {err ? (
          <div style={{ padding: '24px 6px', textAlign: 'center', color: 'var(--red, #e5484d)', fontSize: 13.5, lineHeight: 1.6 }}>{err}</div>
        ) : (
          <>
            <div style={{ position: 'relative', width: VIEW, height: VIEW, margin: '0 auto', touchAction: 'none', overflow: 'hidden', borderRadius: 12, background: 'var(--surface2)' }}>
              <canvas
                ref={canvasRef} width={VIEW} height={VIEW}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                onWheel={onWheel} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
                style={{ display: 'block', cursor: 'grab', width: VIEW, height: VIEW }}
              />
              {/* 원형 마스크 가이드 */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: '0 0 0 9999px rgba(255,255,255,.55) inset', borderRadius: '50%' }} />
            </div>

            <input
              type="range" min={minScale} max={minScale * 6} step={0.001} value={scale}
              onChange={e => { const ns = parseFloat(e.target.value); setScale(ns); if (decoded) setOffset(o => clampOffset(o, ns, decoded)) }}
              style={{ width: VIEW, display: 'block', margin: '14px auto 0', accentColor: 'var(--accent)' }}
              aria-label="확대"
            />
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, height: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
          >취소</button>
          <button
            onClick={confirm} disabled={!!err || !decoded || busy}
            style={{ flex: 1, height: 44, borderRadius: 10, border: 'none', background: (!!err || !decoded || busy) ? 'var(--accent-l)' : 'var(--accent)', color: (!!err || !decoded || busy) ? 'var(--accent)' : '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: (!!err || !decoded || busy) ? 'default' : 'pointer' }}
          >{busy ? '처리 중…' : '적용'}</button>
        </div>
      </div>
    </div>
  )
}
