'use client'
import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { CONTACT_TYPES, FIELD_DEFS, FieldKey } from './contactConfig'
import { createContactMessage, uploadContactFiles } from '@/services/contactService'
import { ROUTES } from '@/lib/constants/routes'
import styles from './ContactForm.module.css'
import Link from 'next/link'
import AppIcon from '@/components/tds/AppIcon'

/* 로그인 안내 — 문의는 로그인한 사용자만 받는다.
   비로그인 문의는 답변을 전달할 경로가 없다. 메일 발송 기능이 없고,
   '내 문의'(getMyContactMessages)는 user_id 로 조회하므로 비로그인은 열 수 없다.
   접수만 받고 답변이 도달하지 않는 것보다, 접수 자체를 받지 않는 편이 정직하다. */
const loginCta: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minHeight: 44, padding: '0 24px', marginTop: 4,
  borderRadius: 12, background: 'var(--accent)', color: '#fff',
  fontSize: 14.5, fontWeight: 800, textDecoration: 'none',
}

export default function ContactForm({ onSent }: { onSent?: () => void }) {
  const { user } = useAuth()
  const sp = useSearchParams()
  const fromPath = sp.get('from')
  const fromLabel = sp.get('label')

  const [typeKey, setTypeKey] = useState('general')
  const [values, setValues] = useState<Record<string, string>>({})
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [sentId, setSentId] = useState<string | null>(null)
  // 첨부 업로드·접수 과정의 안내. 실패해도 본문은 보존한다
  const [note, setNote] = useState<string | null>(null)

  const type = useMemo(() => CONTACT_TYPES.find(t => t.key === typeKey)!, [typeKey])

  const authedEmail = (user as any)?.email ?? ''
  const emailValue = email || authedEmail

  function setField(k: string, v: string) {
    setValues(prev => ({ ...prev, [k]: v }))
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setFiles(Array.from(e.target.files).slice(0, 5))
  }

  async function submitContact() {
    if (sending) return
    setSending(true)
    const title = (values.title ?? '').trim() || type.label
    const content = (values.content ?? '').trim() || (values.reason ?? '').trim() || '(내용 없음)'
    const extra: Record<string, string> = {}
    for (const f of type.fields) {
      if (f !== 'title' && f !== 'content' && (values[f] ?? '').trim()) extra[f] = values[f]
    }
    /* 첨부는 서버가 자리를 예약하고 서명 URL 로 직접 올린다.
       초안(draftId)을 제출까지 들고 가야 첨부가 이 문의에 연결된다. */
    let draftId: string | null = null
    if (files.length) {
      const up = await uploadContactFiles(files)
      draftId = up.draftId
      if (up.failed.length) {
        setNote('올리지 못한 파일이 있어요 — ' + up.failed.map(f => f.name + '(' + f.reason + ')').join(', '))
      }
      // 하나도 못 올렸으면 멈춘다. 작성한 내용은 그대로 둔다
      if (up.uploaded === 0) { setSending(false); return }
    }

    const res = await createContactMessage({
      type: typeKey, title, content, extra,
      email: emailValue, pageUrl: fromPath, pageLabel: fromLabel, draftId,
    })
    setSending(false)
    if (res.ok && res.id) {
      setNote(res.dropped ? '첨부 ' + res.dropped + '개는 업로드가 끝나지 않아 빠졌어요.' : null)
      setSentId(res.id); onSent?.()
    } else {
      /* 초안이 만료됐으면 첨부부터 다시 올려야 한다.
         본문은 보존하고 파일 선택만 비운다 */
      if (res.needsReattach) setFiles([])
      setNote((res.error ?? '접수에 실패했어요')
        + (res.needsReattach ? ' 첨부를 다시 선택해주세요. 작성하신 내용은 그대로 있어요.' : ''))
    }
  }

  const canSubmit = agree && emailValue && type.fields.filter(f => FIELD_DEFS[f].required).every(f => (values[f] ?? '').trim())

  if (!user) {
    return (
      <div className={styles.done}>
        <h3 className={styles.doneTitle}>로그인이 필요해요</h3>
        <p className={styles.doneDesc}>
          답변을 받아보시려면 로그인해주세요.<br />
          문의하신 내용과 답변은 <b>마이페이지 &gt; 내 문의</b>에서 확인할 수 있어요.
        </p>
        <Link href={ROUTES.login} style={loginCta}>로그인하기</Link>
      </div>
    )
  }

  if (sentId) {
    return (
      <div className={styles.done}>
        <div className={styles.doneIcon}><AppIcon name="check" size={28} color="#fff" /></div>
        <h3 className={styles.doneTitle}>문의가 접수되었어요</h3>
        <p className={styles.doneDesc}>평균 1~3일 안에 답변 드릴게요. 접수번호를 알려드려요.</p>
        <span className={styles.doneId}>#{sentId.slice(0, 8)}</span>
        {note && (
          <p className={styles.doneDesc} style={{ color: 'var(--warn, #d97706)' }}>{note}</p>
        )}
      </div>
    )
  }

  return (
    <div className={styles.form}>
      <label className={styles.groupLabel}>문의 유형</label>
      <div className={styles.types}>
        {CONTACT_TYPES.map(t => (
          <button
            key={t.key}
            type="button"
            className={typeKey === t.key ? styles.typeOn : styles.type}
            onClick={() => { setTypeKey(t.key); setValues({}) }}
          >{t.label}</button>
        ))}
      </div>

      {type.hint && <p className={styles.hint}>{type.hint}</p>}

      {fromPath && (
        <div className={styles.attached}>
          <span className={styles.attachedLabel}>문의 위치</span>
          <span className={styles.attachedValue}>{fromLabel || fromPath}</span>
        </div>
      )}

      {type.redirect ? (
        <div className={styles.redirectBox}>
          <div className={styles.redirectIcon}><AppIcon name="handshake" size={48} color="var(--accent)" style={{ display: 'block', margin: '0 auto' }} /></div>
          <div className={styles.redirectTitle}>제휴 안내 페이지에서 접수해요</div>
          <p className={styles.redirectDesc}>{type.redirect.desc}</p>
          <Link href={type.redirect.href} className={styles.redirectBtn}>{type.redirect.label} →</Link>
        </div>
      ) : (
        <>
      {type.fields.map((f: FieldKey) => {
        const def = FIELD_DEFS[f]
        return (
          <div key={f} className={styles.field}>
            <label className={styles.label}>{def.label}{def.required && <em className={styles.req}>*</em>}</label>
            {def.multiline ? (
              <textarea className={styles.textarea} placeholder={def.placeholder} value={values[f] ?? ''} onChange={e => setField(f, e.target.value)} rows={5} />
            ) : (
              <input className={styles.input} placeholder={def.placeholder} value={values[f] ?? ''} onChange={e => setField(f, e.target.value)} />
            )}
          </div>
        )
      })}

      <div className={styles.field}>
        <label className={styles.label}>답변 받을 이메일<em className={styles.req}>*</em></label>
        <input className={styles.input} type="email" placeholder="you@example.com" value={emailValue} onChange={e => setEmail(e.target.value)} />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>첨부파일</label>
        <label className={styles.fileBtn}>
          <AppIcon name="clip" size={14} style={{ marginRight: 5 }} />파일 선택
          <input type="file" multiple accept="image/*" onChange={onFiles} hidden />
        </label>
        {files.length > 0 && <span className={styles.fileList}>{files.map(f => f.name).join(', ')}</span>}
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '6px 0 0', lineHeight: 1.6 }}>
          최대 5개, 파일당 10MB까지 올릴 수 있어요. 파일을 고른 뒤 1시간 안에 보내주세요 —
          시간이 지나면 첨부만 다시 올리시면 돼요. 한 번 고른 파일을 빼도 남은 개수는 돌아오지 않아요.
        </p>
      </div>

      {note && (
        <div style={{
          margin: '0 0 12px', padding: '10px 12px', borderRadius: 9,
          border: '1px solid #f0b429', background: '#fff8e6',
          fontSize: 12.5, lineHeight: 1.6, color: '#7a5200', whiteSpace: 'pre-wrap',
        }}>{note}</div>
      )}

      <label className={styles.agree}>
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
        <span>개인정보 수집·이용에 동의합니다. (문의 응대 목적으로만 사용됩니다)</span>
      </label>

      <button type="button" className={styles.submit} disabled={!canSubmit || sending} onClick={submitContact}>
        {sending ? '보내는 중…' : '문의 보내기'}
      </button>
        </>
      )}
    </div>
  )
}