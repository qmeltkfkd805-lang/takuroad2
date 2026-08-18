'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  drawStory, drawFeed, ensureReportFonts, loadImage,
  STORY_W, STORY_H, FEED_W, FEED_H,
} from '@/lib/report/drawReport'
import type { ReportCardData } from '@/services/yearlyReportService'

const BG: Record<'story' | 'feed', string> = {
  story: '/report/story-bg.png',
  feed: '/report/feed-bg.png',
}

export default function ReportShareCard({ data }: { data: ReportCardData }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bgCache = useRef<Record<string, HTMLImageElement>>({})
  const [mode, setMode] = useState<'story' | 'feed'>('story')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const render = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setStatus('loading'); setMsg('')
    try {
      await ensureReportFonts()
      const src = BG[mode]
      let bg = bgCache.current[src]
      if (!bg) { bg = await loadImage(src); bgCache.current[src] = bg }
      const w = mode === 'story' ? STORY_W : FEED_W
      const h = mode === 'story' ? STORY_H : FEED_H
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no ctx')
      if (mode === 'story') drawStory(ctx, bg, data)
      else drawFeed(ctx, bg, data)
      setStatus('ready')
    } catch (e) {
      console.error('[리포트 렌더 실패]', e)
      setStatus('error')
    }
  }, [mode, data])

  useEffect(() => { render() }, [render])

  const fileName = () => `takuroad-${data.year}-${mode}.png`
  function toBlob(): Promise<Blob | null> {
    return new Promise(res => {
      const c = canvasRef.current
      if (!c) return res(null)
      c.toBlob(b => res(b), 'image/png')
    })
  }

  async function save() {
    setBusy(true); setMsg('')
    try {
      const blob = await toBlob(); if (!blob) throw new Error('blob')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileName()
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      setMsg('이미지를 저장했어요')
    } catch { setMsg('저장에 실패했어요') } finally { setBusy(false) }
  }

  async function share() {
    setBusy(true); setMsg('')
    try {
      const blob = await toBlob(); if (!blob) throw new Error('blob')
      const file = new File([blob], fileName(), { type: 'image/png' })
      const nav = navigator as any
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: `${data.year} 나의 타쿠로드` })
        setMsg('')
      } else {
        await save() // 공유 미지원(데스크톱 등) → 저장으로 대체
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setMsg('공유를 지원하지 않아 저장으로 대체돼요')
    } finally { setBusy(false) }
  }

  const seg = (m: 'story' | 'feed', label: string) => (
    <button
      onClick={() => setMode(m)}
      style={{
        flex: 1, height: 40, borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13.5, fontWeight: 800,
        border: mode === m ? '1px solid var(--accent)' : '1px solid var(--border)',
        background: mode === m ? 'var(--accent-l)' : 'var(--surface)',
        color: mode === m ? 'var(--accent)' : 'var(--muted)',
      }}
    >{label}</button>
  )

  return (
    <div style={{ maxWidth: 380, margin: '0 auto' }}>
      {/* 스토리/피드 전환 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {seg('story', '스토리 9:16')}
        {seg('feed', '피드 1:1')}
      </div>

      {/* 프리뷰 (캔버스를 CSS로 축소) */}
      <div style={{
        position: 'relative', width: '100%',
        borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface2)',
        aspectRatio: mode === 'story' ? '1080 / 1920' : '1 / 1',
      }}>
        <canvas ref={canvasRef} style={{ display: status === 'ready' ? 'block' : 'none', width: '100%', height: '100%' }} />
        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
            이미지 만드는 중…
          </div>
        )}
        {status === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>
            배경 이미지를 불러오지 못했어요
            <button onClick={render} style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 8, padding: '8px 16px', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }}>다시 시도</button>
          </div>
        )}
      </div>

      {/* 저장 / 공유 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          onClick={save} disabled={busy || status !== 'ready'}
          style={{ flex: 1, height: 48, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: busy || status !== 'ready' ? 'default' : 'pointer', opacity: busy || status !== 'ready' ? 0.5 : 1 }}
        >이미지 저장</button>
        <button
          onClick={share} disabled={busy || status !== 'ready'}
          style={{ flex: 1, height: 48, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: busy || status !== 'ready' ? 'default' : 'pointer', opacity: busy || status !== 'ready' ? 0.6 : 1 }}
        >{busy ? '처리 중…' : '공유하기'}</button>
      </div>
      {msg && <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>{msg}</div>}
    </div>
  )
}
