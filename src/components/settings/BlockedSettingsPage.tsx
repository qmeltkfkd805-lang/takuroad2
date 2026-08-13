'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import SettingsSubShell from './SettingsSubShell'
import { getBlockedUsers, unblockUser, type BlockedUser } from '@/services/blockService'
import ctl from './settingsControls.module.css'

export default function BlockedSettingsPage() {
  const { user } = useAuth()
  const [list, setList] = useState<BlockedUser[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (user) getBlockedUsers(user.id).then(setList)
  }, [user])

  async function unblock(id: string) {
    if (!user || busy) return
    setBusy(id)
    const r = await unblockUser(id)
    setBusy(null)
    if (r.ok) setList(prev => (prev ?? []).filter(u => u.id !== id))
  }

  return (
    <SettingsSubShell title="차단 관리">
      <p className={ctl.sectionDesc}>차단한 사용자의 글·프로필·활동은 서로에게 보이지 않아요.</p>
      {list === null
        ? <div className={ctl.empty}>불러오는 중...</div>
        : list.length === 0
          ? <div className={ctl.empty}>차단한 사용자가 없어요.</div>
          : <div className={ctl.cardList}>
              {list.map(u => (
                <div key={u.id} className={ctl.blockRow}>
                  {u.avatarUrl
                    ? <img className={ctl.bAvatar} src={u.avatarUrl} alt="" />
                    : <span className={ctl.bAvatarPh}>{u.nickname?.[0] ?? '?'}</span>}
                  <span className={ctl.bName}>{u.nickname}</span>
                  <button className={ctl.unblockBtn} disabled={busy === u.id} onClick={() => unblock(u.id)}>
                    {busy === u.id ? '해제 중…' : '차단 해제'}
                  </button>
                </div>
              ))}
            </div>}
    </SettingsSubShell>
  )
}
