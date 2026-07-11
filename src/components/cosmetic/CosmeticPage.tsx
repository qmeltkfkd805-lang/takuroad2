'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyCosmetics, getEquipped, equipCosmetic, Cosmetic, Equipped } from '@/services/cosmeticService'
import { FRAME_STYLE, BG_STYLE, THEME_STYLE, FX_CLASS, RARITY_LABEL, previewStyle } from '@/lib/cosmetics/style'
import { Icon } from '@/components/tds'
import styles from './CosmeticPage.module.css'

/* 프로필 꾸미기

   ⭐ 왼쪽에 "지금 내 프로필"이 실시간으로 바뀐다.
      고르는 즉시 보여야 꾸미는 재미가 생긴다. 저장 버튼을 누르고 나서 확인하면 늦다.

   ⭐ 못 얻은 것도 보여준다. 단, 흐리게 + "무엇을 하면 열리는지"와 함께.
      숨기면 목표가 안 생긴다. */

const TABS: { type: string; label: string }[] = [
  { type: 'frame',      label: '프레임' },
  { type: 'background', label: '배경' },
  { type: 'title',      label: '칭호' },
  { type: 'effect',     label: '효과' },
  { type: 'theme',      label: '테마' },
]

export default function CosmeticPage() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState<Cosmetic[]>([])
  const [equipped, setEquipped] = useState<Equipped>({})
  const [tab, setTab] = useState('frame')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    Promise.all([getMyCosmetics(user.id), getEquipped(user.id)])
      .then(([c, e]) => { setItems(c); setEquipped(e) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2400) }

  const byId = (id?: string) => items.find(c => c.id === id)
  const worn = {
    frame: byId(equipped.frame),
    background: byId(equipped.background),
    title: byId(equipped.title),
    effect: byId(equipped.effect),
    theme: byId(equipped.theme),
  }

  async function pick(c: Cosmetic) {
    if (!user) return
    if (!c.unlocked) {
      toast(c.fromBadge ? `${c.fromBadge}를 달성하면 열려요` : '아직 해금하지 않았어요')
      return
    }
    const isOn = equipped[c.type] === c.id
    const next = isOn ? null : c.id

    // 먼저 화면을 바꾸고(즉시 반응), 저장은 뒤따른다
    setEquipped(prev => {
      const n = { ...prev }
      if (next) n[c.type] = next; else delete n[c.type]
      return n
    })

    const res = await equipCosmetic(user.id, c.type, next)
    if (!res.ok) {
      toast(res.message ?? '실패했어요')
      setEquipped(await getEquipped(user.id))   // 되돌린다
    }
  }

  if (!user) return <div className={styles.page}><p className={styles.center}>로그인이 필요해요.</p></div>

  const list = items.filter(c => c.type === tab)
  const unlockedCount = items.filter(c => c.unlocked).length

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1>프로필 꾸미기 <Icon name="colorstar" size={22} /></h1>
          <p>도전을 달성하면 새로운 꾸미기 요소가 열려요.</p>
        </div>
        <span className={styles.total}>
          <b>{unlockedCount}</b> / {items.length} 해금
        </span>
      </header>

      <div className={styles.layout}>
        {/* 지금 내 프로필 — 고르는 즉시 바뀐다 */}
        <aside className={styles.previewCol}>
          <div
            className={`${styles.card} ${worn.effect ? styles[FX_CLASS[worn.effect.slug]] ?? '' : ''}`}
            style={{
              ...(worn.theme ? THEME_STYLE[worn.theme.slug] : {}),
              ...(worn.background ? BG_STYLE[worn.background.slug] : {}),
            }}
          >
            <div className={styles.avatarWrap}>
              <div
                className={styles.avatar}
                style={worn.frame ? FRAME_STYLE[worn.frame.slug] : undefined}
              >
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" />
                  : <span>{(profile?.nickname ?? '나').slice(0, 1)}</span>}
              </div>
            </div>

            <div className={styles.nick}>{profile?.nickname ?? '나'}</div>
            {worn.title && <div className={styles.title}>{worn.title.name}</div>}

            <div className={styles.wornList}>
              {TABS.map(t => {
                const w = worn[t.type as keyof typeof worn]
                return (
                  <div key={t.type} className={styles.wornRow}>
                    <span className={styles.wornLabel}>{t.label}</span>
                    <span className={w ? styles.wornOn : styles.wornOff}>
                      {w ? w.name : '없음'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>

        {/* 고르는 곳 */}
        <section className={styles.pickCol}>
          <nav className={styles.tabs}>
            {TABS.map(t => {
              const n = items.filter(c => c.type === t.type)
              const got = n.filter(c => c.unlocked).length
              return (
                <button
                  key={t.type}
                  className={`${styles.tab} ${tab === t.type ? styles.tabOn : ''}`}
                  onClick={() => setTab(t.type)}
                >
                  {t.label} <em>{got}/{n.length}</em>
                </button>
              )
            })}
          </nav>

          {loading ? (
            <div className={styles.grid}>
              {[0,1,2,3,4,5].map(i => <div key={i} className={styles.skel} />)}
            </div>
          ) : (
            <div className={styles.grid}>
              {list.map(c => (
                <Tile
                  key={c.id}
                  c={c}
                  on={equipped[c.type] === c.id}
                  onClick={() => pick(c)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {msg && <div className={styles.toast}>{msg}</div>}
    </div>
  )
}

function Tile({ c, on, onClick }: { c: Cosmetic; on: boolean; onClick: () => void }) {
  return (
    <button
      className={`${styles.tile} ${on ? styles.tileOn : ''} ${c.unlocked ? '' : styles.tileLock}`}
      onClick={onClick}
    >
      <div className={styles.thumb} style={previewStyle(c.type, c.slug)}>
        {c.type === 'title'  && <span className={styles.thumbTitle}>{c.name}</span>}
        {c.type === 'effect' && <span className={`${styles.thumbFx} ${styles[FX_CLASS[c.slug]] ?? ''}`} />}
        {!c.unlocked && <span className={styles.lock}>잠김</span>}
        {on && <span className={styles.check}>착용 중</span>}
      </div>

      <div className={styles.tileName}>{c.name}</div>
      <div className={`${styles.rarity} ${styles['r_' + c.rarity]}`}>{RARITY_LABEL[c.rarity] ?? c.rarity}</div>

      {!c.unlocked && c.fromBadge && (
        <div className={styles.cond}>{c.fromBadge} 달성</div>
      )}
    </button>
  )
}
