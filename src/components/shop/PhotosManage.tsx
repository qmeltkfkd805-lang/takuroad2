'use client'
import AppIcon from '@/components/tds/AppIcon'
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

const MAX_PHOTOS = 20

/** 여러 장 업로드 + ★대표 지정 + 순서변경 + 삭제. embedded=true면 등록 위저드용으로 헤더 숨김 */
export default function PhotosManage({ shop, embedded = false }: { shop: { id: string; slug: string }; embedded?: boolean }) {
  const { user } = useAuth()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<ShopImageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const imagesRef = useRef<ShopImageRow[]>([])

  // 대표 구도 조정(자르기) — 대표 사진이 히어로에 어떻게 보일지 정한다
  const [cropTarget, setCropTarget] = useState<ShopImageRow | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [caPixels, setCaPixels] = useState<CropArea | null>(null)
  const [cropBusy, setCropBusy] = useState(false)

  useEffect(() => { imagesRef.current = images }, [images])

  async function load() {
    const rows = await getShopImages(shop.id)
    setImages(rows)
    setDirty(false)
    setLoading(false)
  }
  useEffect(() => { load() }, [shop.id])

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
        return arr
      })
    }

    function onUp() {
      setDragId(null)
      setDirty(true)
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
    setBusy(true)
    const ok = await persistOrder()
    if (ok) {
      await load()
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
      if (!embedded) router.refresh()
    } else {
      alert('순서 저장에 실패했어요.')
    }
    setBusy(false)
  }

  useEffect(() => {
    if (!dirty) return
    function warn(e: BeforeUnloadEvent) { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !user) return
    if (images.length + files.length > MAX_PHOTOS) {
      alert('사진은 최대 ' + MAX_PHOTOS + '장까지 올릴 수 있어요.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setBusy(true)
    if (dirty) await persistOrder()
    let order = images.length
    for (const f of files) {
      const url = await uploadShopMainImage(f, shop.slug)
      if (url) {
        await addShopImage(shop.id, url, user.id, order)
        order++
      }
    }
    if (fileRef.current) fileRef.current.value = ''
    await load()
    setBusy(false)
    if (!embedded) router.refresh()
  }

  async function onDelete(img: ShopImageRow) {
    if (busy) return
    if (!confirm('이 사진을 삭제할까요?')) return
    setBusy(true)
    if (dirty) await persistOrder()
    const ok = await deleteShopImage(img.id)
    if (!ok) alert('삭제에 실패했어요.')
    await load()
    setBusy(false)
    if (!embedded) router.refresh()
  }

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

  // 구도 조정 열기
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
      if (!url) { alert('구도 저장에 실패했어요.'); setCropBusy(false); return }
      if (dirty) await persistOrder()
      await addShopImage(shop.id, url, user.id, so)
      await deleteShopImage(cropTarget.id)
      const rows = await getShopImages(shop.id)
      if (wasCover) {
        const nw = rows.find(r => r.image_url === url)
        if (nw) await setShopCoverImage(shop.id, nw.id)
      }
      await load()
      if (!embedded) router.refresh()
    } catch {
      alert('이미지를 불러오지 못했어요. 새로고침 후 다시 시도해주세요.')
    }
    setCropTarget(null)
    setCropBusy(false)
  }

  return (
    <div className={styles.wrap}>
      {!embedded && (
        <>
          <Link href={'/shop/' + shop.slug + '/manage'} className={styles.back}>← 매장 관리</Link>
          <h1 className={styles.title}>사진 관리</h1>
        </>
      )}
      <p className={styles.desc}>여러 장을 올리고 <b>★ 대표</b>를 지정하세요. <b>✂ 구도</b>로 대표가 화면에 어떻게 보일지 맞출 수 있어요. 대표는 샵 카드·상세 히어로에 먼저 보이고, 나머지는 ‹ ›로 넘겨봐요. ⠿ 손잡이로 순서 변경.</p>

      {loading ? (
        <p className={styles.empty}>불러오는 중…</p>
      ) : images.length === 0 ? (
        <p className={styles.empty}>아직 등록된 사진이 없어요.</p>
      ) : (
        <div className={styles.grid}>
          {images.map(img => (
            <div
              key={img.id}
              data-img-id={img.id}
              className={dragId === img.id ? styles.cellDrag : styles.cell}
            >
              <img src={img.image_url} alt="" className={styles.thumb} draggable={false} />
              {img.is_cover && <span className={styles.coverTag}>대표</span>}
              <button
                className={styles.grip}
                onPointerDown={() => { if (!busy) setDragId(img.id) }}
                aria-label="순서 바꾸기"
              >⠿</button>
              <div className={styles.tools}>
                <button
                  className={img.is_cover ? styles.toolOn : styles.tool}
                  onClick={() => onCover(img)}
                  disabled={busy}
                >★ 대표</button>
                <button className={styles.tool} onClick={() => openCrop(img)} disabled={busy}>✂ 구도</button>
                <button className={styles.toolDel} onClick={() => onDelete(img)} disabled={busy} aria-label="삭제"><AppIcon name="close" size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.saveBar}>
        <span className={styles.saveMsg}>
          {dirty ? '순서가 바뀌었어요' : savedFlash ? '저장했어요 ✓' : '⠿ 손잡이를 끌어 순서를 바꿔보세요'}
        </span>
        <button className={styles.saveBtn} onClick={saveOrder} disabled={busy || !dirty}>
          {busy ? '저장 중…' : '저장하기'}
        </button>
      </div>

      <button className={styles.addBtn} onClick={() => fileRef.current?.click()} disabled={busy || images.length >= MAX_PHOTOS}>
        {busy ? '처리 중…' : '+ 사진 추가'}
      </button>
      <p className={styles.count}>{images.length} / {MAX_PHOTOS}장</p>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} hidden />

      {/* 구도 조정(자르기) — 보일 영역을 정한다 */}
      {cropTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 520 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, marginBottom: 4, textAlign: 'center' }}>구도 조정</div>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5, marginBottom: 10, textAlign: 'center' }}>대표 사진이 목록·상세 맨 위에 어떻게 보일지 맞춰주세요 (드래그·확대·회전)</div>
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
              <button onClick={saveCrop} disabled={cropBusy} style={{ flex: 1, padding: 11, borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{cropBusy ? '저장 중…' : '이 구도로 저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}