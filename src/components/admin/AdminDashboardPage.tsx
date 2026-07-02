'use client'

import { useState, useEffect, CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { getAdminTodoSummary, getAdminStats, getTopShops, AdminStats, TopShop } from '@/services/adminDashboardService'
import { getActiveWorks, ActiveWork } from '@/services/activeWorksService'
import { ROUTES } from '@/lib/constants/routes'

const rankRow: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '11px 2px', borderBottom: '1px solid var(--border)',
  textDecoration: 'none', color: 'inherit', fontSize: 14,
}

export default function AdminDashboardPage({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [topWorks, setTopWorks] = useState<ActiveWork[]>([])
  const [topShops, setTopShops] = useState<TopShop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getAdminStats(), getAdminTodoSummary(), getActiveWorks(5), getTopShops(5)])
      .then(([s, sum, works, shops]) => {
        setStats(s); setSummary(sum); setTopWorks(works); setTopShops(shops); setLoading(false)
      })
  }, [])

  if (loading || !stats || !summary) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  }

  return (
    <div style={{ padding: 16 }}>
      <SectionTitle>📊 전체 현황</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
        <StatCard label="작품" value={stats.works} onClick={() => onNavigate('works')} />
        <StatCard label="샵" value={stats.shops} onClick={() => onNavigate('shopmanage')} />
        <StatCard label="이벤트" value={stats.events} onClick={() => onNavigate('events')} />
        <StatCard label="배너" value={stats.banners} onClick={() => onNavigate('banners')} />
        <StatCard label="회원" value={stats.members} onClick={() => onNavigate('members')} />
        <StatCard label="최애 등록" value={stats.favorites} />
      </div>

      <SectionTitle>🗓 오늘</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 8 }}>
        <StatCard label="신규 회원" value={stats.newMembersToday} accent />
        <PlaceholderCard label="방문자" />
        <PlaceholderCard label="체크인" />
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 24 }}>※ 방문자·체크인은 체크인/분석 시스템 연결 후 집계돼요.</p>

      <SectionTitle>🟠 검수 대기</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <TodoRow icon="📝" label="샵 제보 대기" count={summary.pendingSuggestions} onClick={() => onNavigate('reported')} />
        <TodoRow icon="✅" label="인증 신청 대기" count={summary.pendingVerifyRequests} onClick={() => onNavigate('verify')} />
        <TodoRow icon="❓" label="미확인 굿즈 정보" count={summary.unconfirmedProducts} />
      </div>

      <SectionTitle>🎬 인기 작품 TOP5 <Muted>최근 7일 활동</Muted></SectionTitle>
      {topWorks.length === 0 ? (
        <EmptyLine text="활동 데이터가 쌓이면 표시돼요" />
      ) : (
        <div style={{ marginBottom: 24 }}>
          {topWorks.map((w, i) => (
            <Link key={w.id} href={`/work/${w.slug}`} target="_blank" style={rankRow}>
              <span><b style={{ color: 'var(--accent)', marginRight: 8 }}>{i + 1}</b>{w.name}</span>
            </Link>
          ))}
        </div>
      )}

      <SectionTitle>🏪 인기 샵 TOP5 <Muted>방문순</Muted></SectionTitle>
      {topShops.length === 0 ? (
        <EmptyLine text="아직 샵이 없어요" />
      ) : (
        <div style={{ marginBottom: 24 }}>
          {topShops.map((s, i) => (
            <Link key={s.id} href={ROUTES.shop(s.slug)} target="_blank" style={rankRow}>
              <span><b style={{ color: 'var(--accent)', marginRight: 8 }}>{i + 1}</b>{s.name}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>방문 {s.visit_count ?? 0}</span>
            </Link>
          ))}
        </div>
      )}

      {summary.staleShops.length > 0 && (
        <>
          <SectionTitle>🔥 인기 있는데 오래된 정보</SectionTitle>
          <div>
            {summary.staleShops.map((shop: any) => (
              <Link key={shop.id} href={ROUTES.shopEdit(shop.slug)} style={rankRow}>
                <span style={{ fontWeight: 700 }}>{shop.name}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>방문 {shop.visit_count}회 · {new Date(shop.info_last_confirmed_at).toLocaleDateString('ko-KR')} 갱신</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 14, fontWeight: 900, marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 6 }}>{children}</h2>
}
function Muted({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{children}</span>
}

function StatCard({ label, value, onClick, accent }: { label: string; value: number; onClick?: () => void; accent?: boolean }) {
  return (
    <div onClick={onClick} style={{
      border: '1px solid var(--border)', borderRadius: 12, padding: '14px 12px',
      cursor: onClick ? 'pointer' : 'default', background: 'var(--surface)',
    }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: accent ? 'var(--accent)' : 'var(--text)' }}>{(value ?? 0).toLocaleString()}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function PlaceholderCard({ label }: { label: string }) {
  return (
    <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: '14px 12px', background: 'var(--surface2)' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>준비 중</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function EmptyLine({ text }: { text: string }) {
  return <div style={{ padding: '18px 2px', fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>{text}</div>
}

function TodoRow({ icon, label, count, onClick }: { icon: string; label: string; count: number; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{icon} {label}</span>
      <span style={{ fontSize: 13, fontWeight: 900, color: count > 0 ? 'var(--accent)' : 'var(--muted)' }}>{count}건</span>
    </div>
  )
}




