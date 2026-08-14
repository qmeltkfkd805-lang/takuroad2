'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import SettingsSubShell from './SettingsSubShell'
import AvatarCropper from './AvatarCropper'
import styles from './ProfileEditPage.module.css'
import {
  getEquipped, getMyCosmetics, getMyBadges, getMyFavoriteWorks,
  SHOWCASE_MAX, type Cosmetic, type ShowcaseBadge,
} from '@/services/cosmeticService'
import {
  saveProfileEdit, checkNicknameAvailable, type ProfileEditSnapshot, type AvatarChange,
} from '@/services/profileEditService'

const NICK_MIN = 2
const NICK_MAX = 12
const BIO_MAX = 50
const NICK_RE = /^[a-zA-Z0-9가-힣_]+$/

// P2: Storage 정책(avatars 본인 폴더 전용) 승인 완료 → 아바타 업로드 활성화.
const AVATAR_UPLOAD_ENABLED = true

type FavWork = { tagId: string; name: string; slug: string | null; cover: string | null }

function snapEq(a: ProfileEditSnapshot, b: ProfileEditSnapshot) {
  return a.nickname === b.nickname && a.bio === b.bio
    && a.titleId === b.titleId && a.featuredWorkId === b.featuredWorkId
    && a.showcase.length === b.showcase.length && a.showcase.every((v, i) => v === b.showcase[i])
}

export default function ProfileEditPage() {
  const router = useRouter()
  const { user, profile, loading, refreshProfile } = useAuth()

  const [ready, setReady] = useState(false)
  const [form, setForm] = useState<ProfileEditSnapshot>({ nickname: '', bio: '', titleId: null, featuredWorkId: null, showcase: [] })
  const [original, setOriginal] = useState<ProfileEditSnapshot>({ nickname: '', bio: '', titleId: null, featuredWorkId: null, showcase: [] })

  const [titles, setTitles] = useState<Cosmetic[]>([])
  const [works, setWorks] = useState<FavWork[]>([])
  const [badges, setBadges] = useState<ShowcaseBadge[]>([])

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarMode, setAvatarMode] = useState<'keep' | 'new' | 'reset'>('keep')
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null)
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [nickState, setNickState] = useState<{ s: 'idle' | 'checking' | 'ok' | 'taken' | 'error'; msg?: string }>({ s: 'idle' })
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState<null | 'title' | 'work' | 'badge'>(null)

  // ── 초기 로드 ──
  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    let alive = true
    ;(async () => {
      const [eq, cos, myBadges, favs] = await Promise.all([
        getEquipped(user.id),
        getMyCosmetics(user.id),
        getMyBadges(user.id),
        getMyFavoriteWorks(user.id),
      ])
      if (!alive) return
      const titleList = cos.filter(c => c.type === 'title')
      const showcase = Array.isArray((eq as any).showcase) ? (eq as any).showcase.filter(Boolean).slice(0, SHOWCASE_MAX) : []
      const init: ProfileEditSnapshot = {
        nickname: profile?.nickname ?? '',
        bio: (profile as any)?.bio ?? '',
        titleId: typeof (eq as any).title === 'string' ? (eq as any).title : null,
        featuredWorkId: typeof (eq as any).featuredWork === 'string' ? (eq as any).featuredWork : null,
        showcase,
      }
      setTitles(titleList); setWorks(favs); setBadges(myBadges)
      setForm(init); setOriginal(init)
      setAvatarPreview(profile?.avatar_url ?? null)
      setInitialAvatarUrl(profile?.avatar_url ?? null)
      setAvatarMode('keep'); setAvatarBlob(null)
      setReady(true)
    })()
    return () => { alive = false }
  }, [loading, user, profile, router])

  const avatarDirty = avatarMode === 'new' || (avatarMode === 'reset' && !!initialAvatarUrl)
  const dirty = ready && (!snapEq(form, original) || avatarDirty)

  // 닉네임 검증
  const nickTrim = form.nickname.trim()
  const nickChanged = nickTrim !== original.nickname
  const nickValid = nickTrim.length >= NICK_MIN && nickTrim.length <= NICK_MAX && NICK_RE.test(nickTrim)
  const nickErrText = form.nickname.length === 0 ? '' :
    (nickTrim.length < NICK_MIN ? `${NICK_MIN}자 이상 입력해주세요` :
      nickTrim.length > NICK_MAX ? `${NICK_MAX}자 이하로 입력해주세요` :
        !NICK_RE.test(nickTrim) ? '한글·영문·숫자·밑줄(_)만 쓸 수 있어요' : '')

  const canSave = dirty && !saving && (!nickChanged || nickValid) && nickState.s !== 'taken'

  // 이탈 경고(탭 닫기·새로고침)
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  function set<K extends keyof ProfileEditSnapshot>(k: K, v: ProfileEditSnapshot[K]) {
    setForm(f => ({ ...f, [k]: v })); setFormErr('')
  }

  function onNickChange(v: string) {
    set('nickname', v.slice(0, NICK_MAX * 2)) // 여유롭게 받되 검증에서 자름
    setNickState({ s: 'idle' })
  }

  async function checkNick() {
    if (!user || !nickValid) return
    setNickState({ s: 'checking' })
    const r = await checkNicknameAvailable(user.id, nickTrim)
    if (!r.ok) { setNickState({ s: 'error', msg: r.message }); return }
    setNickState(r.available ? { s: 'ok', msg: '사용할 수 있는 닉네임이에요' } : { s: 'taken', msg: '이미 사용 중인 닉네임이에요' })
  }

  // 아바타 (P1: 로컬 미리보기만)
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) setCropFile(f)
  }
  function onCropDone(res: { blob: Blob; url: string }) {
    setAvatarPreview(prev => { if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev); return res.url })
    setAvatarBlob(res.blob); setAvatarMode('new'); setCropFile(null)
  }
  function onResetAvatar() {
    setAvatarPreview(prev => { if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev); return null })
    setAvatarBlob(null); setAvatarMode('reset')
  }
  useEffect(() => () => { if (avatarPreview && avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview) }, [avatarPreview])

  async function handleSave() {
    if (!user || !canSave) return
    if (nickChanged && !nickValid) { setFormErr('닉네임을 확인해주세요.'); return }
    setSaving(true); setFormErr('')
    const next: ProfileEditSnapshot = { ...form, nickname: nickTrim, bio: form.bio.trim() }
    const avatarChange: AvatarChange =
      avatarMode === 'new' && avatarBlob ? { mode: 'new', blob: avatarBlob, currentUrl: initialAvatarUrl }
        : avatarMode === 'reset' ? { mode: 'reset', currentUrl: initialAvatarUrl }
          : { mode: 'keep', currentUrl: initialAvatarUrl }
    const res = await saveProfileEdit(user.id, next, original, avatarChange)
    if (!res.ok) {
      setSaving(false)
      if (res.fieldError?.field === 'nickname') { setNickState({ s: 'taken', msg: res.fieldError.message }); setFormErr('') }
      else setFormErr(res.fieldError?.message ?? '저장에 실패했어요.')
      return
    }
    setOriginal(next); setForm(next)
    setAvatarMode('keep'); setAvatarBlob(null)
    await refreshProfile()
    setSaving(false)
    setToast('저장했어요')
    setTimeout(goBackToSettings, 700)
  }

  // 진입은 push('/profile/settings/profile')로 들어오므로, 나갈 땐 back()으로 pop 한다.
  // (push('/profile/settings')로 나가면 설정 화면의 back()과 서로 튕겨 무한 반복이 됨)
  function goBackToSettings() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/profile/settings')
  }
  function leaveGuard(go: () => void) {
    if (dirty && !window.confirm('변경사항이 저장되지 않았어요. 나가시겠어요?')) return
    go()
  }
  function handleBack() { leaveGuard(goBackToSettings) }

  // ── 파생 표시값 ──
  const curTitle = useMemo(() => titles.find(t => t.id === form.titleId) ?? null, [titles, form.titleId])
  const curWork = useMemo(() => works.find(w => w.tagId === form.featuredWorkId) ?? null, [works, form.featuredWorkId])
  const showcaseBadges = useMemo(
    () => form.showcase.map(id => badges.find(b => b.tierId === id)).filter(Boolean) as ShowcaseBadge[],
    [form.showcase, badges],
  )

  const saveTopBtn = (
    <button className={styles.saveTop} onClick={handleSave} disabled={!canSave}>
      {saving ? '저장 중…' : '저장'}
    </button>
  )

  if (!ready) {
    return <SettingsSubShell title="프로필 편집"><div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div></SettingsSubShell>
  }

  const avatarInitial = (form.nickname.trim()[0] ?? profile?.nickname?.[0] ?? '?')

  return (
    <SettingsSubShell title="프로필 편집" right={saveTopBtn} onBack={handleBack}>
      <div className={styles.wrap}>
        {/* 아바타 */}
        <div className={styles.avatarSec}>
          <div className={styles.avatarWrap}>
            <span className={styles.avatar}>
              {avatarPreview ? <img src={avatarPreview} alt="" /> : avatarInitial}
            </span>
            <button className={styles.camBtn} onClick={() => fileRef.current?.click()} aria-label="사진 변경">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>
            </button>
          </div>
          <div className={styles.avatarActions}>
            <button className={styles.avatarAct} onClick={() => fileRef.current?.click()}>사진 변경</button>
            <span className={styles.avatarSep} />
            <button className={`${styles.avatarAct} ${styles.muted}`} onClick={onResetAvatar}>기본 이미지</button>
          </div>
          <div className={styles.avatarHint}>JPG, PNG, WebP · 최대 5MB</div>
          {!AVATAR_UPLOAD_ENABLED && (
            <div className={styles.avatarNotice}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              이미지 저장은 준비 중이라 지금은 미리보기만 돼요
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPickFile} style={{ display: 'none' }} />
        </div>

        {/* 기본 정보 */}
        <div className={styles.group}>
          <div className={styles.groupLabel}>기본 정보</div>
          <div className={styles.card}>
            {/* 닉네임 */}
            <div className={styles.row}>
              <div className={styles.rowTop}>
                <span className={styles.label}>닉네임</span>
                <span className={styles.count}>{nickTrim.length}/{NICK_MAX}</span>
              </div>
              <div className={styles.fieldMain}>
                <div className={styles.inputWrap}>
                  <input className={styles.input} value={form.nickname} onChange={e => onNickChange(e.target.value)} placeholder="닉네임" />
                  <button className={styles.dupBtn} onClick={checkNick} disabled={!nickChanged || !nickValid || nickState.s === 'checking'}>
                    {nickState.s === 'checking' ? '확인 중' : '중복 확인'}
                  </button>
                </div>
                {nickErrText
                  ? <div className={`${styles.hint} ${styles.hintErr}`}>{nickErrText}</div>
                  : nickState.msg
                    ? <div className={`${styles.hint} ${nickState.s === 'ok' ? styles.hintOk : nickState.s === 'taken' || nickState.s === 'error' ? styles.hintErr : ''}`}>{nickState.msg}</div>
                    : null}
              </div>
            </div>

            {/* 한 줄 소개 */}
            <div className={styles.row}>
              <div className={styles.rowTop}>
                <span className={styles.label}>한 줄 소개</span>
                <span className={styles.count}>{form.bio.length}/{BIO_MAX}</span>
              </div>
              <div className={styles.fieldMain}>
                <textarea
                  className={styles.textarea} value={form.bio} maxLength={BIO_MAX}
                  onChange={e => set('bio', e.target.value)}
                  placeholder="좋아하는 작품, 덕질 취향을 한 줄로 소개해보세요"
                />
              </div>
            </div>

            {/* 대표 칭호 */}
            <button className={styles.pickRow} onClick={() => setModal('title')}>
              <span className={styles.pickLabel}>대표 칭호</span>
              <span className={styles.pickValue}>
                {curTitle ? <span className={styles.pickValText}>{curTitle.name}</span> : <span className={styles.pickPlaceholder}>선택 안 함</span>}
                <span className={styles.chev}><Chevron /></span>
              </span>
            </button>
          </div>
        </div>

        {/* 프로필에 표시할 항목 */}
        <div className={styles.group}>
          <div className={styles.groupLabel}>프로필에 표시할 항목</div>
          <div className={styles.card}>
            {/* 최애 작품 */}
            <div className={styles.pickRow} style={{ cursor: 'default' }}>
              <span className={styles.pickLabel}>최애 작품</span>
              <span className={styles.pickValue}>
                {curWork ? (
                  <>
                    {curWork.cover && <img className={styles.workThumb} src={curWork.cover} alt="" />}
                    <span className={styles.pickValText}>{curWork.name}</span>
                  </>
                ) : <span className={styles.pickPlaceholder}>선택 안 함</span>}
                <button className={styles.changeBtn} onClick={() => setModal('work')}>변경</button>
              </span>
            </div>
            {/* 대표 배지 */}
            <div className={styles.pickRow} style={{ cursor: 'default' }}>
              <span className={styles.pickLabel}>대표 배지</span>
              <span className={styles.pickValue}>
                {showcaseBadges.length > 0 ? (
                  <span className={styles.badgeMini}>
                    {showcaseBadges.map(b => b.icon ? <img key={b.tierId} src={b.icon} alt={b.name} /> : null)}
                  </span>
                ) : <span className={styles.pickPlaceholder}>선택 안 함</span>}
                <button className={styles.changeBtn} onClick={() => setModal('badge')}>변경</button>
              </span>
            </div>
          </div>
        </div>

        {formErr && <div className={styles.formErr}>{formErr}</div>}

        {/* PC 하단 버튼 */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={() => leaveGuard(goBackToSettings)}>취소</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={!canSave}>{saving ? '저장 중…' : '저장하기'}</button>
        </div>
      </div>

      {/* 크롭 모달 */}
      {cropFile && <AvatarCropper file={cropFile} onCancel={() => setCropFile(null)} onDone={onCropDone} />}

      {/* 선택 모달 */}
      {modal === 'title' && (
        <TitlePicker titles={titles} current={form.titleId} onClose={() => setModal(null)} onPick={id => { set('titleId', id); setModal(null) }} />
      )}
      {modal === 'work' && (
        <WorkPicker works={works} current={form.featuredWorkId} onClose={() => setModal(null)} onPick={id => { set('featuredWorkId', id); setModal(null) }} />
      )}
      {modal === 'badge' && (
        <BadgePicker badges={badges} selected={form.showcase} onClose={() => setModal(null)} onDone={ids => { set('showcase', ids); setModal(null) }} />
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </SettingsSubShell>
  )
}

/* ── 아이콘 ── */
function Chevron() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg> }
function Check() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg> }

/* ── 칭호 선택 ── */
function TitlePicker({ titles, current, onClose, onPick }: { titles: Cosmetic[]; current: string | null; onClose: () => void; onPick: (id: string | null) => void }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}><span className={styles.modalTitle}>대표 칭호</span><button className={styles.modalClose} onClick={onClose} aria-label="닫기">×</button></div>
        <div className={styles.modalBody}>
          <button className={`${styles.optRow} ${current === null ? styles.on : ''}`} onClick={() => onPick(null)}>
            <span className={styles.optBody}><span className={styles.optName}>선택 안 함</span></span>
            {current === null && <span className={styles.optCheck}><Check /></span>}
          </button>
          {titles.length === 0 && <div className={styles.optEmpty}>아직 획득한 칭호가 없어요.<br />배지·레벨을 달성하면 칭호가 열려요.</div>}
          {titles.map(t => {
            const on = current === t.id
            const locked = !t.unlocked
            return (
              <button key={t.id} className={`${styles.optRow} ${on ? styles.on : ''} ${locked ? styles.locked : ''}`} disabled={locked} onClick={() => !locked && onPick(t.id)}>
                <span className={styles.optTitlePill}>{t.name}</span>
                <span className={styles.optBody}>{locked && <span className={styles.optSub}>{t.fromBadge ?? '잠김'}</span>}</span>
                {on && <span className={styles.optCheck}><Check /></span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── 최애 작품 선택 ── */
function WorkPicker({ works, current, onClose, onPick }: { works: FavWork[]; current: string | null; onClose: () => void; onPick: (id: string | null) => void }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}><span className={styles.modalTitle}>최애 작품</span><button className={styles.modalClose} onClick={onClose} aria-label="닫기">×</button></div>
        <div className={styles.modalBody}>
          {works.length === 0 && <div className={styles.optEmpty}>아직 최애로 등록한 작품이 없어요.<br />작품 페이지에서 최애를 등록해보세요.</div>}
          {works.map(w => {
            const on = current === w.tagId
            return (
              <button key={w.tagId} className={`${styles.optRow} ${on ? styles.on : ''}`} onClick={() => onPick(on ? null : w.tagId)}>
                {w.cover ? <img className={styles.optThumb} src={w.cover} alt="" /> : <span className={styles.optThumb} />}
                <span className={styles.optBody}><span className={styles.optName}>{w.name}</span></span>
                {on && <span className={styles.optCheck}><Check /></span>}
              </button>
            )
          })}
        </div>
        {current && (
          <div className={styles.modalFoot}><button className={styles.modalClear} onClick={() => onPick(null)} style={{ flex: 1 }}>해제</button></div>
        )}
      </div>
    </div>
  )
}

/* ── 대표 배지 선택 (최대 3) ── */
function BadgePicker({ badges, selected, onClose, onDone }: { badges: ShowcaseBadge[]; selected: string[]; onClose: () => void; onDone: (ids: string[]) => void }) {
  const [sel, setSel] = useState<string[]>(selected)
  function toggle(id: string) {
    setSel(cur => cur.includes(id) ? cur.filter(x => x !== id) : (cur.length >= SHOWCASE_MAX ? cur : [...cur, id]))
  }
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}><span className={styles.modalTitle}>대표 배지 ({sel.length}/{SHOWCASE_MAX})</span><button className={styles.modalClose} onClick={onClose} aria-label="닫기">×</button></div>
        <div className={styles.modalBody}>
          {badges.length === 0 && <div className={styles.optEmpty}>아직 획득한 배지가 없어요.</div>}
          {badges.map(b => {
            const on = sel.includes(b.tierId)
            const full = !on && sel.length >= SHOWCASE_MAX
            return (
              <button key={b.tierId} className={`${styles.optRow} ${on ? styles.on : ''} ${full ? styles.locked : ''}`} disabled={full} onClick={() => toggle(b.tierId)}>
                {b.icon ? <img className={styles.optBadgeIcon} src={b.icon} alt="" /> : <span className={styles.optBadgeIcon} />}
                <span className={styles.optBody}>
                  <span className={styles.optName}>{b.name}</span>
                  {b.badgeName && <span className={styles.optSub}>{b.badgeName}</span>}
                </span>
                {on && <span className={styles.optCheck}><Check /></span>}
              </button>
            )
          })}
        </div>
        <div className={styles.modalFoot}>
          {sel.length > 0 && <button className={styles.modalClear} onClick={() => setSel([])}>전체 해제</button>}
          <button className={styles.modalDone} onClick={() => onDone(sel)}>완료</button>
        </div>
      </div>
    </div>
  )
}
