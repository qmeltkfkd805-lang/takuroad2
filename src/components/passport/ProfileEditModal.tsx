'use client'

import { useState, useRef } from 'react'
import { uploadAvatar, updateNickname } from '@/services/shopService'
import { setTagline } from '@/services/cosmeticService'
import styles from './ProfileEditModal.module.css'

interface Props {
  userId: string
  initialNickname: string
  initialTagline: string
  initialAvatar: string | null
  onClose: () => void
  onSaved: (v: { nickname: string; tagline: string; avatar: string | null }) => void
}

export default function ProfileEditModal({
  userId, initialNickname, initialTagline, initialAvatar, onClose, onSaved,
}: Props) {
  const [nickname, setNickname] = useState(initialNickname)
  const [tagline, setTag] = useState(initialTagline)
  const [avatar, setAvatar] = useState(initialAvatar)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSaving(true)
    const res = await uploadAvatar(userId, file)
    setSaving(false)
    if (res.ok && res.url) setAvatar(res.url)
    else setErr(res.error ?? '사진 업로드에 실패했어요')
  }

  async function handleSave() {
    setErr('')
    const nick = nickname.trim()
    if (nick.length < 2) return setErr('닉네임은 2자 이상이어야 해요')
    if (nick.length > 20) return setErr('닉네임은 20자 이하여야 해요')

    setSaving(true)
    if (nick !== initialNickname) {
      const r = await updateNickname(userId, nick)
      if (!r.ok) { setSaving(false); return setErr(r.error ?? '닉네임 변경에 실패했어요') }
    }
    if (tagline !== initialTagline) {
      const r = await setTagline(userId, tagline)
      if (!r.ok) { setSaving(false); return setErr('문구 저장에 실패했어요') }
    }
    setSaving(false)
    onSaved({ nickname: nick, tagline, avatar })
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <h2>프로필 수정</h2>
          <button className={styles.x} onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className={styles.avatarBox}>
          <div className={styles.avatar}>
            {avatar ? <img src={avatar} alt="" /> : <span>{nickname[0]}</span>}
          </div>
          <button className={styles.avatarBtn} onClick={() => fileRef.current?.click()} disabled={saving}>
            사진 변경
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display: 'none' }} />
        </div>

        <label className={styles.field}>
          <span className={styles.label}>닉네임</span>
          <input className={styles.input} value={nickname} onChange={e => setNickname(e.target.value)} maxLength={20} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>여권 문구</span>
          <input className={styles.input} value={tagline} onChange={e => setTag(e.target.value)} maxLength={40} placeholder="나만의 여권 문구를 적어보세요" />
        </label>

        {err && <p className={styles.err}>{err}</p>}

        <div className={styles.actions}>
          <button className={styles.cancel} onClick={onClose} disabled={saving}>취소</button>
          <button className={styles.save} onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}