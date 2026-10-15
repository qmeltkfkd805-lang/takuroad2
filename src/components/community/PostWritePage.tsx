'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { ROUTES } from '@/lib/constants/routes'
import { getAllTagsForSelect, getMyRoutes } from '@/services/routeService'
import { createPost, updatePost, getPost, uploadPostImage } from '@/services/communityPostService'
import { linkBlocksIn, lineOf } from '@/lib/utils/linkUrl'
import { dropBeside, dropAsLine, rowOf, PHOTO_ROW_MAX } from '@/lib/utils/photoRow'
import { linkCardHtml, linkCardLoadingHtml, cleanLinkCards, LINK_CARD_HOLDER_STYLE, LINK_CARD_VERSION, REMOVE_BTN, type LinkPreview } from '@/lib/utils/linkCardHtml'
import { getMyWorkRelationships } from '@/services/workRelationshipService'
import { createPoll } from '@/services/pollService'
import { Board, BOARDS, BOARD_FLAIRS, CREATION_BOARDS, boardMeta, NewPost, NewPoll } from '@/types/community-post'
import DraftNotice from '@/components/common/DraftNotice'
import CompanionEventPicker from './CompanionEventPicker'
import { getPostEvent, setPostEvent, PostEventSummary } from '@/services/postEventService'

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
  const goodsIdParam = sp.get('goodsId')   // 기존 굿즈로 새 자랑 글 작성 모드
  const editorRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<Range | null>(null)   // 편집기 안에서 마지막으로 커서가 있던 자리 (사진·파일 넣을 위치)
  /* 링크 미리보기 카드 — 본문에 링크를 붙이면 그 줄 바로 아래에 카드가 생긴다(편집기 안, 글에 그대로 저장).
     같은 주소라도 링크를 넣을 때마다 그 줄 아래에 카드가 붙는다.
     linkSeen: 이미 한 번 살펴본 링크 자리(글자 덩어리 → 그때의 주소). ✕나 지우기로 카드를 없앤 자리엔 다시 붙이지 않는다. */
  const linkSeen = useRef<WeakMap<Node, string>>(new WeakMap())
  const linkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const MAX_LINK_CARDS = 5
  const rememberCards = () => {
    editorRef.current?.querySelectorAll<HTMLElement>('[data-link-card][data-url]').forEach(n => {
      const u = n.getAttribute('data-url')
      if (!u) return
      // 예전 모양으로 저장된 카드만 지금 모양으로 다시 그린다
      n.setAttribute('contenteditable', 'false')
      if (n.getAttribute('data-v') === LINK_CARD_VERSION) return
      n.setAttribute('style', LINK_CARD_HOLDER_STYLE)
      n.setAttribute('data-v', LINK_CARD_VERSION)
      fetch(`/api/link-preview?url=${encodeURIComponent(u)}`).then(r => (r.ok ? r.json() : null))
        .then((pv: LinkPreview | null) => { if (pv?.ok && n.isConnected) n.innerHTML = linkCardHtml(u, pv, true) }).catch(() => {})
    })
  }
  // 그 줄 바로 아래(연달아 붙은 카드들 중)에 이 주소 카드가 있는지
  const cardAfter = (line: Node, url: string) => {
    let n = (line as Element).nextElementSibling ?? (line.nextSibling as Element | null)
    while (n && n.nodeType === 1 && n.matches('[data-link-card]')) {
      if (n.getAttribute('data-url') === url) return true
      n = n.nextElementSibling
    }
    return false
  }
  const attachLinkCards = () => {
    const root = editorRef.current
    if (!root) return
    const cardEls = Array.from(root.querySelectorAll('[data-link-card][data-url]'))
    const cards = new Map<string, number>()
    for (const n of cardEls) { const u = n.getAttribute('data-url') || ''; cards.set(u, (cards.get(u) ?? 0) + 1) }
    let count = cardEls.length
    const links = linkBlocksIn(root, true)
    const occ = new Map<string, number>()
    for (const l of links) occ.set(l.url, (occ.get(l.url) ?? 0) + 1)
    for (const { url, node, block } of links) {
      if (count >= MAX_LINK_CARDS) break
      if (linkSeen.current.get(node) === url) continue   // 이미 살펴본 링크(카드를 지웠어도 다시 안 붙임)
      linkSeen.current.set(node, url)
      if (cardAfter(block ?? node, url)) continue          // 이 링크 바로 아래에 이미 카드가 있음
      if ((cards.get(url) ?? 0) >= (occ.get(url) ?? 0)) continue   // 같은 주소 링크 수만큼 카드가 이미 있음
      cards.set(url, (cards.get(url) ?? 0) + 1); count++
      const holder = document.createElement('div')
      holder.setAttribute('data-link-card', '1')
      holder.setAttribute('data-url', url)
      holder.setAttribute('data-loading', '1')
      holder.setAttribute('contenteditable', 'false')
      holder.setAttribute('style', LINK_CARD_HOLDER_STYLE)
      holder.setAttribute('data-v', LINK_CARD_VERSION)
      holder.innerHTML = linkCardLoadingHtml(url)
      // 링크가 든 줄 바로 아래에. 줄 구분 없이 바로 들어간 링크면 그 줄을 <p>로 감싸서 그 아래에(글 맨 끝으로 보내지 않는다)
      // 같은 줄에 링크가 여럿이면 앞서 붙은 카드들 뒤에 차례로
      let anchor: Element | null = lineOf(root, node)
      while (anchor?.nextElementSibling?.matches('[data-link-card]')) anchor = anchor.nextElementSibling
      if (anchor) anchor.insertAdjacentElement('afterend', holder); else root.appendChild(holder)
      // 카드 뒤에 줄이 없으면 하나 만들어 둔다 — 카드 다음에 이어서 쓸 수 있게
      if (!holder.nextElementSibling) { const p = document.createElement('p'); p.innerHTML = '<br>'; holder.after(p) }
      fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        .then(r => (r.ok ? r.json() : null))
        .then((pv: LinkPreview | null) => {
          if (!holder.isConnected) return
          if (pv?.ok) { holder.removeAttribute('data-loading'); holder.innerHTML = linkCardHtml(url, pv, true) }
          else holder.remove()   // 미리보기를 못 만드는 링크 → 카드 없이 링크만
        })
        .catch(() => { if (holder.isConnected) holder.remove() })
    }
  }
  // 직접 칠 땐 입력이 멈추고 잠깐 뒤에 찾는다(반쪽짜리 주소로 카드가 생기지 않게).
  // 붙여넣기는 주소가 한 번에 다 들어오므로 바로.
  const pastedRef = useRef(false)
  const syncEditorText = () => {
    if (linkTimer.current) clearTimeout(linkTimer.current)
    const wait = pastedRef.current ? 0 : 500
    pastedRef.current = false
    linkTimer.current = setTimeout(attachLinkCards, wait)
    if (editorRef.current?.querySelector('img[src^="data:"], img[src^="blob:"]')) setTimeout(() => { void uploadInlineImages() }, 0)
  }
  /* ── 붙여넣기·끌어다 놓은 사진 ──
     사진을 복사해 붙여넣으면 브라우저가 사진을 글자(data:image…)로 본문에 박아 넣는다 → 글 하나가 수 MB가 돼서 목록이 안 열린다.
     그래서 사진 파일은 가로채서 업로드한 뒤 주소로 넣고, 혹시 data: 사진이 들어오면 곧바로 업로드해서 주소로 바꾼다. */
  const inlineUploading = useRef<WeakSet<HTMLImageElement>>(new WeakSet())
  const dataUrlToFile = async (src: string) => {
    const blob = await (await fetch(src)).blob()
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
    return new File([blob], `paste.${ext}`, { type: blob.type || 'image/png' })
  }
  const uploadInlineImages = async (): Promise<boolean> => {
    const root = editorRef.current
    if (!root || !user) return true
    const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img[src^="data:"], img[src^="blob:"]'))
    let ok = true
    await Promise.all(imgs.map(async img => {
      if (inlineUploading.current.has(img)) return
      inlineUploading.current.add(img)
      img.style.opacity = '0.4'
      try {
        const url = await uploadPostImage(await dataUrlToFile(img.src), user.id)
        if (url) { img.src = url; img.style.opacity = ''; setImages(prev => [...prev, url]) }
        else { img.remove(); ok = false }
      } catch { img.remove(); ok = false }
      finally { inlineUploading.current.delete(img) }
    }))
    return ok
  }
  const imageFilesOf = (dt: DataTransfer | null) => Array.from(dt?.files ?? []).filter(f => f.type.startsWith('image/'))
  const onEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    pastedRef.current = true
    const files = imageFilesOf(e.clipboardData)
    if (files.length && user) {
      e.preventDefault()
      const sel = window.getSelection()
      if (sel?.rangeCount && editorRef.current?.contains(sel.anchorNode)) caretRef.current = sel.getRangeAt(0).cloneRange()
      void onPickImages(files)
      return
    }
    setTimeout(() => { void uploadInlineImages() }, 0)   // 글+사진이 섞인 붙여넣기 → 들어온 data: 사진을 업로드로 바꿈
  }
  /* ── 내 PC 폴더에서 사진·동영상 끌어다 놓기 ──
     글쓰기 화면 어디에 놓아도 브라우저가 파일을 열어버리지 않게 막고,
     본문 위에 놓으면 놓은 자리에, 본문 밖에 놓으면 마지막 커서 자리(없으면 맨 아래)에 넣는다. */
  const [fileDragOver, setFileDragOver] = useState(false)
  const dropFilesRef = useRef<(files: File[], x: number, y: number) => void>(() => {})
  dropFilesRef.current = (files, x, y) => {
    if (!user) return
    const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }
    const r = doc.caretRangeFromPoint?.(x, y)
    if (r && editorRef.current?.contains(r.startContainer)) caretRef.current = r
    const imgs = files.filter(f => f.type.startsWith('image/'))
    const vids = files.filter(f => f.type.startsWith('video/'))
    void (async () => { if (imgs.length) await onPickImages(imgs); if (vids.length) await onPickVideo(vids) })()
  }
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    let depth = 0
    const onEnter = (e: DragEvent) => { if (!hasFiles(e)) return; depth++; setFileDragOver(true) }
    const onLeave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setFileDragOver(false) }
    const onOver = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy' }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault(); e.stopPropagation()
      depth = 0; setFileDragOver(false)
      const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
      if (files.length) dropFilesRef.current(files, e.clientX, e.clientY)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop, true)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop, true)
    }
  }, [])
  useEffect(() => { const t = setTimeout(rememberCards, 300); return () => clearTimeout(t) }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  /* ── 본문 사진 크기 조절 (2026-10-15) ──
     본문 사진을 누르면 테두리 + 위에 크기 버튼(작게·중간·크게·원래) + 오른쪽 아래 손잡이(끌어서 조절).
     크기는 사진 style 의 width(본문 너비 대비 %)로 저장 → 글 화면·모바일에서도 같은 비율로 보인다. */
  const [selImg, setSelImg] = useState<HTMLImageElement | null>(null)
  const [, setImgTick] = useState(0)
  // 본문에 첨부한 사진만(링크 카드·루트 카드 등 제외)
  const movableImg = (t: HTMLElement | null): HTMLImageElement | null => {
    if (!t || t.tagName !== 'IMG' || !editorRef.current?.contains(t)) return null
    if (t.closest('[data-link-card]') || t.closest('[contenteditable="false"]')) return null
    return t as HTMLImageElement
  }
  // 크기 조절은 한 장짜리 사진만 — 나란히 놓인 사진은 비율대로 자동으로 나눠 가진다
  const resizableImg = (t: HTMLElement | null): HTMLImageElement | null => {
    const img = movableImg(t)
    return img && !rowOf(img) ? img : null
  }

  /* ── 사진 끌어서 옮기기 · 나란히 놓기 ──
     마우스: 사진을 누른 채 끌기 / 터치: 사진을 꾹(0.35초) 누른 뒤 끌기.
     다른 사진의 왼쪽·오른쪽에 놓으면 나란히(한 줄 최대 3장), 글 줄 사이에 놓으면 그 자리로. */
  const dragRef = useRef<{ img: HTMLImageElement; x: number; y: number; active: boolean; timer?: ReturnType<typeof setTimeout>; touch: boolean } | null>(null)
  const justDragged = useRef(false)
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number; src: string } | null>(null)
  const [dropHint, setDropHint] = useState<{ kind: 'side'; target: HTMLImageElement; side: 'left' | 'right'; rect: DOMRect } | { kind: 'line'; block: HTMLElement | null; before: boolean; rect: DOMRect } | { kind: 'full'; rect: DOMRect } | null>(null)
  const dropHintRef = useRef<typeof dropHint>(null)
  const findDrop = (x: number, y: number, img: HTMLImageElement): typeof dropHint => {
    const root = editorRef.current
    if (!root) return null
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    if (!el || !root.contains(el)) return null
    const t = movableImg(el)
    if (t && t !== img) {
      const r = t.getBoundingClientRect()
      const side = x < r.left + r.width / 2 ? 'left' : 'right'
      const row = rowOf(t)
      if (row && row !== rowOf(img) && row.querySelectorAll('img').length >= PHOTO_ROW_MAX) return { kind: 'full', rect: row.getBoundingClientRect() }
      return { kind: 'side', target: t, side, rect: r }
    }
    // 글 줄 사이 — 편집기 바로 아래 단계 줄 중 손가락/마우스 높이에 있는 줄의 위/아래
    const blocks = Array.from(root.children) as HTMLElement[]
    for (const b of blocks) {
      const r = b.getBoundingClientRect()
      if (y < r.bottom) return { kind: 'line', block: b, before: y < r.top + r.height / 2, rect: r }
    }
    const last = blocks[blocks.length - 1]
    return last ? { kind: 'line', block: last, before: false, rect: last.getBoundingClientRect() } : null
  }
  useEffect(() => {
    const stopTouchScroll = (e: TouchEvent) => { if (dragRef.current?.active) e.preventDefault() }
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      if (!d.active) {
        const far = Math.hypot(e.clientX - d.x, e.clientY - d.y) > (d.touch ? 8 : 6)
        if (d.touch) { if (far) { clearTimeout(d.timer); dragRef.current = null } return }   // 꾹 누르기 전에 움직이면 그냥 스크롤
        if (!far) return
        d.active = true
        setSelImg(null)
      }
      setDragGhost({ x: e.clientX, y: e.clientY, src: d.img.currentSrc || d.img.src })
      const h = findDrop(e.clientX, e.clientY, d.img)
      dropHintRef.current = h; setDropHint(h)
    }
    const up = () => {
      const d = dragRef.current
      dragRef.current = null
      if (!d) return
      clearTimeout(d.timer)
      const h = dropHintRef.current
      dropHintRef.current = null; setDropHint(null); setDragGhost(null)
      if (!d.active) return
      justDragged.current = true
      setTimeout(() => { justDragged.current = false }, 50)
      const root = editorRef.current
      if (!root || !h) return
      if (h.kind === 'side') dropBeside(d.img, h.target, h.side, root)
      else if (h.kind === 'line') dropAsLine(d.img, h.block, h.before, root)
      syncEditorText()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('touchmove', stopTouchScroll, { passive: false })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('touchmove', stopTouchScroll)
    }
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  const onEditorPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const img = movableImg(e.target as HTMLElement)
    if (!img || e.button > 0) return
    const touch = e.pointerType === 'touch'
    if (!touch) e.preventDefault()   // 마우스: 글자 선택·브라우저 기본 끌기 대신 우리 끌기
    const d = { img, x: e.clientX, y: e.clientY, active: false, touch } as NonNullable<typeof dragRef.current>
    if (touch) d.timer = setTimeout(() => {
      if (dragRef.current !== d) return
      d.active = true
      setSelImg(null)
      setDragGhost({ x: d.x, y: d.y, src: img.currentSrc || img.src })
      try { navigator.vibrate?.(15) } catch { /* noop */ }
    }, 350)
    dragRef.current = d
  }
  const setImgWidth = (img: HTMLImageElement, pct: number) => {
    const v = Math.max(15, Math.min(100, pct))
    img.style.width = `${Math.round(v * 10) / 10}%`
    img.style.height = 'auto'
    img.removeAttribute('width'); img.removeAttribute('height')
    setImgTick(t => t + 1)
  }
  useEffect(() => {
    if (!selImg) return
    const rerender = () => { if (!selImg.isConnected) setSelImg(null); else setImgTick(t => t + 1) }
    const outside = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (t === selImg || t.closest?.('[data-img-tools]')) return
      setSelImg(null)
    }
    window.addEventListener('scroll', rerender, true)
    window.addEventListener('resize', rerender)
    document.addEventListener('pointerdown', outside, true)
    const ed = editorRef.current
    ed?.addEventListener('input', rerender)
    return () => {
      window.removeEventListener('scroll', rerender, true)
      window.removeEventListener('resize', rerender)
      document.removeEventListener('pointerdown', outside, true)
      ed?.removeEventListener('input', rerender)
    }
  }, [selImg])
  // 네 모서리 어디서든 — 바깥쪽으로 끌면 커지고 안쪽으로 끌면 작아진다(가로·세로 중 더 많이 움직인 쪽 기준)
  const startImgDrag = (e: React.PointerEvent, sx: 1 | -1, sy: 1 | -1) => {
    const img = selImg, ed = editorRef.current
    if (!img || !ed) return
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX, startY = e.clientY
    const r0 = img.getBoundingClientRect()
    const startW = r0.width, ratio = r0.height > 0 ? r0.width / r0.height : 1
    const cs = getComputedStyle(ed)
    const boxW = ed.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    const move = (ev: PointerEvent) => {
      const byX = sx * (ev.clientX - startX)
      const byY = sy * (ev.clientY - startY) * ratio
      const d = Math.abs(byX) >= Math.abs(byY) ? byX : byY
      setImgWidth(img, ((startW + d) / boxW) * 100)
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const imgRect = selImg?.isConnected ? selImg.getBoundingClientRect() : null
  const curPct = selImg ? parseFloat(selImg.style.width || '100') : 100

  /* ── 링크 걸린 글자 선택 시 말풍선 (2026-10-15) ──
     본문에서 링크가 걸린 부분을 드래그하면 그 위에 분홍 링크 아이콘 + 연결된 주소가 뜬다.
     분홍 아이콘을 누르면 '선택한 부분만' 링크가 풀린다(나머지 글자는 링크 그대로). */
  const [linkBubble, setLinkBubble] = useState<{ rect: DOMRect; hrefs: string[] } | null>(null)
  useEffect(() => {
    const onSel = () => {
      const root = editorRef.current
      const sel = window.getSelection()
      if (!root || !sel || !sel.rangeCount || sel.isCollapsed || !root.contains(sel.anchorNode)) { setLinkBubble(null); return }
      const range = sel.getRangeAt(0)
      const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .filter(a => !a.closest('[data-link-card]') && !a.closest('[contenteditable="false"]') && range.intersectsNode(a))
      if (!anchors.length) { setLinkBubble(null); return }
      const hrefs = Array.from(new Set(anchors.map(a => a.getAttribute('href') || '').filter(Boolean)))
      setLinkBubble({ rect: range.getBoundingClientRect(), hrefs })
    }
    document.addEventListener('selectionchange', onSel)
    const hide = () => setLinkBubble(b => (b ? null : b))
    window.addEventListener('scroll', hide, true)
    return () => { document.removeEventListener('selectionchange', onSel); window.removeEventListener('scroll', hide, true) }
  }, [])
  const unlinkSelection = () => {
    document.execCommand('unlink')
    setLinkBubble(null)
    syncEditorText()
  }

  const onEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (justDragged.current) return
    const t = e.target as HTMLElement
    const rm = t.closest('[data-lp-remove]')
    if (rm) { e.preventDefault(); rm.closest('[data-link-card]')?.remove(); return }
    if (t.closest('[data-link-card]')) { e.preventDefault(); return }   // 편집 중엔 카드를 눌러도 이동하지 않게
    const img = resizableImg(t)
    setSelImg(img)
  }
  const tagBoxRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const workLaneRef = useRef<HTMLDivElement>(null)

  const [board, setBoard] = useState<Board>((sp.get('board') as Board) || 'free')
  const [tags, setTags] = useState<Tag[]>([])
  const [tagIds, setTagIds] = useState<string[]>(sp.get('tag') ? [sp.get('tag')!] : [])
  const [tagQuery, setTagQuery] = useState('')
  const [tagOpen, setTagOpen] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const [myWorks, setMyWorks] = useState<{ id: string; name: string }[]>([])   // 내 최애·관심 작품 (빠른 태그)
  const [companionEvent, setCompanionEvent] = useState<PostEventSummary | null>(null)   // 덕메게시판: 같이 갈 이벤트

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
  const [addToCollection, setAddToCollection] = useState(true)  // 굿즈자랑: 내 컬렉션에도 담기
  const [existingGoodsId, setExistingGoodsId] = useState<string | null>(null)   // 기존 굿즈로 새 글 작성 시 연결할 굿즈
  const [prefillNotice, setPrefillNotice] = useState<string | null>(null)       // 비공개 이미지 안내
  const [goodsChars, setGoodsChars] = useState<string[]>([])   // 굿즈자랑: 캐릭터(여러 명, 칩)
  const [goodsCharInput, setGoodsCharInput] = useState('')
  const [goodsTypeList, setGoodsTypeList] = useState<string[]>([])  // 굿즈자랑: 굿즈 종류(직접 입력, 여러 개)
  const [goodsTypeInput, setGoodsTypeInput] = useState('')
  const [goodsStore, setGoodsStore] = useState('')             // 굿즈자랑: 구입처
  const [goodsPrice, setGoodsPrice] = useState('')             // 굿즈자랑: 가격
  const [goodsId, setGoodsId] = useState<string | null>(null)  // 편집 중인 글에 연결된 굿즈 id
  const goodsCharStr = goodsChars.join(', ')                    // character_name 저장용(쉼표 join, ≤60자)
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
  const isGoods = board === 'goods'

  useEffect(() => { getAllTagsForSelect().then((t) => setTags(t as Tag[])).catch(() => setTags([])) }, [])
  // 새 글: 쓰던 글이 있으면 들어오자마자 자동으로 채워 넣는다(다른 화면에 다녀오거나 새로고침해도 그대로).
  // 기존 굿즈로 쓰는 글(goodsId)은 그 굿즈 내용이 먼저라 예전처럼 "불러오기" 안내만 띄운다.
  const autoLoadRef = useRef(false)
  const draftBlocked = useRef(false)   // 등록이 끝나면 자동 저장 멈춤
  const [draftAuto, setDraftAuto] = useState(false)
  useEffect(() => {
    if (editId) return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        setHasDraft(true)
        if (goodsIdParam) setShowDraftBanner(true)
        else autoLoadRef.current = true
      }
    } catch { /* noop */ }
  }, [editId])
  useEffect(() => {
    if (editId) return
    if (autoLoadRef.current) { loadDraft(); setDraftAuto(true); return }
    applyBoardTemplate(board)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!editId || !user) return
    getPost(editId, user.id).then(pp => {
      if (!pp) return
      if (pp.board === 'companion') getPostEvent(editId).then(ev => setCompanionEvent(ev))
      setBoard(pp.board); setTagIds(pp.tagIds?.length ? pp.tagIds : (pp.tagId ? [pp.tagId] : [])); setTitle(pp.title ?? ''); setImages(pp.images ?? []); setSpoiler(pp.isSpoiler); setFlair(pp.flair ?? null)
      if (editorRef.current) editorRef.current.innerHTML = (pp.content ?? '').replace(/<div data-gm="1"[\s\S]*?<\/div>/gi, '')
      // 링크 카드: 이미 글에 들어 있는 카드는 지금 모양으로 다시 그린다(서버 저장분이라 빠름) + ✕ 버튼.
      // 카드가 없는 링크는 지금 붙인다.
      editorRef.current?.querySelectorAll<HTMLElement>('[data-link-card]').forEach(n => {
        if (!n.querySelector('[data-lp-remove]')) n.insertAdjacentHTML('afterbegin', REMOVE_BTN)
      })
      rememberCards(); attachLinkCards()
      // 굿즈자랑 글이면 연결된 굿즈의 캐릭터·태그 프리필
      if (pp.board === 'goods') {
        import('@/services/goodsService').then(async ({ getPostGoodsId, getGoodsDetail }) => {
          const gid = await getPostGoodsId(editId)
          if (!gid) return
          setGoodsId(gid)
          const d = await getGoodsDetail(gid)
          if (d) {
            setGoodsChars(d.characterName ? d.characterName.split(',').map(s => s.trim()).filter(Boolean) : [])
            setGoodsTypeList((d.tags ?? []).filter(Boolean))
            setGoodsStore(d.store ?? '')
            setGoodsPrice(d.price != null ? String(d.price) : '')
          }
        }).catch(() => {})
      }
    }).catch(() => {})
  }, [editId, user?.id])
  // 기존 굿즈로 새 자랑 글 작성 모드 — 텍스트 프리필 + 공개 이미지만 프리필(비공개 goods-images 제외)
  useEffect(() => {
    if (editId || !goodsIdParam || !user) return
    setBoard('goods')
    setAddToCollection(false)   // 새 굿즈 생성 경로(linkPostToGoods) 차단
    import('@/services/goodsService').then(async ({ getGoodsDetail }) => {
      const d = await getGoodsDetail(goodsIdParam)
      if (!d) return
      setExistingGoodsId(goodsIdParam)
      setTagIds(d.workId ? [d.workId] : [])
      setTitle(d.name ?? '')
      setGoodsChars(d.characterName ? d.characterName.split(',').map(s => s.trim()).filter(Boolean) : [])
      setGoodsTypeList((d.tags ?? []).filter(Boolean))
      setGoodsStore(d.store ?? '')
      setGoodsPrice(d.price != null ? String(d.price) : '')
      // 공개 URL만 재사용: community(shop-images 공개) / external(https). goods(비공개 서명 URL)은 저장 금지 → 제외
      const usable = (d.images ?? []).filter(im => im.url && (im.storageOwner === 'community' || (im.storageOwner === 'external' && !!im.external && im.external.startsWith('https://'))))
      const hasPrivate = (d.images ?? []).some(im => im.storageOwner === 'goods')
      const urls = usable.map(im => im.url as string)
      setImages(urls)
      if (editorRef.current) {
        editorRef.current.innerHTML = urls.map(u => `<p><img src="${u}" style="max-width:100%;border-radius:10px;" /></p>`).join('') + '<p><br/></p>'
      }
      if (hasPrivate) setPrefillNotice('비공개로 보관된 사진은 게시글에 자동으로 가져올 수 없어요. 공개할 사진을 다시 첨부해주세요.')
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, goodsIdParam, user?.id])

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
    if (sel.rangeCount) caretRef.current = sel.getRangeAt(0).cloneRange()
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
  /* 카드를 실수로 지웠을 때 — 그 링크가 있는 줄에서 엔터를 치면 링크 바로 아래에 카드를 다시 붙인다.
     (✕·지우기로 뺀 링크는 평소엔 다시 안 붙이므로, 엔터가 '다시 붙여줘' 신호) */
  const recardOnEnter = () => {
    const root = editorRef.current
    const sel = window.getSelection()
    if (!root || !sel || !sel.rangeCount) return
    let line: Node | null = sel.anchorNode
    while (line && line.parentNode && line.parentNode !== root) line = line.parentNode
    if (!line || line === root) return
    const here = linkBlocksIn(root, true).filter(l => line!.contains(l.node))
    if (!here.length) return
    let changed = false
    for (const l of here) if (!cardAfter(line, l.url) && linkSeen.current.delete(l.node)) changed = true
    if (changed) setTimeout(attachLinkCards, 0)   // 엔터로 줄이 나뉜 다음에 — 카드는 링크 줄 바로 아래로 간다
  }

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) recardOnEnter()
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

  /* 사진·동영상·파일·표·루트를 '마지막으로 커서가 있던 자리'에 넣는다.
     - 빈 줄이면 그 줄을 대신하고, 글 중간이면 그 줄을 커서 위치에서 나눠 사이에 넣는다.
     - 링크 카드·사진 묶음처럼 편집 불가 블록 위라면 그 블록 바로 다음에 넣는다.
     - 커서를 둔 적이 없으면 맨 아래에 붙인다. */
  const insertBlockAtCaret = (html: string) => {
    const root = editorRef.current
    if (!root) return
    const tpl = document.createElement('template')
    tpl.innerHTML = html
    const blocks = Array.from(tpl.content.childNodes)
    if (!blocks.length) return
    const last = blocks[blocks.length - 1]
    const isEmpty = (n: Node) => n.nodeType === 1
      ? !(n as HTMLElement).textContent?.trim() && !(n as HTMLElement).querySelector('img,video,iframe,a,table,hr,[data-link-card],[data-photo-row]')
      : !n.textContent?.trim()

    let r = caretRef.current
    if (r && (!root.contains(r.startContainer))) r = null
    let caretAt: Node | null = null   // 넣은 뒤 커서를 둘 줄

    if (!r) {
      for (const b of blocks) root.appendChild(b)
      const p = document.createElement('p'); p.appendChild(document.createElement('br'))
      root.appendChild(p); caretAt = p
    } else {
      r = r.cloneRange(); r.collapse(false)
      // 커서가 있는 '최상위 줄' 찾기
      let line: Node | null = r.startContainer
      if (line === root) {
        line = root.childNodes[r.startOffset - 1] ?? null   // 줄 사이에 커서 → 앞 줄 뒤에 넣기
        if (!line) {
          root.insertBefore(tpl.content, root.firstChild); caretAt = last.nextSibling
          if (!caretAt) { const p = document.createElement('p'); p.appendChild(document.createElement('br')); root.appendChild(p); caretAt = p }
        }
      } else {
        while (line && line.parentNode !== root) line = line.parentNode
      }
      if (line && !caretAt) {
        const locked = line.nodeType === 1 && ((line as HTMLElement).isContentEditable === false || (line as HTMLElement).matches('[data-link-card],[data-photo-row],[contenteditable="false"]'))
        if (!locked && isEmpty(line)) {
          // 빈 줄 → 그 자리를 대신 쓰고, 다음 글 쓸 빈 줄을 하나 남긴다
          const p = document.createElement('p'); p.appendChild(document.createElement('br'))
          root.insertBefore(tpl.content, line); root.insertBefore(p, line); line.parentNode!.removeChild(line)
          caretAt = p
        } else {
          let tail: Node | null = null
          // 줄 맨 앞에 커서 → 그 줄 '위'에 넣고 커서는 원래 줄 앞에 그대로
          const head = document.createRange()
          head.setStart(line, 0); head.setEnd(r.startContainer, r.startOffset)
          const headBox = document.createElement('div'); headBox.appendChild(head.cloneContents())
          if (!locked && line.contains(r.startContainer) && isEmpty(headBox)) {
            root.insertBefore(tpl.content, line)
            caretAt = line
          } else if (!locked && line.contains(r.startContainer)) {
            const cut = document.createRange()
            cut.setStart(r.startContainer, r.startOffset)
            cut.setEnd(line, line.nodeType === 3 ? (line.textContent || '').length : line.childNodes.length)
            const rest = cut.extractContents()
            if (line.nodeType === 3) {
              const t = document.createTextNode(rest.textContent || '')
              if (t.textContent!.trim()) tail = t
            } else {
              const holder = (line as HTMLElement).cloneNode(false) as HTMLElement
              holder.appendChild(rest)
              if (!isEmpty(holder)) tail = holder
              if (isEmpty(line) && !(line as HTMLElement).querySelector('br')) (line as HTMLElement).appendChild(document.createElement('br'))
            }
          }
          if (!caretAt) {
          const after = line.nextSibling
          if (tail) root.insertBefore(tail, after)
          root.insertBefore(tpl.content, tail ?? after)
          if (tail) caretAt = tail
          else {
            const p = document.createElement('p'); p.appendChild(document.createElement('br'))
            root.insertBefore(p, last.nextSibling); caretAt = p
          }
          }
        }
      }
    }
    // 커서를 넣은 블록 바로 다음 줄 맨 앞으로 — 여러 장을 올리면 차례대로 이어 붙는다
    if (caretAt) {
      const nr = document.createRange()
      nr.setStart(caretAt, 0); nr.collapse(true)
      caretRef.current = nr.cloneRange()
      const sel = window.getSelection()
      if (sel && document.activeElement === root) { sel.removeAllRanges(); sel.addRange(nr) }
    }
  }

  const onPickImages = async (list: FileList | File[] | null) => {
    if (!user || !list) return
    for (const f of Array.from(list as ArrayLike<File>)) {
      const url = await uploadPostImage(f, user.id)
      if (url) {
        setImages(prev => [...prev, url])
        insertBlockAtCaret(`<p><img src="${url}" style="max-width:100%;border-radius:10px;" /></p>`)
      }
    }
  }

  const onPickVideo = async (list: FileList | File[] | null) => {
    if (!user || !list) return
    for (const f of Array.from(list as ArrayLike<File>)) {
      const url = await uploadPostImage(f, user.id)
      if (url) insertBlockAtCaret(`<p><video src="${url}" controls playsinline style="max-width:100%;border-radius:10px;"></video></p>`)
    }
  }
  const onPickFile = async (list: FileList | null) => {
    if (!user || !list) return
    for (const f of Array.from(list)) {
      const url = await uploadPostImage(f, user.id)
      if (url) insertBlockAtCaret(`<p><a href="${url}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;gap:6px;color:#e8006f;font-weight:700;text-decoration:none;">📎 ${escapeHtml(f.name)}</a></p>`)
    }
  }

  const appendBlock = (html: string) => { insertBlockAtCaret(html); editorRef.current?.focus() }
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

  // ── 자동 임시저장 (새 글만) ── 입력이 멈추고 0.5초 뒤, 화면을 떠나거나 숨길 때 바로
  const draftState = { board, tagIds, title, images, poll: pollData, spoiler, flair, goodsChars, goodsTypeList, goodsStore, goodsPrice }
  const draftStateRef = useRef(draftState)
  draftStateRef.current = draftState
  const writeDraftSilent = useCallback(() => {
    if (editId || draftBlocked.current) return
    const d = draftStateRef.current
    const el = editorRef.current
    const html = el ? el.innerHTML : null
    if (html === null) return   // 에디터가 없으면(화면 전환 중) 건드리지 않음
    const tmpl = BOARD_TEMPLATES[d.board] ?? ''
    const bodyEmpty = !html || html === tmpl || (!(el!.innerText || '').trim() && !el!.querySelector('img,video,a,table'))
    const empty = bodyEmpty && !d.title.trim() && d.images.length === 0 && !d.poll && d.goodsChars.length === 0 && d.goodsTypeList.length === 0 && !d.goodsStore && !d.goodsPrice
    try {
      if (empty) return
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, html, savedAt: Date.now() }))
    } catch { /* noop */ }
  }, [editId])
  useEffect(() => {
    if (editId || goodsIdParam) return
    const t = setTimeout(writeDraftSilent, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, tagIds, title, images, pollData, spoiler, flair, goodsChars, goodsTypeList, goodsStore, goodsPrice])
  useEffect(() => {
    if (editId || goodsIdParam) return
    const el = editorRef.current
    let t: ReturnType<typeof setTimeout> | null = null
    const mo = el ? new MutationObserver(() => { if (t) clearTimeout(t); t = setTimeout(writeDraftSilent, 500) }) : null
    if (el && mo) mo.observe(el, { childList: true, subtree: true, characterData: true })
    const onHide = () => { if (document.visibilityState === 'hidden') writeDraftSilent() }
    window.addEventListener('pagehide', writeDraftSilent)
    document.addEventListener('visibilitychange', onHide)
    return () => { mo?.disconnect(); if (t) clearTimeout(t); window.removeEventListener('pagehide', writeDraftSilent); document.removeEventListener('visibilitychange', onHide) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, goodsIdParam])
  // "새로 쓰기" — 불러온 글을 지우고 빈 글로
  const startOver = () => {
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
    setHasDraft(false); setDraftAuto(false)
    setTitle(''); setImages([]); setPollData(null); setSpoiler(false); setFlair(null); setTagIds(sp.get('tag') ? [sp.get('tag')!] : [])
    setGoodsChars([]); setGoodsTypeList([]); setGoodsStore(''); setGoodsPrice('')
    if (editorRef.current) { editorRef.current.innerHTML = ''; applyBoardTemplate(board) }
    linkSeen.current = new WeakMap()
  }

  // ── 임시저장 ──
  const saveDraft = () => {
    const html = editorRef.current?.innerHTML ?? ''
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ board, tagIds, title, html, images, poll: pollData, spoiler, flair, goodsChars, goodsTypeList, goodsStore, goodsPrice, savedAt: Date.now() }))
      setHasDraft(true); setShowDraftBanner(false)
      window.alert('임시저장되었어요.')
    } catch { window.alert('임시저장에 실패했어요.') }
  }
  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return
      const d = JSON.parse(raw)
      setBoard(d.board ?? 'free'); setTagIds(d.tagIds ?? []); setTitle(d.title ?? ''); setImages(d.images ?? []); setPollData(d.poll ?? null); setSpoiler(d.spoiler ?? false); setFlair(d.flair ?? null)
      if (Array.isArray(d.goodsChars)) setGoodsChars(d.goodsChars)
      if (Array.isArray(d.goodsTypeList)) setGoodsTypeList(d.goodsTypeList)
      if (typeof d.goodsStore === 'string') setGoodsStore(d.goodsStore)
      if (typeof d.goodsPrice === 'string') setGoodsPrice(d.goodsPrice)
      if (editorRef.current) editorRef.current.innerHTML = d.html ?? ''
      rememberCards()
      setShowDraftBanner(false)
    } catch { /* noop */ }
  }
  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }; setHasDraft(false); setShowDraftBanner(false) }

  const addGoodsType = (raw: string) => {
    const t = raw.trim().replace(/\s+/g, ' ')
    if (!t || t.length > 30) { setGoodsTypeInput(''); return }
    setGoodsTypeList(prev => (prev.some(x => x.toLowerCase() === t.toLowerCase()) || prev.length >= 20) ? prev : [...prev, t])
    setGoodsTypeInput('')
  }

  const addGoodsChar = (raw: string) => {
    const t = raw.trim().replace(/\s+/g, ' ')
    if (!t) { setGoodsCharInput(''); return }
    setGoodsChars(prev => {
      if (prev.some(x => x.toLowerCase() === t.toLowerCase())) return prev
      // character_name 컬럼 상한(60자)에 맞춰 join 길이 초과 시 거부
      if ([...prev, t].join(', ').length > 60) return prev
      return [...prev, t]
    })
    setGoodsCharInput('')
  }

  const filteredTags = tagQuery.trim()
    ? tags.filter(t => t.name.toLowerCase().includes(tagQuery.trim().toLowerCase())).slice(0, 40)
    : tags.slice(0, 40)

  // 굿즈자랑: 발행 글 하단에 붙는 "굿즈 정보" 블록(편집기엔 미표시). 저장 시 재생성.
  const buildGoodsMetaHtml = () => {
    const rows: string[] = []
    if (goodsTypeList.length) rows.push(`종류 · ${goodsTypeList.join(', ')}`)
    if (goodsChars.length) rows.push(`캐릭터 · ${goodsChars.join(', ')}`)
    if (goodsStore.trim()) rows.push(`구입처 · ${goodsStore.trim()}`)
    if (goodsPrice.trim()) rows.push(`가격 · ${Number(goodsPrice).toLocaleString()}원`)
    if (!rows.length) return ''
    const inner = rows.map(r => escapeHtml(r)).join('<br>')
    return `<div data-gm="1" style="margin-top:16px;padding:13px 15px;background:var(--accent-l,#fff2f8);border:1px solid var(--accent,#ff5692);border-radius:12px;font-size:14px;line-height:1.9;color:var(--text,#333)"><strong style="color:var(--accent,#ff5692)">굿즈 정보</strong><br>${inner}</div>`
  }
  const stripGoodsMeta = (h: string) => h.replace(/<div data-gm="1"[\s\S]*?<\/div>/gi, '')

  const submit = async () => {
    if (!user) { router.push(ROUTES.login); return }
    if (linkTimer.current) { clearTimeout(linkTimer.current); linkTimer.current = null }
    // 본문에 글자로 박힌 사진(data:)이 남아 있으면 먼저 업로드해서 주소로 바꾼다
    setSaving(true)
    const inlineOk = await uploadInlineImages()
    setSaving(false)
    if (!inlineOk) { setErr('붙여넣은 사진 중 일부를 올리지 못해서 뺐어요. 확인하고 다시 등록해주세요.'); return }
    const cleaned = editorRef.current ? cleanLinkCards(editorRef.current) : null
    let html = stripGoodsMeta(cleaned?.innerHTML ?? '')
    const plain = (editorRef.current?.innerText ?? '').trim()
    // 사진 목록(썸네일)엔 링크 카드 이미지를 넣지 않는다
    const noCards = cleaned ? (cleaned.cloneNode(true) as HTMLElement) : null
    noCards?.querySelectorAll('[data-link-card]').forEach(n => n.remove())
    const imgs = collectImages(stripGoodsMeta(noCards?.innerHTML ?? ''))
    const linkUrl = cleaned?.querySelector('[data-link-card][data-url]')?.getAttribute('data-url') ?? null
    if (isGoods) { const meta = buildGoodsMetaHtml(); if (meta) html = html + meta }
    const notice = isAdmin && isNotice
    if (!notice) {
      if (workRequired && tagIds.length === 0) { setErr(`${meta.label}은(는) 작품을 최소 1개 선택해야 해요.`); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
      if ((meta.imageRequired || isGoods) && imgs.length === 0) { setErr(isGoods ? '굿즈 사진을 1장 이상 첨부해주세요.' : '이미지를 1장 이상 첨부해주세요.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    }
    if (!title.trim() && !plain && imgs.length === 0 && !pollData) { setErr('제목이나 내용을 입력해주세요.'); return }
    if (isFanart && !notice && !allAgreed) { setErr('업로드 전 확인 항목에 모두 동의해주세요.'); return }
    if (/src="(data|blob):/i.test(html) || html.length > 500_000) { setErr('본문이 너무 커요. 사진은 사진 버튼으로 넣어주세요.'); return }

    setErr(''); setSaving(true)
    const finalBoard: Board = (notice && noticeScope !== 'all') ? noticeScope : board
    if (editId) {
      const ok = await updatePost(editId, { board: finalBoard, tagIds, title, content: html, images: imgs, showOnWork, spoiler, flair: BOARD_FLAIRS[finalBoard] ? flair : null, linkUrl })
      // 덕메게시판: 같이 갈 이벤트 연결 갱신 (다른 게시판으로 옮기면 연결 해제)
      if (ok) await setPostEvent(editId, finalBoard === 'companion' ? companionEvent?.id ?? null : null)
      // 굿즈자랑 글이면 연결된 굿즈의 이름·캐릭터·태그도 함께 갱신
      if (ok && finalBoard === 'goods' && goodsId) {
        try {
          const { updateGoodsMeta } = await import('@/services/goodsService')
          await updateGoodsMeta(goodsId, { name: title, characterName: goodsCharStr || null, store: goodsStore || null, price: goodsPrice ? Number(goodsPrice) : null, tags: goodsTypeList })
        } catch (e) { console.error('[굿즈 갱신 실패]', e) }
      }
      setSaving(false)
      if (ok) { draftBlocked.current = true; clearDraft(); router.push(`/community/${editId}`) } else setErr('수정에 실패했어요.')
      return
    }
    const payload: NewPost = { board: finalBoard, tagIds, title, content: html, images: imgs, showOnWork, isNotice: notice, noticeAll: notice && noticeScope === 'all', spoiler, flair: BOARD_FLAIRS[finalBoard] ? flair : null, linkUrl }
    const id = await createPost(user.id, payload)
    if (!id) { setSaving(false); setErr('등록에 실패했어요. 잠시 후 다시 시도해주세요.'); return }
    if (pollData) { await createPoll(id, pollData) }
    if (finalBoard === 'companion' && companionEvent) { await setPostEvent(id, companionEvent.id) }

    if (finalBoard === 'goods' && !notice && existingGoodsId) {
      // 기존 굿즈로 새 글 작성: 새 굿즈 생성 없이 post_goods_links만 연결
      try {
        const { linkExistingGoodsToPost, updateGoodsMeta } = await import('@/services/goodsService')
        await linkExistingGoodsToPost(id, existingGoodsId)
        // 사용자가 굿즈 정보를 바꿨으면 기존 굿즈만 안전 갱신(새 행 생성 금지)
        try { await updateGoodsMeta(existingGoodsId, { name: title, characterName: goodsCharStr || null, store: goodsStore || null, price: goodsPrice ? Number(goodsPrice) : null, tags: goodsTypeList }) } catch (e) { console.error('[굿즈 갱신 실패]', e) }
      } catch (e) {
        // 링크 실패 → 방금 만든 글 보상 삭제(연결 안 된 고아 글 방지)
        console.error('[기존 굿즈 연결 실패]', e)
        try { const { deletePost } = await import('@/services/communityPostService'); await deletePost(id) } catch { /* 보상 삭제 실패 무시 */ }
        setSaving(false); setErr('굿즈 연결에 실패했어요. 잠시 후 다시 시도해주세요.'); return
      }
      setSaving(false); draftBlocked.current = true; clearDraft(); router.push(`/community/${id}`); return
    }

    // 굿즈자랑 새 글은 내 굿즈·컬렉션에도 자동 등록 (실패해도 글 자체는 유지)
    if (finalBoard === 'goods' && !notice && addToCollection) {
      try {
        const { linkPostToGoods } = await import('@/services/goodsService')
        await linkPostToGoods(id, { workId: tagIds[0] ?? null, imageUrls: imgs, name: title, characterName: goodsCharStr || null, store: goodsStore || null, price: goodsPrice ? Number(goodsPrice) : null, tags: goodsTypeList })
      } catch (e) { console.error('[굿즈 연동 실패]', e) }
    }
    setSaving(false)
    draftBlocked.current = true; clearDraft(); router.push('/community')
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

  // 굿즈자랑 전용: 캐릭터·태그 (PC는 우측 사이드바, 모바일은 등록 모달)
  const goodsMetaFields = (
    <>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>캐릭터 이름 <span style={{ fontWeight: 600 }}>(여러 명 가능)</span></div>
        {goodsChars.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {goodsChars.map(c => (
              <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 9999, background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 13 }}>
                {c}
                <button type="button" onClick={() => setGoodsChars(prev => prev.filter(x => x !== c))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 15, lineHeight: 1, padding: 0, fontFamily: 'inherit' }}>×</button>
              </span>
            ))}
          </div>
        )}
        <input value={goodsCharInput} onChange={e => setGoodsCharInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addGoodsChar(goodsCharInput) } else if (e.key === 'Backspace' && !goodsCharInput && goodsChars.length) { setGoodsChars(prev => prev.slice(0, -1)) } }}
          onBlur={() => { if (goodsCharInput.trim()) addGoodsChar(goodsCharInput) }}
          maxLength={40} placeholder="캐릭터 입력 후 Enter" style={{ ...selectStyle, width: '100%', boxSizing: 'border-box' }} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>굿즈 종류 <span style={{ fontWeight: 600 }}>(여러 개 가능)</span></div>
        {goodsTypeList.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {goodsTypeList.map(ty => (
              <span key={ty} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 9999, background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 13 }}>
                {ty}
                <button type="button" onClick={() => setGoodsTypeList(prev => prev.filter(x => x !== ty))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 15, lineHeight: 1, padding: 0, fontFamily: 'inherit' }}>×</button>
              </span>
            ))}
          </div>
        )}
        <input value={goodsTypeInput} onChange={e => setGoodsTypeInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addGoodsType(goodsTypeInput) } else if (e.key === 'Backspace' && !goodsTypeInput && goodsTypeList.length) { setGoodsTypeList(prev => prev.slice(0, -1)) } }}
          onBlur={() => { if (goodsTypeInput.trim()) addGoodsType(goodsTypeInput) }}
          maxLength={30} placeholder="종류 입력 후 Enter (예: 아크릴 스탠드)" style={{ ...selectStyle, width: '100%', boxSizing: 'border-box' }} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>구입처 <span style={{ fontWeight: 600 }}>(선택)</span></div>
        <input value={goodsStore} onChange={e => setGoodsStore(e.target.value)} maxLength={80} placeholder="예: 애니메이트" style={{ ...selectStyle, width: '100%', boxSizing: 'border-box' }} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>가격 <span style={{ fontWeight: 600 }}>(선택)</span></div>
        <input value={goodsPrice} onChange={e => setGoodsPrice(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" maxLength={12} placeholder="예: 25000" style={{ ...selectStyle, width: '100%', boxSizing: 'border-box' }} />
      </div>
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
        .taku-editor a[href]:not([contenteditable="false"]):not([data-lp]),.taku-editor a[href]:not([contenteditable="false"]):not([data-lp]) *{color:var(--accent) !important;text-decoration:underline !important;text-underline-offset:3px}
        .taku-editor [data-link-card]{cursor:default;user-select:none}
        .taku-editor [data-link-card]{max-width:300px !important;width:100%}   /* 예전에 만든 큰 카드도 이 너비로 */
        .taku-editor img{max-width:100%;height:auto;cursor:grab;-webkit-user-drag:none;-webkit-touch-callout:none}
        .taku-editor blockquote{border-left:3px solid var(--accent);margin:8px 0;padding:4px 14px;color:var(--muted)}
        .taku-write-grid{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:24px}
        .tb-btn{width:34px;height:34px;border:none;background:none;border-radius:7px;cursor:pointer;color:var(--text);display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800}
        .tb-btn:hover{background:var(--surface2)}
        .pw-worklane{scrollbar-width:none}
        .pw-worklane::-webkit-scrollbar{display:none}
        @media (pointer: coarse) and (max-width:900px){
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
          {isDesktop && <span style={{ fontSize: 19, fontWeight: 900 }}>{editId ? '글 수정' : (existingGoodsId ? '굿즈 자랑 글쓰기' : '글쓰기')}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={saveDraft} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            임시저장 <span style={{ color: 'var(--muted)', fontWeight: 800 }}>{hasDraft ? 1 : 0}</span>
          </button>
          <button onClick={() => { if (isDesktop) submit(); else setSettingsOpen(true) }} disabled={saving || (isDesktop && isFanart && !allAgreed)} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: (saving || (isDesktop && isFanart && !allAgreed)) ? 'var(--border)' : 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: (saving || (isDesktop && isFanart && !allAgreed)) ? 'default' : 'pointer', fontFamily: 'inherit' }}>{saving ? (editId ? '수정 중…' : '등록 중…') : (editId ? '수정' : (existingGoodsId ? '게시글 등록' : '등록'))}</button>
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
        {draftAuto && <DraftNotice text="작성 중이던 글을 불러왔어요." onDiscard={startOver} onClose={() => setDraftAuto(false)} />}
        {err && <div style={{ fontSize: 14, color: '#c0392b', background: 'rgba(239,90,90,.08)', borderRadius: 10, padding: '11px 14px', marginBottom: 16 }}>{err}</div>}

        {existingGoodsId && (
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)', background: 'var(--accent-l, #fff2f8)', border: '1px solid var(--accent, #ff5692)', borderRadius: 12, padding: '11px 14px', marginBottom: 16 }}>
            보관함에 등록된 굿즈로 새 자랑 글을 작성합니다.
            {prefillNotice && <div style={{ color: 'var(--muted)', marginTop: 4 }}>{prefillNotice}</div>}
          </div>
        )}

        <div className="taku-write-grid">
          {/* 에디터 */}
          <div style={{ minWidth: 0, ...(isGoods && isDesktop ? { display: 'flex', flexDirection: 'column' } : {}) }}>
            {/* 게시판 + 작품 (모바일: 세로로 쌓고 밑줄 스타일) */}
            <div style={isGoods && isDesktop ? goodsCard : undefined}>
            {isGoods && isDesktop && (
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)' }}>게시글 설정</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginLeft: 8 }}>어떤 굿즈인지, 어떤 작품인지 설정해 주세요.</span>
              </div>
            )}
            <div className="pw-catrow" style={{ display: 'flex', gap: 10, marginBottom: isGoods && isDesktop ? 0 : 12, flexWrap: 'wrap' }}>
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
            {myWorks.filter(w => !tagIds.includes(w.id)).length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>내 최애·관심 작품</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" aria-label="왼쪽으로" onClick={() => workLaneRef.current?.scrollBy({ left: -220, behavior: 'smooth' })} style={laneArrow}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                  </button>
                  <div ref={workLaneRef} className="pw-worklane" style={{ display: 'flex', flexWrap: 'nowrap', gap: 6, overflowX: 'auto', paddingBottom: 2, flex: 1, minWidth: 0 }}>
                    {myWorks.filter(w => !tagIds.includes(w.id)).map(w => (
                      <button key={w.id} onClick={() => toggleTag(w.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13, padding: '6px 12px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}># {w.name}</button>
                    ))}
                  </div>
                  <button type="button" aria-label="오른쪽으로" onClick={() => workLaneRef.current?.scrollBy({ left: 220, behavior: 'smooth' })} style={laneArrow}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                  </button>
                </div>
              </div>
            )}
            {/* 덕메게시판: 작품과 함께 '같이 갈 이벤트'도 고를 수 있게 */}
            {board === 'companion' && <CompanionEventPicker value={companionEvent} onChange={setCompanionEvent} />}
            </div>

            {BOARD_FLAIRS[board] && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>말머리</span>
                {BOARD_FLAIRS[board]!.map(f => (
                  <button key={f} onClick={() => setFlair(flair === f ? null : f)} style={{ padding: '6px 14px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, border: `1.5px solid ${flair === f ? 'var(--accent)' : 'var(--border)'}`, background: flair === f ? 'var(--accent)' : 'var(--surface)', color: flair === f ? '#fff' : 'var(--text)' }}>{f}</button>
                ))}
              </div>
            )}

            <div style={isGoods && isDesktop ? { ...goodsCard, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: 0 } : undefined}>
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
            <div ref={editorRef} className="taku-editor pw-editor" contentEditable suppressContentEditableWarning data-ph={isGoods ? '굿즈 사진과 자랑하고 싶은 이야기를 자유롭게 적어보세요.' : '내용을 입력하세요.'} onKeyDown={onEditorKeyDown} onInput={syncEditorText} onPaste={onEditorPaste} onClick={onEditorClick} onPointerDown={onEditorPointerDown}
              onDragStart={e => { if ((e.target as HTMLElement).tagName === 'IMG') e.preventDefault() }}
              onContextMenu={e => { if (dragRef.current && (e.target as HTMLElement).tagName === 'IMG') e.preventDefault() }}
              style={{ minHeight: 340, maxHeight: isGoods && isDesktop ? 'none' : '55vh', flex: isGoods && isDesktop ? 1 : undefined, overflowY: 'auto', fontSize: 16, lineHeight: 1.7, color: 'var(--text)', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 12, ...(fileDragOver ? { outline: '2px dashed #e8006f', outlineOffset: 2, background: 'rgba(232,0,111,0.04)' } : null) }} />

            {/* 사진 크기 조절 — 고른 사진 위에 띄운다(화면 기준 위치) */}
            {linkBubble && (() => {
              const W = 300
              const r = linkBubble.rect
              const left = Math.max(8, Math.min(window.innerWidth - W - 8, r.left + r.width / 2 - W / 2))
              const top = r.top > 64 ? r.top - 52 : r.bottom + 10
              const first = linkBubble.hrefs[0]
              return (
                <div data-img-tools="1" role="dialog" aria-label="연결된 링크"
                  style={{ position: 'fixed', left, top, width: W, zIndex: 72, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.16)' }}>
                  <button type="button" title="이 부분 링크 해제" aria-label="이 부분 링크 해제"
                    onMouseDown={e => e.preventDefault()} onClick={unlinkSelection}
                    style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9999, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></svg>
                  </button>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>링크 연결됨 · 아이콘을 누르면 해제</div>
                    <a href={first} target="_blank" rel="noopener noreferrer" onMouseDown={e => e.preventDefault()}
                      style={{ display: 'block', fontSize: 12.5, color: 'var(--text)', textDecoration: 'underline', textUnderlineOffset: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {first}
                    </a>
                    {linkBubble.hrefs.length > 1 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>외 {linkBubble.hrefs.length - 1}개 링크</div>}
                  </div>
                </div>
              )
            })()}

            {dragGhost && (
              <img src={dragGhost.src} alt="" aria-hidden="true"
                style={{ position: 'fixed', left: dragGhost.x - 40, top: dragGhost.y - 40, width: 80, height: 80, objectFit: 'cover', borderRadius: 10, opacity: .8, boxShadow: '0 8px 24px rgba(0,0,0,.25)', pointerEvents: 'none', zIndex: 70 }} />
            )}
            {dropHint && dropHint.kind === 'side' && (
              <div aria-hidden="true" style={{ position: 'fixed', left: (dropHint.side === 'left' ? dropHint.rect.left : dropHint.rect.right) - 2, top: dropHint.rect.top, width: 4, height: dropHint.rect.height, borderRadius: 4, background: 'var(--accent)', pointerEvents: 'none', zIndex: 69 }} />
            )}
            {dropHint && dropHint.kind === 'line' && (
              <div aria-hidden="true" style={{ position: 'fixed', left: dropHint.rect.left, top: (dropHint.before ? dropHint.rect.top : dropHint.rect.bottom) - 2, width: dropHint.rect.width, height: 4, borderRadius: 4, background: 'var(--accent)', pointerEvents: 'none', zIndex: 69 }} />
            )}
            {dropHint && dropHint.kind === 'full' && (
              <div aria-hidden="true" style={{ position: 'fixed', left: dropHint.rect.left, top: dropHint.rect.top - 26, padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: 'rgba(0,0,0,.7)', color: '#fff', pointerEvents: 'none', zIndex: 69 }}>한 줄에 {PHOTO_ROW_MAX}장까지 놓을 수 있어요</div>
            )}

            {selImg && imgRect && (
              <>
                <div aria-hidden="true" style={{ position: 'fixed', left: imgRect.left - 2, top: imgRect.top - 2, width: imgRect.width + 4, height: imgRect.height + 4, border: '2px solid var(--accent)', borderRadius: 8, pointerEvents: 'none', zIndex: 60 }} />
                <div data-img-tools="1" style={{ position: 'fixed', left: Math.max(8, imgRect.left), top: Math.max(8, imgRect.top - 50), zIndex: 61, display: 'flex', gap: 4, padding: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,.14)' }}>
                  {([['작게', 33], ['중간', 50], ['크게', 75], ['원래', 100]] as const).map(([label, pct]) => (
                    <button key={label} type="button" onMouseDown={e => e.preventDefault()} onClick={() => setImgWidth(selImg, pct)}
                      style={{ border: 'none', borderRadius: 7, padding: '6px 10px', fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
                        background: Math.abs(curPct - pct) < 1 ? 'var(--accent)' : 'var(--surface2)', color: Math.abs(curPct - pct) < 1 ? '#fff' : 'var(--text)' }}>
                      {label}
                    </button>
                  ))}
                  <span style={{ alignSelf: 'center', fontSize: 11.5, color: 'var(--muted)', padding: '0 4px 0 2px', minWidth: 34, textAlign: 'right' }}>{Math.round(curPct)}%</span>
                  <span style={{ alignSelf: 'center', fontSize: 11, color: 'var(--muted)', paddingRight: 6, whiteSpace: 'nowrap' }}>· 끌어서 다른 사진 옆에 놓으면 나란히</span>
                </div>
                {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sy]) => (
                  <div key={`${sx}${sy}`} data-img-tools="1" onPointerDown={e => startImgDrag(e, sx, sy)} title="끌어서 크기 조절"
                    style={{ position: 'fixed', left: (sx < 0 ? imgRect.left : imgRect.right) - 9, top: (sy < 0 ? imgRect.top : imgRect.bottom) - 9,
                      width: 18, height: 18, borderRadius: 4, background: 'var(--accent)', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.3)',
                      cursor: sx === sy ? 'nwse-resize' : 'nesw-resize', zIndex: 61, touchAction: 'none' }} />
                ))}
              </>
            )}

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
          </div>

          {/* 설정 사이드바 — PC만. 모바일은 등록 시 모달로 */}
          {isDesktop && (
            <aside className="taku-write-side" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {isGoods && (
                <div style={{ border: '1px solid var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.06))', borderRadius: 14, padding: '16px 16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--accent)', marginBottom: 10 }}>굿즈 자랑 팁</div>
                  <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>
                    <li>굿즈의 포인트가 잘 보이게 사진을 찍어보세요.</li>
                    <li>구입처, 가격, 만족도 등 정보를 함께 남겨주면 좋아요!</li>
                    <li>다른 타쿠들이 궁금해할 내용도 환영이에요.</li>
                  </ul>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--accent)', marginTop: 12 }}>서로 존중하고 즐겁게 자랑해요!</div>
                </div>
              )}
              {isGoods && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>굿즈 정보</div>
                  {goodsMetaFields}
                </div>
              )}
              <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 900 }}>설정</div>
                {settingsFields}
              </div>
            </aside>
          )}
        </div>
        {isGoods && !existingGoodsId && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, padding: '14px 16px', borderRadius: 14, border: '1px solid var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.06))', cursor: 'pointer' }}>
            <input type="checkbox" checked={addToCollection} onChange={() => setAddToCollection(v => !v)} style={{ width: 18, height: 18, accentColor: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>이 글의 굿즈를 내 컬렉션에도 담기</span>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>작품별 컬렉션에 자동으로 정리돼요.</span>
            </span>
          </label>
        )}
      </div>
      {pollOpen && <PollModal onClose={() => setPollOpen(false)} onConfirm={data => { setPollData(data); setPollOpen(false) }} />}
      {tableOpen && <TableModal onClose={() => setTableOpen(false)} onConfirm={html => { appendBlock(html); setTableOpen(false) }} />}

      {/* 📱 등록 옵션 모달 (모바일: 등록 누르면 뜸) */}
      {settingsOpen && (
        <div onClick={() => setSettingsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '20px 18px calc(18px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '82vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>{editId ? '수정 옵션' : '등록 옵션'}</div>
            {isGoods && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                {goodsMetaFields}
              </div>
            )}
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
              <button onClick={submit} disabled={saving || (isFanart && !allAgreed)} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: (saving || (isFanart && !allAgreed)) ? 'var(--border)' : 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: (saving || (isFanart && !allAgreed)) ? 'default' : 'pointer', fontFamily: 'inherit' }}>{saving ? (editId ? '수정 중…' : '등록 중…') : (editId ? '수정' : (existingGoodsId ? '게시글 등록' : '등록'))}</button>
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

const goodsCard: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', marginBottom: 16 }
const laneArrow: React.CSSProperties = { flexShrink: 0, width: 30, height: 30, borderRadius: 9999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
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
