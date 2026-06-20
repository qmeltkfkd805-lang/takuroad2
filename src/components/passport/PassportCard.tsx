'use client'

import { OtakuPassport } from '@/services/passportService'
import { RARITY_COLOR } from '@/services/badgeService'

interface Props {
  passport: OtakuPassport
  isOwner?: boolean
  onChangeTitleClick?: () => void
}

export default function PassportCard({ passport, isOwner, onChangeTitleClick }: Props) {
  const issuedDate = new Date(passport.issuedAt).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\. /g, '.').replace('.', '.')

  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)',
      border: '1.5px solid var(--border)', borderRadius: '20px',
      padding: '24px 20px', margin: '16px',
    }}>
      {/* 여권 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 900, color: 'var(--muted)', letterSpacing: '1px' }}>
          TAKUROAD PASSPORT
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '6px', fontSize: '11px', color: 'var(--muted)' }}>
          <span>No. {passport.passportNumber}</span>
          <span>Issued {issuedDate}</span>
        </div>
      </div>

      {/* 자동 소개 문구 */}
      <p style={{
        textAlign: 'center', fontSize: '13px', color: 'var(--accent)',
        fontWeight: 700, marginBottom: '16px', fontStyle: 'italic',
      }}>
        &quot;{passport.tagline}&quot;
      </p>

      {/* 닉네임 + 명패 */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 900, overflow: 'hidden',
          }}>
            {passport.avatarUrl ? (
              <img src={passport.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              passport.nickname[0]
            )}
          </div>
          <span style={{ fontSize: '18px', fontWeight: 900 }}>{passport.nickname}</span>
        </div>

        {passport.titleBadgeName ? (
          <div
            onClick={isOwner ? onChangeTitleClick : undefined}
            style={{
              display: 'inline-block', fontSize: '15px', fontWeight: 900,
              color: 'var(--accent)', cursor: isOwner ? 'pointer' : 'default',
            }}
          >
            【 {passport.titleBadgeName} 】
          </div>
        ) : isOwner ? (
          <button
            onClick={onChangeTitleClick}
            style={{
              fontSize: '12px', color: 'var(--muted)', background: 'none',
              border: '1px dashed var(--border)', borderRadius: '8px',
              padding: '6px 14px', cursor: 'pointer',
            }}
          >
            명패 설정하기
          </button>
        ) : null}
      </div>

      {/* 덕질 DNA */}
      {passport.topVisitedSeries.length > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '16px',
          padding: '12px', background: 'var(--surface2)', borderRadius: '12px',
          marginBottom: '16px',
        }}>
          {passport.topVisitedSeries[0] && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--muted)' }}>🎮 작품</div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{passport.topVisitedSeries[0].name}</div>
            </div>
          )}
        </div>
      )}

      {/* 기록 도장들 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <StatBox label="방문" value={passport.visitedShopCount} />
        <StatBox label="순례" value={passport.pilgrimageCount} />
        <StatBox label="배지" value={passport.totalBadgeCount} />
        <StatBox label="후기" value={passport.reviewCount} />
      </div>

      {/* 첫 성지 / 최근 성지 */}
      {(passport.firstShop || passport.latestShop) && (
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>
          {passport.firstShop && (
            <div style={{ marginBottom: '4px' }}>
              🏁 첫 성지: <strong style={{ color: 'var(--text)' }}>{passport.firstShop.name}</strong>
              {' '}({new Date(passport.firstShop.date).toLocaleDateString('ko-KR')})
            </div>
          )}
          {passport.latestShop && (
            <div>
              📍 최근 성지: <strong style={{ color: 'var(--text)' }}>{passport.latestShop.name}</strong>
              {' '}({new Date(passport.latestShop.date).toLocaleDateString('ko-KR')})
            </div>
          )}
        </div>
      )}

      {/* 가장 많이 찾은 작품 Top 3 */}
      {passport.topVisitedSeries.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 900, color: 'var(--muted)', marginBottom: '8px' }}>
            가장 많이 찾은 작품
          </div>
          {passport.topVisitedSeries.map((s, i) => (
            <div key={s.name} style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '13px', padding: '4px 0',
            }}>
              <span>{i + 1}. {s.name}</span>
              <span style={{ color: 'var(--muted)' }}>{s.count}곳</span>
            </div>
          ))}
        </div>
      )}

      {/* 대표 배지 */}
      {passport.featuredBadges.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 900, color: 'var(--muted)', marginBottom: '8px' }}>
            대표 배지
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {passport.featuredBadges.map((b, i) => (
              <div key={i} style={{
                width: '44px', height: '44px', borderRadius: '10px',
                border: `2px solid ${RARITY_COLOR[b.rarity as keyof typeof RARITY_COLOR] ?? 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--surface)', overflow: 'hidden',
              }}>
                {b.iconUrl?.startsWith('http') ? (
                  <img src={b.iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '20px' }}>🏅</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 4px', background: 'var(--surface2)', borderRadius: '10px' }}>
      <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--accent)' }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}