'use client'
import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { CONTACT_TYPES, FIELD_DEFS, FieldKey } from './contactConfig'
import styles from './ContactForm.module.css'

export default function ContactForm() {
  const { user } = useAuth()
  const sp = useSearchParams()
  const fromPath = sp.get('from')
  const fromLabel = sp.get('label')

  const [typeKey, setTypeKey] = useState('general')
  const [values, setValues] = useState<Record<string, string>>({})
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [files, setFiles] = useState<File[]>([])

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
    // TODO: 나중에 여기를 createContactMessage()로 교체
    // payload: { type: typeKey, email: emailValue, values, fromPath, fromLabel, files }
    alert('문의 전송 기능은 곧 제공됩니다. 조금만 기다려 주세요!')
  }

  const canSubmit = agree && emailValue && type.fields.filter(f => FIELD_DEFS[f].required).every(f => (values[f] ?? '').trim())

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
          📎 파일 선택
          <input type="file" multiple accept="image/*" onChange={onFiles} hidden />
        </label>
        {files.length > 0 && <span className={styles.fileList}>{files.map(f => f.name).join(', ')}</span>}
      </div>

      <label className={styles.agree}>
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
        <span>개인정보 수집·이용에 동의합니다. (문의 응대 목적으로만 사용됩니다)</span>
      </label>

      <button type="button" className={styles.submit} disabled={!canSubmit} onClick={submitContact}>
        문의 보내기
      </button>
    </div>
  )
}