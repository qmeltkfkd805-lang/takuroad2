'use client'

import { useState } from 'react'
import MyPostsTab from '@/components/profile/MyPostsTab'
import MyReviewsTab from '@/components/profile/MyReviewsTab'
import MyRoutesTab from '@/components/profile/MyRoutesTab'

type Tab = 'posts' | 'routes' | 'reviews'

const TABS: { key: Tab; label: string }[] = [
  { key: 'posts', label: '작성한 글' },
  { key: 'routes', label: '공개한 루트' },
  { key: 'reviews', label: '작성한 후기' },
]

/** 남의 프로필에서 보여주는 공개 활동 — 탭 */
export default function PublicActivity({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>('posts')
  return (
    <div style={{ padding: '12px 16px 40px' }}>
      <div style={{
        display: 'flex', gap: '6px', marginBottom: '16px',
        overflowX: 'auto', paddingBottom: '2px',
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', borderRadius: '20px',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: tab === t.key ? 'var(--accent)' : 'var(--surface2)',
              color: tab === t.key ? '#fff' : 'var(--text)',
              fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'posts' && <MyPostsTab userId={userId} />}
      {tab === 'routes' && <MyRoutesTab userId={userId} readOnly />}
      {tab === 'reviews' && <MyReviewsTab userId={userId} />}
    </div>
  )
}
