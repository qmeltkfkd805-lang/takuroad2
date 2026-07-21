'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  createShopEvent, uploadEventImage, ShopEventType,
  EVENT_TYPE_ICON, EVENT_TYPE_LABEL,
} from '@/services/shopEventService'
import styles from './shopEventForm.module.css'

const EVENT_TYPES: ShopEventType[] = [
  'notice', 'event', 'restock', 'new_arrival',
  'sold_out', 'discount', 'reservation', 'exchange_meet', 'fan_meet',
]

export default function ShopEventForm({ shopId, shopSlug }: { shopId: string; shopSlug: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<ShopEventType>('notice')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
  }
  function removeImage() {
    setImageFile(null); setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit() {
    if (!user || !title.trim() || submitting) return
    setSubmitting(true)
    let imageUrl: string | undefined
    if (imageFile) {
      const url = await uploadEventImage(imageFile, shopSlug)
      if (url) imageUrl = url
    }
    const ok = await createShopEvent({
      shopId, type, title,
      description: description || undefined,
      imageUrl,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      userId: user.id,
    })
    setSubmitting(false)
    if (ok) router.push(`/shop/${shopSlug}/manage/events`)
    else alert('등록에 실패했어요. 잠시 후 다시 시도해 주세요.')
  }

  return (
    <div className={styles.wrap}>
      <Link href={`/shop/${shopSlug}/manage/events`} className={styles.back}>← 이벤트 관리</Link>
      <h1 className={styles.title}>매장 소식 등록</h1>
      <p className={styles.desc}>공지·재입고·할인 같은 소식을 올리면 샵 상세에 표시돼요.</p>

      <label className={styles.label}>소식 종류</label>
      <div className={styles.types}>
        {EVENT_TYPES.map(t => (
          <button key={t} className={type === t ? styles.typeOn : styles.type} onClick={() => setType(t)}>
            {EVENT_TYPE_ICON[t]} {EVENT_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <label className={styles.label}>제목</label>
      <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 블루아카 아크릴 재입고" />

      <label className={styles.label}>설명 <span className={styles.opt}>(선택)</span></label>
      <textarea className={styles.textarea} value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="자세한 내용을 적어주세요." />

      <label className={styles.label}>기간 <span className={styles.opt}>(선택)</span></label>
      <div className={styles.dates}>
        <input type="date" className={styles.input} value={startsAt} onChange={e => setStartsAt(e.target.value)} />
        <span className={styles.tilde}>~</span>
        <input type="date" className={styles.input} value={endsAt} onChange={e => setEndsAt(e.target.value)} min={startsAt || undefined} />
      </div>

      <label className={styles.label}>사진 <span className={styles.opt}>(선택)</span></label>
      {imagePreview ? (
        <div className={styles.previewBox}>
          <img src={imagePreview} alt="" className={styles.preview} />
          <button className={styles.previewDel} onClick={removeImage}>✕</button>
        </div>
      ) : (
        <button className={styles.imageBtn} onClick={() => fileRef.current?.click()}>📷 사진 추가</button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onImage} hidden />

      <button className={styles.submit} onClick={submit} disabled={!title.trim() || submitting}>
        {submitting ? '등록 중…' : '소식 등록'}
      </button>
    </div>
  )
}