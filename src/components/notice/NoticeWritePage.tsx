'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getNoticeById, createNotice, updateNotice, uploadNoticeImage,
} from '@/services/noticeService'

function rgbToHex(v: string): string | null {
  const m = v.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!m) return null
  const h = (n: string) => Number(n).toString(16).padStart(2, '0')
  return '#' + h(m[1]) + h(m[2]) + h(m[3])
}

export default function NoticeWritePage() {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const sp = useSearchParams()
  const editId = sp.get('edit')
  const editorRef = useRef<HTMLDivElement>(null)

  const [title, setTitle] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [color, setColor] = useState('#E8006F')
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!editId) { setReady(true); return }
    getNoticeById(editId).then(n => {
      if (n) {
        setTitle(n.title)
        setIsPinned(n.is_pinned)
        if (editorRef.current) editorRef.current.innerHTML = n.content ?? ''
      }
      setReady(true)
    })
  }, [editId])

  const refreshActive = useCallback(() => {
    const el = editorRef.current
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!el || !sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return
    try {
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
      })
      const hex = rgbToHex(String(document.queryCommandValue('foreColor') || ''))
      if (hex) setColor(hex)
    } catch { /* noop */ }
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', refreshActive)
    return () => document.removeEventListener('selectionchange', refreshActive)
  }, [refreshActive])

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
    editorRef.current?.focus()
    refreshActive()
  }

  async function onPickImages(list: FileList | null) {
    if (!list) return
    for (const f of Array.from(list)) {
      const url = await uploadNoticeImage(f)
      if (url && editorRef.current) {
        editorRef.current.innerHTML += '<p><img src="' + url + '" style="max-width:100%;border-radius:10px;" /></p><p><br/></p>'
      }
    }
  }

  async function save() {
    if (!user || saving) return
    const html = editorRef.current?.innerHTML ?? ''
    const plain = (editorRef.current?.innerText ?? '').trim()
    if (!title.trim()) { setErr('제목을 입력해주세요'); return }
    if (!plain) { setErr('내용을 입력해주세요'); return }

    setSaving(true); setErr('')
    const ok = editId
      ? await updateNotice(editId, { title, content: html, is_pinned: isPinned })
      : await createNotice({ title, content: html, isPinned, userId: user.id })
    setSaving(false)

    if (ok) router.push('/support/notice')
    else setErr('저장에 실패했어요. 관리자 계정인지 확인해주세요.')
  }

  if (!ready) {
    return <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중…</div>
  }
  if (!isAdmin) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--muted)', marginBottom: 18 }}>공지는 관리자만 작성할 수 있어요.</p>
        <button onClick={() => router.push('/support/notice')} style={ghost}>공지사항으로</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px 80px' }}>
      <style>{`
        .nt-btn { height:34px; min-width:34px; display:inline-flex; align-items:center; justify-content:center;
          border:1px solid transparent; border-radius:7px; background:transparent; color:var(--text);
          font-size:14px; font-family:inherit; cursor:pointer; padding:0 8px; }
        .nt-btn:hover { background:var(--surface); border-color:var(--border); }
        .nt-editor:empty:before { content:attr(data-ph); color:var(--muted); }
        .nt-editor:focus { outline:none; border-color:var(--accent) !important; }
        .nt-editor blockquote { margin:10px 0; padding:8px 14px; border-left:3px solid var(--accent); color:var(--muted); }
        .nt-editor img { max-width:100%; border-radius:10px; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{editId ? '공지 수정' : '공지 작성'}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/support/notice')} style={ghost}>취소</button>
          <button onClick={save} disabled={saving} style={primary}>{saving ? '저장 중…' : editId ? '수정 완료' : '등록'}</button>
        </div>
      </div>

      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="제목을 입력하세요"
        style={{
          width: '100%', boxSizing: 'border-box', marginBottom: 12,
          padding: '14px 16px', fontSize: 18, fontWeight: 700, fontFamily: 'inherit',
          border: '1px solid var(--border)', borderRadius: 12,
          background: 'var(--surface)', color: 'var(--text)',
        }}
      />

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', padding: '6px 8px', background: 'var(--surface2)' }}>
          <label className="nt-btn" title="사진" style={{ cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 4.5-4.5 3 3L16 11l4 4.5" /></svg>
            <input type="file" accept="image/*" multiple onChange={e => onPickImages(e.target.files)} style={{ display: 'none' }} />
          </label>
          <button className="nt-btn" title="링크" onClick={() => { const u = window.prompt('링크 URL'); if (u) exec('createLink', u) }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></svg>
          </button>
          <Sep />
          <button className="nt-btn" title="인용구" onClick={() => exec('formatBlock', 'blockquote')} style={{ fontSize: 16 }}>&ldquo;</button>
          <button className="nt-btn" title="구분선" onClick={() => exec('insertHorizontalRule')}>―</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', padding: '6px 8px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <select onChange={e => { exec('fontSize', e.target.value); e.target.selectedIndex = 0 }} defaultValue="" style={tbSelect}>
            <option value="" disabled>크기</option>
            <option value="2">작게</option>
            <option value="3">보통</option>
            <option value="5">크게</option>
            <option value="6">더 크게</option>
          </select>
          <Sep />
          <button className="nt-btn" title="굵게" onClick={() => exec('bold')} style={{ fontWeight: 900, ...act(active.bold) }}>B</button>
          <button className="nt-btn" title="기울임" onClick={() => exec('italic')} style={{ fontStyle: 'italic', ...act(active.italic) }}>I</button>
          <button className="nt-btn" title="밑줄" onClick={() => exec('underline')} style={{ textDecoration: 'underline', ...act(active.underline) }}>U</button>
          <button className="nt-btn" title="취소선" onClick={() => exec('strikeThrough')} style={{ textDecoration: 'line-through', ...act(active.strikeThrough) }}>S</button>
          <label className="nt-btn" title="글자색" style={{ cursor: 'pointer', position: 'relative' }}>
            <span style={{ borderBottom: '3px solid ' + color, lineHeight: 1 }}>A</span>
            <input type="color" value={color} onChange={e => { setColor(e.target.value); exec('foreColor', e.target.value) }} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
          </label>
          <Sep />
          <button className="nt-btn" title="왼쪽 정렬" onClick={() => exec('justifyLeft')} style={act(active.justifyLeft)}><AlignIcon dir="left" /></button>
          <button className="nt-btn" title="가운데 정렬" onClick={() => exec('justifyCenter')} style={act(active.justifyCenter)}><AlignIcon dir="center" /></button>
          <button className="nt-btn" title="오른쪽 정렬" onClick={() => exec('justifyRight')} style={act(active.justifyRight)}><AlignIcon dir="right" /></button>
        </div>
      </div>

      <div
        ref={editorRef}
        className="nt-editor"
        contentEditable
        suppressContentEditableWarning
        data-ph="내용을 입력하세요."
        style={{ minHeight: 400, fontSize: 16, lineHeight: 1.8, color: 'var(--text)', padding: '16px 18px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}
      />

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 16, fontSize: 14, cursor: 'pointer' }}>
        <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        상단 고정
      </label>

      {err && <p style={{ color: 'var(--red, #e04343)', fontSize: 14, marginTop: 12 }}>{err}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button onClick={() => router.push('/support/notice')} style={ghost}>취소</button>
        <button onClick={save} disabled={saving} style={primary}>{saving ? '저장 중…' : editId ? '수정 완료' : '등록'}</button>
      </div>
    </div>
  )
}

function Sep() { return <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} /> }
function AlignIcon({ dir }: { dir: 'left' | 'center' | 'right' }) {
  const d = dir === 'left' ? 'M4 6h16M4 12h10M4 18h13' : dir === 'center' ? 'M4 6h16M7 12h10M6 18h12' : 'M4 6h16M10 12h10M7 18h13'
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d={d} /></svg>
}
function act(on?: boolean): React.CSSProperties {
  return on ? { background: 'var(--accent-l, rgba(232,0,111,.08))', borderColor: 'var(--accent)', color: 'var(--accent)' } : {}
}

const tbSelect: React.CSSProperties = {
  height: 34, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)',
  color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', padding: '0 6px',
}
const ghost: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--muted)', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}
const primary: React.CSSProperties = {
  padding: '10px 26px', borderRadius: 10, border: 'none',
  background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'inherit',
}