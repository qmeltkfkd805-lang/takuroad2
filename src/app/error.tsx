'use client'

import { useEffect } from 'react'
import { Taku } from '@/components/tds'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '24px', textAlign: 'center',
    }}>
      <div style={{ marginBottom: '20px' }}><Taku pose="sit" size={96} /></div>
      <h1 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>
        오류가 발생했어요
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
        잠시 후 다시 시도해주세요.
      </p>
      <button
        onClick={reset}
        style={{
          padding: '10px 24px', borderRadius: '10px',
          background: 'var(--accent)', color: '#fff',
          border: 'none', fontWeight: 700, fontSize: '14px',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        다시 시도
      </button>
    </div>
  )
}
