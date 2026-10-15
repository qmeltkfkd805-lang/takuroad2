'use client'

/* 본문 사진 자르기·돌리기 (2026-10-15)
   돌리기(90°씩) → 남길 부분을 끌어서 고르기 → [적용] 하면 새 사진으로 올려서 본문의 그 사진을 바꾼다(원래 파일은 그대로 둔다). */
import { useEffect, useRef, useState } from 'react'

type Rect = { x: number; y: number; w: number; h: number }   // 돌린 사진 기준 0~1
const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 }

export default function ImageEditModal({ src, onClose, onApply }: {
  src: string
  onClose: () => void
  onApply: (file: File) => Promise<void>
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [err, setErr] = useState('')
  const [rot, setRot] = useState(0)          // 0 · 90 · 180 · 270
  const [crop, setCrop] = useState<Rect>(FULL)
  const [busy, setBusy] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => setImg(i)
    i.onerror = () => setErr('사진을 불러오지 못했어요.')
    i.src = src + (src.includes('?') ? '&' : '?') + 'edit=1'   // 예전에 받아 둔(교차 출처 표시 없는) 사본을 피한다
  }, [src])

  const side = rot % 180 !== 0
  const W = img ? (side ? img.naturalHeight : img.naturalWidth) : 1
  const H = img ? (side ? img.naturalWidth : img.naturalHeight) : 1
  const maxW = typeof window !== 'undefined' ? Math.min(560, window.innerWidth - 48) : 560
  const scale = Math.min(maxW / W, 400 / H, 1)
  const dw = Math.round(W * scale), dh = Math.round(H * scale)

  // 돌린 사진을 그린 미리보기 주소
  const [previewUrl, setPreviewUrl] = useState('')
  useEffect(() => {
    if (!img) return
    const c = document.createElement('canvas')
    c.width = dw; c.height = dh
    const g = c.getContext('2d')!
    g.translate(dw / 2, dh / 2); g.rotate((rot * Math.PI) / 180)
    const iw = side ? dh : dw, ih = side ? dw : dh
    g.drawImage(img, -iw / 2, -ih / 2, iw, ih)
    try { setPreviewUrl(c.toDataURL('image/jpeg', 0.85)) } catch { setErr('이 사진은 여기서 고칠 수 없어요.') }
  }, [img, rot, dw, dh, side])

  const pt = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  const onDown = (e: React.PointerEvent) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag.current = pt(e) }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const a = drag.current, b = pt(e)
    const r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
    if (r.w > 0.02 && r.h > 0.02) setCrop(r)
  }
  const onUp = () => { drag.current = null }

  const rotate = (d: number) => { setRot(r => (r + d + 360) % 360); setCrop(FULL) }

  const apply = async () => {
    if (!img) return
    setBusy(true); setErr('')
    try {
      const full = document.createElement('canvas')
      full.width = W; full.height = H
      const g = full.getContext('2d')!
      g.translate(W / 2, H / 2); g.rotate((rot * Math.PI) / 180)
      g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
      const out = document.createElement('canvas')
      out.width = Math.max(1, Math.round(crop.w * W)); out.height = Math.max(1, Math.round(crop.h * H))
      out.getContext('2d')!.drawImage(full, Math.round(crop.x * W), Math.round(crop.y * H), out.width, out.height, 0, 0, out.width, out.height)
      const blob: Blob | null = await new Promise(res => out.toBlob(res, 'image/jpeg', 0.92))
      if (!blob) throw new Error('blob')
      await onApply(new File([blob], 'edited.jpg', { type: 'image/jpeg' }))
    } catch {
      setErr('저장하지 못했어요. 다시 해주세요.')
      setBusy(false)
    }
  }

  const btn: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 9, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
  const changed = rot !== 0 || crop.w < 0.999 || crop.h < 0.999

  return (
    <div onClick={busy ? undefined : onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="사진 자르기·돌리기" onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, padding: 18, maxWidth: '100%', boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>사진 자르기·돌리기</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>남길 부분을 사진 위에서 끌어서 고르세요.</div>
        <div style={{ width: dw, height: dh, maxWidth: '100%', margin: '0 auto', position: 'relative', background: '#111', borderRadius: 8, overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}
          ref={boxRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          {previewUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={previewUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />
            : <div style={{ color: '#aaa', fontSize: 13, padding: 20 }}>{err || '불러오는 중…'}</div>}
          {previewUrl && (
            <div style={{ position: 'absolute', left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%`, boxShadow: '0 0 0 9999px rgba(0,0,0,.5)', outline: '2px solid #fff', pointerEvents: 'none' }} />
          )}
        </div>
        {err && previewUrl && <div style={{ color: '#d33', fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14, alignItems: 'center' }}>
          <button type="button" style={btn} onClick={() => rotate(-90)} disabled={busy}>⟲ 왼쪽으로</button>
          <button type="button" style={btn} onClick={() => rotate(90)} disabled={busy}>⟳ 오른쪽으로</button>
          <button type="button" style={btn} onClick={() => { setRot(0); setCrop(FULL) }} disabled={busy}>처음대로</button>
          <span style={{ flex: 1 }} />
          <button type="button" style={btn} onClick={onClose} disabled={busy}>취소</button>
          <button type="button" onClick={apply} disabled={busy || !img || !changed}
            style={{ ...btn, border: 'none', background: changed ? 'var(--accent)' : 'var(--surface2)', color: changed ? '#fff' : 'var(--muted)' }}>
            {busy ? '올리는 중…' : '적용'}
          </button>
        </div>
      </div>
    </div>
  )
}
