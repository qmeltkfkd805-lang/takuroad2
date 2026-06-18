'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProfileSetupPage() {
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit() {
    const trimmed = nickname.trim()

    if (!trimmed) return setError('닉네임을 입력해주세요')
    if (trimmed.length < 2) return setError('닉네임은 2자 이상이어야 해요')
    if (trimmed.length > 20) return setError('닉네임은 20자 이하여야 해요')
    if (!/^[a-zA-Z0-9가-힣_]+$/.test(trimmed))
      return setError('한글, 영문, 숫자, 언더바(_)만 사용 가능해요')

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    // 닉네임 중복 확인
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('nickname', trimmed)
      .maybeSingle()

    if (existing) {
      setError('이미 사용 중인 닉네임이에요')
      setLoading(false)
      return
    }

    // 프로필 생성
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: user.id, nickname: trimmed } as any)

    if (insertError) {
      setError('오류가 발생했어요. 다시 시도해주세요')
      setLoading(false)
      return
    }

    router.push('/')
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '360px',
        background: 'var(--surface)',
        border: '1.5px solid var(--border)',
        borderRadius: '16px',
        padding: '32px 24px',
      }}>
        <div style={{
          fontFamily: "'Cute Font', cursive",
          fontSize: '28px',
          color: 'var(--accent)',
          letterSpacing: '2px',
          marginBottom: '4px',
        }}>
          TAKUROAD
        </div>
        <h1 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '8px' }}>
          닉네임을 설정해주세요
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>
          타쿠로드에서 사용할 닉네임이에요
        </p>

        <input
          type="text"
          value={nickname}
          onChange={e => { setNickname(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="닉네임 입력 (2~20자)"
          maxLength={20}
          style={{
            width: '100%',
            padding: '12px',
            border: `1.5px solid ${error ? 'var(--red)' : 'var(--border)'}`,
            borderRadius: '10px',
            fontSize: '15px',
            fontFamily: 'inherit',
            background: 'var(--surface2)',
            color: 'var(--text)',
            outline: 'none',
            marginBottom: '8px',
            boxSizing: 'border-box',
          }}
        />

        {error && (
          <p style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '12px' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !nickname.trim()}
          style={{
            width: '100%',
            padding: '12px',
            background: loading || !nickname.trim() ? 'var(--border)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontFamily: 'inherit',
            fontWeight: 700,
            cursor: loading || !nickname.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '설정 중...' : '시작하기'}
        </button>

        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '12px', textAlign: 'center' }}>
          한글, 영문, 숫자, 언더바(_) 사용 가능
        </p>
      </div>
    </div>
  )
}
