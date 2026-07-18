'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getMyCosmetics, getEquipped, equipCosmetic, Cosmetic, Equipped,
  getMyBadges, getAllBadges, getShowcase, toggleShowcase, ShowcaseBadge, SHOWCASE_MAX,
  getFeaturedWork, setFeaturedWork, getMyFavoriteWorks,
} from '@/services/cosmeticService'
import { FRAME_STYLE, RARITY_LABEL, previewStyle, bgStyle, fxClass } from '@/lib/cosmetics/style'
import { Icon } from '@/components/tds'
import { MaskIcon } from '@/components/collection/MaskIcon'
import styles from './CosmeticPage.module.css'

/* 프로필 꾸미기

   ⭐ 왼쪽 프로필이 고르는 즉시 바뀐다. 저장 버튼 누르고 확인하면 늦다.
   ⭐ 못 얻은 것도 보여준다 (흐리게 + "○○ 달성"). 숨기면 목표가 안 생긴다.

   ⭐⭐ 역할은 나누되 입구는 하나.
      칭호(cosmetic title)  = 내가 고른 이름     "덕질 장인"
      대표 배지(showcase)    = 내가 자랑할 성취   "리뷰 마스터 Lv3"
      둘은 다른 것이지만, 설정 화면이 두 개가 되면 안 된다. */

const TABS: { type: string; label: string }[] = [
  { type: 'frame',      label: '프레임' },
  { type: 'background', label: '배경' },
  { type: 'title',      label: '칭호' },
  { type: 'effect',     label: '효과' },
  { type: 'showcase',   label: '대표 배지' },
  { type: 'work',       label: '대표 작품' },
]

export default function CosmeticPage() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState<Cosmetic[]>([])
  const [equipped, setEquipped] = useState<Equipped>({})
  const [badges, setBadges] = useState<ShowcaseBadge[]>([])
  const [showcase, setShowcase] = useState<string[]>([])
  const [favWorks, setFavWorks] = useState<{ tagId: string; name: string; slug: string | null; cover: string | null }[]>([])
  const [featWork, setFeatWork] = useState<string | null>(null)
  const sp = useSearchParams()
  const [tab, setTab] = useState(sp.get('tab') ?? 'frame')
  /* 필터 — 아이템이 많아지면 '내가 뭘 갖고 있지?'를 찾기가 어려워진다.
     보유 상태 × 등급, 두 축이면 충분하다. */
  const [owned, setOwned] = useState<'all' | 'mine'>('all')
  const [rarity, setRarity] = useState<'all' | 'common' | 'rare' | 'epic' | 'legendary'>('all')
  /* 접힌 등급 — 기본은 다 펼침. 사용자가 접은 것만 기억한다. */
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    Promise.all([
      getMyCosmetics(user.id),
      getEquipped(user.id),
      getAllBadges(user.id),
      getShowcase(user.id),
      getMyFavoriteWorks(user.id),
      getFeaturedWork(user.id),
    ])
      .then(([c, e, b, s, fw, feat]) => { setItems(c); setEquipped(e); setBadges(b); setShowcase(s); setFavWorks(fw as any); setFeatWork(feat as any) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2400) }
  async function pickWork(tagId: string) {
    if (!user) return
    const next = featWork === tagId ? null : tagId
    setFeatWork(next)
    const r = await setFeaturedWork(user.id, next)
    if (!r.ok) { setFeatWork(featWork); toast('저장에 실패했어요.') }
  }

  const byId = (id?: string) => items.find(c => c.id === id)
  const worn = {
    frame: byId(equipped.frame),
    background: byId(equipped.background),
    title: byId(equipped.title),
    effect: byId(equipped.effect),
  }

  async function pick(c: Cosmetic) {
    if (!user) return
    if (!c.unlocked) {
      toast(c.fromBadge ? c.fromBadge + '를 달성하면 열려요' : '아직 해금하지 않았어요')
      return
    }
    const isOn = equipped[c.type] === c.id
    const next = isOn ? null : c.id

    setEquipped(prev => {
      const n = { ...prev }
      if (next) n[c.type] = next; else delete n[c.type]
      return n
    })

    const res = await equipCosmetic(user.id, c.type, next)
    if (!res.ok) {
      toast(res.message ?? '실패했어요')
      setEquipped(await getEquipped(user.id))
    }
  }

  async function pickBadge(b: ShowcaseBadge) {
    if (!user) return
    const res = await toggleShowcase(user.id, b.tierId)
    setShowcase(res.showcase)
    if (!res.ok && res.message) toast(res.message)
  }

  if (!user) {
    return <div className={styles.page}><p className={styles.center}>로그인이 필요해요.</p></div>
  }

  const list = items
    .filter(c => c.type === tab)
    .filter(c => owned === 'all' || c.unlocked)
    .filter(c => rarity === 'all' || c.rarity === rarity)
  const unlockedCount = items.filter(c => c.unlocked).length
  const shownBadges = showcase
    .map(id => badges.find(b => b.tierId === id))
    .filter(Boolean) as ShowcaseBadge[]

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
            className={[styles.card, fxClass(worn.effect?.slug)].join(' ')}
            style={bgStyle(worn.background?.slug, worn.background?.assetUrl)}
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

            {shownBadges.length > 0 && (
              <div className={styles.showRow}>
                {shownBadges.map(b => (
                  <span key={b.tierId} className={[styles.showChip, styles['r_' + b.rarity]].join(' ')}>
                    {b.icon
                      ? <img src={b.icon} alt="" />
                      : <MaskIcon name="star" size={12} color="var(--accent)" />}
                    {b.name}
                  </span>
                ))}
              </div>
            )}

            <div className={styles.wornList}>
              {TABS.filter(t => t.type !== 'showcase').map(t => {
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
              const isShow = t.type === 'showcase'
              const total = isShow ? badges.length : items.filter(c => c.type === t.type).length
              const got = isShow
                ? showcase.length
                : items.filter(c => c.type === t.type && c.unlocked).length
              return (
                <button
                  key={t.type}
                  className={[styles.tab, tab === t.type ? styles.tabOn : ''].join(' ')}
                  onClick={() => setTab(t.type)}
                >
                  {t.label} <em>{got}/{total}</em>
                </button>
              )
            })}
          </nav>

          {tab !== 'showcase' && (
            <div className={styles.filterBox}>
              <button className={styles.filterHead} onClick={() => setFilterOpen(v => !v)}>
                <span className={styles.filterTitle}>필터</span>
                {!filterOpen && (owned !== 'all' || rarity !== 'all') && (
                  <span className={styles.filterSum}>
                    {owned === 'mine' ? '보유 중' : null}
                    {owned === 'mine' && rarity !== 'all' ? ' · ' : null}
                    {rarity !== 'all' ? RARITY_LABEL[rarity] : null}
                  </span>
                )}
                <span className={[styles.caret, filterOpen ? '' : styles.caretFolded].join(' ')}>
                  <svg viewBox='0 0 24 24' width='14' height='14' fill='none'
                       stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                    <polyline points='6 9 12 15 18 9' />
                  </svg>
                </span>
              </button>

            {filterOpen && (
            <div className={styles.filters}>
              <div className={styles.filterRow}>
                <button
                  className={[styles.chip, owned === 'all' ? styles.chipOn : ''].join(' ')}
                  onClick={() => setOwned('all')}
                >전체 보기</button>
                <button
                  className={[styles.chip, owned === 'mine' ? styles.chipOn : ''].join(' ')}
                  onClick={() => setOwned('mine')}
                >보유 중</button>
              </div>

              <div className={styles.filterRow}>
                {([
                  ['all', '전체 등급'],
                  ['common', '일반'],
                  ['rare', '레어'],
                  ['epic', '에픽'],
                  ['legendary', '전설'],
                ] as const).map(([key, label]) => {
                  const n = items.filter(c =>
                    c.type === tab &&
                    (key === 'all' || c.rarity === key) &&
                    (owned === 'all' || c.unlocked)
                  ).length
                  if (n === 0 && key !== 'all') return null
                  return (
                    <button
                      key={key}
                      className={[
                        styles.chip,
                        styles['c_' + key],
                        rarity === key ? styles.chipOn : '',
                      ].join(' ')}
                      onClick={() => setRarity(key)}
                    >
                      {label} <em>{n}</em>
                    </button>
                  )
                })}
              </div>
            </div>
            )}
            </div>
          )}

          {loading ? (
            <div className={styles.grid}>
              {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className={styles.skel} />)}
            </div>
          ) : tab === 'showcase' ? (
            badges.length === 0 ? (
              <p className={styles.center}>아직 딴 배지가 없어요. 도전을 시작해보세요.</p>
            ) : (
              <>
                <p className={styles.hint}>
                  프로필에 자랑할 배지를 최대 <b>{SHOWCASE_MAX}개</b>까지 골라요.
                </p>
                                {(['common', 'rare', 'epic', 'legendary'] as const).map(rar => {
                  const group = badges.filter(b => b.rarity === rar)
                  if (group.length === 0) return null
                  const got = group.filter(b => b.earned).length
                  return (
                    <div key={rar} className={styles.rarGroup}>
                      <div className={styles.rarHead}>
                        <span className={[styles.rarBadge, styles['r_' + rar]].join(' ')}>{RARITY_LABEL[rar]}</span>
                        <span className={styles.rarCount}>{got} / {group.length}</span>
                      </div>
                      <div className={styles.grid}>
                        {group.map(b => (
                          <BadgeTile key={b.tierId} b={b} on={showcase.includes(b.tierId)} order={showcase.indexOf(b.tierId)} onClick={() => pickBadge(b)} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )
          ) : tab === 'work' ? (
            favWorks.length === 0 ? (
              <p className={styles.center}>아직 최애 작품이 없어요. 작품을 최애로 등록해보세요.</p>
            ) : (
              <>
                <p className={styles.hint}>여권에 띄울 <b>최애 작품 1개</b>를 골라요.</p>
                <div className={styles.grid}>
                  {favWorks.map(w => (
                    <button key={w.tagId} className={[styles.workTile, featWork === w.tagId ? styles.workOn : ''].join(' ')} onClick={() => pickWork(w.tagId)}>
                      <div className={styles.workPoster}>{w.cover ? <img src={w.cover} /> : <span>?</span>}</div>
                      <span className={styles.workName}>{w.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )
          ) : (
            /* ⭐ 등급별로 나눈다 — 올라갈수록 좋아진다는 게 보여야 모으고 싶어진다.
               한 덩어리로 쏟아지면 그 위계가 안 느껴진다. */
            list.length === 0 ? (
              <p className={styles.center}>
                {owned === 'mine' ? '아직 해금한 게 없어요. 도전을 시작해보세요.' : '해당하는 아이템이 없어요.'}
              </p>
            ) : (
            <>
              {(['common', 'rare', 'epic', 'legendary'] as const).map(rar => {
                const group = list.filter(c => c.rarity === rar)
                if (group.length === 0) return null
                const got = group.filter(c => c.unlocked).length
                const isFolded = folded.has(rar)
                return (
                  <div key={rar} className={styles.rarGroup}>
                    <button
                      className={styles.rarHead}
                      onClick={() => setFolded(prev => {
                        const n = new Set(prev)
                        if (n.has(rar)) n.delete(rar); else n.add(rar)
                        return n
                      })}
                    >
                      <span className={[styles.rarBadge, styles['r_' + rar]].join(' ')}>
                        {RARITY_LABEL[rar]}
                      </span>
                      <span className={styles.rarCount}>{got} / {group.length}</span>
                      <span className={[styles.caret, isFolded ? styles.caretFolded : ''].join(' ')}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </button>

                    {!isFolded && (
                      <div className={styles.grid}>
                        {group.map(c => (
                          <Tile key={c.id} c={c} on={equipped[c.type] === c.id} onClick={() => pick(c)} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
            )
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
      className={[styles.tile, on ? styles.tileOn : '', c.unlocked ? '' : styles.tileLock].join(' ')}
      onClick={onClick}
    >
      <div
        className={[
          styles.thumb,
          c.type === 'effect' ? styles.thumbStage : '',
          c.type === 'effect' ? fxClass(c.slug) : '',
          /* ⭐ 썸네일은 세기를 올린다 — 고르는 화면에서 안 보이면 고를 수가 없다.
             프로필에선 은은한 게 맞고, 여기선 알아볼 수 있어야 한다. 같은 효과, 다른 세기. */
          c.type === 'effect' ? 'tkfx-preview' : '',
        ].join(' ')}
        style={c.type === 'background' ? bgStyle(c.slug, c.assetUrl) : undefined}
      >
        {/* ⭐⭐ 미리보기가 곧 결과여야 한다.
            previewStyle은 프레임 스타일을 '네모 썸네일'에 붙여서 원형 테두리가 안 보였고,
            배경은 이미지를 무시했고, 효과·칭호는 아무것도 안 그렸다.
            미리보기가 거짓말을 하면 고를 수가 없다. 그래서 진짜를 그린다. */}

        {/* 프레임 — 진짜 아바타 원에 씌운다 */}
        {c.type === 'frame' && (
          <span className={styles.thumbAvatar} style={FRAME_STYLE[c.slug]}>존</span>
        )}

        {/* 칭호 — 진짜 칭호 알약 */}
        {c.type === 'title' && <span className={styles.thumbTitle}>{c.name}</span>}

        {/* 효과는 썸네일 전체가 무대다 (thumbStage + tkfx). 안에 원을 두면 효과가 갇힌다 */}

        {!c.unlocked && <span className={styles.lock}>잠김</span>}
      </div>

      {/* 칭호는 미리보기가 곧 이름이다 — 아래에 또 쓰면 같은 말이 두 번 나온다 */}
      {c.type !== 'title' && <div className={styles.tileName}>{c.name}</div>}
      <div className={[styles.rarity, styles['r_' + c.rarity]].join(' ')}>
        {RARITY_LABEL[c.rarity] ?? c.rarity}
      </div>

      {!c.unlocked && c.fromBadge && (
        <div className={styles.cond}>{c.fromBadge} 달성</div>
      )}
    </button>
  )
}

/** 대표 배지 타일 — 고르면 진열 순서가 붙는다 */
function BadgeTile({ b, on, order, onClick }: {
  b: ShowcaseBadge; on: boolean; order: number; onClick: () => void
}) {
  return (
    <button
      className={[styles.tile, on ? styles.tileOn : '', !b.earned ? styles.tileLocked : ''].join(' ')}
      onClick={b.earned ? onClick : undefined}
      disabled={!b.earned}
    >
      <div className={[styles.thumb, styles['bg_' + b.rarity] ?? ''].join(' ')}>
        {b.icon
          ? <img src={b.icon} alt="" className={styles.badgeImg} />
          : <MaskIcon name="star" size={30} color="var(--accent)" />}
        {on && <span className={styles.check}>{order + 1}번째</span>}
      </div>
      <div className={styles.tileName}>{b.name}</div>
      <div className={[styles.rarity, styles['r_' + b.rarity]].join(' ')}>
        {RARITY_LABEL[b.rarity] ?? b.rarity}
      </div>
    </button>
  )
}