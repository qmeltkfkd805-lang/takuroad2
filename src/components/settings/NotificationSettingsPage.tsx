'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import SettingsSubShell from './SettingsSubShell'
import {
  getMyNotifPrefs, setNotifTypes, setNotifChannels, setMarketingConsent,
  NOTIF_TYPES, type NotifType, type NotifPrefs,
} from '@/services/notificationPrefService'
import ctl from './settingsControls.module.css'

const TYPE_LABEL: Record<NotifType, string> = {
  favorite: '관심 작품 소식', event: '이벤트 · 팝업', follow: '새 팔로워',
  comment: '댓글', like: '좋아요', route: '루트 소식', notice: '공지사항',
}

function Toggle({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} disabled={disabled}
      className={`${ctl.switch}${on ? ' ' + ctl.switchOn : ''}`}
      onClick={() => onChange(!on)}
    ><span className={ctl.knob} /></button>
  )
}

export default function NotificationSettingsPage() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) getMyNotifPrefs(user.id).then(setPrefs)
  }, [user])

  async function toggleType(t: NotifType, v: boolean) {
    if (!prefs) return
    const prev = prefs
    setPrefs({ ...prefs, types: { ...prefs.types, [t]: v } as Record<NotifType, boolean> })
    const r = await setNotifTypes({ [t]: v } as Partial<Record<NotifType, boolean>>)
    if (!r.ok) setPrefs(prev)
  }

  async function toggleChannel(c: 'push' | 'email', v: boolean) {
    if (!prefs) return
    const prev = prefs
    setPrefs({ ...prefs, channels: { ...prefs.channels, [c]: v } })
    const r = await setNotifChannels({ [c]: v } as Partial<{ push: boolean; email: boolean }>)
    if (!r.ok) setPrefs(prev)
  }

  async function toggleMarketing(v: boolean) {
    if (!prefs || busy) return
    const prev = prefs
    setBusy(true)
    setPrefs({ ...prefs, marketing: { ...prefs.marketing, agreed: v } })
    const r = await setMarketingConsent(v)
    setBusy(false)
    if (!r.ok) setPrefs(prev)
  }

  return (
    <SettingsSubShell title="알림 설정">
      <div className={ctl.groupTitle} style={{ marginTop: 4 }}>알림 채널</div>
      <div className={ctl.cardList}>
        <div className={ctl.trow}>
          <div className={ctl.pbody}><div className={ctl.plabel}>푸시 알림</div><div className={ctl.pdesc}>브라우저 푸시 알림</div></div>
          <Toggle on={!!prefs?.channels.push} disabled={!prefs} onChange={v => toggleChannel('push', v)} />
        </div>
        <div className={ctl.trow}>
          <div className={ctl.pbody}><div className={ctl.plabel}>이메일 알림</div><div className={ctl.pdesc}>{user?.email ?? ''}</div></div>
          <Toggle on={!!prefs?.channels.email} disabled={!prefs} onChange={v => toggleChannel('email', v)} />
        </div>
      </div>

      <div className={ctl.groupTitle}>알림 종류</div>
      <div className={ctl.cardList}>
        {NOTIF_TYPES.map(t => (
          <div key={t} className={ctl.trow}>
            <div className={ctl.pbody}><div className={ctl.plabel}>{TYPE_LABEL[t]}</div></div>
            <Toggle on={!!prefs?.types[t]} disabled={!prefs} onChange={v => toggleType(t, v)} />
          </div>
        ))}
      </div>

      <div className={ctl.groupTitle}>마케팅</div>
      <div className={ctl.cardList}>
        <div className={ctl.trow}>
          <div className={ctl.pbody}>
            <div className={ctl.plabel}>마케팅 정보 수신 동의</div>
            <div className={ctl.pdesc}>
              {prefs?.marketing.agreed && prefs.marketing.agreedAt
                ? `${new Date(prefs.marketing.agreedAt).toLocaleDateString('ko-KR')} 동의함`
                : '이벤트·혜택 소식 (선택)'}
            </div>
          </div>
          <Toggle on={!!prefs?.marketing.agreed} disabled={!prefs || busy} onChange={toggleMarketing} />
        </div>
      </div>
    </SettingsSubShell>
  )
}
