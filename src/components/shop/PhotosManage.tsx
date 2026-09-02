'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getShopImages, addShopImage, deleteShopImage,
  setShopCoverImage, reorderShopImages, uploadShopMainImage,
  ShopImageRow,
} from '@/services/shopService'
import Cropper from 'react-easy-crop'
import { getCroppedImageFile, CropArea } from '@/lib/utils/cropImage'
import styles from './photosManage.module.css'

const MAX_PHOTOS = 10

/* 샵 사진 관리 — 고른 사진 한 장을 크게 보며 편집하는 구조.
   ① 제목·개수 ② 사진 추가 ③ 큰 미리보기 + 그 아래 대표·보이는 영역·삭제
   ④ 오른쪽 썸네일 목록(드래그 순서) ⑤ 순서가 바뀐 경우에만 저장 줄
   embedded=true면 등록 위저드 안 — 페이지 헤더·여백을 쓰지 않는다.
   ⚠️ 저장 API·삭제 정책·대표 필드(is_cover)·정렬값(sort_order)은 기존 그대로 재사용. */
export default function PhotosManage({ shop, embedded = false, onCoverChange, onDirtyChange }: {
  shop: { id: string; slug: string }
  embedded?: boolean
  /** 대표 사진이 바뀌면 알려준다(위저드 우측 미리보기 즉시 반영용) */
  onCoverChange?: (url: string | null) => void
  /** 저장 안 한 순서 변경이 있는지 알려준다(위저드가 나가기 전에 경고하려고) */
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { user } = useAuth()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<ShopImageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const imagesRef = useRef<ShopImageRow[]>([])
  // 꾹 눌러서 끌기 — 짧게 누르면 대표 지정, 길게 누르거나 끌면 순서 변경
  const pendingRef = useRef<{ id: string; x: number; y: number; touch: boolean; timer: number } | null>(null)
  const movedRef = useRef(false)

  // 업로드 상태
  const [dropOver, setDropOver] = useState(false)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])

  // 보이는 영역 조정(자르기) — 사진이 카드·히어로에 어떻게 보일지 정한다
  const [cropTarget, setCropTarget] = useState<ShopImageRow | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [caPixels, setCaPixels] = useState<CropArea | null>(null)
  const [cropBusy, setCropBusy] = useState(false)

  useEffect(() => { imagesRef.current = images }, [images])
  useEffect(() => { onDirtyChange?.(dirty)   }, [dirty])

  /* 큰 미리보기 = 항상 대표 사진. 그래서 대표가 없으면 첫 사진을 자동으로 대표로 만든다
     (addShopImage가 is_cover:false로 넣기 때문에 새 샵은 대표가 비어 있다) */
  async function load() {
    let rows = await getShopImages(shop.id)
    if (rows.length > 0 && !rows.some(r => r.is_cover)) {
      const ok = await setShopCoverImage(shop.id, rows[0].id)
      if (ok) rows = await getShopImages(shop.id)
    }
    setImages(rows)
    setDirty(false)
    setLoading(false)
    onCoverChange?.(rows.find(r => r.is_cover)?.image_url ?? rows[0]?.image_url ?? null)
  }
  useEffect(() => { load()   }, [shop.id])

  // 드래그 중 전역 포인터 추적
  useEffect(() => {
    if (!dragId) return

    function onMove(e: PointerEvent) {
      e.preventDefault()
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const cell = el?.closest('[data-img-id]')
      const overId = cell?.getAttribute('data-img-id')
      if (!overId || overId === dragId) return
      setImages(prev => {
        const from = prev.findIndex(p => p.id === dragId)
        const to = prev.findIndex(p => p.id === overId)
        if (from < 0 || to < 0 || from === to) return prev
        const arr = [...prev]
        const [moved] = arr.splice(from, 1)
        arr.splice(to, 0, moved)
        movedRef.current = true
        return arr
      })
    }

    function onUp() {
      setDragId(null)
      if (movedRef.current) setDirty(true)   // 실제로 자리가 바뀐 경우에만
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragId])

  // 저장 안 한 순서가 있으면 먼저 반영 (다른 작업이 reload로 덮어쓰는 것 방지)
  async function persistOrder() {
    const arr = imagesRef.current
    return reorderShopImages(arr.map((it, i) => ({ id: it.id, sort_order: i })))
  }

  async function saveOrder() {
    if (busy || !dirty) return
    const before = imagesRef.current   // 실패 시 되돌릴 순서
    setBusy(true)
    const ok = await persistOrder()
    if (ok) {
      await load()
      if (!embedded) router.refresh()
    } else {
      setImages(before)   // 실패 → 기존 순서로 복구
      alert('순서 저장에 실패했어요. 잠시 후 다시 시도해주세요.')
    }
    setBusy(false)
  }

  useEffect(() => {
    if (!dirty) return
    function warn(e: BeforeUnloadEvent) { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /* ── 업로드 (클릭 · 드래그앤드롭 공용) ── */
  async function handleFiles(list: File[]) {
    if (!list.length || !user || busy) return
    const errs: string[] = []
    const seen = new Set<string>()
    const picked: File[] = []

    for (const f of list) {
      if (!f.type.startsWith('image/')) { errs.push(`${f.name} · 이미지 파일이 아니에요`); continue }
      const key = `${f.name}:${f.size}`
      if (seen.has(key)) { errs.push(`${f.name} · 같은 파일이 중복돼 한 장만 올려요`); continue }
      seen.add(key)
      if (images.length + picked.length >= MAX_PHOTOS) { errs.push(`${f.name} · 최대 ${MAX_PHOTOS}장까지만 올릴 수 있어요`); continue }
      picked.push(f)
    }
    setUploadErrors(errs)
    if (fileRef.current) fileRef.current.value = ''
    if (!picked.length) return

    setBusy(true)
    setUploading({ done: 0, total: picked.length })
    if (dirty) await persistOrder()
    let order = images.length
    for (let i = 0; i < picked.length; i++) {
      const f = picked[i]
      const url = await uploadShopMainImage(f, shop.slug)
      if (url) {
        await addShopImage(shop.id, url, user.id, order)
        order++
      } else {
        errs.push(`${f.name} · 업로드에 실패했어요`)
      }
      setUploading({ done: i + 1, total: picked.length })
    }
    setUploadErrors([...errs])
    await load()
    setUploading(null)
    setBusy(false)
    if (!embedded) router.refresh()
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(Array.from(e.target.files ?? []))
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDropOver(false)
    handleFiles(Array.from(e.dataTransfer.files ?? []))
  }

  async function onDelete(img: ShopImageRow) {
    if (busy) return
    const msg = img.is_cover && images.length > 1
      ? '이 사진을 삭제할까요?\n대표 사진이라, 다음 사진이 자동으로 대표가 돼요.'
      : '이 사진을 삭제할까요?'
    if (!confirm(msg)) return
    setBusy(true)
    if (dirty) await persistOrder()
    const ok = await deleteShopImage(img.id)
    if (!ok) alert('삭제에 실패했어요.')
    await load()   // load()가 대표 없는 상태를 자동으로 메운다
    setBusy(false)
    if (!embedded) router.refresh()
  }

  /* 썸네일 포인터 — 짧게 누르면 대표 지정, 꾹 누르거나 끌면 순서 변경.
     (손잡이 없이 사진 아무 데나 잡아서 옮길 수 있게) */
  const LONG_PRESS = 260, MOUSE_SLOP = 5, TOUCH_SLOP = 12
  function clearPending() {
    if (pendingRef.current) { window.clearTimeout(pendingRef.current.timer); pendingRef.current = null }
  }
  function beginDrag(id: string) {
    clearPending()
    movedRef.current = false
    setDragId(id)
  }
  function onThumbDown(img: ShopImageRow, e: React.PointerEvent) {
    if (busy) return
    const touch = e.pointerType !== 'mouse'
    clearPending()
    pendingRef.current = {
      id: img.id, x: e.clientX, y: e.clientY, touch,
      timer: window.setTimeout(() => beginDrag(img.id), LONG_PRESS),
    }
  }
  function onThumbMove(e: React.PointerEvent) {
    const p = pendingRef.current
    if (!p || dragId) return
    const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y)
    if (!p.touch && dist > MOUSE_SLOP) beginDrag(p.id)      // 마우스: 조금만 끌어도 바로 드래그
    else if (p.touch && dist > TOUCH_SLOP) clearPending()   // 터치: 길게 누르기 전에 움직이면 스크롤로 본다
  }
  function onThumbUp(img: ShopImageRow) {
    if (dragId) return          // 드래그였음 — 대표 지정 아님
    if (!pendingRef.current) return
    clearPending()
    onCover(img)
  }

  // 썸네일을 짧게 누르면 그 사진이 곧바로 대표가 된다(큰 미리보기 = 대표)
  async function onCover(img: ShopImageRow) {
    if (busy || img.is_cover) return
    setBusy(true)
    if (dirty) await persistOrder()
    const ok = await setShopCoverImage(shop.id, img.id)
    if (!ok) alert('대표 사진 지정에 실패했어요.')
    await load()
    setBusy(false)
    if (!embedded) router.refresh()
  }

  // 보이는 영역 조정 열기
  function openCrop(img: ShopImageRow) {
    if (busy) return
    setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); setCaPixels(null)
    setCropTarget(img)
  }

  // 잘라서 저장 — 원본은 잘린 새 이미지로 교체(같은 자리·대표 유지)
  async function saveCrop() {
    if (!cropTarget || !caPixels || !user) return
    setCropBusy(true)
    const wasCover = cropTarget.is_cover
    const so = cropTarget.sort_order
    try {
      const file = await getCroppedImageFile(cropTarget.image_url, caPixels, `crop-${Date.now()}.jpg`, rotation)
      const url = await uploadShopMainImage(file, shop.slug)
      if (!url) { alert('저장에 실패했어요.'); setCropBusy(false); return }
      if (dirty) await persistOrder()
      await addShopImage(shop.id, url, user.id, so)
      await deleteShopImage(cropTarget.id)
      const rows = await getShopImages(shop.id)
      const nw = rows.find(r => r.image_url === url)
      if (wasCover && nw) await setShopCoverImage(shop.id, nw.id)
      await load()
      if (!embedded) router.refresh()
    } catch {
      alert('이미지를 불러오지 못했어요. 새로고침 후 다시 시도해주세요.')
    }
    setCropTarget(null)
    setCropBusy(false)
  }

  // 크게 보이는 사진 = 대표 사진 (썸네일을 누르면 대표가 바뀐다)
  const selected = images.find(i => i.is_cover) ?? images[0] ?? null
  const full = images.length >= MAX_PHOTOS

  return (
    <div className={embedded ? `${styles.wrap} ${styles.wrapEmbedded}` : styles.wrap}>
      {!embedded && (
        <>
          <Link href={'/shop/' + shop.slug + '/manage'} className={styles.back}>← 매장 관리</Link>
          <h1 className={styles.title}>사진 관리</h1>
        </>
      )}

      {/* ① 제목 + 개수 */}
      <div className={styles.head}>
        <span className={styles.headIcon}>
          <Svg size={19}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="m21 15-5-5L5 21" /></Svg>
        </span>
        <div className={styles.headText}>
          <h2 className={styles.headTitle}>사진</h2>
          <p className={styles.headSub}>샵을 가장 잘 보여주는 사진을 선택해 주세요.</p>
        </div>
        <span className={styles.count}><b className={styles.countNum}>{images.length}</b> / {MAX_PHOTOS}</span>
      </div>

      {/* ② 사진 추가 */}
      <button
        type="button"
        className={dropOver ? `${styles.upload} ${styles.uploadOver}` : styles.upload}
        onClick={() => !busy && !full && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!busy && !full) setDropOver(true) }}
        onDragLeave={() => setDropOver(false)}
        onDrop={onDrop}
        disabled={busy || full}
      >
        <span className={styles.uploadIcon}>
          <Svg size={26}><path d="M12 16V4m0 0L8 8m4-4 4 4" /><path d="M20 16.5A3.5 3.5 0 0 0 18 10a6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 6 18.5" /></Svg>
        </span>
        <span className={styles.uploadTexts}>
          <span className={styles.uploadMain}>
            {uploading ? `업로드 중… ${uploading.done} / ${uploading.total}`
              : full ? `사진을 ${MAX_PHOTOS}장 다 채웠어요`
                : '사진을 끌어다 놓거나 클릭해서 추가'}
          </span>
          <span className={styles.uploadSub}>JPG, PNG · 최대 {MAX_PHOTOS}장</span>
        </span>
        <span className={styles.uploadBtn}>사진 선택</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPick} hidden />

      {uploadErrors.length > 0 && (
        <div className={styles.uploadErrors}>
          {uploadErrors.map((m, i) => <span key={i} className={styles.uploadError}>{m}</span>)}
        </div>
      )}

      {loading ? (
        <p className={styles.empty}>불러오는 중…</p>
      ) : images.length === 0 ? (
        <p className={styles.empty}>아직 등록된 사진이 없어요.</p>
      ) : (
        <div className={styles.main}>
          {/* ③ 선택한 사진 */}
          <div>
            <div className={styles.hero}>
              {selected && <img src={selected.image_url} alt="" className={styles.heroImg} draggable={false} />}
              {selected?.is_cover && (
                <span className={styles.heroBadge}>
                  <Svg size={11} fill="#fff" color="#fff"><path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" /></Svg>
                  대표 사진
                </span>
              )}
            </div>

            <div className={styles.actions}>
              <button className={styles.act} onClick={() => selected && openCrop(selected)} disabled={busy || !selected}>
                <Svg size={14}><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></Svg>
                보이는 영역 조정
              </button>
              <button className={styles.actDanger} onClick={() => selected && onDelete(selected)} disabled={busy || !selected}>삭제</button>
            </div>
            <p className={styles.heroHint}>옆에서 사진을 누르면 그 사진이 대표가 돼요. 대표 사진은 샵 카드와 상세 화면에서 가장 먼저 보여요.</p>
          </div>

          {/* ④ 썸네일 목록 */}
          <div>
            <div className={styles.thumbs}>
              {images.map(img => {
                const cls = dragId === img.id ? styles.thumbCellDrag
                  : img.id === selected?.id ? styles.thumbCellOn : styles.thumbCell
                return (
                  <div key={img.id} data-img-id={img.id} className={cls} role="button" tabIndex={0}
                    aria-label={img.is_cover ? '대표 사진' : '이 사진을 대표로'}
                    onPointerDown={e => onThumbDown(img, e)}
                    onPointerMove={onThumbMove}
                    onPointerUp={() => onThumbUp(img)}
                    onPointerLeave={clearPending}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCover(img) } }}>
                    <img src={img.image_url} alt="" className={styles.thumbImg} draggable={false} />
                    {img.is_cover && (
                      <span className={styles.thumbStar}>
                        <Svg size={11} fill="#fff" color="#fff"><path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" /></Svg>
                      </span>
                    )}
                    <button
                      className={styles.thumbDel}
                      onPointerDown={e => { e.stopPropagation(); clearPending() }}
                      onClick={e => { e.stopPropagation(); onDelete(img) }}
                      disabled={busy}
                      aria-label="이 사진 삭제"
                      title="삭제"
                    >
                      <Svg size={13}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" /></Svg>
                    </button>
                  </div>
                )
              })}
              <button className={styles.addTile} onClick={() => fileRef.current?.click()} disabled={busy || full} aria-label="사진 추가">
                <Svg size={22}><path d="M12 5v14M5 12h14" /></Svg>
              </button>
            </div>
            <p className={styles.thumbsHint}>사진을 꾹 눌러 끌면 노출 순서를 바꿀 수 있어요.</p>
          </div>
        </div>
      )}

      {/* ⑤ 순서가 바뀐 경우에만 */}
      {dirty && (
        <div className={styles.orderBar}>
          <span className={styles.orderMsg}>순서 변경사항이 저장되지 않았어요.</span>
          <button className={styles.orderBtn} onClick={saveOrder} disabled={busy}>
            {busy ? '저장 중…' : '사진 순서 저장'}
          </button>
        </div>
      )}

      {/* 보이는 영역 조정(자르기) */}
      {cropTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 520 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, marginBottom: 4, textAlign: 'center' }}>보이는 영역 조정</div>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5, marginBottom: 10, textAlign: 'center' }}>목록·상세에 어느 부분이 보일지 맞춰주세요 (드래그·확대·회전)</div>
            <div style={{ position: 'relative', width: '100%', height: 300, borderRadius: 12, overflow: 'hidden', background: '#000' }}>
              <Cropper
                image={cropTarget.image_url}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={16 / 9}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={(_a, px) => setCaPixels(px as CropArea)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
              <span style={{ fontSize: 12, color: '#ccc', width: 30 }}>확대</span>
              <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
              <span style={{ fontSize: 12, color: '#ccc', width: 30 }}>회전</span>
              <input type="range" min={-180} max={180} step={1} value={rotation} onChange={e => setRotation(Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: '#ccc', width: 34, textAlign: 'right' }}>{rotation}°</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setCropTarget(null)} disabled={cropBusy} style={{ flex: 1, padding: 11, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={saveCrop} disabled={cropBusy} style={{ flex: 1, padding: 11, borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{cropBusy ? '저장 중…' : '이 영역으로 저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Svg({ size = 14, color = 'currentColor', fill = 'none', children }: { size?: number; color?: string; fill?: string; children: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>{children}</svg>
}
