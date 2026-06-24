'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyWorkRelationships } from '@/services/workRelationshipService'
import { WorkRelationship } from '@/types/work-relationship'
import { AFFINITY_LABEL } from '@/lib/constants/workRelationship'

const PALETTE = [
  { bg: '#EEEDFE', fg: '#3C3489' }, { bg: '#E1F5EE', fg: '#0F6E56' },
  { bg: '#FAECE7', fg: '#993C1D' }, { bg: '#E6F1FB', fg: '#185FA5' },
  { bg: '#FBEAF0', fg: '#993556' }, { bg: '#FAEEDA', fg: '#854F0B' },
  { bg: '#EAF3DE', fg: '#3B6D11' }, { bg: '#FCEBEB', fg: '#A32D2D' },
]
function workColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export default function HomeFeed() {
  const { user } = useAuth()
  const [rels, setRels] = useState<WorkRelationship[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getMyWorkRelationships(user.id).then(setRels).finally(() => setLoading(false))
  }, [user])

  // 최애 먼저, 그다음 좋아하는 작품 (관계 있는 것만, 가로 스크롤)
  const myWorks = rels
    .filter(r => r.affinity)
    .sort((a, b) => (a.affinity === 'favorite' ? -1 : 1) - (b.affinity === 'favorite' ? -1 : 1))

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* 헤더 */}
      <div style={{
        padding: '18px 16px 14px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--accent)', margin: 0 }}>
          TAKUROAD
        </h1>
      </div>

      {/* ❤️ 내 작품 */}
      <div style={{ padding: '20px 0 8px' }}>
        <h2 style={{
          fontSize: '16px', fontWeight: 700, color: 'var(--text)',
          margin: '0 0 12px', padding: '0 16px',
        }}>
          ❤️ 내 작품
        </h2>

        {loading ? (
          <div style={{ padding: '20px 16px', color: 'var(--muted)', fontSize: '14px' }}>
            불러오는 중...
          </div>
        ) : !user ? (
          <PromptBox text="로그인하면 좋아하는 작품을 모아볼 수 있어요" href="/login" cta="로그인" />
        ) : myWorks.length === 0 ? (
          <PromptBox text="아직 좋아하는 작품이 없어요" href="/search" cta="작품 찾아보기" />
        ) : (
          <div style={{
            display: 'flex', gap: '10px', overflowX: 'auto',
            padding: '0 16px 4px', scrollbarWidth: 'none',
          }}>
            {myWorks.map(r => {
              const color = workColor(r.work.id)
              return (
                <Link key={r.work.id} href={`/work/${r.work.slug}`} style={{
                  flexShrink: 0, width: '92px', textDecoration: 'none',
                }}>
                  <div style={{
                    position: 'relative', width: '92px', height: '92px',
                    borderRadius: 'var(--r-sm)', background: color.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '26px', fontWeight: 700, color: color.fg,
                  }}>
                    {r.work.name.slice(0, 2)}
                    <span style={{
                      position: 'absolute', top: '4px', left: '4px', fontSize: '14px',
                    }}>
                      {AFFINITY_LABEL[r.affinity!].icon}
                    </span>
                  </div>
                  <div style={{
                    marginTop: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {r.work.name}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* 아래로 다른 섹션(활발한 작품/새로운 소식/굿즈샵/루트/지도)은 데이터 준비되면 추가 */}
    </div>
  )
}

function PromptBox({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div style={{
      margin: '0 16px', padding: '20px', borderRadius: 'var(--r-sm)',
      background: 'var(--surface2)', textAlign: 'center',
    }}>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 12px' }}>{text}</p>
      <Link href={href} style={{
        display: 'inline-block', padding: '9px 20px', borderRadius: 'var(--r-sm)',
        background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 700,
        textDecoration: 'none',
      }}>
        {cta}
      </Link>
    </div>
  )
}