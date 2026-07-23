'use client'

import { CONTACT_TYPES, FIELD_DEFS, FieldKey } from '@/components/contact/contactConfig'
import styles from '@/components/contact/ContactForm.module.css'

/** 관리자용 — 일반 문의를 신청 폼과 같은 모양으로 읽기 전용 표시 */
export default function ContactDetailView({ m }: { m: any }) {
  const x = m.extra ?? {}
  const type = CONTACT_TYPES.find(t => t.key === m.type) ?? null

  function valueOf(f: FieldKey): string {
    if (f === 'title') return m.title ?? ''
    if (f === 'content') return m.content ?? ''
    return x[f] ?? ''
  }

  const fields: FieldKey[] = type?.fields?.length ? type.fields : (['title', 'content'] as FieldKey[])

  return (
    <div className={styles.form}>
      <label className={styles.groupLabel}>문의 유형</label>
      <div className={styles.types}>
        {CONTACT_TYPES.map(t => (
          <span key={t.key} className={m.type === t.key ? styles.typeOn : styles.type}>{t.label}</span>
        ))}
      </div>

      {m.page_url && (
        <div className={styles.attached}>
          <span className={styles.attachedLabel}>문의 위치</span>
          <span className={styles.attachedValue}>{m.page_label || m.page_url}</span>
        </div>
      )}

      {fields.map((f: FieldKey) => {
        const def = FIELD_DEFS[f]
        if (!def) return null
        return (
          <div key={f} className={styles.field}>
            <label className={styles.label}>{def.label}</label>
            {def.multiline
              ? <textarea className={styles.textarea} value={valueOf(f)} readOnly rows={5} />
              : <input className={styles.input} value={valueOf(f)} readOnly />}
          </div>
        )
      })}

      <div className={styles.field}>
        <label className={styles.label}>답변 받을 이메일</label>
        <input className={styles.input} value={m.email ?? ''} readOnly />
      </div>
    </div>
  )
}