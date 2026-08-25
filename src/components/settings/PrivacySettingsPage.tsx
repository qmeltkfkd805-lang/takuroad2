'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import SettingsSubShell from './SettingsSubShell'
import {
  getMyPrivacy, setPrivacy, PRIVACY_TARGETS,
  type PrivacyTarget, type PrivacyLevel, type PrivacySettings,
} from '@/services/privacyService'
import ctl from './settingsControls.module.css'

const TARGET_LABEL: Record<PrivacyTarget, { label: string; desc: string }> = {
  follows:          { label: '팔로우 · 팔로잉', desc: '내 팔로워·팔로잉 목록' },
  activity:         { label: '활동 내역', desc: '최근 활동·타임라인' },
  visited_shops:    { label: '방문한 샵', desc: '체크인한 매장' },
  completed_routes: { label: '완주한 루트', desc: '성지순례 완주 기록' },
  liked_works:      { label: '관심 작품', desc: '최애·관심 등록 작품' },
  collections:      { label: '컬렉션', desc: '수집 현황' },
  goods:            { label: '굿즈', desc: '내 굿즈 목록' },
}

const LEVELS: { value: PrivacyLevel; label: string }[] = [
  { value: 'public',    label: '전체 공개' },
  { value: 'followers', label: '팔로워' },
  { value: 'private',   label: '나만' },
]

export default function PrivacySettingsPage() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<PrivacySettings | null>(null)
  const [saving, setSaving] = useState<PrivacyTarget | null>(null)

  useEffect(() => {
    if (!user) return
    getMyPrivacy(user.id).then(setPrefs)
  }, [user])

  async function change(target: PrivacyTarget, level: PrivacyLevel) {
    if (!prefs || prefs[target] === level || saving) return
    const prev = prefs
    setPrefs({ ...prefs, [target]: level } as PrivacySettings)  // 낙관적
    setSaving(target)
    const res = await setPrivacy({ [target]: level } as Partial<Record<PrivacyTarget, PrivacyLevel>>)
    setSaving(null)
    if (!res.ok) setPrefs(prev)  // 실패 복원
  }

  return (
    <SettingsSubShell title="공개 범위">
      <p className={ctl.sectionDesc}>각 항목을 누가 볼 수 있는지 정해요. 저장된 값이 없으면 프로필 공개 설정을 따릅니다.</p>
      <div className={ctl.cardList}>
        {PRIVACY_TARGETS.map(t => (
          <div key={t} className={ctl.prow}>
            <div className={ctl.pbody}>
              <div className={ctl.plabel}>{TARGET_LABEL[t].label}</div>
              <div className={ctl.pdesc}>{TARGET_LABEL[t].desc}</div>
            </div>
            <div className={ctl.seg}>
              {LEVELS.map(l => (
                <button
                  key={l.value}
                  className={`${ctl.segBtn}${prefs?.[t] === l.value ? ' ' + ctl.segBtnActive : ''}`}
                  onClick={() => change(t, l.value)}
                  disabled={!prefs}
                >{l.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SettingsSubShell>
  )
}
