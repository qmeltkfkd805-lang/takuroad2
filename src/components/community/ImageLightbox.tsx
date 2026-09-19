'use client'

import { useCallback, useEffect, useState } from 'react'

/* 게시글 사진 확대 뷰어 v2 (2026-09-19)
 *
 * v1 은 열 때마다 오버레이와 <img> 를 새로 만들고 닫을 때 부쉈다.
 * 프로덕션 빌드에서 15회쯤 여닫으면 메인 스레드가 멈췄다(휠 스크롤만 살아 있고
 * 클릭·키보드·커서 갱신이 전부 죽음). 원인은 특정하지 못했지만 배제된 것은:
 *   · 스크롤 잠금 (overflow / padding 둘 다 꺼도 멈춤)
 *   · 오버레이·style 태그·리스너·DOM 누수 (실제 빌드에서 40회 계측, 증가 0)
 * 남은 후보는 큰 이미지를 반복해서 붙였다 떼는 렌더링·디코딩 경로였다.
 *
 * v2 는 그 경로를 아예 없앤다:
 *   · 오버레이를 항상 마운트해 두고 display 로만 숨긴다 (DOM 생성·파괴 없음)
 *   · <img> 하나를 재사용하고 src 만 바꾼다
 *   · decoding="async" — 메인 스레드 동기 디코딩을 피한다
 *   · 커서 CSS 는 모듈당 한 번만 <head> 에 주입한다 (카드마다 <style> 렌더 안 함)
 */

const P = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 2.2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

let cssDone = false
function injectCss() {
  if (cssDone || typeof document === 'undefined') return
  cssDone = true
  const s = document.createElement('style')
  s.dataset.taku = 'lightbox'
  s.textContent = '.taku-post-body img{cursor:zoom-in}'
  document.head.appendChild(s)
}

function Overlay({ open, list, index, setIndex, onClose }: {
  open: boolean; list: string[]; index: number
  setIndex: React.Dispatch<React.SetStateAction<number>>; onClose: () => void
}) {
  const n = list.length
  const many = n > 1

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (many && e.key === 'ArrowLeft') { e.preventDefault(); setIndex(k => (k - 1 + n) % n) }
      else if (many && e.key === 'ArrowRight') { e.preventDefault(); setIndex(k => (k + 1) % n) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, n, many, onClose, setIndex])

  // 스크롤 주체는 <html> 이다 (이 앱은 html { overflow-y: scroll }). body 에 걸면 안 먹는다.
  useEffect(() => {
    if (!open) return
    const el = document.documentElement
    const prev = el.style.overflow
    el.style.overflow = 'hidden'
    return () => { el.style.overflow = prev }
  }, [open])

  const src = n ? list[Math.max(0, Math.min(n - 1, index))] : undefined

  return (
    <div role="dialog" aria-modal="true" aria-hidden={!open} data-open={open ? '1' : '0'}
      aria-label="사진 확대" onClick={onClose}
      style={{
        display: open ? 'flex' : 'none',
        position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,.92)',
        alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <button aria-label="닫기" onClick={onClose} style={btn({ top: 16, right: 16 })}>
        <svg width="22" height="22" viewBox="0 0 24 24" {...P}><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>

      <img src={src} alt="" decoding="async" onClick={e => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '92vh', objectFit: 'contain', display: 'block' }} />

      {many && (
        <>
          <button aria-label="이전 사진" onClick={e => { e.stopPropagation(); setIndex(k => (k - 1 + n) % n) }} style={btn({ left: 12, top: '50%' }, true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" {...P}><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button aria-label="다음 사진" onClick={e => { e.stopPropagation(); setIndex(k => (k + 1) % n) }} style={btn({ right: 12, top: '50%' }, true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" {...P}><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <div aria-live="polite" style={{
            position: 'fixed', bottom: 18, left: 0, right: 0, textAlign: 'center',
            color: '#fff', fontSize: 13, fontWeight: 700, pointerEvents: 'none',
          }}>{index + 1} / {n}</div>
        </>
      )}
    </div>
  )
}

function btn(pos: React.CSSProperties, center = false): React.CSSProperties {
  return {
    position: 'fixed', ...pos, ...(center ? { transform: 'translateY(-50%)' } : null),
    width: 42, height: 42, borderRadius: 9999, border: 'none',
    background: 'rgba(255,255,255,.14)', color: '#fff', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', zIndex: 4002,
  }
}

export function usePostLightbox() {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<string[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => { injectCss() }, [])

  const openAt = useCallback((l: string[], k: number) => {
    const clean = (l || []).filter(Boolean)
    if (!clean.length) return
    setList(clean)
    setIndex(Math.max(0, Math.min(clean.length - 1, k)))
    setOpen(true)
  }, [])

  const onClose = useCallback(() => setOpen(false), [])

  const onBodyClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const t = e.target as HTMLElement | null
    if (!t || t.tagName !== 'IMG') return
    const imgs = Array.from(e.currentTarget.querySelectorAll('img'))
    const k = imgs.indexOf(t as HTMLImageElement)
    if (k < 0) return
    e.preventDefault()
    openAt(imgs.map(m => m.currentSrc || m.src), k)
  }, [openAt])

  const node = <Overlay open={open} list={list} index={index} setIndex={setIndex} onClose={onClose} />
  return { openAt, onBodyClick, node }
}