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
import { Shop } from '@/types/shop'
import styles from './photosManage.module.css'

const MAX_PHOTOS = 20

export default function PhotosManage({ shop }: { shop: Shop }) {
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
      router.refresh()
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
    router.refresh()
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
    router.refresh()
  }

  async function onCover(img: ShopImageRow) {
    if (busy || img.is_cover) return
    setBusy(true)
    if (dirty) await persistOrder()
    const ok = await setShopCoverImage(shop.id, img.id)
    if (!ok) alert('대표 사진 지정에 실패했어요.')
    await load()
    setBusy(false)
    router.refresh()
  }

  return (
    <div className={styles.wrap}>
      <Link href={'/shop/' + shop.slug + '/manage'} className={styles.back}>← 매장 관리</Link>
      <h1 className={styles.title}>사진 관리</h1>
      <p className={styles.desc}>⠿ 손잡이를 잡고 끌어서 순서를 바꿀 수 있어요. 대표 사진이 목록과 지도에 먼저 보여요.</p>

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
                <button className={styles.toolDel} onClick={() => onDelete(img)} disabled={busy} aria-label="삭제">✕</button>
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
    </div>
  )
}