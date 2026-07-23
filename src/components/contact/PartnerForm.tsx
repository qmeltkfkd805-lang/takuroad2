'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { createContactMessage, uploadContactFiles } from '@/services/contactService'
import { PARTNER_TYPES, P_FIELD_DEFS, COLLAB_FIELDS, PFieldKey } from './partnerConfig'
import styles from './PartnerForm.module.css'
import AppIcon from '@/components/tds/AppIcon'

export default function PartnerForm() {
  const { user } = useAuth()
  const [typeKey, setTypeKey] = useState('shop')
  const [common, setCommon] = useState<Record<string, string>>({})
  const [values, setValues] = useState<Record<string, string>>({})
  const [collab, setCollab] = useState<string[]>([])
  const [collabEtc, setCollabEtc] = useState('')
  const [content, setContent] = useState('')
  const [agree, setAgree] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [sentId, setSentId] = useState<string | null>(null)

  const type = useMemo(() => PARTNER_TYPES.find(t => t.key === typeKey)!, [typeKey])
  const authedEmail = (user as any)?.email ?? ''
  const emailValue = common.email || authedEmail

  function setC(k: string, v: string) { setCommon(p => ({ ...p, [k]: v })) }
  function setV(k: string, v: string) { setValues(p => ({ ...p, [k]: v })) }
  function toggleCollab(c: string) {
    setCollab(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }
  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setFiles(Array.from(e.target.files).slice(0, 5))
  }

  const canSubmit = agree && emailValue && (common.manager ?? '').trim() && (common.company ?? '').trim()

  async function submit() {
    if (sending) return
    setSending(true)
    const attachmentUrls = files.length ? await uploadContactFiles(files) : []
    const extra: Record<string, any> = {
      partnerType: type.label,
      manager: common.manager, company: common.company,
      phone: common.phone, homepage: common.homepage,
      instagram: common.instagram, x: common.x, snsEtc: common.snsEtc,
      collab, collabEtc: collab.includes('기타') ? collabEtc : undefined, ...values,
    }
    const res = await createContactMessage({
      type: 'partner',
      title: '[제휴] ' + type.label + ' · ' + (common.company || ''),
      content: content || '(내용 없음)',
      extra, email: emailValue, attachmentUrls,
    })
    setSending(false)
    if (res.ok && res.id) setSentId(res.id)
    else alert('전송에 실패했어요. 잠시 후 다시 시도해 주세요.')
  }

  if (sentId) {
    return (
      <div className={styles.done}>
        <div className={styles.doneIcon}><AppIcon name="check" size={28} color="#fff" /></div>
        <h3 className={styles.doneTitle}>제휴 문의가 접수되었어요</h3>
        <p className={styles.doneDesc}>검토 후 입력하신 이메일로 연락드릴게요.</p>
        <span className={styles.doneId}>#{sentId.slice(0, 8)}</span>
      </div>
    )
  }

  return (
    <div className={styles.form}>
      <label className={styles.gLabel}>제휴 유형</label>
      <div className={styles.types}>
        {PARTNER_TYPES.map(t => (
          <button key={t.key} type="button" className={typeKey === t.key ? styles.typeOn : styles.type} onClick={() => { setTypeKey(t.key); setValues({}) }}>{t.label}</button>
        ))}
      </div>

      {type.redirect ? (
        <div className={styles.redirectBox}>
          <div className={styles.redirectIcon}><AppIcon name={typeKey === 'shop' ? 'shop' : 'ticket'} size={48} color="var(--accent)" style={{ display: 'block', margin: '0 auto' }} /></div>
          <div className={styles.redirectTitle}>직접 등록할 수 있어요</div>
          <p className={styles.redirectDesc}>{type.redirect.desc}</p>
          <Link href={type.redirect.href} className={styles.redirectBtn}>{type.redirect.label} →</Link>
        </div>
      ) : (
      <>
      <div className={styles.row2}>
        <Field label="담당자 이름" req val={common.manager} on={v => setC('manager', v)} ph="담당자 성함" />
        <Field label="회사/매장명" req val={common.company} on={v => setC('company', v)} ph="회사 또는 매장 이름" />
      </div>
      <div className={styles.row2}>
        <Field label="이메일" req val={emailValue} on={v => setC('email', v)} ph="you@example.com" />
        <Field label="연락처" val={common.phone} on={v => setC('phone', v)} ph="선택" />
      </div>
      <Field label="홈페이지" val={common.homepage} on={v => setC('homepage', v)} ph="https:// (선택)" />

      <label className={styles.gLabel}>SNS</label>
      <div className={styles.row3}>
        <Field label="Instagram" val={common.instagram} on={v => setC('instagram', v)} ph="@" small />
        <Field label="X" val={common.x} on={v => setC('x', v)} ph="@" small />
        <Field label="기타" val={common.snsEtc} on={v => setC('snsEtc', v)} ph="링크" small />
      </div>

      {type.fields.length > 0 && (
        <>
          <label className={styles.gLabel}>{type.label} 정보</label>
          {type.fields.map((f: PFieldKey) => {
            const def = P_FIELD_DEFS[f]
            return def.multiline
              ? <div key={f} className={styles.field}><label className={styles.label}>{def.label}</label><textarea className={styles.textarea} value={values[f] ?? ''} onChange={e => setV(f, e.target.value)} placeholder={def.placeholder} rows={3} /></div>
              : <Field key={f} label={def.label} val={values[f]} on={v => setV(f, v)} ph={def.placeholder} />
          })}
        </>
      )}

      <label className={styles.gLabel}>예상 협업 분야</label>
      <div className={styles.checks}>
        {COLLAB_FIELDS.map(c => (
          <label key={c} className={collab.includes(c) ? styles.checkOn : styles.check}>
            <input type="checkbox" checked={collab.includes(c)} onChange={() => toggleCollab(c)} hidden />
            {c}
          </label>
        ))}
        </div>
        {collab.includes('기타') && (
          <input
            className={styles.input}
            style={{ marginTop: 10 }}
            value={collabEtc}
            onChange={e => setCollabEtc(e.target.value)}
            placeholder="어떤 협업을 원하시는지 적어주세요"
          />
        )}

      <div className={styles.field}>
        <label className={styles.label}>제휴 내용</label>
        <textarea className={styles.textarea} value={content} onChange={e => setContent(e.target.value)} placeholder="제휴 내용을 자유롭게 작성해주세요." rows={5} />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>첨부파일 (회사소개서·제안서·이미지)</label>
        <label className={styles.fileBtn}><AppIcon name="clip" size={14} style={{ marginRight: 5 }} />파일 선택<input type="file" multiple onChange={onFiles} hidden /></label>
        {files.length > 0 && <span className={styles.fileList}>{files.map(f => f.name).join(', ')}</span>}
      </div>

      <label className={styles.agree}>
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
        <span>개인정보 수집·이용에 동의합니다. (제휴 검토 목적으로만 사용됩니다)</span>
      </label>

      <button type="button" className={styles.submit} disabled={!canSubmit || sending} onClick={submit}>
        {sending ? '보내는 중…' : '제휴 문의 보내기'}
      </button>
      </>
      )}
    </div>
  )
}

function Field({ label, req, val, on, ph, small }: { label: string; req?: boolean; val?: string; on: (v: string) => void; ph?: string; small?: boolean }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}{req && <em className={styles.reqMark}>*</em>}</label>
      <input className={styles.input} value={val ?? ''} onChange={e => on(e.target.value)} placeholder={ph} />
    </div>
  )
}