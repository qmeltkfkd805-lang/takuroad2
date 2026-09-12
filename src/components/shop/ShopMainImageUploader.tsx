'use client'

import { useState, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import {
  uploadShopImage, addShopImage, deleteShopImage,
  setShopCoverImage, removeUploadedObject,
} from '@/services/shopService'
import { getCroppedImageFile, CropArea } from '@/lib/utils/cropImage'
import {
  SHOP_IMAGE_PRESET, ALLOWED_INPUT_MIME, UploadError, UPLOAD_ERROR_TEXT,
} from '@/lib/utils/imageEncode'

interface Props {
  shopSlug: string
  shopId: string
  /** 로그인 사용자 id. 상위(ShopForm)가 useAuth 로 이미 갖고 있는 값을 그대로 받는다.
   *  이 컴포넌트에서 auth.getUser() 를 새로 부르지 않는다.
   *  uploaded_by 기록용이며 권한 근거가 아니다 — 소유권 판정은 RLS 가 한다. */
  userId: string
  currentImageUrl?: string | null
  onUploaded?: (url: string) => void
}

export default function ShopMainImageUploader({ shopSlug, shopId, userId, currentImageUrl, onUploaded }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  /* 동기 실행 잠금. setUploading 은 리렌더가 비동기라 같은 프레임 안의
     두 번째 클릭이 클로저의 옛 uploading(false)을 보고 통과한다.
     중복 실행 방지는 이 ref 가 맡고, uploading state 는 버튼 라벨·disabled 표시 전용이다. */
  const uploadLockRef = useRef(false)
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(currentImageUrl ?? null)
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null)
  const [uploading, setUploading] = useState(false)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type || !ALLOWED_INPUT_MIME.has(file.type)) {
      alert(UPLOAD_ERROR_TEXT['unsupported-type'])
      e.target.value = ''
      return
    }
    setRawImageSrc(URL.createObjectURL(file))
  }

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixelsValue: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixelsValue)
  }, [])

  /* 새 파일 업로드 → DB 행 안전 추가 → 원자적 대표 전환 → 성공 후에만 화면 갱신.
     기존 대표 행과 기존 Storage 객체는 어느 경로에서도 건드리지 않는다.
     이전 대표는 삭제되지 않고 갤러리 사진으로 강등된다. */
  async function handleSaveCrop() {
    // 입력 검증은 잠금을 잡기 전에 끝낸다 — 잡았다 푸는 경로를 만들지 않는다.
    if (!rawImageSrc || !croppedAreaPixels) return
    if (!userId) return                          // 로그인 사용자가 없으면 시작하지 않는다

    if (uploadLockRef.current) return            // 중복 클릭 방지 (동기)
    uploadLockRef.current = true
    setUploading(true)

    try {
      const croppedFile = await getCroppedImageFile(
        rawImageSrc, croppedAreaPixels, `main-${Date.now()}.webp`, rotation,
        SHOP_IMAGE_PRESET,
      )

      // 1) 새 객체 업로드
      const r = await uploadShopImage(croppedFile, shopSlug)
      if (!r.ok) { alert(UPLOAD_ERROR_TEXT[r.code]); return }
      const ref = { bucket: r.bucket, path: r.path }

      // 2) 갤러리 사진으로 먼저 추가한다 (is_cover=false). 기존 대표는 그대로다.
      const newId = await addShopImage(shopId, r.url, userId, 0, ref)
      if (!newId) {
        await removeUploadedObject(ref)
        alert(UPLOAD_ERROR_TEXT['db-failed'])
        return
      }

      // 3) 원자적 대표 전환. 실패하면 방금 만든 것만 되돌린다.
      const promoted = await setShopCoverImage(shopId, newId)
      if (!promoted) {
        const rowGone = await deleteShopImage(newId)
        if (rowGone) await removeUploadedObject(ref)
        else console.error('[롤백 실패] 신규 행 =', newId, '/ 정리 대상 =', `${ref.bucket}/${ref.path}`)
        alert('대표 사진 지정에 실패했어요.')
        return                                   // 성공 표시·미리보기 갱신 안 함
      }

      // 4) 성공한 뒤에만 화면을 갱신한다
      setSavedImageUrl(r.url)
      onUploaded?.(r.url)
    } catch (e) {
      alert(UPLOAD_ERROR_TEXT[e instanceof UploadError ? e.code : 'encode-failed'])
    } finally {
      // 어떤 경로로 빠져나가도 잠금을 반드시 푼다
      uploadLockRef.current = false
      setRawImageSrc(null)
      setRotation(0)
      setZoom(1)
      setUploading(false)
    }
  }

  function handleCancelCrop() {
    setRawImageSrc(null)
    setRotation(0)
    setZoom(1)
  }

  return (
    <div>
      <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}><Svg size={15} color="var(--accent)"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></Svg>대표 사진</h3>
      <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
        샵 목록과 상세 페이지 맨 위에 보이는 사진이에요
      </p>

      {!rawImageSrc ? (
        <>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%', height: '160px', borderRadius: '12px',
              border: '1.5px dashed var(--border)', background: 'var(--surface2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', overflow: 'hidden',
            }}
          >
            {savedImageUrl ? (
              <img src={savedImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}><Svg size={14}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></Svg> 클릭해서 사진 추가</span>
            )}
          </div>

          {savedImageUrl && (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                marginTop: '8px', padding: '7px 14px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--surface)',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              사진 변경
            </button>
          )}
        </>
      ) : (
        <div>
          <div style={{ position: 'relative', width: '100%', height: '280px', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
            <Cropper
              image={rawImageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={16 / 9}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>확대</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              style={{ flex: 1 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>회전</span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onChange={e => setRotation(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '11px', color: 'var(--muted)', width: '34px', textAlign: 'right' }}>{rotation}°</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCancelCrop}
              disabled={uploading}
              style={{
                flex: 1, padding: '10px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--surface)',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              취소
            </button>
            <button
              onClick={handleSaveCrop}
              disabled={uploading}
              style={{
                flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                background: 'var(--accent)', color: '#fff',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {uploading ? '저장 중...' : '이 영역으로 저장'}
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  )
}


function Svg({ size = 14, color = 'currentColor', fill = 'none', children }: { size?: number; color?: string; fill?: string; children: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden>{children}</svg>
}
