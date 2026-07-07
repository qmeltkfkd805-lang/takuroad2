'use client'

import { useState, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { uploadShopMainImage, setShopMainImage } from '@/services/shopService'
import { getCroppedImageFile, CropArea } from '@/lib/utils/cropImage'

interface Props {
  shopSlug: string
  shopId: string
  currentImageUrl?: string | null
  onUploaded?: (url: string) => void
}

export default function ShopMainImageUploader({ shopSlug, shopId, currentImageUrl, onUploaded }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
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
    setRawImageSrc(URL.createObjectURL(file))
  }

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixelsValue: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixelsValue)
  }, [])

  async function handleSaveCrop() {
    if (!rawImageSrc || !croppedAreaPixels) return
    setUploading(true)

    const croppedFile = await getCroppedImageFile(rawImageSrc, croppedAreaPixels, `main-${Date.now()}.jpg`, rotation)
    const url = await uploadShopMainImage(croppedFile, shopSlug)

    if (url) {
      await setShopMainImage(shopId, url)
      setSavedImageUrl(url)
      onUploaded?.(url)
    }

    setRawImageSrc(null)
    setRotation(0)
    setZoom(1)
    setUploading(false)
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
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  )
}


function Svg({ size = 14, color = 'currentColor', fill = 'none', children }: { size?: number; color?: string; fill?: string; children: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden>{children}</svg>
}
