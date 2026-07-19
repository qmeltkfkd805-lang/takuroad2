'use client'

import { useState } from 'react'
import PassportCard from './PassportCard'
import { OtakuPassport } from '@/services/passportService'
import { updateNickname } from '@/services/shopService'
import { setTagline } from '@/services/cosmeticService'
import styles from './ProfileCustomizationModal.module.css'

type Tab = 'profile' | 'frame' | 'background' | 'title'
const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: '프로필' },
  { key: 'frame', label: '프레임' },
  { key: 'background', label: '배경' },
  { key: 'title', label: '칭호' },
]

interface Props {
  passport: OtakuPassport
  userId: string
  onClose: () => void
  onSaved: (v: { nickname: string; tagline: string }) => void
}

export default function ProfileCustomizationModal({ passport, userId, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('profile')
  const [nickname, setNickname] = useState(passport.nickname)
  const [tagline, setTag] = useState(passport.tagline)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const preview: OtakuPassport = { ...passport, nickname, tagline }

  async function handleSave() {
    setErr('')
    const nick = nickname.trim()
    if (nick.length < 2) return setErr('닉네임은 2자 이상이어야 해요')
    setSaving(true)
    if (nick !== passport.nickname) {
      const r = await updateNickname(userId, nick)
      if (!r.ok) { setSaving(false); return setErr(r.error ?? '닉네임 변경 실패') }
    }
    if (tagline !== passport.tagline) {
      const r = await setTagline(userId, tagline)
      if (!r.ok) { setSaving(false); return setErr('문구 저장 실패') }
    }
    setSaving(false)
    onSaved({ nickname: nick, tagline })
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <div>
            <h2>프로필 꾸미기</h2>
            <p>나만의 여권을 꾸며보세요!</p>
          </div>
          <div className={styles.headRight}>
            <button className={styles.random}>🎲 랜덤 꾸미기</button>
            <button className={styles.x} onClick={onClose} aria-label="닫기">✕</button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.preview}>
            <PassportCard passport={preview} isOwner={false} />
          </div>

          <div className={styles.panel}>
            <div className={styles.tabs}>
              {TABS.map(t => (
                <button
                  key={t.key}
                  className={[styles.tab, tab === t.key ? styles.tabOn : ''].join(' ')}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className={styles.content}>
              {tab === 'profile' ? (
                <>
                  <section className={styles.card}>
                    <h3 className={styles.cardTitle}>현재 착용</h3>
                    <div className={styles.wornRow}><span>프레임</span><b>기본</b></div>
                    <div className={styles.wornRow}><span>배경</span><b>벚꽃</b></div>
                    <div className={styles.wornRow}><span>칭호</span><b>{passport.titleBadgeName ?? '없음'}</b></div>
                  </section>

                  <section className={styles.card}>
                    <label className={styles.field}>
                      <span className={styles.label}>닉네임</span>
                      <input className={styles.input} value={nickname} onChange={e => setNickname(e.target.value)} maxLength={10} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>한줄 소개</span>
                      <input className={styles.input} value={tagline} onChange={e => setTag(e.target.value)} maxLength={30} placeholder="나만의 여권 문구" />
                    </label>
                  </section>

                  <section className={styles.card}>
                    <h3 className={styles.cardTitle}>대표 작품 · 대표 배지</h3>
                    <p className={styles.soon}>곧 여기서 고를 수 있어요</p>
                  </section>
                </>
              ) : (
                <section className={styles.card}>
                  <p className={styles.soon}>{TABS.find(t => t.key === tab)?.label} — 준비 중</p>
                </section>
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <span className={styles.hintText}>변경 사항은 실시간으로 미리보기에 반영됩니다</span>
          <div className={styles.actions}>
            <button className={styles.cancel} onClick={onClose} disabled={saving}>취소</button>
            <button className={styles.save} onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장하기'}</button>
          </div>
        </div>
        {err && <p className={styles.err}>{err}</p>}
      </div>
    </div>
  )
}