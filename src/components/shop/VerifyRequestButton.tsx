'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { requestShopVerify, getMyVerifyRequest } from '@/services/shopService'
import { Button } from '@/components/tds/Button'

interface Props {
  shopId: string
  shopName: string
  accentColor: string
}

export default function VerifyRequestButton({ shopId, shopName, accentColor }: Props) {
  const { user } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [myRequest, setMyRequest] = useState<{ status: string; note: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    getMyVerifyRequest(shopId, user.id).then(req => {
      setMyRequest(req)
      setLoading(false)
    })
  }, [shopId, user])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
  }

  function removeFile() {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!user || !note.trim()) return
    setSubmitting(true)
    const ok = await requestShopVerify(shopId, user.id, note, file)
    if (ok) {
      setMyRequest({ status: 'pending', note })
      setShowForm(false)
      setNote('')
      setFile(null)
      setPreview(null)
    }
    setSubmitting(false)
  }

  if (loading) return null
  if (!user) return null

  if (myRequest) {
    const statusInfo = {
      pending:  { label: '인증 심사 중', color: 'var(--yellow)', icon: '⏳' },
      approved: { label: '인증 완료', color: 'var(--green)', icon: '✓' },
      rejected: { label: '인증 거절됨', color: 'var(--red)', icon: '✕' },
    }[myRequest.status] ?? { label: '상태 없음', color: 'var(--muted)', icon: '·' }

    return (
      <div style={{
        padding: '12px 14px', borderRadius: '10px',
        background: `${statusInfo.color}15`, border: `1px solid ${statusInfo.color}40`,
        marginBottom: '20px', fontSize: '13px', fontWeight: 700, color: statusInfo.color,
      }}>
        {statusInfo.icon} {statusInfo.label}
        {myRequest.status === 'rejected' && (
          <button
            onClick={() => { setMyRequest(null); setShowForm(true) }}
            style={{
              marginLeft: '10px', background: 'none', border: 'none',
              textDecoration: 'underline', cursor: 'pointer', color: statusInfo.color, fontWeight: 700,
            }}
          >다시 신청</button>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{
            width: '100%', padding: '12px', borderRadius: '12px',
            border: '1.5px dashed var(--border)', background: 'transparent', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 700, color: accentColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          <span aria-hidden style={{ width: 16, height: 16, display: 'inline-block', flexShrink: 0, backgroundColor: accentColor, WebkitMaskImage: 'url(/icons/shop.png)', maskImage: 'url(/icons/shop.png)', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskPosition: 'center', maskPosition: 'center' }} />
          이 샵의 사장님이신가요? 인증 신청하기
        </button>
      ) : (
        <div style={{
          padding: '16px', borderRadius: '12px',
          background: 'var(--surface2)', border: '1.5px solid var(--border)',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
            {shopName} 사장님 인증 신청
          </p>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
            사업자등록증, 매장 사진 등 인증 가능한 정보를 입력해주세요. 운영진이 검토 후 승인해요.
          </p>

          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="인증 가능한 정보를 입력해주세요 (예: 사업자등록번호, 연락처 등)"
            rows={4}
            style={{
              width: '100%', padding: '10px',
              border: '1.5px solid var(--border)', borderRadius: '8px',
              fontSize: '13px', fontFamily: 'inherit', lineHeight: 1.6,
              background: 'var(--surface)', color: 'var(--text)',
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              marginBottom: '10px',
            }}
          />

          {!file ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                border: '1.5px dashed var(--border)', background: 'var(--surface)',
                color: 'var(--muted)', fontSize: '13px', cursor: 'pointer',
                fontFamily: 'inherit', marginBottom: '10px',
              }}
            >
              📎 사업자등록증 / 증빙 자료 첨부 (이미지, PDF)
            </button>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px', borderRadius: '8px',
              border: '1.5px solid var(--border)', background: 'var(--surface)',
              marginBottom: '10px',
            }}>
              {preview ? (
                <img src={preview} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
              ) : (
                <span style={{ fontSize: '24px' }}>📄</span>
              )}
              <span style={{ fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </span>
              <button
                onClick={removeFile}
                style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '13px' }}
              >삭제</button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="action" fullWidth onClick={() => setShowForm(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={handleSubmit}
              disabled={submitting || !note.trim()}
            >
              {submitting ? '신청 중...' : '신청하기'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}


