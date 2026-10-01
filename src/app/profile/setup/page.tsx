'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { readFirstTouch, channelOf } from '@/lib/utils/firstTouch'
import ConsentChecklist, { EMPTY_CONSENT, requiredDone, type ConsentValue } from '@/components/auth/ConsentChecklist'
import { recordConsents } from '@/lib/consent'

export default function ProfileSetupPage() {
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [consent, setConsent] = useState<ConsentValue>(EMPTY_CONSENT)
  const consentOk = requiredDone(consent)
  const router = useRouter()

  async function handleSubmit() {
    const trimmed = nickname.trim()

    if (!trimmed) return setError('닉네임을 입력해주세요')
    if (trimmed.length < 2) return setError('닉네임은 2자 이상이어야 해요')
    if (trimmed.length > 20) return setError('닉네임은 20자 이하여야 해요')
    if (!/^[a-zA-Z0-9가-힣_]+$/.test(trimmed))
      return setError('한글, 영문, 숫자, 언더바(_)만 사용 가능해요')
    if (!consentOk) return setError('필수 동의 항목에 모두 동의해 주세요')

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
    // 첫 방문 때 잡아둔 유입 경로를 같이 남긴다 (관리자 회원 상세에서 확인)
    const ft = readFirstTouch()
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        nickname: trimmed,
        signup_channel: channelOf(ft),
        signup_referrer: ft?.referrer ?? null,
        signup_landing_path: ft?.landingPath ?? null,
        signup_utm_source: ft?.utmSource ?? null,
        signup_utm_medium: ft?.utmMedium ?? null,
        signup_utm_campaign: ft?.utmCampaign ?? null,
      } as any)

    if (insertError) {
      setError('오류가 발생했어요. 다시 시도해주세요')
      setLoading(false)
      return
    }

    // 가입 동의 기록 (필수 4개 + 선택 알림). 실패해도 가입은 진행 — 다음 접속 때 동의 화면이 다시 뜬다
    await recordConsents(consent.marketing)

    // 가입 전에 보던 화면으로 돌아간다 (/auth/callback 이 ?redirect= 로 넘겨준다)
    const back = new URLSearchParams(window.location.search).get('redirect')
    window.location.href = back && back.startsWith('/') && !back.startsWith('//') ? back : '/'
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
        maxWidth: '520px',
        background: 'var(--surface)',
        border: '1.5px solid var(--border)',
        borderRadius: '16px',
        padding: '32px 24px',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/takuroad-logo.png" alt="타쿠로드 TAKUROAD" style={{ display: 'block', height: 40, width: 'auto', marginBottom: 12 }} />
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

        <div style={{ margin: '20px 0 18px' }}>
          <ConsentChecklist value={consent} onChange={v => { setConsent(v); setError('') }} />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !nickname.trim() || !consentOk}
          style={{
            width: '100%',
            padding: '12px',
            background: loading || !nickname.trim() || !consentOk ? 'var(--border)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontFamily: 'inherit',
            fontWeight: 700,
            cursor: loading || !nickname.trim() || !consentOk ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '설정 중...' : '동의하고 시작하기'}
        </button>

        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '12px', textAlign: 'center' }}>
          한글, 영문, 숫자, 언더바(_) 사용 가능
        </p>
      </div>
    </div>
  )
}
