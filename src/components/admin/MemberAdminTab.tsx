'use client'
import { useState, useEffect, useCallback } from 'react'
import { getAdminMembers, AdminMember, getMemberDetail, MemberDetail, grantExp } from '@/services/adminMemberService'
import { adminUpsert } from '@/services/adminUpsertService'
import { createClient } from '@/lib/supabase/client'

const PAGE_SIZE = 20
const ROLE_LABEL: Record<string, string> = { user: '일반회원', owner: '사장님', admin: '관리자' }
const ROLE_OPTIONS = [{ v: 'user', l: '일반회원' }, { v: 'owner', l: '사장님' }, { v: 'admin', l: '관리자' }]
const STATUS_LABEL: Record<string, string> = { active: '정상', dormant: '휴면', suspended: '정지', withdrawn: '탈퇴' }
const STATUS_TONE: Record<string, string> = { active: 'var(--green)', dormant: 'var(--yellow)', suspended: 'var(--red)', withdrawn: 'var(--muted)' }
const ACT_LABEL: Record<string, string> = {
  check_in: '체크인', checkin: '체크인', favorite: '최애 등록', review: '후기 작성', route: '루트', route_complete: '루트 완주',
  level_up: '레벨업', badge: '뱃지 획득', collection: '컬렉션', save_shop: '샵 저장',
}

export default function MemberAdminTab() {
  const [members, setMembers] = useState<AdminMember[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async (s: string, p: number) => {
    setLoading(true)
    const res = await getAdminMembers(s, PAGE_SIZE, p * PAGE_SIZE)
    setMembers(res.members); setTotal(res.total); setLoading(false)
  }, [])

  useEffect(() => { load(search, page) }, [search, page, load])
  function submitSearch() { setPage(0); setSearch(query.trim()) }
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)

  if (selectedId) return <MemberDetailView id={selectedId} onBack={() => setSelectedId(null)} />

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }} placeholder="닉네임 검색"
          style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, background: 'var(--surface)', color: 'var(--text)' }} />
        <button onClick={submitSearch} style={{ flexShrink: 0, padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>검색</button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>전체 {total.toLocaleString()}명{search ? ` · "${search}" 검색` : ''}</p>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
      ) : members.length === 0 ? (
        <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--muted)' }}><div style={{ fontSize: 36, marginBottom: 10 }}>👥</div><p style={{ fontSize: 14 }}>{search ? '검색 결과가 없어요' : '아직 회원이 없어요'}</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {members.map((m) => (
            <button key={m.id} onClick={() => setSelectedId(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '1px solid var(--border)', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
              <div style={{ width: 40, height: 40, borderRadius: 9999, flexShrink: 0, overflow: 'hidden', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.nickname || '(닉네임 없음)'}
                  {m.role !== 'user' && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: m.role === 'admin' ? 'var(--accent)' : 'var(--secondary)', padding: '2px 6px', borderRadius: 6 }}>{ROLE_LABEL[m.role] ?? m.role}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>가입 {new Date(m.created_at).toLocaleDateString('ko-KR')}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>보기 ›</span>
            </button>
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

function MemberDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [d, setD] = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState('user')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [expAmt, setExpAmt] = useState('')
  const [expReason, setExpReason] = useState('')
  const [manualBadges, setManualBadges] = useState<{ id: string; name: string }[]>([])
  const [grantTierId, setGrantTierId] = useState('')
  const [grantBusy, setGrantBusy] = useState(false)
  const [grantMsg, setGrantMsg] = useState<string | null>(null)

  const refresh = useCallback(() => {
    getMemberDetail(id).then((m) => {
      setD(m)
      if (m) { setRole(m.role); setNote(m.admin_note ?? '') }
      setLoading(false)
    })
  }, [id])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const sb = createClient()
    ;(async () => {
      const { data } = await sb.from('badge_tiers').select('id, name').eq('award_type', 'manual').eq('is_active', true).order('sort_order')
      const list = (data ?? []).map((b: any) => ({ id: b.id, name: b.name }))
      setManualBadges(list)
      if (list.length > 0) setGrantTierId(list[0].id)
    })()
  }, [])
  async function grantBadge() {
    if (!grantTierId) return
    setGrantBusy(true); setGrantMsg(null)
    try {
      const res = await fetch('/api/admin/grant-badge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id, tierId: grantTierId }) })
      const j = await res.json()
      setGrantMsg(res.ok ? '지급 완료' : ('실패: ' + (j.error ?? res.status)))
    } catch (e: any) { setGrantMsg('오류: ' + (e?.message ?? '알 수 없음')) }
    finally { setGrantBusy(false) }
  }

  async function saveRoleNote() {
    setSaving(true); setMsg(null)
    const res = await adminUpsert({ table: 'profiles', id, fields: { role, admin_note: note.trim() || null }, action: 'update' })
    setSaving(false); setMsg(res.ok ? '저장됐어요' : (res.error ?? '저장 실패')); if (res.ok) refresh()
  }

  async function setStatus(status: string, days: number | null) {
    if (status === 'suspended' && !confirm(days ? `${days}일 정지할까요?` : '영구 정지할까요?')) return
    const suspended_until = days ? new Date(Date.now() + days * 86400000).toISOString() : null
    setMsg(null)
    const res = await adminUpsert({ table: 'profiles', id, fields: { status, suspended_until }, action: 'update' })
    setMsg(res.ok ? '적용됐어요' : (res.error ?? '실패')); if (res.ok) refresh()
  }

  async function toggleBeta(v: boolean) {
    const res = await adminUpsert({ table: 'profiles', id, fields: { is_beta: v }, action: 'update' })
    if (res.ok) refresh()
  }

  async function doGrantExp() {
    const amt = parseInt(expAmt, 10)
    if (!amt || Number.isNaN(amt)) { setMsg('EXP 숫자를 입력하세요'); return }
    setMsg(null)
    const r = await grantExp(id, amt, expReason.trim() || '관리자 지급')
    if (r) { setMsg(`EXP ${amt} 지급 완료 (총 ${r.total_exp}, Lv.${r.level})`); setExpAmt(''); setExpReason(''); refresh() }
    else setMsg('EXP 지급 실패')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  if (!d) return <div style={{ padding: 16 }}><button onClick={onBack} style={backBtn}>← 목록</button><p style={{ marginTop: 20, color: 'var(--muted)' }}>회원 정보를 불러올 수 없어요</p></div>

  const acts = [
    { label: '체크인', v: d.checkins }, { label: '최애', v: d.favorites }, { label: '후기', v: d.reviews },
    { label: '저장 샵', v: d.saved_shops }, { label: '만든 루트', v: d.routes }, { label: '완주 루트', v: d.route_completions },
  ]
  const status = d.status || 'active'

  return (
    <div style={{ padding: 16 }}>
      <button onClick={onBack} style={backBtn}>← 목록</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '16px 0' }}>
        <div style={{ width: 60, height: 60, borderRadius: 9999, overflow: 'hidden', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
          {d.avatar_url ? <img src={d.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
            {d.nickname || '(닉네임 없음)'}
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: STATUS_TONE[status], padding: '2px 8px', borderRadius: 9999 }}>{STATUS_LABEL[status] ?? status}</span>
            {d.is_beta && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', border: '1px solid var(--accent)', padding: '1px 7px', borderRadius: 9999 }}>베타</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Lv.{d.level} · EXP {d.total_exp.toLocaleString()}
            {status === 'suspended' && d.suspended_until && ` · ~${new Date(d.suspended_until).toLocaleDateString('ko-KR')}까지`}
            {status === 'suspended' && !d.suspended_until && ' · 영구'}
          </div>
        </div>
      </div>

      <Card title="기본 정보">
        <Row k="UID" v={d.id} mono />
        <Row k="가입일" v={new Date(d.created_at).toLocaleString('ko-KR')} />
        <Row k="등급" v={ROLE_LABEL[d.role] ?? d.role} />
      </Card>

      <Card title="활동">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {acts.map((a) => (
            <div key={a.label} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{a.v.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{a.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {d.recent_activity && d.recent_activity.length > 0 && (
        <Card title="최근 활동">
          {d.recent_activity.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--muted)', flexShrink: 0, width: 44 }}>{new Date(a.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</span>
              <span style={{ fontWeight: 600 }}>{ACT_LABEL[a.type] ?? a.type}</span>
            </div>
          ))}
        </Card>
      )}

      <Card title="권한">
        <select value={role} onChange={(e) => setRole(e.target.value)} style={selectStyle}>
          {ROLE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      </Card>

      <Card title="운영 메모">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 오프라인 행사 제보를 자주 해주는 회원 / 사장님 인증 완료 / 도배 주의"
          style={{ width: '100%', minHeight: 90, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', resize: 'vertical' }} />
      </Card>

      <button onClick={saveRoleNote} disabled={saving} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20 }}>
        {saving ? '저장 중...' : '권한 · 메모 저장'}
      </button>

      <Card title="배지 지급">
        {manualBadges.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>수동 지급 배지가 없어요</div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={grantTierId} onChange={(e) => setGrantTierId(e.target.value)} style={selectStyle}>
              {manualBadges.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button onClick={grantBadge} disabled={grantBusy} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {grantBusy ? '지급 중...' : '지급'}
            </button>
          </div>
        )}
        {grantMsg && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text)' }}>{grantMsg}</div>}
      </Card>

      <Card title="제재">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <SanctionBtn onClick={() => setStatus('suspended', 1)}>1일 정지</SanctionBtn>
          <SanctionBtn onClick={() => setStatus('suspended', 7)}>7일 정지</SanctionBtn>
          <SanctionBtn onClick={() => setStatus('suspended', null)}>영구 정지</SanctionBtn>
          <SanctionBtn onClick={() => setStatus('active', null)} tone="green">정지 해제</SanctionBtn>
        </div>
      </Card>

      <Card title="베타테스터">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={d.is_beta} onChange={(e) => toggleBeta(e.target.checked)} style={{ width: 18, height: 18 }} />
          베타테스터로 지정
        </label>
      </Card>

      <Card title="EXP 지급">
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={expAmt} onChange={(e) => setExpAmt(e.target.value)} placeholder="EXP" inputMode="numeric" style={{ ...selectStyle, width: 90, flexShrink: 0 }} />
          <input value={expReason} onChange={(e) => setExpReason(e.target.value)} placeholder="사유 (예: 이벤트 참여 감사)" style={selectStyle} />
          <button onClick={doGrantExp} style={{ flexShrink: 0, padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--secondary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>지급</button>
        </div>
      </Card>

      {msg && <p style={{ fontSize: 13, textAlign: 'center', marginTop: 6, color: msg.includes('실패') || msg.includes('입력') ? 'var(--red)' : 'var(--green)' }}>{msg}</p>}

      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 20, lineHeight: 1.6 }}>도장·기념품·컬렉션 지급과 신고 내역은 준비 중이에요.</p>
    </div>
  )
}

const backBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: 0 }
const selectStyle: React.CSSProperties = { flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, background: 'var(--surface)', color: 'var(--text)' }

function SanctionBtn({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone?: string }) {
  return <button onClick={onClick} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: tone === 'green' ? 'var(--green)' : 'var(--red)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{children}</button>
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', marginBottom: 8 }}>{title}</div>{children}</div>
}
function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}><span style={{ color: 'var(--muted)', flexShrink: 0 }}>{k}</span><span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-all', fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? 11 : 13 }}>{v}</span></div>
}
function PageBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: disabled ? 'var(--muted)' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1 }}>{children}</button>
}
