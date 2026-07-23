'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { updateNickname, deleteAccount } from '@/services/shopService'
import AppIcon from '@/components/tds/AppIcon'

export default function AccountSettingsTab() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const currentYear = new Date().getFullYear()

  async function handleSaveNickname() {
    if (!user) return
    const trimmed = nickname.trim()
    if (trimmed.length < 2) return setError('닉네임은 2자 이상이어야 해요')
    if (trimmed.length > 20) return setError('닉네임은 20자 이하여야 해요')

    setSaving(true)
    setError('')
    const result = await updateNickname(user.id, trimmed)
    if (result.ok) {
      setSuccess('닉네임이 변경됐어요')
      setEditing(false)
    } else {
      setError(result.error ?? '변경에 실패했어요')
    }
    setSaving(false)
  }

  async function handleDeleteAccount() {
    if (!user) return
    if (confirmText !== '계정탈퇴') return
    setDeleting(true)
    const ok = await deleteAccount(user.id)
    if (ok) {
      router.push('/')
    } else {
      setError('탈퇴 처리에 실패했어요')
      setDeleting(false)
    }
  }

  return (
    <div style={{ padding: '20px 16px' }}>

      <Link
        href="/profile/activity"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderRadius: '10px',
          background: 'var(--surface2)', textDecoration: 'none', color: 'var(--text)',
          marginBottom: '10px',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 700 }}><AppIcon name="chart" size={14} style={{ marginRight: 6 }} />내 활동 (레벨 · 경험치)</span>
        <span style={{ color: 'var(--muted)' }}>›</span>
      </Link>

      <Link
        href={`/profile/report/${currentYear}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderRadius: '10px',
          background: 'var(--surface2)', textDecoration: 'none', color: 'var(--text)',
          marginBottom: '32px',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 700 }}><AppIcon name="book" size={14} style={{ marginRight: 6 }} />{currentYear}년 타쿠로드 리포트</span>
        <span style={{ color: 'var(--muted)' }}>›</span>
      </Link>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '10px' }}>닉네임</h3>
        {editing ? (
          <div>
            <input
              type="text"
              value={nickname}
              onChange={e => { setNickname(e.target.value); setError('') }}
              maxLength={20}
              style={{
                width: '100%', padding: '10px 12px',
                border: '1.5px solid var(--border)', borderRadius: '8px',
                fontSize: '14px', fontFamily: 'inherit',
                background: 'var(--surface2)', color: 'var(--text)',
                outline: 'none', boxSizing: 'border-box', marginBottom: '8px',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setEditing(false); setNickname(profile?.nickname ?? ''); setError('') }}
                style={{
                  flex: 1, padding: '9px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >취소</button>
              <button
                onClick={handleSaveNickname}
                disabled={saving}
                style={{
                  flex: 1, padding: '9px', borderRadius: '8px',
                  border: 'none', background: 'var(--accent)', color: '#fff',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{saving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px' }}>{profile?.nickname}</span>
            <button
              onClick={() => setEditing(true)}
              style={{
                fontSize: '12px', color: 'var(--accent)', background: 'none',
                border: '1px solid var(--accent)', borderRadius: '6px',
                padding: '5px 10px', cursor: 'pointer',
              }}
            >변경</button>
          </div>
        )}
        {error && <p style={{ fontSize: '12px', color: 'var(--red)', marginTop: '6px' }}>{error}</p>}
        {success && <p style={{ fontSize: '12px', color: 'var(--green)', marginTop: '6px' }}>{success}</p>}
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '10px' }}>이메일</h3>
        <p style={{ fontSize: '14px', color: 'var(--muted)' }}>{user?.email}</p>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '0 0 32px' }} />

      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 900, color: 'var(--red)', marginBottom: '10px' }}>계정 탈퇴</h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '14px' }}>
          탈퇴 시 작성한 후기, 루트, 찜 목록 등 일부 데이터가 삭제될 수 있어요. 이 작업은 되돌릴 수 없어요.
        </p>

        <p style={{ fontSize: '12px', marginBottom: '8px' }}>
          탈퇴를 진행하려면 <strong>계정탈퇴</strong>를 입력해주세요.
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder="계정탈퇴"
          style={{
            width: '100%', padding: '10px 12px',
            border: '1.5px solid var(--border)', borderRadius: '8px',
            fontSize: '14px', fontFamily: 'inherit',
            background: 'var(--surface2)', color: 'var(--text)',
            outline: 'none', boxSizing: 'border-box', marginBottom: '10px',
          }}
        />
        <button
          onClick={handleDeleteAccount}
          disabled={confirmText !== '계정탈퇴' || deleting}
          style={{
            width: '100%', padding: '11px', borderRadius: '8px',
            border: 'none',
            background: confirmText === '계정탈퇴' ? 'var(--red)' : 'var(--border)',
            color: '#fff', fontSize: '14px', fontWeight: 700,
            cursor: confirmText === '계정탈퇴' ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          {deleting ? '처리 중...' : '계정 탈퇴하기'}
        </button>
      </div>
    </div>
  )
}