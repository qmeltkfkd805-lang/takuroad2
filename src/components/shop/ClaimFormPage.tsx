'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { getShopBySlug, requestShopVerify, getMyVerifyRequest } from '@/services/shopService'
import { Shop } from '@/types/shop'
import styles from './claimForm.module.css'
import AppIcon from '@/components/tds/AppIcon'

const MANAGE_FEATURES = [
  '영업시간 수정', '휴무 공지', '이벤트 등록', '매장 사진 관리', '굿즈 입고 소식', '댓글 답변',
]

export default function ClaimFormPage({ slug }: { slug: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [already, setAlready] = useState<{ status: string } | null>(null)
  const [transferMode, setTransferMode] = useState(false)

  const [manager, setManager] = useState('')
  const [position, setPosition] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [bizName, setBizName] = useState('')
  const [bizNo, setBizNo] = useState('')
  const [owner, setOwner] = useState('')
  const [features, setFeatures] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [agree1, setAgree1] = useState(false)
  const [agree2, setAgree2] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getShopBySlug(slug).then(s => { setShop(s); setLoading(false) })
  }, [slug])

  useEffect(() => {
    if (!user || !shop) return
    getMyVerifyRequest(shop.id, user.id).then(req => { if (req) setAlready(req) })
    if ((user as any).email) setEmail((user as any).email)
  }, [user, shop])

  function toggleFeature(f: string) {
    setFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }

  const canSubmit = manager.trim() && email.trim() && phone.trim() && bizName.trim() && bizNo.trim() && file && agree1 && agree2

  async function submit() {
    if (!user || !shop || !canSubmit || submitting) return
    setSubmitting(true)
    const note = '[사업자] ' + bizName + ' / 등록번호 ' + bizNo + (owner ? ' / 대표 ' + owner : '')
    const extra = {
      manager, position, email, phone, bizName, bizNo, owner,
      features, shopName: shop.name, shopAddr: shop.addr,
      transfer: transferMode || undefined,
    }
    const ok = await requestShopVerify(shop.id, user.id, note, file, extra)
    setSubmitting(false)
    if (ok) setDone(true)
    else alert('신청에 실패했어요. 잠시 후 다시 시도해 주세요.')
  }

  if (loading) return <div className={styles.wrap}><p className={styles.msg}>불러오는 중…</p></div>
  if (!shop) return <div className={styles.wrap}><p className={styles.msg}>매장을 찾을 수 없어요.</p></div>
  if (!user) return <div className={styles.wrap}><p className={styles.msg}>로그인 후 이용해 주세요.</p></div>

  if (done) {
    return (
      <div className={styles.wrap}>
        <div className={styles.done}>
          <div className={styles.doneIcon}>✓</div>
          <h2 className={styles.doneTitle}>인증 신청이 접수되었어요</h2>
          <p className={styles.doneDesc}>운영진이 검토 후 결과를 알려드릴게요.</p>
          <Link href="/mypage" className={styles.doneBtn}>마이페이지로</Link>
        </div>
      </div>
    )
  }

  if (shop.is_claimed && shop.owner_id !== user.id && !transferMode) {
    return (
      <div className={styles.wrap}>
        <div className={styles.done}>
          <div className={styles.doneIcon} style={{ background: 'var(--yellow, #f59e0b)' }}>!</div>
          <h2 className={styles.doneTitle}>{shop.name}</h2>
          <p className={styles.doneDesc}>이미 인증된 매장이에요. 실제 사장님이시라면 인증 이전을 요청할 수 있어요. 운영진이 확인 후 처리해 드릴게요.</p>
          <button className={styles.doneBtn} style={{ border: 'none', cursor: 'pointer' }} onClick={() => setTransferMode(true)}>인증 이전 요청하기</button>
        </div>
      </div>
    )
  }

  if (already) {
    const label = { pending: '심사 중', approved: '인증 완료', rejected: '거절됨' }[already.status] ?? already.status
    return (
      <div className={styles.wrap}>
        <div className={styles.done}>
          <h2 className={styles.doneTitle}>{shop.name}</h2>
          <p className={styles.doneDesc}>이미 이 매장에 대한 인증 신청이 있어요. (상태: {label})</p>
          <Link href="/mypage" className={styles.doneBtn}>인증 현황 보기</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.shopBox}>
        <span className={styles.shopLabel}>인증할 매장</span>
        <div className={styles.shopName}>{shop.name}</div>
        <div className={styles.shopAddr}>{shop.addr || '주소 미등록'}</div>
      </div>

      <h3 className={styles.section}>기본 정보</h3>
      <div className={styles.row2}>
        <F label="담당자 이름" req val={manager} on={setManager} ph="성함" />
        <F label="직책" val={position} on={setPosition} ph="예: 점장 (선택)" />
      </div>
      <div className={styles.row2}>
        <F label="이메일" req val={email} on={setEmail} ph="you@example.com" />
        <F label="연락처" req val={phone} on={setPhone} ph="연락 가능한 번호" />
      </div>

      <h3 className={styles.section}>사업자 정보</h3>
      <F label="상호명" req val={bizName} on={setBizName} ph="사업자등록증상 상호" />
      <div className={styles.row2}>
        <F label="사업자등록번호" req val={bizNo} on={setBizNo} ph="000-00-00000" />
        <F label="대표자명" val={owner} on={setOwner} ph="선택" />
      </div>

      <h3 className={styles.section}>증빙 자료<em className={styles.reqMark}>*</em></h3>
      <p className={styles.hint}>사업자등록증이 가장 좋아요. 없다면 매장 명함·내부 사진 등 운영을 증명할 자료를 올려주세요.</p>
      {!file ? (
        <button className={styles.fileBtn} onClick={() => fileRef.current?.click()}><AppIcon name="clip" size={14} style={{ marginRight: 6 }} />사업자등록증 / 증빙 자료 첨부</button>
      ) : (
        <div className={styles.fileCard}>
          {preview ? <img src={preview} alt="" className={styles.thumb} /> : <span className={styles.fileIcon}><AppIcon name="note" size={24} /></span>}
          <span className={styles.fileName}>{file.name}</span>
          <button className={styles.fileDel} onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}>삭제</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onFile} hidden />

      <h3 className={styles.section}>관리하고 싶은 기능</h3>
      <div className={styles.checks}>
        {MANAGE_FEATURES.map(f => (
          <label key={f} className={features.includes(f) ? styles.checkOn : styles.check}>
            <input type="checkbox" checked={features.includes(f)} onChange={() => toggleFeature(f)} hidden />
            {f}
          </label>
        ))}
      </div>

      <div className={styles.agrees}>
        <label className={styles.agree}>
          <input type="checkbox" checked={agree1} onChange={e => setAgree1(e.target.checked)} />
          <span>제출한 정보는 인증 목적으로만 사용됩니다.</span>
        </label>
        <label className={styles.agree}>
          <input type="checkbox" checked={agree2} onChange={e => setAgree2(e.target.checked)} />
          <span>허위 신청 시 인증이 취소될 수 있습니다.</span>
        </label>
      </div>

      <button className={styles.submit} disabled={!canSubmit || submitting} onClick={submit}>
        {submitting ? '신청 중…' : '인증 신청하기'}
      </button>
    </div>
  )
}

function F({ label, req, val, on, ph }: { label: string; req?: boolean; val: string; on: (v: string) => void; ph?: string }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}{req && <em className={styles.reqMark}>*</em>}</label>
      <input className={styles.input} value={val} onChange={e => on(e.target.value)} placeholder={ph} />
    </div>
  )
}