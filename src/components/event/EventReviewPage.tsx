'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import WorkEventList from '@/components/work/WorkEventList'
import { WorkEvent } from '@/services/eventService'
import { getPendingSubmissions, PendingSubmission, approveSubmission, rejectSubmission } from '@/services/eventSubmissionService'
import { createShop, searchShops } from '@/services/shopService'
import { Shop } from '@/types/shop'
import { generateSlug } from '@/lib/utils/shop'
import { CATEGORIES } from '@/lib/constants/categories'

const TYPE_LABEL: Record<string, string> = {
  popup: '🎪 팝업스토어', collab_cafe: '☕ 콜라보 카페', exhibition: '🖼️ 전시',
}

function fmtPeriod(s: string | null, e: string | null): string {
  if (!s && !e) return '기간 미정'
  const f = (d: string) => d.replace(/-/g, '.').slice(2)
  if (s && e) return `${f(s)} ~ ${f(e)}`
  return f((s ?? e)!)
}

// 제보된 카카오 장소(snapshot)로 새 Shop 생성.
// snapshot에 없는 값은 cats(검수자가 선택)뿐 — 나머지(사진·설명·영업시간)는 샵 페이지에서 보완.
// createShop은 slug 중복 시 null을 반환하므로, 1회 한정으로 접미사를 붙여 재시도한다.
async function createShopFromSnapshot(
  snap: any,
  name: string,
  cats: string[],
  userId: string
): Promise<{ id: string; slug: string } | null> {
  const base = generateSlug(name)
  const data = {
    name: name.trim(),
    addr: snap?.roadAddress ?? snap?.address ?? null,
    lat: snap?.lat ?? null,
    lng: snap?.lng ?? null,
    cats,
    hours: null,
    parking: null,
  }

  let res = await createShop({ ...data, slug: base }, userId)
  if (!res) {
    // 슬러그 중복 가능성 → 짧은 접미사로 한 번 재시도
    res = await createShop({ ...data, slug: `${base}-${Math.random().toString(36).slice(2, 6)}` }, userId)
  }
  return res
}

export default function EventReviewPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [queue, setQueue] = useState<PendingSubmission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin) { setLoading(false); return }
    getPendingSubmissions().then(setQueue).finally(() => setLoading(false))
  }, [authLoading, isAdmin])

  function removeFromQueue(id: string) {
    setQueue(q => q.filter(x => x.id !== id))
  }

  if (authLoading || loading) {
    return <Centered>불러오는 중...</Centered>
  }
  if (!isAdmin || !user) {
    return <Centered>관리자만 접근할 수 있어요.</Centered>
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '16px', maxWidth: '680px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text)', margin: '4px 0 6px' }}>
        🛡️ 이벤트 제보 검수
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 20px' }}>
        검수 대기 {queue.length}건 · 수정 후 승인할 수 있어요
      </p>

      {queue.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)',
          background: 'var(--surface2)', borderRadius: 'var(--r-sm)' }}>
          검수할 제보가 없어요
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {queue.map(s => (
            <ReviewCard key={s.id} submission={s} reviewerId={user.id} onDone={() => removeFromQueue(s.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// 제보 한 건 = Event 생성 에디터
function ReviewCard({ submission, reviewerId, onDone }: {
  submission: PendingSubmission
  reviewerId: string
  onDone: () => void
}) {
  const snap = submission.placeSnapshot ?? {}
  const snapName = snap.name ?? '(장소 정보 없음)'
  const snapAddr = snap.roadAddress ?? snap.address ?? ''

  // 제보 값으로 시작하되, 관리자가 수정 가능
  const [title, setTitle] = useState(submission.title.trim())
  const [type, setType] = useState(submission.type)
  const [placeDetail, setPlaceDetail] = useState(submission.placeDetail ?? '')
  const [startDate, setStartDate] = useState(submission.startDate ?? '')
  const [endDate, setEndDate] = useState(submission.endDate ?? '')
  const [description, setDescription] = useState(submission.description ?? '')

  // 샵 연결 — 승인의 전제. shopId가 채워져야 승인 가능.
  // 샵 상세에서 제보한 경우 이미 shop_id가 있음 → 그대로 시작(생성 단계 건너뜀).
  const prelinked = submission.shopId != null
  const [shopId, setShopId] = useState<string | null>(submission.shopId ?? null)
  const [shopSlug, setShopSlug] = useState<string | null>(submission.shopSlug ?? null)
  const [shopName, setShopName] = useState((snap.name ?? '').trim())
  const [shopCats, setShopCats] = useState<string[]>([])
  const [creatingShop, setCreatingShop] = useState(false)

  // 연결 방식: 샵상세 제보(prelinked) / 기존샵 매칭(matched) / 새로 생성(created)
  const [linkKind, setLinkKind] = useState<'prelinked' | 'matched' | 'created' | null>(prelinked ? 'prelinked' : null)
  const [matchedName, setMatchedName] = useState<string | null>(null)

  // 기존 샵 찾기(중복 방지) — 제보 장소 이름으로 검색
  const [shopQuery, setShopQuery] = useState((snap.name ?? '').trim())
  const [shopResults, setShopResults] = useState<Shop[]>([])
  const [searchingShops, setSearchingShops] = useState(false)
  const [shopSearched, setShopSearched] = useState(false)

  // 진입 시 1회 자동 검색 (샵상세 제보가 아닐 때만)
  useEffect(() => {
    if (prelinked) return
    const q = (snap.name ?? '').trim()
    if (!q) { setShopSearched(true); return }
    setSearchingShops(true)
    searchShops(q).then(rows => {
      setShopResults(rows)
      setSearchingShops(false)
      setShopSearched(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [err, setErr] = useState('')

  // 미리보기 — 수정한 값 실시간 반영
  const preview: WorkEvent = {
    id: submission.id, tagId: submission.tagId, type, shopId,
    title, createdAt: submission.createdAt,
  }

  function toggleCat(name: string) {
    setShopCats(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name])
  }

  async function handleCreateShop() {
    if (!shopName.trim()) { setErr('샵 이름을 입력하세요'); return }
    if (shopCats.length === 0) { setErr('카테고리를 1개 이상 선택하세요'); return }
    setErr(''); setCreatingShop(true)
    const res = await createShopFromSnapshot(snap, shopName, shopCats, reviewerId)
    setCreatingShop(false)
    if (!res) { setErr('샵 생성에 실패했어요. 이름/슬러그가 중복됐을 수 있어요.'); return }
    setShopId(res.id)
    setShopSlug(res.slug)
    setLinkKind('created')
  }

  async function handleShopSearch() {
    const q = shopQuery.trim()
    if (!q) return
    setSearchingShops(true)
    const rows = await searchShops(q)
    setShopResults(rows)
    setSearchingShops(false)
    setShopSearched(true)
  }

  function matchExistingShop(shop: Shop) {
    setShopId(shop.id)
    setShopSlug(shop.slug)
    setMatchedName(shop.name)
    setLinkKind('matched')
    setErr('')
  }

  function unlinkShop() {
    setShopId(null)
    setShopSlug(null)
    setMatchedName(null)
    setLinkKind(null)
  }

  async function approve() {
    if (!shopId) { setErr('먼저 장소를 샵으로 연결하세요'); return }
    if (!title.trim()) { setErr('이벤트명을 입력하세요'); return }
    setErr(''); setApproving(true)
    const ok = await approveSubmission({
      submissionId: submission.id,
      tagId: submission.tagId,
      shopId,
      type,
      title: title.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
    }, reviewerId)
    setApproving(false)
    if (!ok) { setErr('승인에 실패했어요. 잠시 후 다시 시도해주세요.'); return }
    onDone()
  }

  async function reject() {
    const input = prompt('반려 사유 (선택 — 제보자에게 전달)')
    if (input === null) return   // 취소
    setErr(''); setRejecting(true)
    const ok = await rejectSubmission(submission.id, input.trim() || null, reviewerId)
    setRejecting(false)
    if (!ok) { setErr('반려에 실패했어요. 잠시 후 다시 시도해주세요.'); return }
    onDone()
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', overflow: 'hidden' }}>
      {/* 메타: 제보자 + 작품 + 출처 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
        padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          제보 <b style={{ color: 'var(--text)' }}>{submission.submitterName}</b>
          <a href={`/work/${submission.tagId}`} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--purple)', fontWeight: 700, textDecoration: 'none' }}>
            🎮 {submission.tagName} ↗
          </a>
        </span>
        <a href={submission.sourceUrl} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '13px', color: '#fff', background: 'var(--purple)', fontWeight: 700,
            padding: '6px 12px', borderRadius: 'var(--r-sm)', textDecoration: 'none' }}>
          🔗 출처 확인
        </a>
      </div>

      {/* 에디터 */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <EditField label="이벤트명">
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
        </EditField>

        <EditField label="종류">
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.entries(TYPE_LABEL).map(([v, label]) => (
              <button key={v} onClick={() => setType(v)}
                style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  border: `1.5px solid ${type === v ? 'var(--accent)' : 'var(--border)'}`,
                  background: type === v ? 'var(--surface2)' : 'var(--surface)',
                  color: 'var(--text)', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit' }}>
                {label}
              </button>
            ))}
          </div>
        </EditField>

        {/* 장소 → 샵 연결: 승인의 전제. 제보된 카카오 장소로 새 Shop 생성해 shop_id 확보. */}
        <EditField label="장소 → 샵 연결">
          {shopId ? (
            // 연결됨
            <div style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--green)', background: 'rgba(5,150,105,.10)' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--green)' }}>
                {linkKind === 'prelinked' ? '✓ 이미 연결된 샵' : linkKind === 'matched' ? '✓ 기존 샵에 연결됨' : '✓ 새 Shop 생성됨'}
                {' — '}
                {linkKind === 'prelinked' ? (submission.shopName ?? '샵') : linkKind === 'matched' ? (matchedName ?? '샵') : shopName}
              </div>
              <a href={`/shop/${shopSlug}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '12px', color: 'var(--green)', textDecoration: 'underline' }}>
                샵 페이지에서 사진·설명·영업시간 보완하기 ↗
              </a>
              {linkKind !== 'prelinked' && (
                <button onClick={unlinkShop}
                  style={{ display: 'block', marginTop: '8px', background: 'none', border: 'none',
                    color: 'var(--muted)', fontSize: '12px', textDecoration: 'underline',
                    cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                  연결 변경
                </button>
              )}
            </div>
          ) : (
            // 연결 전 — 새 Shop 생성 패널
            <div style={{ padding: '12px', borderRadius: 'var(--r-sm)',
              border: '1px dashed var(--border)', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>📍 제보된 장소: {snapName}</div>
                {snapAddr && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{snapAddr}</div>}
              </div>

              {/* 1. 기존 샵에 연결 (중복 방지) */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
                  이미 등록된 샵인가요? (중복 방지)
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input value={shopQuery} onChange={e => setShopQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleShopSearch() } }}
                    placeholder="샵 이름으로 검색" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={handleShopSearch} disabled={searchingShops}
                    style={{ padding: '0 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', fontWeight: 700,
                      cursor: searchingShops ? 'not-allowed' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    {searchingShops ? '검색중' : '검색'}
                  </button>
                </div>

                {shopResults.length > 0 ? (
                  <div style={{ marginTop: '6px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
                    {shopResults.map(sp => (
                      <div key={sp.id} onClick={() => matchExistingShop(sp)}
                        style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>📍 {sp.name}</div>
                        {sp.addr && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{sp.addr}</div>}
                      </div>
                    ))}
                  </div>
                ) : shopSearched && !searchingShops ? (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--muted)' }}>
                    일치하는 기존 샵이 없어요 — 아래에서 새로 만들면 됩니다
                  </div>
                ) : null}
              </div>

              {/* 구분선 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', fontSize: '11px', fontWeight: 700 }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                또는
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>

              {/* 2. 새 Shop으로 만들기 */}
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>🆕 새 Shop으로 만들기</div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
                  샵 이름 (필요하면 다듬기)
                </label>
                <input value={shopName} onChange={e => setShopName(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
                  카테고리 * (1개 이상)
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {CATEGORIES.map(cat => {
                    const selected = shopCats.includes(cat.name)
                    return (
                      <button key={cat.slug} onClick={() => toggleCat(cat.name)}
                        style={{ padding: '6px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                          border: `1.5px solid ${selected ? cat.color : 'var(--border)'}`,
                          background: selected ? cat.bgColor : 'var(--surface)',
                          color: selected ? cat.color : 'var(--text)',
                          fontSize: '12px', fontWeight: 700, fontFamily: 'inherit' }}>
                        {cat.icon} {cat.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button onClick={handleCreateShop} disabled={creatingShop}
                style={{ padding: '10px', borderRadius: 'var(--r-sm)', border: 'none',
                  background: creatingShop ? 'var(--border)' : 'var(--accent)', color: '#fff',
                  fontSize: '13px', fontWeight: 700, cursor: creatingShop ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {creatingShop ? '생성 중...' : '📍 이 장소로 새 Shop 생성'}
              </button>
            </div>
          )}
        </EditField>

        <EditField label="상세 위치">
          <input value={placeDetail} onChange={e => setPlaceDetail(e.target.value)}
            placeholder="예: 5층" style={inputStyle} />
        </EditField>

        <EditField label="기간">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            <span style={{ color: 'var(--muted)' }}>~</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
          </div>
        </EditField>

        <EditField label="설명">
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={2} placeholder="(없음)" style={{ ...inputStyle, resize: 'vertical' }} />
        </EditField>
      </div>

      {/* 미리보기 */}
      <div style={{ padding: '14px 16px', background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px' }}>
          👁️ 승인 후 — 작품 홈 「새로운 소식」
        </div>
        <WorkEventList events={[preview]} />

        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', margin: '14px 0 8px' }}>
          👁️ 승인 후 — {snapName} 「진행 중인 이벤트」
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
          borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <span style={{ fontSize: '20px' }}>{TYPE_LABEL[type]?.split(' ')[0] ?? '✨'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{title || '(제목 없음)'}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {fmtPeriod(startDate || null, endDate || null)}{placeDetail ? ` · ${placeDetail}` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* 에러 */}
      {err && (
        <div style={{ padding: '10px 16px', background: 'var(--red-l)', color: 'var(--red)',
          fontSize: '13px', fontWeight: 700, borderTop: '1px solid var(--border)' }}>
          {err}
        </div>
      )}

      {/* 승인 / 반려 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
        {!shopId && (
          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0, textAlign: 'center' }}>
            장소를 샵으로 연결하면 승인할 수 있어요
          </p>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={reject} disabled={approving || rejecting}
            style={{ flex: 1, padding: '12px', borderRadius: 'var(--r-sm)',
              border: '1.5px solid var(--border)', background: 'var(--surface)',
              color: 'var(--red)', fontSize: '14px', fontWeight: 700,
              cursor: (approving || rejecting) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {rejecting ? '반려 중...' : '반려'}
          </button>
          <button onClick={approve} disabled={!shopId || approving || rejecting}
            style={{ flex: 2, padding: '12px', borderRadius: 'var(--r-sm)', border: 'none',
              background: (!shopId || approving || rejecting) ? 'var(--border)' : 'var(--green)', color: '#fff',
              fontSize: '14px', fontWeight: 700,
              cursor: (!shopId || approving || rejecting) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {approving ? '승인 중...' : '수정 내용으로 승인'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '5px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '14px' }}>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--r-sm)',
  border: '1px solid var(--border)', background: 'var(--surface)',
  fontSize: '14px', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box',
}