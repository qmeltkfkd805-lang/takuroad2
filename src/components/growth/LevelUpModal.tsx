'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { LEVELUP_EVENT, getMyLevelInfo, getNextReward, levelTier, LevelInfo, LevelReward } from '@/services/expService'
import { bgStyle, fxClass, FRAME_STYLE, RARITY_LABEL } from '@/lib/cosmetics/style'
import { Taku } from '@/components/tds'

/* 레벨업 축하 모달 — 해금 모달과 같은 전역 리스너 패턴.
   축하 → 새 레벨·랭크 칭호 → 🎁 이번 레벨 보상 → 다음 레벨 진행바 → 다음 보상/랭크 → 성장센터. */

const RANK_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
const RARITY_COLOR: Record<string, string> = { common: '#9aa0aa', rare: '#3d7fe0', epic: '#b45cff', legendary: '#ffb02e' }
const TYPE_LABEL: Record<string, string> = { background: '배경', effect: '효과', frame: '프레임', title: '칭호', theme: '테마' }

function RewardSwatch({ r }: { r: LevelReward }) {
  let inner: React.ReactNode = null
  if (r.type === 'background') inner = <div style={{ position: 'absolute', inset: 0, ...bgStyle(r.slug, r.assetUrl) }} />
  else if (r.type === 'frame') inner = <div style={{ position: 'absolute', inset: 6, borderRadius: 8, background: '#fff', ...(FRAME_STYLE[r.slug] || {}) }} />
  else if (r.type === 'effect') inner = <div className={`tkfx-preview ${fxClass(r.slug)}`} style={{ position: 'absolute', inset: 0, background: '#161b2e' }} />
  else inner = <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏷️</div>
  return (
    <div style={{ position: 'relative', width: 46, height: 46, borderRadius: 10, overflow: 'hidden', border: `2px solid ${RARITY_COLOR[r.rarity] ?? '#ccc'}`, flexShrink: 0 }}>
      {inner}
    </div>
  )
}

export default function LevelUpModal() {
  const { user } = useAuth()
  const router = useRouter()
  const [to, setTo] = useState<number | null>(null)
  const [info, setInfo] = useState<LevelInfo | null>(null)
  const [rewards, setRewards] = useState<LevelReward[]>([])
  const [next, setNext] = useState<{ level: number; reward: LevelReward } | null>(null)

  useEffect(() => {
    if (!user) return
    const onLevelUp = async (e: Event) => {
      const d = (e as CustomEvent<any>).detail
      if (!d || d.userId !== user.id) return   // 본인 레벨업만
      setTo(d.to)
      setRewards(Array.isArray(d.rewards) ? d.rewards : [])
      try { setInfo(await getMyLevelInfo(user.id)) } catch {}
      try { setNext(await getNextReward(d.to)) } catch {}
    }
    window.addEventListener(LEVELUP_EVENT, onLevelUp)
    return () => window.removeEventListener(LEVELUP_EVENT, onLevelUp)
  }, [user])

  if (to == null) return null

  const rank = levelTier(to)
  const nextRankLevel = RANK_STEPS.find(l => l > to) ?? null
  const nextRank = nextRankLevel ? levelTier(nextRankLevel) : null

  let pct = 0, remain = 0, hasNext = false
  if (info && info.nextLevelThreshold != null) {
    const span = info.nextLevelThreshold - info.currentLevelExp
    const got = info.totalExp - info.currentLevelExp
    pct = span > 0 ? Math.min(100, Math.round((got / span) * 100)) : 0
    remain = info.nextLevelExp ?? 0
    hasNext = true
  }

  const close = () => { setTo(null); setInfo(null); setRewards([]); setNext(null) }

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, maxWidth: 360, width: '100%', padding: '28px 22px 24px', textAlign: 'center', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={close} aria-label="닫기" style={{ position: 'absolute', top: 12, right: 14, border: 'none', background: 'none', fontSize: 22, color: 'var(--muted)', cursor: 'pointer' }}>×</button>

        <Taku pose="gacha" size={72} />
        <div style={{ fontSize: 12.5, fontWeight: 900, letterSpacing: '0.08em', color: 'var(--accent)', marginTop: 6 }}>LEVEL UP!</div>
        <h2 style={{ fontSize: 32, fontWeight: 900, margin: '2px 0 0' }}>LV.{to}</h2>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{rank.title}</div>

        {rewards.length > 0 && (
          <div style={{ marginTop: 18, padding: '14px 14px 12px', background: 'var(--surface2)', borderRadius: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: 'var(--accent)', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>🎁 이번 레벨 보상 {rewards.length}개</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rewards.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                  <RewardSwatch r={r} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: RARITY_COLOR[r.rarity] ?? 'var(--muted)' }}>{RARITY_LABEL[r.rarity] ?? r.rarity} · {TYPE_LABEL[r.type] ?? r.type}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>꾸미기에서 바로 착용할 수 있어요</div>
          </div>
        )}

        {hasNext && (
          <div style={{ margin: '18px 0 4px' }}>
            <div style={{ height: 10, borderRadius: 9999, background: 'var(--surface2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#FFC64B,#FF8A3D)' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 7 }}>다음 레벨까지 {remain.toLocaleString()} XP</div>
          </div>
        )}

        {next && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted)' }}>
            다음 보상 · <b style={{ color: 'var(--text)' }}>{next.reward.name}</b> (LV.{next.level})
          </div>
        )}

        {nextRank && nextRankLevel && (
          <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--muted)' }}>
            다음 랭크 · <b style={{ color: 'var(--text)' }}>LV.{nextRankLevel} {nextRank.title}</b>
          </div>
        )}

        <button
          onClick={() => { close(); router.push('/growth') }}
          style={{ marginTop: 22, width: '100%', padding: 13, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          성장센터에서 확인
        </button>
      </div>
    </div>
  )
}
