'use client'

import { useEffect, useState } from 'react'
import { hostOf } from '@/lib/utils/linkUrl'

/* 글에 붙은 링크 미리보기 카드 (2026-10-14)
   위: 대표 이미지(있으면) / 아래: 제목 · 설명 2줄 · 도메인. 누르면 새 창.
   정보는 /api/link-preview 가 준다(같은 링크는 서버에 한 번 저장한 걸 다시 씀).
   · 읽기 화면: 정보를 못 받으면 아무것도 안 그린다(본문의 링크 글자는 그대로 있다)
   · 글쓰기 화면(onRemove 있음): 불러오는 중 / 못 불러옴도 보여주고 ✕로 카드를 뺄 수 있다 */

type Preview = { url: string; ok: boolean; title: string | null; description: string | null; image: string | null; siteName: string | null }

const cache = new Map<string, Preview>()

export default function LinkPreviewCard({ url, onRemove, compact }: { url: string; onRemove?: () => void; compact?: boolean }) {
  const [state, setState] = useState<{ url: string; p: Preview | null; loading: boolean }>({ url, p: cache.get(url) ?? null, loading: !cache.has(url) })
  const [imgFailed, setImgFailed] = useState<string | null>(null)
  const cur = state.url === url ? state : { url, p: cache.get(url) ?? null, loading: !cache.has(url) }

  useEffect(() => {
    if (cache.has(url)) { setState({ url, p: cache.get(url)!, loading: false }); return }
    let alive = true
    // 글쓰기 중 타이핑마다 부르지 않게 잠깐 기다렸다가
    const t = setTimeout(() => {
      fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        .then(r => r.ok ? r.json() : null)
        .then((p: Preview | null) => {
          const v = p ?? { url, ok: false, title: null, description: null, image: null, siteName: null }
          cache.set(url, v)
          if (alive) setState({ url, p: v, loading: false })
        })
        .catch(() => { if (alive) setState({ url, p: null, loading: false }) })
    }, onRemove ? 600 : 0)
    return () => { alive = false; clearTimeout(t) }
  }, [url, onRemove])

  const editing = !!onRemove
  const p = cur.p
  const host = hostOf(url)

  const removeBtn = editing && (
    <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); onRemove!() }} aria-label="링크 카드 빼기"
      style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, width: 28, height: 28, borderRadius: 9999, border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  )

  const box: React.CSSProperties = { position: 'relative', display: 'block', width: '100%', maxWidth: compact ? 420 : 520, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', textDecoration: 'none', color: 'inherit' }

  if (cur.loading) {
    if (!editing) return null
    return (
      <div style={{ ...box, padding: '14px 16px', fontSize: 13, color: 'var(--muted)' }}>
        {removeBtn}링크 미리보기를 불러오는 중…<div style={{ marginTop: 4, fontSize: 12 }}>{host}</div>
      </div>
    )
  }
  if (!p || !p.ok) {
    if (!editing) return null
    return (
      <div style={{ ...box, padding: '14px 16px', fontSize: 13, color: 'var(--muted)' }}>
        {removeBtn}이 링크는 미리보기를 만들 수 없어요. 글에는 링크로만 보여요.<div style={{ marginTop: 4, fontSize: 12 }}>{host}</div>
      </div>
    )
  }

  const showImg = p.image && imgFailed !== p.image
  return (
    <a data-lp="1" href={url} target="_blank" rel="noopener noreferrer nofollow ugc" style={box} onClick={editing ? e => e.preventDefault() : undefined}>
      {removeBtn}
      {showImg && (
        <div style={{ width: '100%', aspectRatio: '1.91 / 1', maxHeight: compact ? 200 : 270, background: 'var(--surface2)', overflow: 'hidden' }}>
          {/* 외부 이미지 — 우리 주소를 알리지 않게 referrer 를 빼고, 못 불러오면 이미지 칸을 접는다 */}
          <img src={p.image!} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setImgFailed(p.image)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}
      <div style={{ padding: '14px 18px 15px', borderTop: showImg ? '1px solid var(--border)' : 'none' }}>
        {p.title && <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>}
        {p.description && (
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</div>
        )}
        <div style={{ marginTop: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--green, #14B8A0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.siteName && p.siteName !== host ? `${p.siteName} · ${host}` : host}</div>
      </div>
    </a>
  )
}
