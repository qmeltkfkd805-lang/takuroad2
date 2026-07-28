'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { useRouter } from 'next/navigation'
import { createWork, uploadWorkImage, findDuplicateWork, getWorkForEdit, updateWork } from '@/services/workRegisterService'

const IP_TYPES = ['애니', '게임', '만화', '웹툰', '소설', '기타']
const STATUS = [
  { v: '연재중', c: '#22c55e' },
  { v: '완결', c: '#3b82f6' },
  { v: '휴재', c: '#eab308' },
  { v: '종료', c: '#6b7280' },
]
const ORIGINAL = ['원작', '2차 창작', '파생 작품']
const GENRES = ['액션', '판타지', '학원', '일상', 'SF', '추리', '로맨스', '코미디', '스포츠', '음악', '호러', '드라마', '마법소녀', '소년물', '19', '고어']
const STEPS = [
  { n: 1, label: '기본 정보' },
  { n: 2, label: '분류' },
  { n: 3, label: '연결 & 등록' },
]

function Svg({ size = 16, color = 'currentColor', fill = 'none', children }: { size?: number; color?: string; fill?: string; children: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, verticalAlign: '-2px' }}>{children}</svg>
}
const CheckIcon = (p: { size?: number; color?: string }) => <Svg {...p}><path d="m5 12 5 5L20 6" /></Svg>

export default function WorkRegister({ mode = 'create', editId = null }: { mode?: 'create' | 'edit'; editId?: string | null } = {}) {
  const router = useRouter()
  const { user, isAdmin } = useAuth()

  const editing = mode === 'edit'
  const [loadingEdit, setLoadingEdit] = useState(mode === 'edit')
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [eng, setEng] = useState('')
  const [slug, setSlug] = useState('')
  const [aliases, setAliases] = useState<string[]>([])
  const [aliasInput, setAliasInput] = useState('')
  const [ipType, setIpType] = useState('')
  const [original, setOriginal] = useState('')
  const [status, setStatus] = useState('')
  const [cover, setCover] = useState('')
  const [banner, setBanner] = useState('')
  const [accent, setAccent] = useState('#FF5692')
  const [desc, setDesc] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [kwInput, setKwInput] = useState('')
  const [homepage, setHomepage] = useState('')
  const [twitter, setTwitter] = useState('')
  const [youtube, setYoutube] = useState('')
  const [official, setOfficial] = useState('')

  const [upCover, setUpCover] = useState(false)
  const [upBanner, setUpBanner] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const coverRef = useRef<HTMLInputElement | null>(null)
  const bannerRef = useRef<HTMLInputElement | null>(null)

  const slugForUpload = useMemo(() => {
    // Storage 경로는 ASCII만 안전 — 영문/숫자만 추출, 한글 등은 제거 후 없으면 랜덤
    const b = (eng || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return b || ('work-' + Math.random().toString(36).slice(2, 8))
  }, [eng])

  // 커버에서 대표색 자동 추출
  function extractColor(file: File) {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = 24; c.height = 24
        const ctx = c.getContext('2d'); if (!ctx) return
        ctx.drawImage(img, 0, 0, 24, 24)
        const d = ctx.getImageData(0, 0, 24, 24).data
        let r = 0, g = 0, b = 0, n = 0
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ }
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n)
        setAccent('#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join(''))
      } catch {}
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>, kind: 'cover' | 'banner') {
    const file = e.target.files?.[0]
    if (!file || !user) return
    kind === 'cover' ? setUpCover(true) : setUpBanner(true)
    if (kind === 'cover') extractColor(file)
    const url = await uploadWorkImage(file, slugForUpload, kind)
    kind === 'cover' ? setUpCover(false) : setUpBanner(false)
    if (url) { kind === 'cover' ? setCover(url) : setBanner(url) } else setMsg('이미지 업로드 실패')
    if (kind === 'cover' && coverRef.current) coverRef.current.value = ''
    if (kind === 'banner' && bannerRef.current) bannerRef.current.value = ''
  }

  function toggleGenre(g: string) { setGenres((a) => a.includes(g) ? a.filter((x) => x !== g) : [...a, g]) }
  function addAlias() {
    const v = aliasInput.trim()
    if (v && !aliases.includes(v)) setAliases((a) => [...a, v])
    setAliasInput('')
  }
  function addKeyword() {
    const v = kwInput.trim().replace(/^#/, '')
    if (v && !keywords.includes(v)) setKeywords((a) => [...a, v])
    setKwInput('')
  }

  function stepIssue(n: number): string | null {
    if (n === 1) {
      if (!name.trim()) return '작품명을 입력해주세요'
      if (!ipType) return 'IP 타입을 선택해주세요'
      if (!desc.trim()) return '한 줄 소개를 입력해주세요'
      return null
    }
    if (n === 2) return genres.length >= 1 ? null : '장르를 1개 이상 선택해주세요'
    return null
  }
  const curIssue = stepIssue(step)
  const canNext = curIssue === null
  const stepDone = (n: number) => stepIssue(n) === null
  function goToStep(target: number) {
    if (target <= step) { setStep(target); setMsg(null); return }
    for (let n = step; n < target; n++) { const iss = stepIssue(n); if (iss) { setStep(n); setMsg(iss); return } }
    setStep(target); setMsg(null)
  }

  const guide = [
    { label: '작품명·IP 타입', ok: !!name.trim() && !!ipType },
    ...(isAdmin ? [{ label: '대표 이미지', ok: !!cover }] : []),
    { label: '한 줄 소개', ok: !!desc.trim() },
    { label: '장르 선택', ok: genres.length > 0 },
  ]

  useEffect(() => {
    if (mode !== 'edit' || !editId) return
    let alive = true
    getWorkForEdit(editId).then((w: any) => {
      if (!alive) return
      if (w) {
        setName(w.name ?? ''); setEng(w.english_name ?? ''); setSlug(w.slug ?? ''); setAliases(w.aliases ?? [])
        setIpType(w.ip_type ?? ''); setOriginal(w.original_type ?? ''); setStatus(w.status ?? '')
        setCover(w.cover_url ?? ''); setBanner(w.banner_image ?? ''); setAccent(w.accent_color ?? '#FF5692')
        setDesc(w.description ?? ''); setGenres(w.genres ?? []); setKeywords(w.keywords ?? [])
        setHomepage(w.homepage_url ?? ''); setTwitter(w.twitter_url ?? ''); setYoutube(w.youtube_url ?? ''); setOfficial(w.official_url ?? '')
      }
      setLoadingEdit(false)
    }).catch(() => setLoadingEdit(false))
    return () => { alive = false }
  }, [mode, editId])

  async function save() {
    if (!user) return
    const iss = stepIssue(1) || stepIssue(2)
    if (iss) { setMsg(iss); return }
    setSaving(true); setMsg(null)
    const payload = {
      name, slug, english_name: eng, aliases, ip_type: ipType, original_type: original, status,
      cover_url: cover, banner_image: banner, accent_color: accent, description: desc,
      genres, keywords, homepage_url: homepage, twitter_url: twitter, youtube_url: youtube, official_url: official,
    }
    if (editing && editId) {
      const ok = await updateWork(editId, payload)
      if (!ok) { setSaving(false); setMsg('수정 실패 — 다시 시도해주세요'); return }
      setSaving(false)
      router.push('/my-works')
      return
    }
    const dup = await findDuplicateWork(name, eng, aliases)
    if (dup) { setSaving(false); setStep(1); setMsg(`이미 등록된 작품이에요: "${dup}"`); return }
    const res = await createWork(user.id, payload)
    if (!res) { setSaving(false); setMsg('등록 실패 — 다시 시도해주세요'); return }
    setSaving(false)
    router.push('/my-works')
  }

  if (editing && loadingEdit) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>작품 불러오는 중...</div>
  if (!user) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>로그인하면 작품을 등록할 수 있어요.</div>

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto', padding: '20px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/my-works')} style={iconBtn} aria-label="뒤로"><Svg><path d="m15 18-6-6 6-6" /></Svg></button>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>{editing ? '작품 수정' : '작품 등록'}</h1>
        </div>
        <button onClick={() => router.push('/my-works')} style={ghostBtn}>나가기</button>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 28, paddingBottom: 6 }}>
        {STEPS.map((s) => {
          const active = step === s.n, done = step > s.n, incomplete = step > s.n && !stepDone(s.n)
          return (
            <button key={s.n} onClick={() => goToStep(s.n)} style={{ flex: '1 0 auto', display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: `3px solid ${active ? 'var(--accent)' : 'transparent'}` }}>
              <span style={{ width: 28, height: 28, borderRadius: 9999, flexShrink: 0, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', background: incomplete ? 'var(--red)' : (active || done ? 'var(--accent)' : 'var(--surface2)'), color: (incomplete || active || done) ? '#fff' : 'var(--muted)' }}>{incomplete ? '!' : (done ? <CheckIcon size={13} color="#fff" /> : s.n)}</span>
              <span style={{ fontSize: 15, fontWeight: active ? 800 : 600, color: active ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{s.label}</span>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }} className="wr-cols">
        <div style={{ flex: '1 1 0', minWidth: 0, border: '1px solid var(--border)', borderRadius: 18, padding: 40, background: 'var(--surface)' }}>
          {step === 1 && (
            <>
              <StepHead title="기본 정보를 입력해주세요" sub="정확히 입력할수록 더 많은 타쿠들이 작품을 발견할 수 있어요." />
              <Label req>작품명</Label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder="예: 원피스, 귀멸의 칼날, 스파이 패밀리 등" style={inp} />
              <Label>작품명 (영문)</Label>
              <input value={eng} onChange={(e) => setEng(e.target.value)} maxLength={100} placeholder="예: One Piece, Demon Slayer (선택)" style={inp} />
              <Label>URL 주소 (slug)</Label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={80} placeholder="영문·숫자만 (예: one-piece). 비우면 자동 생성" style={inp} />
              <Label>작품 줄임말 (선택)</Label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={aliasInput} onChange={(e) => setAliasInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAlias() } }} placeholder="줄임말 입력 후 Enter (예: 가히리, 귀칼)" style={{ ...inp, flex: 1, marginBottom: 0 }} />
                <button onClick={addAlias} style={{ ...miniBtn, padding: '0 16px' }}>추가</button>
              </div>
              <div style={{ ...chipWrap, marginBottom: aliases.length ? 16 : 6 }}>{aliases.map((a) => <button key={a} onClick={() => setAliases((x) => x.filter((y) => y !== a))} style={{ ...chip(true), display: 'inline-flex', alignItems: 'center', gap: 5 }}>{a}<Svg size={12} color="#fff"><path d="M6 6l12 12M18 6 6 18" /></Svg></button>)}</div>
              <Label req>IP 타입</Label>
              <div style={chipWrap}>{IP_TYPES.map((t) => <button key={t} onClick={() => setIpType(t)} style={chip(ipType === t)}>{t}</button>)}</div>
              <Label>원작 여부</Label>
              <div style={chipWrap}>{ORIGINAL.map((t) => <button key={t} onClick={() => setOriginal(original === t ? '' : t)} style={chip(original === t)}>{t}</button>)}</div>
              <Label>연재 상태</Label>
              <div style={chipWrap}>{STATUS.map((s) => { const on = status === s.v; return <button key={s.v} onClick={() => setStatus(on ? '' : s.v)} style={{ ...chip(on), borderColor: on ? s.c : 'var(--border)', background: on ? s.c : 'var(--surface)' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 9999, background: on ? '#fff' : s.c }} />{s.v}</span></button> })}</div>
              {isAdmin ? (
                <>
                  <Label>대표 이미지 (관리자)</Label>
                  <ImageBox url={cover} uploading={upCover} onPick={() => coverRef.current?.click()} onClear={() => setCover('')} height={150} />
                  <input ref={coverRef} type="file" accept="image/*" onChange={(e) => onPick(e, 'cover')} style={{ display: 'none' }} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, margin: '8px 0 4px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                    <Svg size={14} color="var(--accent)"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></Svg>
                    <span>저작권 보호를 위해 <b style={{ color: 'var(--text)' }}>직접 찍은 사진이나 직접 그린 그림</b>으로 등록해주세요. (공식 포스터·타인 저작물 사용 금지)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 16px' }}>
                    <Label>대표 색상</Label>
                    <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 40, height: 30, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer' }} />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{accent} · 커버에서 자동 추출됨 (수정 가능)</span>
                  </div>
                  <Label>배너 이미지 (선택)</Label>
                  <ImageBox url={banner} uploading={upBanner} onPick={() => bannerRef.current?.click()} onClear={() => setBanner('')} height={110} />
                  <input ref={bannerRef} type="file" accept="image/*" onChange={(e) => onPick(e, 'banner')} style={{ display: 'none' }} />
                </>
              ) : (
                <>
                  <Label>대표 이미지</Label>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '2px 0 16px', padding: '13px 15px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                    <Svg size={15} color="var(--accent)"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></Svg>
                    <span>작품 대표 이미지는 팬들이 올린 <b style={{ color: 'var(--text)' }}>팬아트</b>로 자동 채워져요. 등록 후 창작 탭에 팬아트를 올리면, 이번 시즌 대표 팬아트가 작품 홈 상단에 노출됩니다.</span>
                  </div>
                </>
              )}
              <div style={{ height: 12 }} />
              <Label req>한 줄 소개</Label>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={80} placeholder="이 작품을 한 줄로 소개해주세요!" style={{ ...inp, minHeight: 64, resize: 'vertical' }} />
            </>
          )}

          {step === 2 && (
            <>
              <StepHead title="장르와 태그를 골라요" sub="작품홈에서 분류·검색에 쓰여요." />
              <Label req>장르 (복수 선택)</Label>
              <div style={chipWrap}>{GENRES.map((g) => <button key={g} onClick={() => toggleGenre(g)} style={chip(genres.includes(g))}>{g}</button>)}</div>
              <div style={{ height: 8 }} />
              <Label>태그 (복수, 자유 입력)</Label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={kwInput} onChange={(e) => setKwInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }} placeholder="태그 입력 후 Enter (예: 소년만화, 명작)" style={{ ...inp, flex: 1 }} />
                <button onClick={addKeyword} style={{ ...miniBtn, padding: '0 16px' }}>추가</button>
              </div>
              {keywords.length > 0 && (
                <div style={chipWrap}>{keywords.map((k) => <button key={k} onClick={() => setKeywords((a) => a.filter((x) => x !== k))} style={{ ...chip(true), display: 'inline-flex', alignItems: 'center', gap: 5 }}>#{k}<Svg size={12} color="#fff"><path d="M6 6l12 12M18 6 6 18" /></Svg></button>)}</div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <StepHead title="공식 링크를 연결해요" sub="있으면 넣고, 없어도 등록할 수 있어요." />
              <Label>공식 홈페이지</Label>
              <input value={homepage} onChange={(e) => setHomepage(e.target.value)} placeholder="https://" style={inp} />
              <Label>공식 X (Twitter)</Label>
              <input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/..." style={inp} />
              <Label>공식 유튜브</Label>
              <input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtube.com/..." style={inp} />
              <Label>공식 사이트 (기타)</Label>
              <input value={official} onChange={(e) => setOfficial(e.target.value)} placeholder="https://" style={inp} />
              <button onClick={save} disabled={saving} style={{ width: '100%', marginTop: 20, padding: 16, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>{saving ? '저장 중...' : (editing ? '변경사항 저장' : '작품 등록하기')}</button>
            </>
          )}

          {msg && <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 7, background: '#FDECEC', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700 }}><Svg size={15} color="var(--red)"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></Svg>{msg}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} style={{ ...ghostBtn, opacity: step === 1 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Svg size={15}><path d="m15 18-6-6 6-6" /></Svg>이전</button>
            {step < 3 && (
              <button onClick={() => { if (canNext) { setStep((s) => s + 1); setMsg(null) } else setMsg(curIssue) }} style={{ padding: '13px 26px', borderRadius: 10, border: 'none', background: canNext ? 'var(--accent)' : 'var(--border)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>다음 단계<Svg size={15} color="#fff"><path d="m9 18 6-6-6-6" /></Svg></button>
            )}
          </div>
        </div>

        <aside style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20, alignSelf: 'flex-start' }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', background: 'var(--surface)' }}>
            <div style={{ padding: '14px 16px 10px', fontSize: 14, fontWeight: 900 }}>작품 미리보기</div>
            {/* 작품홈 히어로 미리보기 */}
            <div style={{ background: `linear-gradient(135deg, ${accent}, ${shade(accent, 0.42)})`, padding: '22px 18px', display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 82, height: 108, borderRadius: 12, flexShrink: 0, background: cover ? `url(${cover}) center/cover` : 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!cover && <Svg size={24} color="rgba(255,255,255,.85)"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></Svg>}
              </div>
              <div style={{ flex: 1, minWidth: 0, color: '#fff' }}>
                <div style={{ fontSize: 21, fontWeight: 900, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || '작품명'}</div>
                {ipType && <span style={{ fontSize: 12, fontWeight: 800, background: 'rgba(255,255,255,.22)', color: '#fff', padding: '3px 11px', borderRadius: 9999 }}>{ipType}</span>}
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: accent, color: '#fff', fontWeight: 800, fontSize: 12, padding: '7px 13px', borderRadius: 9999, border: '1px solid rgba(255,255,255,.6)' }}><Svg size={13} color="#fff" fill="#fff"><path d="M12 21s-7-4.35-9.5-8.5C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 7C19 16.65 12 21 12 21z" /></Svg>최애</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fff', color: '#333', fontWeight: 800, fontSize: 12, padding: '7px 13px', borderRadius: 9999 }}><Svg size={13} color="#FFB300" fill="#FFB300"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" /></Svg>관심</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', color: '#333', fontWeight: 800, fontSize: 12, padding: '7px 13px', borderRadius: 9999 }}><Svg size={13} color="#333"><path d="M12 5v14M5 12h14" /></Svg>상태 추가<Svg size={12} color="#333"><path d="m6 9 6 6 6-6" /></Svg></span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, marginTop: 10, opacity: 0.92 }}>
                  <Svg size={13} color="#fff"><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" /><circle cx="17" cy="9" r="2" /><path d="M15.5 15c2 .3 3.5 2 3.5 4" /></Svg>0명이 최애로 등록했어요
                </div>
              </div>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {status && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{status}</span>}
                {original && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>· {original}</span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 12 }}>{desc || '한 줄 소개가 여기에 표시됩니다.'}</div>
              {(genres.length > 0 || keywords.length > 0) && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {[...genres, ...keywords].slice(0, 8).map((g) => <span key={g} style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--surface2)', padding: '3px 9px', borderRadius: 9999 }}># {g}</span>)}
                </div>
              )}
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, background: 'var(--surface)' }}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>등록 가이드</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {guide.map((g) => (
                <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: g.ok ? 'var(--text)' : 'var(--muted)' }}>
                  <span style={{ width: 18, height: 18, borderRadius: 9999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: g.ok ? 'var(--accent)' : 'var(--surface2)' }}>{g.ok ? <CheckIcon size={12} color="#fff" /> : <span style={{ width: 6, height: 6, borderRadius: 9999, background: 'var(--muted)' }} />}</span>
                  {g.label}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      <style>{`@media (hover:none) and (pointer:coarse) and (max-width: 1000px){ .wr-cols{ flex-direction: column !important; } .wr-cols > aside{ width: 100% !important; position: static !important; } }`}</style>
    </div>
  )
}

function shade(hex: string, p: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const n = parseInt(h, 16)
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  r = Math.round(r * (1 - p)); g = Math.round(g * (1 - p)); b = Math.round(b * (1 - p))
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
}
function StepHead({ title, sub }: { title: string; sub: string }) {
  return <div style={{ marginBottom: 20 }}><div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div><div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{sub}</div></div>
}
function ImageBox({ url, uploading, onPick, onClear, height }: { url: string; uploading: boolean; onPick: () => void; onClear: () => void; height: number }) {
  return (
    <div>
      <div style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: url ? `url(${url}) center/cover` : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        {!url && <span style={{ color: 'var(--muted)', fontSize: 13 }}>이미지 없음</span>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onPick} disabled={uploading} style={{ ...miniBtn, padding: '0 16px' }}>{uploading ? '업로드 중...' : (url ? '변경' : '업로드')}</button>
        {url && <button onClick={onClear} style={{ ...miniBtn, color: 'var(--red)' }}>제거</button>}
      </div>
    </div>
  )
}
const inp: React.CSSProperties = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', marginBottom: 14 }
const miniBtn: React.CSSProperties = { padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const ghostBtn: React.CSSProperties = { padding: '9px 15px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
const iconBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const chipWrap: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }
function chip(active: boolean): React.CSSProperties {
  return { padding: '8px 14px', borderRadius: 9999, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
}
function Label({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 6 }}>{children}{req && <span style={{ color: 'var(--accent)' }}> *</span>}</div>
}
