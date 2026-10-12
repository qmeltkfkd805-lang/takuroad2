'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import styles from './settings.module.css'
import da from './deleteAccount.module.css'

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
// 탈퇴 사유(선택) — 값은 /api/account/delete 의 REASON_CODES 와 같아야 한다
// ask = 사유를 고르면 바로 아래에 보이는 질문(어떤 점에서 그렇게 느꼈는지). 없으면 묻지 않는다
const REASONS: { code: string; label: string; ask?: string; hint?: string }[] = [
  { code: 'lack_features', label: '원하는 기능이 없어요', ask: '어떤 기능이 있었으면 좋았을까요?', hint: '예) 이런 기능이 있었으면 계속 썼을 것 같아요' },
  { code: 'no_info', label: '찾는 샵·이벤트 정보가 부족해요', ask: '어떤 정보가 부족했나요?', hint: '예) 찾던 지역·작품·샵이나 이벤트' },
  { code: 'hard_to_use', label: '사용하기 불편해요', ask: '어떤 점이 불편했나요?', hint: '예) 불편했던 화면이나 기능' },
  { code: 'too_many_alerts', label: '알림이 너무 많아요', ask: '어떤 알림이 많다고 느끼셨나요?', hint: '예) 받기 싫었던 알림 종류' },
  { code: 'other_account', label: '다른 계정을 쓰고 있어요' },
  { code: 'privacy', label: '개인정보가 걱정돼요' },
  { code: 'etc', label: '기타', ask: '어떤 점이 아쉬웠는지 알려주세요', hint: '자유롭게 적어 주세요' },
]

const IconTrash = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16" /><path d="M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7" /><path d="M6 7l1 12.2A2 2 0 0 0 9 21h6a2 2 0 0 0 2-1.8L18 7" /><path d="M10 11v6M14 11v6" />
  </svg>
)
const IconDoc = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" />
  </svg>
)
const IconInfo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.6v.2" />
  </svg>
)

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
  const [reason, setReason] = useState<string | null>(null)
  const [detail, setDetail] = useState('')

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
        // 상세 질문이 없는 사유면 앞서 적어둔 내용은 보내지 않는다
        body: JSON.stringify({ phrase, reason, detail: REASONS.find(r => r.code === reason)?.ask ? detail.trim() : '' }),
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

      <div className={!isAdmin && step === 1 ? undefined : styles.container}>
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
              <div className={da.sheet}>
                <div className={da.inner}>
                  <div className={da.head}>
                    <h2 className={da.title}>탈퇴 전 확인해 주세요</h2>
                    <p className={da.desc}>삭제되는 정보와 남는 게시물을 안내해 드려요.</p>
                  </div>

                  <section className={da.section} aria-labelledby="da-removed">
                    <div className={da.secHead}>
                      <span className={`${da.secIcon} ${da.secIconDel}`}><IconTrash /></span>
                      <h3 id="da-removed" className={da.secTitle}>삭제되는 정보</h3>
                      <span className={`${da.badge} ${da.badgeDel}`}>복구 불가</span>
                    </div>
                    <ul className={da.list}>{REMOVED.map(t => <li key={t}>{t}</li>)}</ul>
                  </section>

                  <section className={da.section} aria-labelledby="da-kept">
                    <div className={da.secHead}>
                      <span className={`${da.secIcon} ${da.secIconKeep}`}><IconDoc /></span>
                      <h3 id="da-kept" className={da.secTitle}>남는 게시물</h3>
                      <span className={`${da.badge} ${da.badgeKeep}`}>탈퇴한 회원으로 표시</span>
                    </div>
                    <ul className={da.list}>{KEPT.map(t => <li key={t}>{t}</li>)}</ul>
                  </section>

                  <div className={da.note}>
                    <span className={da.noteIcon}><IconInfo /></span>
                    <div>
                      <p className={da.noteMain}>남기고 싶지 않은 글은 탈퇴 전에 직접 삭제해 주세요.</p>
                      <p className={da.noteSub}>같은 계정으로 다시 가입해도 새 회원으로 시작해요.</p>
                    </div>
                  </div>

                  {/* 이 버튼은 탈퇴를 실행하지 않는다 — 2단계(계정 확인)로 넘어갈 뿐. 실제 탈퇴는 3단계 '탈퇴하기' */}
                  <div className={da.actions}>
                    <button type="button" className={`${da.btn} ${da.btnGhost}`} onClick={() => router.push('/profile/settings')}>돌아가기</button>
                    <button type="button" className={`${da.btn} ${da.btnPrimary}`} onClick={() => setStep(2)}>확인하고 계속</button>
                  </div>
                </div>
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

                <div className={da.reasonBox}>
                  <p className={da.reasonTitle}>떠나시는 이유를 알려주세요 <span className={da.optional}>선택</span></p>
                  <p className={da.reasonDesc}>더 나은 타쿠로드를 만드는 데 참고할게요. 누가 남겼는지는 저장하지 않아요.</p>
                  <div className={da.reasonChips} role="radiogroup" aria-label="탈퇴 사유">
                    {REASONS.map(r => (
                      <button key={r.code} type="button" role="radio" aria-checked={reason === r.code}
                        className={`${da.chip} ${reason === r.code ? da.chipOn : ''}`}
                        onClick={() => setReason(reason === r.code ? null : r.code)}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const picked = REASONS.find(r => r.code === reason)
                    if (!picked?.ask) return null
                    return (
                      <div className={da.askWrap}>
                        <label htmlFor="da-detail" className={da.askLabel}>
                          {picked.ask} <span className={da.optional}>선택</span>
                        </label>
                        <textarea
                          id="da-detail" className={da.reasonText} value={detail} onChange={e => setDetail(e.target.value)}
                          maxLength={300} rows={3} placeholder={picked.hint}
                        />
                        <p className={da.askCount}>{detail.length}/300</p>
                      </div>
                    )
                  })()}
                </div>

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
