'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getOfficialRouteCandidates,
  getOfficialRoutes,
  approveOfficialRoute,
  revokeOfficialRoute,
} from '@/services/adminRouteService'

export default function OfficialRouteTab() {
  const { user } = useAuth()
  const [candidates, setCandidates] = useState<any[]>([])
  const [officialRoutes, setOfficialRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState(1)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [cand, official] = await Promise.all([
      getOfficialRouteCandidates(),
      getOfficialRoutes(),
    ])
    setCandidates(cand.filter((c: any) => !c.is_official))
    setOfficialRoutes(official)
    setLoading(false)
  }

  async function handleApprove(routeId: string) {
    if (!user) return
    const ok = await approveOfficialRoute(routeId, difficulty, user.id)
    if (ok) {
      setApprovingId(null)
      setDifficulty(1)
      loadData()
    }
  }

  async function handleRevoke(routeId: string) {
    if (!confirm('공식 루트를 해제할까요?')) return
    await revokeOfficialRoute(routeId)
    loadData()
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>

  return (
    <div>
      <h3 style={{ fontSize: '14px', fontWeight: 900, padding: '16px 16px 0' }}>
        공식 루트 후보 (좋아요/완료순)
      </h3>
      {candidates.length === 0 ? (
        <p style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
          후보가 없어요
        </p>
      ) : (
        candidates.map(route => (
          <div key={route.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '6px' }}>{route.title}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
              좋아요 {route.likes} · 완료 {route.completionCount}명 · 작성자: {route.profiles?.nickname ?? '알 수 없음'} · {route.route_shops?.length ?? 0}곳
            </div>

            {approvingId === route.id ? (
              <div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  {[1, 2, 3].map(d => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      style={{
                        padding: '6px 12px', borderRadius: '8px',
                        border: `1.5px solid ${difficulty === d ? 'var(--accent)' : 'var(--border)'}`,
                        background: difficulty === d ? 'var(--accent-l)' : 'var(--surface)',
                        fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {'★'.repeat(d)}{'☆'.repeat(3 - d)}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setApprovingId(null)}
                    style={{
                      flex: 1, padding: '9px', borderRadius: '8px',
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >취소</button>
                  <button
                    onClick={() => handleApprove(route.id)}
                    style={{
                      flex: 1, padding: '9px', borderRadius: '8px',
                      border: 'none', background: 'var(--green)', color: '#fff',
                      fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >승인 확정</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setApprovingId(route.id)}
                style={{
                  width: '100%', padding: '9px', borderRadius: '8px',
                  border: 'none', background: 'var(--accent)', color: '#fff',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >공식 루트로 승인</button>
            )}
          </div>
        ))
      )}

      <h3 style={{ fontSize: '14px', fontWeight: 900, padding: '20px 16px 0' }}>
        현재 공식 루트
      </h3>
      {officialRoutes.length === 0 ? (
        <p style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
          아직 공식 루트가 없어요
        </p>
      ) : (
        officialRoutes.map(route => (
          <div key={route.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>✅ {route.title}</span>
              <span style={{ fontSize: '13px', color: '#f59e0b' }}>
                {'★'.repeat(route.official_difficulty ?? 1)}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
              승인일 {new Date(route.approved_at).toLocaleDateString('ko-KR')}
            </div>
            <button
              onClick={() => handleRevoke(route.id)}
              style={{
                fontSize: '12px', color: 'var(--red)', background: 'none',
                border: '1px solid var(--red)', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
              }}
            >공식 해제</button>
          </div>
        ))
      )}
    </div>
  )
}