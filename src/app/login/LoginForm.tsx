'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginForm() {
  const [loading, setLoading] = useState<'google' | 'kakao' | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  async function loginWith(provider: 'google' | 'kakao') {
    setLoading(provider)
    const supabase = createClient()
    const redirectUrl = `${location.origin}/auth/callback?redirect=${redirect}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
        // 구글: 계정 선택 화면 강제
        ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
        // 카카오: 닉네임·프로필 사진만 요청. (이메일은 비즈 앱 전환 후 'account_email' 추가하면 계정 자동 연결까지 됨)
        ...(provider === 'kakao' ? { scopes: 'profile_nickname profile_image' } : {}),
      },
    })
    // 성공하면 페이지가 리다이렉트되므로, 여기 도달하는 건 실패한 경우 → 버튼 복구
    if (error) setLoading(null)
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
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: "'Cute Font', cursive",
          fontSize: '36px',
          color: 'var(--accent)',
          letterSpacing: '3px',
          marginBottom: '8px',
        }}>
          TAKUROAD
        </div>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '32px' }}>
          로그인하고 타쿠로드를 시작하세요
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 카카오 — 국내 주력 */}
          <button
            onClick={() => loginWith('kakao')}
            disabled={loading !== null}
            style={{
              width: '100%',
              padding: '12px',
              border: 'none',
              borderRadius: '10px',
              background: loading === 'kakao' ? '#f4dd00' : '#FEE500',
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading !== null ? 'not-allowed' : 'pointer',
              opacity: loading !== null && loading !== 'kakao' ? 0.55 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: 'rgba(0,0,0,0.85)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#000000" d="M9 1.6C4.86 1.6 1.5 4.23 1.5 7.47c0 2.08 1.38 3.9 3.46 4.95-.15.53-.55 1.98-.63 2.29-.1.38.14.37.29.27.12-.08 1.86-1.26 2.61-1.77.42.06.85.09 1.27.09 4.14 0 7.5-2.63 7.5-5.83S13.14 1.6 9 1.6z"/>
            </svg>
            {loading === 'kakao' ? '로그인 중...' : '카카오로 계속하기'}
          </button>

          {/* 구글 */}
          <button
            onClick={() => loginWith('google')}
            disabled={loading !== null}
            style={{
              width: '100%',
              padding: '12px',
              border: '1.5px solid var(--border)',
              borderRadius: '10px',
              background: loading === 'google' ? 'var(--surface2)' : 'var(--surface)',
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading !== null ? 'not-allowed' : 'pointer',
              opacity: loading !== null && loading !== 'google' ? 0.55 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: 'var(--text)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
            </svg>
            {loading === 'google' ? '로그인 중...' : 'Google로 계속하기'}
          </button>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '20px', lineHeight: 1.6 }}>
          로그인하면 샵 등록, 리뷰 작성,<br />찜 기능을 이용할 수 있어요
        </p>

        <button
          onClick={() => router.push('/')}
          style={{
            marginTop: '16px',
            background: 'none',
            border: 'none',
            fontSize: '13px',
            color: 'var(--muted)',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          로그인 없이 둘러보기
        </button>
      </div>
    </div>
  )
}
