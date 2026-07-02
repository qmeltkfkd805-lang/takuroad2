'use client'
import { useState, useEffect, useCallback } from 'react'
import { getAdminMembers, AdminMember } from '@/services/adminMemberService'

const PAGE_SIZE = 20

export default function MemberAdminTab() {
  const [members, setMembers] = useState<AdminMember[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (s: string, p: number) => {
    setLoading(true)
    const res = await getAdminMembers(s, PAGE_SIZE, p * PAGE_SIZE)
    setMembers(res.members)
    setTotal(res.total)
    setLoading(false)
  }, [])

  useEffect(() => { load(search, page) }, [search, page, load])

  function submitSearch() { setPage(0); setSearch(query.trim()) }

  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
          placeholder="닉네임 검색"
          style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, background: 'var(--surface)', color: 'var(--text)' }}
        />
        <button onClick={submitSearch} style={{ flexShrink: 0, padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>검색</button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>전체 {total.toLocaleString()}명{search ? ` · "${search}" 검색` : ''}</p>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
      ) : members.length === 0 ? (
        <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
          <p style={{ fontSize: 14 }}>{search ? '검색 결과가 없어요' : '아직 회원이 없어요'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {members.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 9999, flexShrink: 0, overflow: 'hidden', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.nickname || '(닉네임 없음)'}
                  {m.role === 'admin' && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--accent)', padding: '2px 6px', borderRadius: 6 }}>관리자</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>가입 {new Date(m.created_at).toLocaleDateString('ko-KR')}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <PageBtn disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← 이전</PageBtn>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{page + 1} / {maxPage + 1}</span>
          <PageBtn disabled={page >= maxPage} onClick={() => setPage((p) => Math.min(maxPage, p + 1))}>다음 →</PageBtn>
        </div>
      )}
    </div>
  )
}

function PageBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
      background: 'var(--surface)', color: disabled ? 'var(--muted)' : 'var(--text)',
      fontWeight: 700, fontSize: 13, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
      opacity: disabled ? 0.5 : 1,
    }}>{children}</button>
  )
}
