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

  async function load() {
    const rows = await getShopImages(shop.id)
    setImages(rows)
    setLoading(false)
  }
  useEffect(() => { load() }, [shop.id])

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !user) return
    if (images.length + files.length > MAX_PHOTOS) {
      alert('사진은 최대 ' + MAX_PHOTOS + '장까지 올릴 수 있어요.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setBusy(true)
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
    const ok = await deleteShopImage(img.id)
    if (!ok) alert('삭제에 실패했어요.')
    await load()
    setBusy(false)
    router.refresh()
  }

  async function onCover(img: ShopImageRow) {
    if (busy || img.is_cover) return
    setBusy(true)
    const ok = await setShopCoverImage(shop.id, img.id)
    if (!ok) alert('대표 사진 지정에 실패했어요.')
    await load()
    setBusy(false)
    router.refresh()
  }

  async function move(idx: number, dir: -1 | 1) {
    if (busy) return
    const next = idx + dir
    if (next < 0 || next >= images.length) return
    const arr = [...images]
    const tmp = arr[idx]
    arr[idx] = arr[next]
    arr[next] = tmp
    setImages(arr)
    setBusy(true)
    await reorderShopImages(arr.map((it, i) => ({ id: it.id, sort_order: i })))
    await load()
    setBusy(false)
    router.refresh()
  }

  return (
    <div className={styles.wrap}>
      <Link href={'/shop/' + shop.slug + '/manage'} className={styles.back}>← 매장 관리</Link>
      <h1 className={styles.title}>사진 관리</h1>
      <p className={styles.desc}>매장 사진을 올리고 순서를 정하세요. 대표 사진이 목록과 지도에 먼저 보여요.</p>

      {loading ? (
        <p className={styles.empty}>불러오는 중…</p>
      ) : images.length === 0 ? (
        <p className={styles.empty}>아직 등록된 사진이 없어요.</p>
      ) : (
        <div className={styles.grid}>
          {images.map((img, i) => (
            <div key={img.id} className={styles.cell}>
              <img src={img.image_url} alt="" className={styles.thumb} />
              {img.is_cover && <span className={styles.coverTag}>대표</span>}
              <div className={styles.tools}>
                <button className={styles.tool} onClick={() => move(i, -1)} disabled={i === 0 || busy} aria-label="앞으로">‹</button>
                <button
                  className={img.is_cover ? styles.toolOn : styles.tool}
                  onClick={() => onCover(img)}
                  disabled={busy}
                  aria-label="대표 사진으로"
                >★</button>
                <button className={styles.tool} onClick={() => move(i, 1)} disabled={i === images.length - 1 || busy} aria-label="뒤로">›</button>
                <button className={styles.toolDel} onClick={() => onDelete(img)} disabled={busy} aria-label="삭제">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className={styles.addBtn} onClick={() => fileRef.current?.click()} disabled={busy || images.length >= MAX_PHOTOS}>
        {busy ? '처리 중…' : '+ 사진 추가'}
      </button>
      <p className={styles.count}>{images.length} / {MAX_PHOTOS}장</p>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} hidden />
    </div>
  )
}