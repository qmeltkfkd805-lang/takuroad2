'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { UserAvatar } from '@/components/cosmetic/UserFace'
import { PhotoViewer } from '@/components/collection/StoryCard'
import { isRouteCompleted, getMyRouteRunStats } from '@/services/routeVisitService'
import {
  getRouteReviews, saveRouteReview, deleteRouteReview,
  MAX_ROUTE_PHOTOS, MAX_REVIEW_LEN, type RouteReview, type RouteReviewPhoto,
} from '@/services/routeReviewService'
import m from '@/components/event/EventVisitButton.module.css'
import s from './RouteReviews.module.css'
import LogoLoader from '@/components/common/LogoLoader'

/* ============================================================
   루트 상세 > 후기 — 완주 후기(글 + 사진 3장)
   - 목록: 누구나(루트를 볼 수 있으면). 사진은 눌러서 크게 넘겨보기
   - 쓰기: 완주한 사람만. 완주할 때마다 1개씩(하루 1번 센 완주 횟수만큼), 내 후기는 각각 수정·삭제
   - 부모(완주 축하 창의 "후기 남기기", 주소 ?review=1)가 openSignal 을 올리면 쓰기 창을 연다
   ============================================================ */

interface Picked { file: File; url: string }

export default function RouteReviews({ routeId, routeTitle, openSignal = 0, onOpened }: { routeId: string; routeTitle: string; openSignal?: number; onOpened?: () => void }) {
  const { user } = useAuth()
  const router = useRouter()
  const [list, setList] = useState<RouteReview[] | null>(null)
  const [completed, setCompleted] = useState(false)
  const [runs, setRuns] = useState(0)   // 내 완주 횟수(하루 1번씩)
  // 쓰기 창: 'new' = 새 후기, RouteReview = 그 후기 수정
  const [editing, setEditing] = useState<'new' | RouteReview | null>(null)
  const [viewer, setViewer] = useState<{ title: string; photos: string[]; index: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // 내 후기(오래된 순) — n번째 완주 후기 번호 매기기
  const mine = user && list ? list.filter(r => r.userId === user.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []
  const mineNo = new Map(mine.map((r, i) => [r.id, i + 1]))
  const canWriteMore = completed && mine.length < Math.max(1, runs)

  const load = useCallback(() => { getRouteReviews(routeId).then(setList).catch(() => setList([])) }, [routeId])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!user) { setCompleted(false); setRuns(0); return }
    isRouteCompleted(routeId, user.id).then(setCompleted).catch(() => {})
    getMyRouteRunStats(routeId, user.id).then(st => setRuns(st.count)).catch(() => {})
  }, [user, routeId])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t) }, [toast])

  async function openWrite() {
    if (!user) { router.push('/login'); return }
    // 방금 완주했으면 기록이 막 저장된 참이라 다시 확인한다
    const ok = completed || await isRouteCompleted(routeId, user.id).catch(() => false)
    if (!ok) { setToast('루트를 완주하면 후기를 남길 수 있어요'); return }
    setCompleted(true)
    // 방금 완주해서 늘어난 완주 횟수를 다시 읽고, 남길 자리가 있으면 새 후기 · 없으면(같은 날 또 완주) 마지막 후기 수정
    const n = await getMyRouteRunStats(routeId, user.id).then(st => st.count).catch(() => runs)
    setRuns(n)
    const last = mine[mine.length - 1] ?? null
    setEditing(mine.length < Math.max(1, n) || !last ? 'new' : last)
  }
  useEffect(() => {
    if (!openSignal) return
    onOpened?.()
    openWrite()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal])

  async function onDelete(r: RouteReview) {
    if (!user || !window.confirm('후기를 삭제할까요? 사진도 함께 지워져요.')) return
    if (await deleteRouteReview(r, user.id)) { setToast('후기를 삭제했어요'); load() }
    else setToast('삭제하지 못했어요')
  }

  const fmt = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` }

  return (
    <div className={s.wrap}>
      {/* 쓰기 안내 — 완주했는데 아직 후기가 없을 때 */}
      {user && list && canWriteMore && (
        <button type="button" className={s.writeBtn} onClick={openWrite}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
          {mine.length > 0 ? `${mine.length + 1}번째 완주 후기 남기기` : '완주 후기 남기기'}
        </button>
      )}

      {list === null ? (
        <LogoLoader size="sm" />
      ) : list.length === 0 ? (
        <div className={s.empty}>아직 후기가 없어요.<br />루트를 완주하면 사진과 함께 후기를 남길 수 있어요.</div>
      ) : (
        <ul className={s.list}>
          {list.map(r => (
            <li key={r.id} className={s.item}>
              <div className={s.head}>
                <UserAvatar userId={r.userId} src={r.avatarUrl} name={r.nickname} size={32} showEffect={false} />
                <span className={s.name}>{r.nickname}</span>
                <span className={s.date}>{fmt(r.createdAt)} {user && r.userId === user.id && mine.length > 1 ? `${mineNo.get(r.id)}번째 완주` : '완주'}</span>
                {user && r.userId === user.id && (
                  <span className={s.mineActions}>
                    <button type="button" onClick={() => setEditing(r)}>수정</button>
                    <button type="button" onClick={() => onDelete(r)}>삭제</button>
                  </span>
                )}
              </div>
              {r.content && <p className={s.text}>{r.content}</p>}
              {r.photos.length > 0 && (
                <div className={s.photos}>
                  {r.photos.map((p, i) => (
                    <button key={p.id} type="button" className={s.photo} aria-label={`${r.nickname}님의 사진 ${i + 1} 크게 보기`}
                      onClick={() => setViewer({ title: routeTitle, photos: r.photos.map(x => x.url), index: i })}>
                      <img src={p.url} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && user && (
        <ReviewModal routeId={routeId} routeTitle={routeTitle} userId={user.id} existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setToast('후기를 남겼어요'); load() }} />
      )}
      {viewer && <PhotoViewer title={viewer.title} photos={viewer.photos} start={viewer.index} onClose={() => setViewer(null)} />}
      {toast && <div className={s.toast} role="status">{toast}</div>}
    </div>
  )
}

/* 쓰기·수정 창 — 이벤트 "다녀왔어요" 사진 창과 같은 모양 */
function ReviewModal({ routeId, routeTitle, userId, existing, onClose, onSaved }: {
  routeId: string; routeTitle: string; userId: string; existing: RouteReview | null
  onClose: () => void; onSaved: () => void
}) {
  const [text, setText] = useState(existing?.content ?? '')
  const [kept, setKept] = useState<RouteReviewPhoto[]>(existing?.photos ?? [])
  const [picked, setPicked] = useState<Picked[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)
  const room = MAX_ROUTE_PHOTOS - kept.length - picked.length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])
  useEffect(() => () => { picked.forEach(p => URL.revokeObjectURL(p.url)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'))
    e.target.value = ''
    if (!files.length) return
    const add = files.slice(0, Math.max(0, room)).map(file => ({ file, url: URL.createObjectURL(file) }))
    if (files.length > add.length) setErr(`사진은 ${MAX_ROUTE_PHOTOS}장까지 남길 수 있어요`)
    setPicked(prev => [...prev, ...add])
  }

  async function save() {
    if (busy) return
    if (!text.trim() && kept.length + picked.length === 0) { setErr('후기나 사진을 하나 이상 남겨주세요'); return }
    setBusy(true); setErr(null)
    try {
      const removed = (existing?.photos ?? []).filter(p => !kept.some(k => k.id === p.id))
      await saveRouteReview(routeId, userId, text, { existingId: existing?.id ?? null, removePhotos: removed, newFiles: picked.map(p => p.file) })
      onSaved()
    } catch (e: any) {
      setErr(e?.message ?? '저장하지 못했어요')
      setBusy(false)
    }
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className={m.backdrop} onClick={() => !busy && onClose()}>
      <div className={m.modal} role="dialog" aria-modal="true" aria-labelledby="rr-title" onClick={e => e.stopPropagation()} style={{ textAlign: 'left' }}>
        <h3 id="rr-title" className={m.modalTitle} style={{ textAlign: 'center' }}>{existing ? '완주 후기 수정' : '완주 후기를 남겨주세요'}</h3>
        <p className={m.modalDesc} style={{ textAlign: 'center', marginBottom: 14 }}>{routeTitle}</p>

        <textarea className={s.textarea} value={text} onChange={e => setText(e.target.value.slice(0, MAX_REVIEW_LEN))}
          placeholder="코스는 어땠나요? 좋았던 샵, 동선 팁, 다음 사람에게 알려주고 싶은 것을 적어주세요." rows={5} disabled={busy} />
        <div className={s.count}>{text.length}/{MAX_REVIEW_LEN}</div>

        {(kept.length > 0 || picked.length > 0) && (
          <div className={m.pickGrid}>
            {kept.map(p => (
              <div key={p.id} className={m.pickItem}>
                <img src={p.url} alt="" />
                {!busy && <button type="button" className={m.pickRemove} onClick={() => setKept(k => k.filter(x => x.id !== p.id))} aria-label="사진 빼기">×</button>}
              </div>
            ))}
            {picked.map((p, i) => (
              <div key={p.url} className={m.pickItem}>
                <img src={p.url} alt="" />
                {!busy && <button type="button" className={m.pickRemove} onClick={() => setPicked(prev => { URL.revokeObjectURL(prev[i].url); return prev.filter((_, j) => j !== i) })} aria-label="사진 빼기">×</button>}
              </div>
            ))}
          </div>
        )}

        {room > 0 && (
          <div className={m.pickButtons}>
            <button type="button" className={m.pickBtn} onClick={() => cameraRef.current?.click()} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></svg>
              카메라
            </button>
            <button type="button" className={m.pickBtn} onClick={() => albumRef.current?.click()} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg>
              앨범
            </button>
          </div>
        )}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
        <input ref={albumRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
        <p className={s.hint}>사진은 {MAX_ROUTE_PHOTOS}장까지, 루트 후기와 내 방문 기록에 함께 공개돼요.</p>

        {err && <p className={s.err}>{err}</p>}
        <div className={m.modalActions}>
          <button type="button" className={m.modalCancel} onClick={onClose} disabled={busy}>{existing ? '취소' : '나중에'}</button>
          <button type="button" className={m.modalOk} onClick={save} disabled={busy}>{busy ? '올리는 중…' : '후기 남기기'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
