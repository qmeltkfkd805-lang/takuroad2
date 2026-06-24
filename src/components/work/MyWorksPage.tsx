'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyWorkRelationships } from '@/services/workRelationshipService'
import { WorkRelationship } from '@/types/work-relationship'
import { AFFINITY_LABEL, STATE_LABEL } from '@/lib/constants/workRelationship'
import { ROUTES } from '@/lib/constants/routes'

// ============================================================
// "내 작품" 화면 (B안)
//   1) ❤️ 최애      — 가장 먼저, 별도 고정 영역
//   2) ⭐ 좋아하는 작품 — 그 아래 그리드
//   3) 함께한 작품   — affinity 없이 state/activity만 있는 작품 (합집합 보존)
// WorkRelationship 하나만 소비. 세 테이블의 존재를 화면은 모른다.
// ============================================================

// 커버 이미지가 없으므로 작품명 기반으로 안정적인 색을 고른다.
// (ipType 색이 코드에서 읽히게 되면 이 자리를 ipType 색으로 교체)
const PALETTE = [
  { bg: '#EEEDFE', fg: '#3C3489' },
  { bg: '#E1F5EE', fg: '#0F6E56' },
  { bg: '#FAECE7', fg: '#993C1D' },
  { bg: '#E6F1FB', fg: '#185FA5' },
  { bg: '#FBEAF0', fg: '#993556' },
  { bg: '#FAEEDA', fg: '#854F0B' },
  { bg: '#EAF3DE', fg: '#3B6D11' },
  { bg: '#FCEBEB', fg: '#A32D2D' },
]
function workColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export default function MyWorksPage() {
  const { user } = useAuth()
  const [rels, setRels] = useState<WorkRelationship[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getMyWorkRelationships(user.id)
      .then(setRels)
      .finally(() => setLoading(false))
  }, [user])

  const favorites = rels.filter(r => r.affinity === 'favorite')
  const likes     = rels.filter(r => r.affinity === 'interest')
  const others    = rels.filter(r => !r.affinity)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* 헤더 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)' }}>
          내 작품 {rels.length > 0 && (
            <span style={{ color: 'var(--accent)' }}>{rels.length}</span>
          )}
        </span>
        <Link href={ROUTES.home} style={{ fontSize: '18px', color: 'var(--muted)' }}>🔍</Link>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
          불러오는 중...
        </div>
      ) : rels.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ padding: '16px' }}>
          {/* 1) ❤️ 최애 — 가장 먼저, 특별한 공간 */}
          <Section title={`${AFFINITY_LABEL.favorite.icon} ${AFFINITY_LABEL.favorite.label}`}>
            {favorites.length === 0 ? (
              <EmptyHint text="아직 최애가 없어요. 작품을 ❤️ 최애로 등록해보세요." />
            ) : (
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                {favorites.map(r => <WorkCard key={r.work.id} rel={r} size="large" />)}
              </div>
            )}
          </Section>

          {/* 2) ⭐ 좋아하는 작품 — 그리드 */}
          {likes.length > 0 && (
            <Section title={`${AFFINITY_LABEL.interest.icon} ${AFFINITY_LABEL.interest.label}`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {likes.map(r => <WorkCard key={r.work.id} rel={r} size="grid" />)}
              </div>
            </Section>
          )}

          {/* 3) 함께한 작품 — affinity 없이 방문/상태만 있는 작품 (합집합 보존) */}
          {others.length > 0 && (
            <Section title="함께한 작품">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {others.map(r => <WorkCard key={r.work.id} rel={r} size="grid" />)}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

// ── 섹션 래퍼 ──────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{
      padding: '16px', borderRadius: 'var(--r-sm)', background: 'var(--surface2)',
      fontSize: '13px', color: 'var(--muted)', textAlign: 'center',
    }}>
      {text}
    </div>
  )
}

// ── 작품 카드 ──────────────────────────────────────────────
// 관계가 한눈에: 색 블록(작품) + 이름 + 상태 뱃지(보조) + 방문 기록(보조)
function WorkCard({ rel, size }: { rel: WorkRelationship; size: 'large' | 'grid' }) {
  const { work, state, activity } = rel
  const color = workColor(work.id)
  const isLarge = size === 'large'
  const block = isLarge ? 96 : undefined

  return (
    <Link
      href={`/work/${work.slug}`}
      style={{
        flexShrink: 0,
        width: isLarge ? '110px' : 'auto',
        textDecoration: 'none',
      }}
    >
      {/* 커버 자리 — 이니셜 + 안정적인 색 */}
      <div style={{
        position: 'relative',
        width: isLarge ? '110px' : '100%',
        height: block, aspectRatio: isLarge ? undefined : '1',
        borderRadius: 'var(--r-sm)', background: color.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isLarge ? '30px' : '22px', fontWeight: 700, color: color.fg,
        overflow: 'hidden',
      }}>
        {work.name.slice(0, 2)}

        {/* 상태 뱃지 — 보조 정보, 좌상단에 작게 */}
        {state && (
          <span style={{
            position: 'absolute', top: '5px', left: '5px',
            background: 'rgba(255,255,255,.9)', borderRadius: '6px',
            padding: '1px 6px', fontSize: '11px', fontWeight: 700, color: 'var(--text)',
          }}>
            {STATE_LABEL[state].icon} {STATE_LABEL[state].label}
          </span>
        )}
      </div>

      {/* 작품명 */}
      <div style={{
        marginTop: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {work.name}
      </div>

      {/* 방문 기록 — 보조 정보 */}
      {activity && activity.visitCount > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
          방문 {activity.visitCount}회
        </div>
      )}
    </Link>
  )
}

// ── 빈 상태 (신규 사용자) ──────────────────────────────────
function EmptyState() {
  return (
    <div style={{ padding: '40px 28px', textAlign: 'center' }}>
      <div style={{
        width: '72px', height: '72px', margin: '0 auto 16px', borderRadius: '50%',
        background: 'var(--accent-l)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '34px',
      }}>
        ❤️
      </div>
      <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
        좋아하는 작품을 모아보세요
      </p>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.6 }}>
        작품을 ❤️ 최애로 등록하거나 굿즈샵에 체크인하면<br />
        여기에 나만의 작품 컬렉션이 쌓여요
      </p>
      <Link href={ROUTES.home} style={{
        display: 'inline-block', padding: '11px 24px', borderRadius: 'var(--r-sm)',
        background: 'var(--accent)', color: '#fff', fontSize: '14px', fontWeight: 700,
        textDecoration: 'none',
      }}>
        작품 둘러보기
      </Link>
    </div>
  )
}