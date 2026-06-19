'use client'

import Link from 'next/link'
import { EmptyState } from './SavedShopsTab'

export default function MyRoutesTab({ userId }: { userId: string }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗺️</div>
      <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '16px' }}>
        루트 기능은 곧 추가될 예정이에요
      </p>
    </div>
  )
}