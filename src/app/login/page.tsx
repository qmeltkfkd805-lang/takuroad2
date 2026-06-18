import { Suspense } from 'react'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div style={{ color: 'var(--muted)', fontSize: '14px' }}>로딩 중...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
