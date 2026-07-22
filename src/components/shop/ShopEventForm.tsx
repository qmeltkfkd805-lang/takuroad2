'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  createShopEvent, updateShopEvent, uploadEventImage, uploadEventVideo,
  MAX_EVENT_VIDEO_MB, ShopEventType, EVENT_TYPE_ICON, EVENT_TYPE_LABEL,
} from '@/services/shopEventService'
import styles from './shopEventForm.module.css'

const EVENT_TYPES: ShopEventType[] = [
  'notice', 'event', 'restock', 'new_arrival',
  'sold_out', 'discount', 'reservation', 'exchange_meet', 'fan_meet',
]

interface Props {
  shopId: string
  shopSlug: string
  initialType?: ShopEventType
  event?: any
}

export default function ShopEventForm({ shopId, shopSlug, initialType, event }: Props) {
  const { user } = useAuth()
  const router = useRouter()
  const isEdit = !!event
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  const [type, setType] = useState<ShopEventType>(event?.type ?? initialType ?? 'notice')
  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [startsAt, setStartsAt] = useState((event?.starts_at ?? '').slice(0, 10))
  const [endsAt, setEndsAt] = useState((event?.ends_at ?? '').slice(0, 10))
  const [keptImage, setKeptImage] = useState<string | null>(event?.image_url ?? null)
  const [keptVideo, setKeptVideo] = useState<string | null>(event?.video_url ?? null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
    setVideoFile(null); setVideoPreview(null); setKeptVideo(null); setKeptImage(null)
  }
  function removeImage() {
    setImageFile(null); setImagePreview(null); setKeptImage(null)
    if (fileRef.current) fileRef.current.value = ''
  }
  function onVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_EVENT_VIDEO_MB * 1024 * 1024) {
      alert('영상이 너무 커요 (' + Math.round(f.size / 1024 / 1024) + 'MB). 4K 대신 1080p로 찍거나 30초 내외로 잘라서 올려주세요. (최대 ' + MAX_EVENT_VIDEO_MB + 'MB)')
      if (videoRef.current) videoRef.current.value = ''
      return
    }
    const url = URL.createObjectURL(f)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      if (probe.duration > 90) {
        alert('영상은 90초 이내로 올려주세요. (현재 ' + Math.round(probe.duration) + '초)')
        URL.revokeObjectURL(url)
        if (videoRef.current) videoRef.current.value = ''
        return
      }
      setVideoFile(f)
      setVideoPreview(url)
      setImageFile(null); setImagePreview(null); setKeptImage(null); setKeptVideo(null)
    }
    probe.src = url
  }
  function removeVideo() {
    setVideoFile(null); setVideoPreview(null); setKeptVideo(null)
    if (videoRef.current) videoRef.current.value = ''
  }

  async function submit() {
    if (!user || !title.trim() || submitting) return
    setSubmitting(true)

    let imageUrl: string | undefined = keptImage ?? undefined
    let videoUrl: string | undefined = keptVideo ?? undefined

    if (imageFile) {
      const url = await uploadEventImage(imageFile, shopSlug)
      if (url) { imageUrl = url; videoUrl = undefined }
    }
    if (videoFile) {
      const url = await uploadEventVideo(videoFile, shopSlug)
      if (!url) { setSubmitting(false); alert('영상 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.'); return }
      videoUrl = url; imageUrl = undefined
    }

    let ok = false
    if (isEdit) {
      ok = await updateShopEvent(event.id, {
        type, title,
        description: description || null,
        image_url: imageUrl ?? null,
        video_url: videoUrl ?? null,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
      })
    } else {
      ok = await createShopEvent({
        shopId, type, title,
        description: description || undefined,
        imageUrl, videoUrl,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
        userId: user.id,
      })
    }

    setSubmitting(false)
    if (ok) {
      router.push('/shop/' + shopSlug + '/manage/events')
      router.refresh()
    } else {
      alert(isEdit ? '수정에 실패했어요.' : '등록에 실패했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  const showImage = imagePreview ?? keptImage
  const showVideo = videoPreview ?? keptVideo
  const heading = isEdit
    ? '매장 소식 수정'
    : (type === 'restock' || type === 'new_arrival') ? '입고 소식 등록' : '매장 소식 등록'

  return (
    <div className={styles.wrap}>
      <Link href={'/shop/' + shopSlug + '/manage/events'} className={styles.back}>← 이벤트 관리</Link>
      <h1 className={styles.title}>{heading}</h1>
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
      {showImage ? (
        <div className={styles.previewBox}>
          <img src={showImage} alt="" className={styles.preview} />
          <button className={styles.previewDel} onClick={removeImage}>✕</button>
        </div>
      ) : (
        <button className={styles.imageBtn} onClick={() => fileRef.current?.click()}>📷 사진 추가</button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onImage} hidden />

      <label className={styles.label}>영상 <span className={styles.opt}>(선택 · 세로 영상 추천, {MAX_EVENT_VIDEO_MB}MB · 90초 이하)</span></label>
      {showVideo ? (
        <div className={styles.previewBox}>
          <video src={showVideo} className={styles.videoPreview} controls playsInline muted />
          <button className={styles.previewDel} onClick={removeVideo}>✕</button>
        </div>
      ) : (
        <button className={styles.imageBtn} onClick={() => videoRef.current?.click()}>🎬 영상 추가</button>
      )}
      <input ref={videoRef} type="file" accept="video/*" onChange={onVideo} hidden />

      <button className={styles.submit} onClick={submit} disabled={!title.trim() || submitting}>
        {submitting ? (isEdit ? '수정 중…' : '등록 중…') : (isEdit ? '수정 완료' : '소식 등록')}
      </button>
    </div>
  )
}