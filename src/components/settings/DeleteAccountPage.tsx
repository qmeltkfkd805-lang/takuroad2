'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { deleteAccount } from '@/services/shopService'
import styles from './settings.module.css'

/* 프로필 익명화 (개발용 테스트).
   ⚠️ 실제 계정 삭제 기능이 아니다. deleteAccount는 닉네임 익명화 + 로그아웃만 하며
      같은 계정으로 다시 로그인하면 데이터가 복구된다. 운영(production)에서는 라우트가 막혀 있다.
      진짜 삭제(서버 RPC + 로그인 차단)는 이후 별도 구현 예정. */

const CONFIRM_PHRASE = '익명화'

export default function DeleteAccountPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
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
    if (phrase !== CONFIRM_PHRASE || !user) return
    setBusy(true); setError('')
    const ok = await deleteAccount(user.id)
    if (ok) router.push('/')
    else { setError('처리에 실패했어요. 잠시 후 다시 시도해주세요.'); setBusy(false) }
  }

  const box: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }
  const primaryBtn: React.CSSProperties = { width: '100%', height: 50, border: 'none', borderRadius: 12, background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', marginTop: 16 }
  const disabledBtn: React.CSSProperties = { opacity: .5, cursor: 'not-allowed' }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <button className={styles.back} onClick={goBack} aria-label="뒤로">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span className={styles.title}>프로필 익명화 (개발용)</span>
        </div>
      </div>

      <div className={styles.container}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', color: 'var(--muted)', fontSize: 11.5, fontWeight: 800, padding: '5px 10px', borderRadius: 9999, margin: '4px 2px 14px' }}>
          개발 환경 전용 · 운영 미노출
        </div>

        {step === 1 && (
          <div style={box}>
            <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 12px' }}>개발용 익명화 테스트</h2>
            <p style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, lineHeight: 1.6, margin: '0 0 12px' }}>
              실제 계정 삭제 기능이 아니에요. 이 동작은 <b>닉네임을 익명 처리하고 로그아웃</b>만 하며,
              같은 계정으로 다시 로그인하면 데이터가 그대로 복구돼요.
            </p>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>
              auth 계정·프로필 행·게시글·리뷰·루트·팔로우 등은 <b>삭제되지 않고 그대로 유지</b>돼요.
              완전한 계정 삭제(서버 삭제 + 로그인 차단)는 이후 별도로 구현할 예정이에요.
            </p>
            <button style={primaryBtn} onClick={() => setStep(2)}>이해했어요, 계속</button>
          </div>
        )}

        {step === 2 && (
          <div style={box}>
            <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 12px' }}>계정 확인</h2>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, margin: '0 0 14px' }}>
              현재 로그인한 계정이 맞는지 확인해주세요.
            </p>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontWeight: 700 }}>
              {user.email ?? profile.nickname}
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, cursor: 'pointer', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, accentColor: 'var(--accent)' }} />
              위 계정이 맞고, 위 안내를 모두 확인했습니다.
            </label>
            <button style={agree ? primaryBtn : { ...primaryBtn, ...disabledBtn }} disabled={!agree} onClick={() => setStep(3)}>다음</button>
          </div>
        )}

        {step === 3 && (
          <div style={box}>
            <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 12px' }}>확인 문구 입력</h2>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, margin: '0 0 12px' }}>
              익명화를 진행하려면 <b style={{ color: 'var(--text)' }}>{CONFIRM_PHRASE}</b> 를 입력해주세요.
            </p>
            <input
              value={phrase} onChange={e => setPhrase(e.target.value)} placeholder={CONFIRM_PHRASE}
              style={{ width: '100%', height: 48, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', padding: '0 14px', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
            />
            <button style={phrase === CONFIRM_PHRASE ? primaryBtn : { ...primaryBtn, ...disabledBtn }} disabled={phrase !== CONFIRM_PHRASE} onClick={() => setStep(4)}>다음</button>
          </div>
        )}

        {step === 4 && (
          <div style={box}>
            <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 12px' }}>익명화 실행</h2>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>
              확인을 누르면 닉네임이 익명 처리되고 로그아웃됩니다. (같은 계정 재로그인 시 복구됨)
            </p>
            {error && <p style={{ color: 'var(--red, #e5484d)', fontSize: 13, marginTop: 12 }}>{error}</p>}
            <button style={busy ? { ...primaryBtn, ...disabledBtn } : primaryBtn} disabled={busy} onClick={handleRun}>
              {busy ? '처리 중...' : '익명화 실행'}
            </button>
            <button style={{ width: '100%', height: 46, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'var(--muted)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginTop: 10 }} onClick={() => router.push('/profile/settings')}>취소</button>
          </div>
        )}
      </div>
    </div>
  )
}
