'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { blockUser } from '@/services/blockService'

/* 공개 프로필용 차단 버튼.
   차단하면 그 프로필이 접근 불가(비공개와 동일 응답)가 되므로 여기선 '차단하기'만.
   해제는 설정 > 차단 관리에서. */
export default function BlockButton({ targetUserId }: { targetUserId?: string | null }) {
  const { user } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!targetUserId || !user || user.id === targetUserId) return null

  async function onBlock() {
    if (!targetUserId || busy) return
    const ok = window.confirm('이 사용자를 차단할까요?\n서로의 글·댓글·활동이 보이지 않게 되고, 기존 팔로우도 해제돼요.')
    if (!ok) return
    setBusy(true)
    const r = await blockUser(targetUserId)
    setBusy(false)
    if (r.ok) {
      window.alert('차단했어요. 해제는 설정 > 차단 관리에서 할 수 있어요.')
      router.push('/')
    } else {
      window.alert(r.message ?? '차단할 수 없어요.')
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0 14px' }}>
      <button
        onClick={onBlock}
        disabled={busy}
        style={{
          border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', padding: '4px 8px',
          textDecoration: 'underline', textUnderlineOffset: 3,
        }}
      >
        {busy ? '처리 중…' : '차단하기'}
      </button>
    </div>
  )
}
