'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getShopHighlights, createHighlight, deleteHighlight, uploadHighlightImage } from '@/services/shopHighlightService'

interface Props {
  shopId: string
  shopSlug: string
}

export default function ShopHighlightManager({ shopId, shopSlug }: Props) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [highlights, setHighlights] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadHighlights()
  }, [shopId])

  async function loadHighlights() {
    const data = await getShopHighlights(shopId)
    setHighlights(data)
    setLoading(false)
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleAdd() {
    if (!user || !title.trim()) return
    setSubmitting(true)

    let imageUrl: string | null = null
    if (imageFile) {
      imageUrl = await uploadHighlightImage(imageFile, shopSlug)
    }

    const ok = await createHighlight(shopId, title, imageUrl, user.id)
    if (ok) {
      setTitle('')
      setImageFile(null)
      setImagePreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadHighlights()
    }
    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('이 추천 코너를 삭제할까요?')) return
    await deleteHighlight(id)
    loadHighlights()
  }

  if (loading) return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>

  return (
    <div>
      <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
        "이 샵 가면 이것만큼은 꼭 보세요" — 가본 사람만 아는 포인트를 알려주세요
      </p>

      <div style={{ border: '1.5px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="예: 블루아카이브 벽면, 랜덤깡 코너"
          style={{
            width: '100%', padding: '9px 12px', marginBottom: '10px',
            border: '1.5px solid var(--border)', borderRadius: '8px',
            fontSize: '13px', fontFamily: 'inherit',
            background: 'var(--surface)', color: 'var(--text)',
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        {imagePreview ? (
          <div style={{ position: 'relative', marginBottom: '10px', display: 'inline-block' }}>
            <img src={imagePreview} alt="" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
            <button
              onClick={() => { setImageFile(null); setImagePreview(null) }}
              style={{
                position: 'absolute', top: '-6px', right: '-6px',
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'var(--red)', color: '#fff', border: 'none',
                cursor: 'pointer', fontSize: '11px',
              }}
            >✕</button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '7px 12px', borderRadius: '8px', marginBottom: '10px',
              border: '1.5px dashed var(--border)', background: 'var(--surface)',
              fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            📷 사진 추가
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />

        <button
          onClick={handleAdd}
          disabled={submitting || !title.trim()}
          style={{
            width: '100%', padding: '9px', borderRadius: '8px', border: 'none',
            background: title.trim() ? 'var(--accent)' : 'var(--border)', color: '#fff',
            fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {submitting ? '추가 중...' : '추가하기'}
        </button>
      </div>

      {highlights.map(h => (
        <div key={h.id} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '8px',
        }}>
          {h.image_url && (
            <img src={h.image_url} alt="" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
          )}
          <span style={{ flex: 1, fontSize: '13px', fontWeight: 700 }}>{h.title}</span>
          <button
            onClick={() => handleDelete(h.id)}
            style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '12px' }}
          >삭제</button>
        </div>
      ))}
    </div>
  )
}