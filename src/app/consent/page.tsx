'use client'
/* 기존 회원 동의 화면 — 동의 기록이 없거나 동의 내용(CONSENT_VERSION)이 바뀐 회원이 한 번 거친다.
   AuthProvider 가 여기로 보낸다. 동의하면 원래 보던 화면으로 돌아간다. */
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ConsentChecklist, { EMPTY_CONSENT, requiredDone, missingRequired, type ConsentValue } from '@/components/auth/ConsentChecklist'
import { recordConsents } from '@/lib/consent'
import { useAuth } from '@/components/layout/AuthProvider'

function ConsentInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { signOut, refreshConsent } = useAuth()
  const [value, setValue] = useState<ConsentValue>(EMPTY_CONSENT)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const raw = params.get('redirect') || '/'
  const redirect = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'   // 바깥 주소로는 보내지 않는다
  const ok = requiredDone(value)

  async function submit() {
    if (!ok || busy) return
    setBusy(true); setError('')
    const saved = await recordConsents(value.marketing)
    if (!saved) { setBusy(false); setError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.'); return }
    await refreshConsent()
    router.replace(redirect)
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 20, padding: '28px 22px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/takuroad-logo.png" alt="타쿠로드 TAKUROAD" style={{ display: 'block', height: 40, width: 'auto', marginBottom: 12 }} />
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 20px' }}>
          서비스를 계속 이용하시려면 아래 내용을 확인하고 동의해 주세요. 한 번만 하면 돼요.
        </p>

        <ConsentChecklist value={value} onChange={v => { setValue(v); setError('') }} />

        {error && <p role="alert" style={{ fontSize: 13, color: 'var(--red)', margin: '14px 0 0' }}>{error}</p>}

        <button type="button" onClick={submit} disabled={!ok || busy}
          style={{ width: '100%', marginTop: 20, padding: 14, border: 'none', borderRadius: 12, fontFamily: 'inherit', fontSize: 16, fontWeight: 800, color: '#fff', background: ok && !busy ? 'var(--accent)' : 'var(--border)', cursor: ok && !busy ? 'pointer' : 'not-allowed' }}>
          {busy ? '저장 중…' : '동의하고 계속하기'}
        </button>
        {/* 버튼이 왜 안 눌리는지 */}
        {!ok && !busy && (
          <p role="status" style={{ fontSize: 12.5, color: 'var(--muted)', margin: '10px 0 0', padding: '10px 12px', borderRadius: 10, background: 'var(--surface2)', lineHeight: 1.5 }}>
            <span aria-hidden style={{ color: 'var(--accent)', fontWeight: 900, marginRight: 6 }}>!</span>
            필수 동의가 남았어요: {missingRequired(value).join(', ')}
          </p>
        )}
        <button type="button" onClick={async () => { await signOut(); router.replace('/') }}
          style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer' }}>
          동의하지 않고 로그아웃
        </button>
      </div>
    </div>
  )
}

export default function ConsentPage() {
  return <Suspense fallback={null}><ConsentInner /></Suspense>
}
