'use client'

import { useState, useEffect } from 'react'
import PassportCard from './PassportCard'
import { OtakuPassport } from '@/services/passportService'
import { updateNickname } from '@/services/shopService'
import { setTagline, getMyCosmetics, getEquipped, equipCosmetic, Cosmetic } from '@/services/cosmeticService'
import { FRAME_STYLE, bgStyle, RARITY_LABEL, fxClass } from '@/lib/cosmetics/style'
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

  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([])
  const [picked, setPicked] = useState<{ frame: string | null; background: string | null; title: string | null }>({
    frame: null, background: null, title: null,
  })

  useEffect(() => {
    Promise.all([getMyCosmetics(userId), getEquipped(userId)]).then(([cos, eq]) => {
      setCosmetics(cos)
      setPicked({
        frame: (eq as any).frame ?? null,
        background: (eq as any).background ?? null,
        title: (eq as any).title ?? null,
      })
    }).catch(() => {})
  }, [userId])

  const byId = (id: string | null) => cosmetics.find(c => c.id === id)
  const toWornItem = (c?: Cosmetic) => c ? { slug: c.slug, name: c.name, assetUrl: c.assetUrl } : undefined

  const previewWorn = {
    frame: toWornItem(byId(picked.frame)),
    background: toWornItem(byId(picked.background)),
    title: toWornItem(byId(picked.title)),
  }

  const preview: OtakuPassport = { ...passport, nickname, tagline }

  function pick(type: Tab, c: Cosmetic) {
    if (!c.unlocked) return
    setPicked(p => ({ ...p, [type]: p[type as 'frame'] === c.id ? null : c.id }))
  }

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
    await equipCosmetic(userId, 'frame', picked.frame)
    await equipCosmetic(userId, 'background', picked.background)
    await equipCosmetic(userId, 'title', picked.title)
    setSaving(false)
    onSaved({ nickname: nick, tagline })
    onClose()
    window.location.reload()
  }

  const itemsOf = (type: Tab) => cosmetics.filter(c => c.type === type)

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
            <PassportCard passport={preview} isOwner={false} previewWorn={previewWorn} />
          </div>

          <div className={styles.panel}>
            <div className={styles.tabs}>
              {TABS.map(t => (
                <button key={t.key} className={[styles.tab, tab === t.key ? styles.tabOn : ''].join(' ')} onClick={() => setTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className={styles.content}>
              {tab === 'profile' ? (
                <>
                  <section className={styles.card}>
                    <h3 className={styles.cardTitle}>현재 착용</h3>
                    <div className={styles.wornRow}><span>프레임</span><b>{byId(picked.frame)?.name ?? '기본'}</b></div>
                    <div className={styles.wornRow}><span>배경</span><b>{byId(picked.background)?.name ?? '기본'}</b></div>
                    <div className={styles.wornRow}><span>칭호</span><b>{byId(picked.title)?.name ?? '없음'}</b></div>
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
                </>
              ) : (
                <div className={styles.grid}>
                  {itemsOf(tab).map(c => {
                    const on = picked[tab as 'frame'] === c.id
                    return (
                      <button
                        key={c.id}
                        className={[styles.tile, on ? styles.tileOn : '', c.unlocked ? '' : styles.tileLock].join(' ')}
                        onClick={() => pick(tab, c)}
                      >
                        <div className={[styles.thumb, c.type === 'effect' ? fxClass(c.slug) : ''].join(' ')} style={c.type === 'background' ? bgStyle(c.slug, c.assetUrl) : undefined}>
                          {c.type === 'frame' && <span className={styles.thumbAvatar} style={FRAME_STYLE[c.slug]}>존</span>}
                          {c.type === 'title' && <span className={styles.thumbTitle}>{c.name}</span>}
                          {!c.unlocked && <span className={styles.lock}>잠김</span>}
                        </div>
                        {c.type !== 'title' && <div className={styles.tileName}>{c.name}</div>}
                        <div className={[styles.rarity, styles['r_' + c.rarity]].join(' ')}>{RARITY_LABEL[c.rarity] ?? c.rarity}</div>
                        {!c.unlocked && c.fromBadge && <div className={styles.cond}>{c.fromBadge} 달성</div>}
                      </button>
                    )
                  })}
                </div>
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