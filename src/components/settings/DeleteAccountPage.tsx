'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import styles from './settings.module.css'

/* 회원 탈퇴 (2026-10-12)
   실제 처리는 서버(/api/account/delete)가 한다 — 개인 기록 삭제 + 로그인 계정 삭제.
   글·댓글·후기·루트는 '탈퇴한 회원'으로 남는다. (migrations/account_delete.sql) */

const CONFIRM_PHRASE = '탈퇴합니다'

const REMOVED = [
  '방문 기록과 덕질 연대기',
  '경험치 · 배지 · 프로필 꾸미기',
  '찜 · 좋아요 · 저장 · 팔로우 · 차단 목록',
  '굿즈 보관함 · 전시관',
  '알림 · 사장님 인증',
]
const KEPT = [
  '커뮤니티 글 · 댓글',
  '이벤트 후기 · Q&A, 샵 리뷰',
  '만든 루트 · 루트 후기',
  '등록한 샵 정보',
]

export default function DeleteAccountPage() {
  const router = useRouter()
  const { user, profile, loading, isAdmin, signOut } = useAuth()
  const [step, setStep] = useState(1)
  const [agree, setAgree] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading || !user || !profile) {
    return <div className={styles.page}><div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div></div>
  }

  function goBack() {
    if (step > 1) { setStep(step - 1); return }
    router.push('/profile/settings')
  }

  async function handleRun() {
    if (phrase !== CONFIRM_PHRASE || busy) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error ?? '탈퇴 처리에 실패했어요. 잠시 후 다시 시도해 주세요.'); setBusy(false); return }
      try { await signOut() } catch { /* 계정이 이미 지워져 세션 종료가 실패해도 괜찮다 */ }
      router.replace('/')
    } catch {
      setError('네트워크 오류가 났어요. 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  const box: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }
  const primaryBtn: React.CSSProperties = { width: '100%', height: 50, border: 'none', borderRadius: 12, background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', marginTop: 16 }
  const disabledBtn: React.CSSProperties = { opacity: .5, cursor: 'not-allowed' }
  const listStyle: React.CSSProperties = { margin: '6px 0 0', paddingLeft: 18, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.8 }
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: 'var(--muted)', margin: '14px 0 0' }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <button className={styles.back} onClick={goBack} aria-label="뒤로">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span className={styles.title}>회원 탈퇴</span>
        </div>
      </div>

      <div className={styles.container}>
        {isAdmin ? (
          <div style={box}>
            <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 12px' }}>관리자 계정은 탈퇴할 수 없어요</h2>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>
              다른 관리자에게 권한을 넘긴 뒤 일반 계정으로 바꿔서 진행해 주세요.
            </p>
          </div>
        ) : (
          <>
            {step === 1 && (
              <div style={box}>
                <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 6px' }}>탈퇴하면 이렇게 돼요</h2>
                <p style={label}>삭제돼요 · 되돌릴 수 없어요</p>
                <ul style={listStyle}>{REMOVED.map(t => <li key={t}>{t}</li>)}</ul>
                <p style={label}>‘탈퇴한 회원’ 이름으로 남아요</p>
                <ul style={listStyle}>{KEPT.map(t => <li key={t}>{t}</li>)}</ul>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, margin: '14px 0 0' }}>
                  남기고 싶지 않은 글은 탈퇴 전에 직접 지워 주세요. 같은 계정으로 다시 가입하면 새 회원으로 시작해요.
                </p>
                <button style={primaryBtn} onClick={() => setStep(2)}>확인했어요</button>
              </div>
            )}

            {step === 2 && (
              <div style={box}>
                <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 12px' }}>계정 확인</h2>
                <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, margin: '0 0 14px' }}>
                  탈퇴할 계정이 맞는지 확인해 주세요.
                </p>
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontWeight: 700 }}>
                  {profile.nickname}{user.email ? ` · ${user.email}` : ''}
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, cursor: 'pointer', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
                  <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, accentColor: 'var(--accent)' }} />
                  위 계정이 맞고, 탈퇴 안내를 모두 확인했어요.
                </label>
                <button style={agree ? primaryBtn : { ...primaryBtn, ...disabledBtn }} disabled={!agree} onClick={() => setStep(3)}>다음</button>
              </div>
            )}

            {step === 3 && (
              <div style={box}>
                <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 12px' }}>마지막 확인</h2>
                <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, margin: '0 0 12px' }}>
                  탈퇴하려면 <b style={{ color: 'var(--text)' }}>{CONFIRM_PHRASE}</b> 를 입력해 주세요.
                </p>
                <input
                  value={phrase} onChange={e => setPhrase(e.target.value)} placeholder={CONFIRM_PHRASE}
                  style={{ width: '100%', height: 48, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', padding: '0 14px', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
                />
                {error && <p style={{ color: 'var(--red, #e5484d)', fontSize: 13, marginTop: 12 }}>{error}</p>}
                <button
                  style={phrase === CONFIRM_PHRASE && !busy ? primaryBtn : { ...primaryBtn, ...disabledBtn }}
                  disabled={phrase !== CONFIRM_PHRASE || busy} onClick={handleRun}>
                  {busy ? '처리 중...' : '탈퇴하기'}
                </button>
                <button style={{ width: '100%', height: 46, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'var(--muted)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginTop: 10 }} onClick={() => router.push('/profile/settings')}>취소</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
