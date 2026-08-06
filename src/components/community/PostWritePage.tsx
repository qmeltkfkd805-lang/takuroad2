'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { ROUTES } from '@/lib/constants/routes'
import { getAllTagsForSelect, getMyRoutes } from '@/services/routeService'
import { createPost, updatePost, getPost, uploadPostImage } from '@/services/communityPostService'
import { getMyWorkRelationships } from '@/services/workRelationshipService'
import { createPoll } from '@/services/pollService'
import { Board, BOARDS, BOARD_FLAIRS, CREATION_BOARDS, boardMeta, NewPost, NewPoll } from '@/types/community-post'

type Tag = { id: string; name: string; slug: string }
const DRAFT_KEY = 'takuroad_community_draft'

const BOARD_TEMPLATES: Partial<Record<Board, string>> = {
  companion:
    '<div>📍 장소 : </div><div><br></div>' +
    '<div>📅 날짜 : </div><div><br></div>' +
    '<div>⏰ 시간 : </div><div><br></div>' +
    '<div>👥 모집 인원 : </div><div><br></div>' +
    '<div>🎯 목적 : </div><div>(팝업 / 카페 / 굿즈샵 / 행사)</div><div><br></div>' +
    '<div>📝 연락할 곳 : </div><div>(sns 또는 오픈채팅)</div>',
}

const FANART_AGREE = [
  '본인이 직접 그린/만든 창작물입니다.',
  '타인의 창작물을 무단으로 업로드하지 않았습니다.',
  'AI를 이용하지 않았습니다.',
  '신고가 접수될 경우 운영 정책에 따라 임시 숨김될 수 있습니다.',
]

export default function PostWritePage() {
  const { user, isAdmin } = useAuth()
  const isDesktop = useIsDesktop()
  const router = useRouter()
  const sp = useSearchParams()
  const lockTag = sp.get('lockTag') === '1'
  const editId = sp.get('edit')
  const editorRef = useRef<HTMLDivElement>(null)
  const tagBoxRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const [board, setBoard] = useState<Board>((sp.get('board') as Board) || 'free')
  const [tags, setTags] = useState<Tag[]>([])
  const [tagIds, setTagIds] = useState<string[]>(sp.get('tag') ? [sp.get('tag')!] : [])
  const [tagQuery, setTagQuery] = useState('')
  const [tagOpen, setTagOpen] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const [myWorks, setMyWorks] = useState<{ id: string; name: string }[]>([])   // 내 최애·관심 작품 (빠른 태그)

  const [title, setTitle] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [showOnWork, setShowOnWork] = useState(true)
  const [agree, setAgree] = useState([false, false, false, false])
  const [isNotice, setIsNotice] = useState(false)
  const [spoiler, setSpoiler] = useState(false)
  const [flair, setFlair] = useState<string | null>(null)
  const [noticeScope, setNoticeScope] = useState<'all' | Board>('all')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [hasDraft, setHasDraft] = useState(false)
  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [color, setColor] = useState('#E8006F')
  const [pollOpen, setPollOpen] = useState(false)
  const [tableOpen, setTableOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)   // 모바일: 등록 시 옵션 선택 모달
  const [pollData, setPollData] = useState<NewPoll | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)           // 모바일: 툴바 "더보기" 패널
  const [routePickOpen, setRoutePickOpen] = useState(false) // 내 루트 공유 — 루트 선택 모달
  const [myRoutes, setMyRoutes] = useState<{ id: string; title: string; share_token: string; cover_image_url: string | null; shopCount: number }[]>([])

  // 내 최애·관심 작품 — 작품 선택 아래 빠른 태그로 노출
  useEffect(() => {
    if (!user) { setMyWorks([]); return }
    getMyWorkRelationships(user.id)
      .then(rels => setMyWorks(rels.filter(r => r.affinity).map(r => ({ id: r.work.id, name: r.work.name }))))
      .catch(() => setMyWorks([]))
  }, [user])

  // 내가 만든 루트 — "내 루트 공유"에서 골라 글에 삽입
  useEffect(() => {
    if (!user) { setMyRoutes([]); return }
    getMyRoutes(user.id)
      .then(rs => setMyRoutes((rs as any[]).map(r => ({ id: r.id, title: r.title, share_token: r.share_token, cover_image_url: r.cover_image_url ?? null, shopCount: r.route_shops?.length ?? 0 }))))
      .catch(() => setMyRoutes([]))
  }, [user])

  const meta = boardMeta(board)!
  const selectedTags = tags.filter(t => tagIds.includes(t.id))
  const workRequired = meta.tagRequired || board === 'exchange'
  const toggleTag = (id: string) => setTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const isFanart = board === 'fanart' || board === 'fancraft'
  const allAgreed = !isFanart || agree.every(Boolean)

  useEffect(() => { getAllTagsForSelect().then((t) => setTags(t as Tag[])).catch(() => setTags([])) }, [])
  useEffect(() => {
    if (editId) return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) { setHasDraft(true); setShowDraftBanner(true) }
    } catch { /* noop */ }
  }, [editId])
  useEffect(() => {
    if (editId) return
    applyBoardTemplate(board)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!editId || !user) return
    getPost(editId, user.id).then(pp => {
      if (!pp) return
      setBoard(pp.board); setTagIds(pp.tagIds?.length ? pp.tagIds : (pp.tagId ? [pp.tagId] : [])); setTitle(pp.title ?? ''); setImages(pp.images ?? []); setSpoiler(pp.isSpoiler); setFlair(pp.flair ?? null)
      if (editorRef.current) editorRef.current.innerHTML = pp.content ?? ''
    }).catch(() => {})
  }, [editId, user?.id])
  useEffect(() => {
    if (!tagOpen) return
    const onDown = (e: MouseEvent) => { if (tagBoxRef.current && !tagBoxRef.current.contains(e.target as Node)) setTagOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [tagOpen])

  useEffect(() => {
    if (!boardOpen) return
    const onDown = (e: MouseEvent) => { if (boardRef.current && !boardRef.current.contains(e.target as Node)) setBoardOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [boardOpen])

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
      const c = document.queryCommandValue('foreColor')
      const hex = rgbToHex(String(c || ''))
      if (hex) setColor(hex)
    } catch { /* noop */ }
  }, [])
  useEffect(() => {
    document.addEventListener('selectionchange', refreshActive)
    return () => document.removeEventListener('selectionchange', refreshActive)
  }, [refreshActive])

  const exec = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); editorRef.current?.focus(); refreshActive() }

  // 인용구 안에서 엔터 → 인용구를 빠져나와 일반 문단으로 (반복 방지). 여러 줄은 Shift+Enter로.
  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    let node: Node | null = sel.anchorNode
    let bq: HTMLElement | null = null
    while (node && node !== editorRef.current) {
      if (node.nodeType === 1 && (node as HTMLElement).tagName === 'BLOCKQUOTE') { bq = node as HTMLElement; break }
      node = node.parentNode
    }
    if (!bq || !bq.parentNode) return
    e.preventDefault()
    const p = document.createElement('div')
    p.appendChild(document.createElement('br'))
    bq.parentNode.insertBefore(p, bq.nextSibling)
    const range = document.createRange()
    range.setStart(p, 0)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    refreshActive()
  }

  const onPickImages = async (list: FileList | null) => {
    if (!user || !list) return
    for (const f of Array.from(list)) {
      const url = await uploadPostImage(f, user.id)
      if (url) {
        setImages(prev => [...prev, url])
        if (editorRef.current) editorRef.current.innerHTML += `<p><img src="${url}" style="max-width:100%;border-radius:10px;" /></p><p><br/></p>`
      }
    }
  }

  const onPickVideo = async (list: FileList | null) => {
    if (!user || !list) return
    for (const f of Array.from(list)) {
      const url = await uploadPostImage(f, user.id)
      if (url && editorRef.current) editorRef.current.innerHTML += `<p><video src="${url}" controls playsinline style="max-width:100%;border-radius:10px;"></video></p><p><br/></p>`
    }
  }
  const onPickFile = async (list: FileList | null) => {
    if (!user || !list) return
    for (const f of Array.from(list)) {
      const url = await uploadPostImage(f, user.id)
      if (url && editorRef.current) editorRef.current.innerHTML += `<p><a href="${url}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;gap:6px;color:#e8006f;font-weight:700;text-decoration:none;">📎 ${f.name}</a></p><p><br/></p>`
    }
  }

  const appendBlock = (html: string) => { if (editorRef.current) { editorRef.current.innerHTML += html + '<p><br/></p>'; editorRef.current.focus() } }
  // 내가 만든 루트를 본문에 카드형 링크로 삽입
  const insertRoute = (r: { title: string; share_token: string; cover_image_url: string | null; shopCount: number }) => {
    const routeSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h6a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8h6"/></svg>`
    const cover = r.cover_image_url
      ? `<img src="${escapeHtml(r.cover_image_url)}" style="width:60px;height:60px;border-radius:10px;object-fit:cover;flex:none;" />`
      : `<span style="width:60px;height:60px;border-radius:10px;background:#f3f3f5;display:inline-flex;align-items:center;justify-content:center;color:#999;flex:none;">${routeSvg}</span>`
    appendBlock(
      `<a href="/route/${escapeHtml(r.share_token)}" contenteditable="false" style="display:flex;align-items:center;gap:12px;border:1px solid #eee;border-radius:14px;padding:12px 14px;margin:8px 0;text-decoration:none;color:inherit;background:#fafafa;">`
      + cover
      + `<span style="min-width:0;"><span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;color:#e8006f;">${routeSvg.replace('width="20" height="20"', 'width="13" height="13"')} 내 루트</span>`
      + `<span style="display:block;font-weight:800;font-size:15px;color:#111;margin-top:2px;">${escapeHtml(r.title)}</span>`
      + `<span style="display:block;font-size:12px;color:#888;margin-top:2px;">${r.shopCount}개 장소 · 눌러서 루트 보기</span></span></a>`
    )
    setRoutePickOpen(false)
    setMoreOpen(false)
  }
  const applyBoardTemplate = (b: Board) => {
    const tmpl = BOARD_TEMPLATES[b]
    const el = editorRef.current
    if (!tmpl || !el) return
    const empty = !el.innerText.trim() && !el.querySelector('img,video,a')
    if (empty) el.innerHTML = tmpl
  }
  const insertTable = () => setTableOpen(true)
  const insertPoll = () => setPollOpen(true)

  const collectImages = (html: string): string[] => {
    const out: string[] = []
    const re = /<img[^>]+src="([^"]+)"/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html))) out.push(m[1])
    return out
  }

  // ── 임시저장 ──
  const saveDraft = () => {
    const html = editorRef.current?.innerHTML ?? ''
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ board, tagIds, title, html, images, poll: pollData, spoiler, flair, savedAt: Date.now() }))
      setHasDraft(true); setShowDraftBanner(false)
      window.alert('임시저장되었어요.')
    } catch { window.alert('임시저장에 실패했어요.') }
  }
  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return
      const d = JSON.parse(raw)
      setBoard(d.board ?? 'free'); setTagIds(d.tagIds ?? []); setTitle(d.title ?? ''); setImages(d.images ?? []); setPollData(d.poll ?? null); setSpoiler(d.spoiler ?? false); setFlair(d.flair ?? null)
      if (editorRef.current) editorRef.current.innerHTML = d.html ?? ''
      setShowDraftBanner(false)
    } catch { /* noop */ }
  }
  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }; setHasDraft(false); setShowDraftBanner(false) }

  const filteredTags = tagQuery.trim()
    ? tags.filter(t => t.name.toLowerCase().includes(tagQuery.trim().toLowerCase())).slice(0, 40)
    : tags.slice(0, 40)

  const submit = async () => {
    if (!user) { router.push(ROUTES.login); return }
    const html = editorRef.current?.innerHTML ?? ''
    const plain = (editorRef.current?.innerText ?? '').trim()
    const imgs = collectImages(html)
    const notice = isAdmin && isNotice
    if (!notice) {
      if (workRequired && tagIds.length === 0) { setErr(`${meta.label}은(는) 작품을 최소 1개 선택해야 해요.`); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
      if (meta.imageRequired && imgs.length === 0) { setErr('이미지를 1장 이상 첨부해주세요.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    }
    if (!title.trim() && !plain && imgs.length === 0 && !pollData) { setErr('제목이나 내용을 입력해주세요.'); return }
    if (isFanart && !notice && !allAgreed) { setErr('업로드 전 확인 항목에 모두 동의해주세요.'); return }

    setErr(''); setSaving(true)
    const finalBoard: Board = (notice && noticeScope !== 'all') ? noticeScope : board
    if (editId) {
      const ok = await updatePost(editId, { board: finalBoard, tagIds, title, content: html, images: imgs, showOnWork, spoiler, flair: BOARD_FLAIRS[finalBoard] ? flair : null })
      setSaving(false)
      if (ok) { clearDraft(); router.push(`/community/${editId}`) } else setErr('수정에 실패했어요.')
      return
    }
    const payload: NewPost = { board: finalBoard, tagIds, title, content: html, images: imgs, showOnWork, isNotice: notice, noticeAll: notice && noticeScope === 'all', spoiler, flair: BOARD_FLAIRS[finalBoard] ? flair : null }
    const id = await createPost(user.id, payload)
    if (id && pollData) { await createPoll(id, pollData) }
    setSaving(false)
    if (id) { clearDraft(); router.push('/community') }
    else setErr('등록에 실패했어요. 잠시 후 다시 시도해주세요.')
  }

  const standaloneBoards = BOARDS.filter(b => !CREATION_BOARDS.includes(b.value))
  const creationBoards = BOARDS.filter(b => CREATION_BOARDS.includes(b.value))

  // 설정 필드 — PC는 옆 패널, 모바일은 등록 모달에서 재사용
  const settingsFields = (
    <>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13.5, cursor: 'pointer', lineHeight: 1.4 }}>
        <input type="checkbox" checked={spoiler} onChange={() => setSpoiler(v => !v)} style={{ marginTop: 2, accentColor: 'var(--accent)' }} />
        <span>🚨 스포일러 포함 (목록에서 &lsquo;스포주의&rsquo; 표시)</span>
      </label>
      {tagIds.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13.5, cursor: 'pointer', lineHeight: 1.4 }}>
          <input type="checkbox" checked={showOnWork} onChange={() => setShowOnWork(v => !v)} style={{ marginTop: 2, accentColor: 'var(--accent)' }} />
          <span>작품 상세 페이지에도 함께 등록</span>
        </label>
      )}
      {isAdmin && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13.5, cursor: 'pointer', lineHeight: 1.4 }}>
          <input type="checkbox" checked={isNotice} onChange={() => setIsNotice(v => !v)} style={{ marginTop: 2, accentColor: 'var(--accent)' }} />
          <span>📌 공지로 등록 (상단 고정)</span>
        </label>
      )}
      {isAdmin && isNotice && (
        <div style={{ paddingLeft: 24 }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 5 }}>공지 노출 게시판</div>
          <select value={noticeScope} onChange={e => setNoticeScope(e.target.value as ('all' | Board))} style={{ ...selectStyle, width: '100%', boxSizing: 'border-box', padding: '9px 12px' }}>
            <option value="all">전체 게시판</option>
            {BOARDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>공지는 사진·작품 없이 등록할 수 있어요.</div>
        </div>
      )}
      {tagIds.length === 0 && !isAdmin && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>작품을 선택하면 추가 옵션이 나와요.</div>}
    </>
  )

  // 팬아트 등록 동의 체크박스 — PC는 본문 아래 인라인, 모바일은 등록 모달에서 재사용
  const fanartAgreeFields = FANART_AGREE.map((label, i) => (
    <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, lineHeight: 1.45, cursor: 'pointer' }}>
      <input type="checkbox" checked={agree[i]} onChange={() => setAgree(prev => prev.map((v, idx) => (idx === i ? !v : v)))} style={{ marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }} />
      <span>{label}</span>
    </label>
  ))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <style>{`
        .taku-editor:empty:before{content:attr(data-ph);color:var(--muted)}
        .taku-editor{outline:none}
        .taku-editor img{max-width:100%}
        .taku-editor blockquote{border-left:3px solid var(--accent);margin:8px 0;padding:4px 14px;color:var(--muted)}
        .taku-write-grid{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:24px}
        .tb-btn{width:34px;height:34px;border:none;background:none;border-radius:7px;cursor:pointer;color:var(--text);display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800}
        .tb-btn:hover{background:var(--surface2)}
        @media (hover:none) and (pointer:coarse) and (max-width:900px){
          .taku-write-grid{grid-template-columns:1fr}
          .pw-body{ padding: 4px 16px 150px !important; }
          /* 네모칸 제거 — 게시판·작품·본문을 밑줄 스타일로, 게시판 아래 작품 세로 배치 */
          .pw-catrow{ flex-direction: column !important; gap: 0 !important; }
          .pw-catrow .pw-select-btn, .pw-catrow input{ border:none !important; border-bottom:1px solid var(--border) !important; border-radius:0 !important; background:none !important; padding:15px 2px !important; font-size:16px !important; width:100% !important; box-sizing:border-box !important; }
          .pw-catrow > div{ min-width:0 !important; flex:none !important; }
          .pw-editor{ border:none !important; border-radius:0 !important; padding:14px 2px !important; max-height:none !important; }              /* 하단 고정 툴바 공간 확보 */
          .pw-toolbar{ position: fixed !important; left:0; right:0; bottom:0; top:auto !important; margin:0 !important; border-radius:0 !important; border-left:none !important; border-right:none !important; z-index:40 !important; padding-bottom: env(safe-area-inset-bottom); }
          .pw-toolbar > div{ flex-wrap: nowrap !important; overflow-x: auto; scrollbar-width: none; }
          .pw-toolbar > div::-webkit-scrollbar{ display:none; }
          .pw-tb-format{ display:none !important; }   /* 모바일: 글꼴·크기·서식 줄 숨김 */
          .pw-tb-extra{ display:none !important; }     /* 모바일: 툴바 부가 버튼은 더보기 패널로 이동 */
          .pw-more-btn{ display:inline-flex !important; }  /* 모바일: 더보기(…) 노출 */
          /* 더보기 패널 — 사진·동영상·더보기 줄 아래에 그리드로 펼쳐짐 (툴바 줄은 그대로 유지) */
          .pw-more-panel{ display:grid !important; grid-template-columns:repeat(4,1fr); gap:6px 8px; padding:14px 12px 12px; border-top:1px solid var(--border); background:var(--surface); overflow:visible !important; flex-wrap:wrap !important; }
          .taku-editor a[contenteditable="false"]{ user-select:none; }
        }
      `}</style>

      {/* 상단 바 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} aria-label={isDesktop ? '뒤로' : '닫기'} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)', display: 'flex' }}>
            {isDesktop
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>}
          </button>
          {isDesktop && <span style={{ fontSize: 19, fontWeight: 900 }}>{editId ? '글 수정' : '글쓰기'}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={saveDraft} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            임시저장 <span style={{ color: 'var(--muted)', fontWeight: 800 }}>{hasDraft ? 1 : 0}</span>
          </button>
          <button onClick={() => { if (isDesktop) submit(); else setSettingsOpen(true) }} disabled={saving || (isDesktop && isFanart && !allAgreed)} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: (saving || (isDesktop && isFanart && !allAgreed)) ? 'var(--border)' : 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: (saving || (isDesktop && isFanart && !allAgreed)) ? 'default' : 'pointer', fontFamily: 'inherit' }}>{saving ? (editId ? '수정 중…' : '등록 중…') : (editId ? '수정' : '등록')}</button>
        </div>
      </div>

      <div className="pw-body" style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 24px 80px' }}>
        {showDraftBanner && hasDraft && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--surface2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>
            <span>임시저장된 글이 있어요. 이어서 작성할까요?</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button onClick={loadDraft} style={{ border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13, padding: '7px 14px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>불러오기</button>
              <button onClick={clearDraft} style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontSize: 13, padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
            </span>
          </div>
        )}
        {err && <div style={{ fontSize: 14, color: '#c0392b', background: 'rgba(239,90,90,.08)', borderRadius: 10, padding: '11px 14px', marginBottom: 16 }}>{err}</div>}

        <div className="taku-write-grid">
          {/* 에디터 */}
          <div style={{ minWidth: 0 }}>
            {/* 게시판 + 작품 (모바일: 세로로 쌓고 밑줄 스타일) */}
            <div className="pw-catrow" style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div ref={boardRef} style={{ position: 'relative' }}>
                <button className="pw-select-btn" onClick={() => setBoardOpen(o => !o)} style={{ ...selectStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer', minWidth: 160, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}>
                  {meta.label}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: boardOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {boardOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 40, marginTop: 6, minWidth: 200, maxHeight: 320, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,.16)', padding: 6 }}>
                    {standaloneBoards.map(b => (
                      <button key={b.value} onClick={() => { setBoard(b.value); setFlair(null); applyBoardTemplate(b.value); setBoardOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: board === b.value ? 'var(--accent-l, rgba(232,0,111,.1))' : 'none', color: board === b.value ? 'var(--accent)' : 'var(--text)', padding: '11px 13px', borderRadius: 8, fontSize: 14.5, fontWeight: board === b.value ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit' }}>{b.label}</button>
                    ))}
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 800, padding: '10px 13px 4px' }}>창작게시판</div>
                    {creationBoards.map(b => (
                      <button key={b.value} onClick={() => { setBoard(b.value); setFlair(null); applyBoardTemplate(b.value); setBoardOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: board === b.value ? 'var(--accent-l, rgba(232,0,111,.1))' : 'none', color: board === b.value ? 'var(--accent)' : 'var(--text)', padding: '11px 13px 11px 26px', borderRadius: 8, fontSize: 14, fontWeight: board === b.value ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit' }}>ㄴ {b.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <div ref={tagBoxRef} style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                {!lockTag && (
                  <div style={{ position: 'relative' }}>
                    <input value={tagQuery} onChange={e => { setTagQuery(e.target.value); setTagOpen(true) }} placeholder={workRequired ? '작품 검색 (필수 · 여러 개 가능)' : '작품 검색 (여러 개 가능)'} style={{ ...selectStyle, width: '100%', boxSizing: 'border-box', borderColor: workRequired && tagIds.length === 0 ? 'var(--accent)' : 'var(--border)' }} />
                    {tagOpen && tagQuery.trim() && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4, maxHeight: 240, overflow: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}>
                        {filteredTags.filter(t => !tagIds.includes(t.id)).length === 0 ? <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--muted)' }}>결과 없음</div>
                          : filteredTags.filter(t => !tagIds.includes(t.id)).map(t => <button key={t.id} onClick={() => { toggleTag(t.id); setTagQuery('') }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text)' }}>{t.name}</button>)}
                      </div>
                    )}
                  </div>
                )}
                {!lockTag && myWorks.filter(w => !tagIds.includes(w.id)).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>내 최애·관심 작품</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {myWorks.filter(w => !tagIds.includes(w.id)).map(w => (
                        <button key={w.id} onClick={() => toggleTag(w.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13, padding: '6px 12px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit' }}># {w.name}</button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedTags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {selectedTags.map(t => (
                      <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent-l, rgba(232,0,111,.12))', color: 'var(--accent)', fontWeight: 700, fontSize: 13, padding: '5px 11px', borderRadius: 9999 }}>
                        # {t.name}
                        {!lockTag && <button onClick={() => toggleTag(t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 15, lineHeight: 1, fontFamily: 'inherit', padding: 0 }}>×</button>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {BOARD_FLAIRS[board] && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>말머리</span>
                {BOARD_FLAIRS[board]!.map(f => (
                  <button key={f} onClick={() => setFlair(flair === f ? null : f)} style={{ padding: '6px 14px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, border: `1.5px solid ${flair === f ? 'var(--accent)' : 'var(--border)'}`, background: flair === f ? 'var(--accent)' : 'var(--surface)', color: flair === f ? '#fff' : 'var(--text)' }}>{f}</button>
                ))}
              </div>
            )}

            {/* 제목 */}
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="제목을 입력해 주세요" style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', padding: '12px 2px', fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />

            {/* 툴바 — 모바일에선 하단 고정 */}
            <div className="pw-toolbar" style={{ border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12, overflow: 'hidden', position: 'sticky', top: 62, zIndex: 5, background: 'var(--surface)' }}>
              {/* 1행: 삽입 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', padding: '6px 8px' }}>
                <label className="tb-btn" title="사진" style={{ cursor: 'pointer' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 4.5-4.5 3 3L16 11l4 4.5" /></svg>
                  <input type="file" accept="image/*" multiple onChange={e => onPickImages(e.target.files)} style={{ display: 'none' }} />
                </label>
                <label className="tb-btn" title="동영상" style={{ cursor: 'pointer' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="6" width="14" height="12" rx="2" /><path d="m16.5 10 5-2.5v9L16.5 14" /></svg>
                  <input type="file" accept="video/*" multiple onChange={e => onPickVideo(e.target.files)} style={{ display: 'none' }} />
                </label>
                <span className="pw-tb-extra" style={{ display: 'contents' }}>
                <label className="tb-btn" title="파일" style={{ cursor: 'pointer' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.5 12.5 21a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10.1 18.7a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" /></svg>
                  <input type="file" multiple onChange={e => onPickFile(e.target.files)} style={{ display: 'none' }} />
                </label>
                <button className="tb-btn" title="링크" onClick={() => { const u = window.prompt('링크 URL'); if (u) exec('createLink', u) }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></svg>
                </button>
                <Sep />
                <button className="tb-btn" title="투표" onClick={insertPoll}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 20v-6M12 20V4M18 20v-9" /></svg>
                </button>
                <button className="tb-btn" title="표" onClick={insertTable}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16M15 4v16" /></svg>
                </button>
                <Sep />
                <button className="tb-btn" title="인용구" onClick={() => exec('formatBlock', 'blockquote')} style={{ fontSize: 16 }}>&ldquo;</button>
                <button className="tb-btn" title="구분선" onClick={() => exec('insertHorizontalRule')}>―</button>
                </span>
                {/* 📱 모바일 전용: 더보기 (…) — 투표·링크·파일·인용구·내 루트 공유 */}
                <button className="pw-more-btn tb-btn" title="더보기" onClick={() => setMoreOpen(o => !o)} style={{ display: 'none', ...(moreOpen ? { background: 'rgba(232,0,111,.14)', color: 'var(--accent)' } : {}) }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                </button>
              </div>
              {/* 2행: 글자 서식 (모바일에선 숨김) */}
              <div className="pw-tb-format" style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', padding: '6px 8px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
                <select onChange={e => { exec('fontName', e.target.value); e.target.selectedIndex = 0 }} defaultValue="" style={{ ...tbSelect }}>
                  <option value="" disabled>글꼴</option>
                  <option value="sans-serif">기본서체</option>
                  <option value="'Nanum Gothic', sans-serif">나눔고딕</option>
                  <option value="'Malgun Gothic', sans-serif">맑은 고딕</option>
                  <option value="Dotum, sans-serif">돋움</option>
                  <option value="Gulim, sans-serif">굴림</option>
                  <option value="Batang, serif">바탕</option>
                </select>
                <select onChange={e => { exec('fontSize', e.target.value); e.target.selectedIndex = 0 }} defaultValue="" style={{ ...tbSelect }}>
                  <option value="" disabled>크기</option>
                  <option value="2">작게</option>
                  <option value="3">보통</option>
                  <option value="5">크게</option>
                  <option value="6">더 크게</option>
                </select>
                <Sep />
                <button className="tb-btn" title="굵게" onClick={() => exec('bold')} style={{ fontWeight: 900, ...act(active.bold) }}>B</button>
                <button className="tb-btn" title="기울임" onClick={() => exec('italic')} style={{ fontStyle: 'italic', ...act(active.italic) }}>I</button>
                <button className="tb-btn" title="밑줄" onClick={() => exec('underline')} style={{ textDecoration: 'underline', ...act(active.underline) }}>U</button>
                <button className="tb-btn" title="취소선" onClick={() => exec('strikeThrough')} style={{ textDecoration: 'line-through', ...act(active.strikeThrough) }}>S</button>
                <label className="tb-btn" title="글자색" style={{ cursor: 'pointer', position: 'relative' }}>
                  <span style={{ borderBottom: `3px solid ${color}`, lineHeight: 1 }}>A</span>
                  <input type="color" value={color} onChange={e => { setColor(e.target.value); exec('foreColor', e.target.value) }} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                </label>
                <Sep />
                <button className="tb-btn" title="왼쪽 정렬" onClick={() => exec('justifyLeft')} style={act(active.justifyLeft)}><AlignIcon dir="left" /></button>
                <button className="tb-btn" title="가운데 정렬" onClick={() => exec('justifyCenter')} style={act(active.justifyCenter)}><AlignIcon dir="center" /></button>
                <button className="tb-btn" title="오른쪽 정렬" onClick={() => exec('justifyRight')} style={act(active.justifyRight)}><AlignIcon dir="right" /></button>
              </div>
              {/* 📱 더보기 패널 — 툴바(사진·동영상·더보기 줄) 아래에 펼쳐짐 (모바일 전용) */}
              {moreOpen && (
                <div className="pw-more-panel">
                  <MoreItem label="투표" onClick={() => { setMoreOpen(false); insertPoll() }} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 20v-6M12 20V4M18 20v-9" /></svg>} />
                  <MoreItem label="링크" onClick={() => { setMoreOpen(false); const u = window.prompt('링크 URL'); if (u) exec('createLink', u) }} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></svg>} />
                  <label style={moreItemStyle}>
                    <span style={moreIconStyle}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.5 12.5 21a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10.1 18.7a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" /></svg></span>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>파일</span>
                    <input type="file" multiple onChange={e => { onPickFile(e.target.files); setMoreOpen(false) }} style={{ display: 'none' }} />
                  </label>
                  <MoreItem label="인용구" onClick={() => { setMoreOpen(false); exec('formatBlock', 'blockquote') }} icon={<span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>&ldquo;</span>} />
                  <MoreItem label="표" onClick={() => { setMoreOpen(false); insertTable() }} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16M15 4v16" /></svg>} />
                  <MoreItem label="구분선" onClick={() => { setMoreOpen(false); exec('insertHorizontalRule') }} icon={<span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>―</span>} />
                  <MoreItem label="내 루트" onClick={() => { setMoreOpen(false); setRoutePickOpen(true) }} icon={<RouteIcon />} />
                </div>
              )}
            </div>

            {/* 본문 */}
            <div ref={editorRef} className="taku-editor pw-editor" contentEditable suppressContentEditableWarning data-ph="내용을 입력하세요." onKeyDown={onEditorKeyDown}
              style={{ minHeight: 340, maxHeight: '55vh', overflowY: 'auto', fontSize: 16, lineHeight: 1.7, color: 'var(--text)', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 12 }} />

            {pollData && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--muted)' }}>투표 (글 맨 아래에 표시됩니다)</span>
                  <button onClick={() => setPollData(null)} style={{ border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12.5, textDecoration: 'underline', fontFamily: 'inherit' }}>투표 삭제</button>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', background: 'var(--surface2)' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>📊 {pollData.title}</div>
                  {pollData.options.filter(Boolean).map((op, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 9, marginBottom: 6, background: 'var(--surface)' }}>
                      <span style={{ width: 15, height: 15, border: '2px solid var(--accent)', borderRadius: pollData.multi ? 4 : 9999, flex: 'none' }} />{op}
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    {[pollData.multi ? '복수 선택' : '단일 선택', pollData.anonymous ? '무기명' : '기명', pollData.viewMode === 'after' ? '참여 후 공개' : pollData.viewMode === 'ended' ? '종료 후 공개' : '상시 공개'].join(' · ')}
                    {pollData.endMode === 'date' && pollData.endAt ? ` · ~${pollData.endAt}` : pollData.endMode === 'count' && pollData.maxParticipants ? ` · ${pollData.maxParticipants}명까지` : ''}
                  </div>
                </div>
              </div>
            )}

            {/* 팬아트 동의 — PC만 인라인. 모바일은 등록 모달에서 */}
            {isFanart && isDesktop && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 12, marginTop: 18 }}>
                {fanartAgreeFields}
              </div>
            )}
          </div>

          {/* 설정 사이드바 — PC만. 모바일은 등록 시 모달로 */}
          {isDesktop && (
            <aside className="taku-write-side">
              <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 900 }}>설정</div>
                {settingsFields}
              </div>
            </aside>
          )}
        </div>
      </div>
      {pollOpen && <PollModal onClose={() => setPollOpen(false)} onConfirm={data => { setPollData(data); setPollOpen(false) }} />}
      {tableOpen && <TableModal onClose={() => setTableOpen(false)} onConfirm={html => { appendBlock(html); setTableOpen(false) }} />}

      {/* 📱 등록 옵션 모달 (모바일: 등록 누르면 뜸) */}
      {settingsOpen && (
        <div onClick={() => setSettingsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '20px 18px calc(18px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '82vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>{editId ? '수정 옵션' : '등록 옵션'}</div>
            {settingsFields}
            {isFanart && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>창작게시판 등록 동의</div>
                {fanartAgreeFields}
              </div>
            )}
            {isFanart && !allAgreed && <div style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700 }}>모든 동의 항목에 체크해야 등록할 수 있어요.</div>}
            {err && <div style={{ fontSize: 13, color: '#c0392b', background: 'rgba(239,90,90,.08)', borderRadius: 10, padding: '10px 12px' }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setSettingsOpen(false)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={submit} disabled={saving || (isFanart && !allAgreed)} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: (saving || (isFanart && !allAgreed)) ? 'var(--border)' : 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: (saving || (isFanart && !allAgreed)) ? 'default' : 'pointer', fontFamily: 'inherit' }}>{saving ? (editId ? '수정 중…' : '등록 중…') : (editId ? '수정' : '등록')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 📱 내 루트 공유 — 루트 선택 모달 */}
      {routePickOpen && (
        <div onClick={() => setRoutePickOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 3100, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '18px 18px calc(16px + env(safe-area-inset-bottom))', maxHeight: '78vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 900 }}>내 루트 공유</span>
              <button onClick={() => setRoutePickOpen(false)} aria-label="닫기" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>내가 만든 루트를 골라 글에 넣을 수 있어요.</div>
            {myRoutes.length === 0 ? (
              <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>아직 만든 루트가 없어요.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {myRoutes.map(r => (
                  <button key={r.id} onClick={() => insertRoute(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, padding: '10px 12px', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {r.cover_image_url
                      ? <img src={r.cover_image_url} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flex: 'none' }} />
                      : <span style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--surface2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: 'var(--muted)' }}><RouteIcon /></span>}
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 800, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || '제목 없는 루트'}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{r.shopCount}개 장소</span>
                    </span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="m9 18 6-6-6-6" /></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const moreIconStyle: React.CSSProperties = { width: 46, height: 46, borderRadius: 14, background: 'var(--surface2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }
const moreItemStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', padding: '6px 0' }
function RouteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h6a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8h6" />
    </svg>
  )
}
function MoreItem({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={moreItemStyle}>
      <span style={moreIconStyle}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
    </button>
  )
}

function act(on?: boolean): React.CSSProperties {
  return on ? { background: 'rgba(232,0,111,.14)', color: 'var(--accent)' } : {}
}
function rgbToHex(rgb: string): string | null {
  if (rgb.startsWith('#')) return rgb
  const m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return null
  const h = (n: string) => Number(n).toString(16).padStart(2, '0')
  return `#${h(m[1])}${h(m[2])}${h(m[3])}`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function TableModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (html: string) => void }) {
  const [rows, setRows] = useState(4)
  const [cols, setCols] = useState(4)
  const [bStyle, setBStyle] = useState('solid')
  const [bWidth, setBWidth] = useState(1)
  const [bColor, setBColor] = useState('#cccccc')
  const [cellBg, setCellBg] = useState('#ffffff')
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null)

  const MAXR = 8, MAXC = 8
  const r = Math.max(1, Math.min(20, rows || 1))
  const c = Math.max(1, Math.min(10, cols || 1))
  const selR = hover ? hover.r : Math.min(r, MAXR)
  const selC = hover ? hover.c : Math.min(c, MAXC)

  const apply = () => {
    const border = bStyle === 'none' ? 'none' : `${bWidth}px ${bStyle} ${bColor}`
    let t = '<table style="border-collapse:collapse;width:100%;margin:8px 0;">'
    for (let i = 0; i < r; i++) { t += '<tr>'; for (let j = 0; j < c; j++) t += `<td style="border:${border};padding:8px;background:${cellBg};min-width:40px;">&nbsp;</td>`; t += '</tr>' }
    onConfirm(t + '</table>')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, maxWidth: 420, width: '100%', maxHeight: '92vh', overflow: 'auto', padding: '20px 22px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 18 }}>
          <span style={{ fontSize: 18, fontWeight: 900 }}>표 삽입</span>
          <button onClick={onClose} aria-label="닫기" style={{ position: 'absolute', right: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 20, marginBottom: 6, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>행 <input type="number" min={1} max={20} value={rows} onChange={e => setRows(Number(e.target.value))} style={numInp} /></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>열 <input type="number" min={1} max={10} value={cols} onChange={e => setCols(Number(e.target.value))} style={numInp} /></label>
          </div>
          <div onMouseLeave={() => setHover(null)} style={{ display: 'grid', gridTemplateColumns: `repeat(${MAXC}, 18px)`, gridAutoRows: '18px', gap: 2 }}>
            {Array.from({ length: MAXR * MAXC }).map((_, idx) => {
              const i = Math.floor(idx / MAXC), j = idx % MAXC
              const on = i < selR && j < selC
              return <div key={idx} onMouseEnter={() => setHover({ r: i + 1, c: j + 1 })} onClick={() => { setRows(i + 1); setCols(j + 1) }} style={{ width: 18, height: 18, borderRadius: 3, border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'var(--surface2)', cursor: 'pointer' }} />
            })}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>{selR} × {selC}</div>

        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>속성 직접입력</div>
        <div style={{ marginBottom: 16 }}>
          <Row label="테두리스타일">
            <select value={bStyle} onChange={e => setBStyle(e.target.value)} style={pollSelect}>
              <option value="solid">─── 실선</option>
              <option value="dashed">─ ─ 파선</option>
              <option value="dotted">· · · 점선</option>
              <option value="double">═══ 이중선</option>
              <option value="none">없음</option>
            </select>
          </Row>
          <Row label="테두리두께"><input type="number" min={1} max={10} value={bWidth} onChange={e => setBWidth(Number(e.target.value))} style={numInp} /></Row>
          <Row label="테두리색"><ColorField value={bColor} onChange={setBColor} /></Row>
          <Row label="셀 배경색"><ColorField value={cellBg} onChange={setCellBg} /></Row>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={apply} style={{ padding: '11px 26px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>적용</button>
          <button onClick={onClose} style={{ padding: '11px 22px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input value={value} onChange={e => onChange(e.target.value)} style={{ width: 90, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }} />
      <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: 30, height: 28, border: '1px solid var(--border)', borderRadius: 6, padding: 0, cursor: 'pointer', background: 'none' }} />
    </div>
  )
}

function PollModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (poll: NewPoll) => void }) {
  const [title, setTitle] = useState('')
  const [options, setOptions] = useState(['', '', ''])
  const [multi, setMulti] = useState(false)
  const [anon, setAnon] = useState(true)
  const [viewMode, setViewMode] = useState<'after' | 'always' | 'ended'>('after')
  const [sortMode, setSortMode] = useState<'number' | 'votes'>('number')
  const [endMode, setEndMode] = useState<'date' | 'count' | 'none'>('none')
  const [endValue, setEndValue] = useState('')

  const setOpt = (i: number, v: string) => setOptions(prev => prev.map((x, idx) => (idx === i ? v : x)))
  const addOpt = () => setOptions(prev => (prev.length >= 15 ? prev : [...prev, '']))
  const removeOpt = (i: number) => setOptions(prev => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev))
  const needsEnd = viewMode === 'ended'
  const endOk = !needsEnd || (endMode !== 'none' && endValue.trim().length > 0)
  const valid = title.trim().length > 0 && options.filter(o => o.trim()).length >= 2 && endOk

  const confirm = () => {
    if (!valid) return
    onConfirm({
      title: title.trim(),
      multi, anonymous: anon, viewMode, sortMode, endMode,
      endAt: endMode === 'date' ? (endValue.trim() || null) : null,
      maxParticipants: endMode === 'count' ? (Number(endValue) || null) : null,
      options: options.map(o => o.trim()).filter(Boolean),
    })
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '92vh', overflow: 'auto', padding: '20px 22px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 18 }}>
          <span style={{ fontSize: 18, fontWeight: 900 }}>투표</span>
          <button onClick={onClose} aria-label="닫기" style={{ position: 'absolute', right: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목을 입력해주세요" style={pollInp} />

        {options.map((op, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input value={op} onChange={e => setOpt(i, e.target.value)} placeholder={`${i + 1} 항목을 입력하세요`} style={{ ...pollInp, marginBottom: 0 }} />
            {options.length > 2 && <button onClick={() => removeOpt(i)} aria-label="삭제" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer' }}>✕</button>}
          </div>
        ))}
        <button onClick={addOpt} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0', marginBottom: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>항목 추가
        </button>

        <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0 14px' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" checked={multi} onChange={() => setMulti(v => !v)} style={{ accentColor: 'var(--accent)' }} />복수 선택 허용
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, cursor: 'pointer', marginBottom: 16 }}>
          <input type="checkbox" checked={anon} onChange={() => setAnon(v => !v)} style={{ accentColor: 'var(--accent)' }} />무기명 투표
        </label>

        <Row label="투표 현황 보기">
          <select value={viewMode} onChange={e => { const v = e.target.value as 'after' | 'always' | 'ended'; setViewMode(v); if (v === 'ended' && endMode === 'none') setEndMode('date') }} style={pollSelect}>
            <option value="after">투표 참여 후 보기</option>
            <option value="always">언제나 보기</option>
            <option value="ended">투표 종료 후 보기</option>
          </select>
        </Row>
        <Row label="투표 항목 정렬">
          <select value={sortMode} onChange={e => setSortMode(e.target.value as 'number' | 'votes')} style={pollSelect}>
            <option value="number">항목 번호 순</option>
            <option value="votes">최다 득표 순</option>
          </select>
        </Row>
        <Row label="자동 종료 설정">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <label style={radioLbl}><input type="radio" name="end" checked={endMode === 'date'} onChange={() => setEndMode('date')} style={{ accentColor: 'var(--accent)' }} />종료일 설정</label>
            <label style={radioLbl}><input type="radio" name="end" checked={endMode === 'count'} onChange={() => setEndMode('count')} style={{ accentColor: 'var(--accent)' }} />참여자 수 설정</label>
            <label style={{ ...radioLbl, opacity: needsEnd ? 0.4 : 1, cursor: needsEnd ? 'not-allowed' : 'pointer' }}><input type="radio" name="end" disabled={needsEnd} checked={endMode === 'none'} onChange={() => setEndMode('none')} style={{ accentColor: 'var(--accent)' }} />자동 종료 없음</label>
          </div>
        </Row>
        {needsEnd && <div style={{ fontSize: 12, color: 'var(--accent)', margin: '-6px 0 10px 104px' }}>종료 후 보기는 종료일 또는 참여자 수를 설정해야 해요.</div>}
        {endMode !== 'none' && (
          <input value={endValue} onChange={e => setEndValue(e.target.value)} placeholder={endMode === 'date' ? '예: 2026-08-01' : '예: 100'} style={{ ...pollInp, marginTop: 4 }} />
        )}

        <button onClick={confirm} disabled={!valid} style={{ width: '100%', marginTop: 18, padding: '13px', borderRadius: 11, border: 'none', background: valid ? 'var(--accent)' : 'var(--border)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: valid ? 'pointer' : 'default', fontFamily: 'inherit' }}>확인</button>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <span style={{ fontSize: 13.5, color: 'var(--text)', width: 92, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  )
}

function Sep() { return <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} /> }
function AlignIcon({ dir }: { dir: 'left' | 'center' | 'right' }) {
  const d = dir === 'left' ? 'M4 6h16M4 12h10M4 18h13' : dir === 'center' ? 'M4 6h16M7 12h10M6 18h12' : 'M4 6h16M10 12h10M7 18h13'
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d={d} /></svg>
}

const selectStyle: React.CSSProperties = {
  padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
}
const numInp: React.CSSProperties = {
  width: 64, padding: '7px 8px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit',
}
const pollInp: React.CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box',
}
const pollSelect: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer',
}
const radioLbl: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, cursor: 'pointer', color: 'var(--text)' }

const tbSelect: React.CSSProperties = {
  height: 34, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)',
  color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', padding: '0 6px',
}
