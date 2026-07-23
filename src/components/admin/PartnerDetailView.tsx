'use client'

import { PARTNER_TYPES, P_FIELD_DEFS, COLLAB_FIELDS, PFieldKey } from '@/components/contact/partnerConfig'
import styles from '@/components/contact/PartnerForm.module.css'

/** 관리자용 — 제휴 문의를 신청 폼과 같은 모양으로 읽기 전용 표시 */
export default function PartnerDetailView({ extra, content }: { extra: any; content?: string }) {
  const x = extra ?? {}
  const type = PARTNER_TYPES.find(t => t.label === x.partnerType) ?? null
  const collab: string[] = Array.isArray(x.collab) ? x.collab : []

  return (
    <div className={styles.form}>
      <label className={styles.gLabel}>제휴 유형</label>
      <div className={styles.types}>
        {PARTNER_TYPES.map(t => (
          <span key={t.key} className={type?.key === t.key ? styles.typeOn : styles.type}>{t.label}</span>
        ))}
      </div>

      <div className={styles.row2}>
        <F label="담당자 이름" v={x.manager} />
        <F label="회사/매장명" v={x.company} />
      </div>
      <div className={styles.row2}>
        <F label="이메일" v={x.email} />
        <F label="연락처" v={x.phone} />
      </div>
      <F label="홈페이지" v={x.homepage} />

      <label className={styles.gLabel}>SNS</label>
      <div className={styles.row3}>
        <F label="Instagram" v={x.instagram} />
        <F label="X" v={x.x} />
        <F label="기타" v={x.snsEtc} />
      </div>

      {type && type.fields.length > 0 && (
        <>
          <label className={styles.gLabel}>{type.label} 정보</label>
          {type.fields.map((f: PFieldKey) => {
            const def = P_FIELD_DEFS[f]
            return def.multiline
              ? (
                <div key={f} className={styles.field}>
                  <label className={styles.label}>{def.label}</label>
                  <textarea className={styles.textarea} value={x[f] ?? ''} readOnly rows={3} />
                </div>
              )
              : <F key={f} label={def.label} v={x[f]} />
          })}
        </>
      )}

      <label className={styles.gLabel}>예상 협업 분야</label>
      <div className={styles.checks}>
        {COLLAB_FIELDS.map(c => (
          <span key={c} className={collab.includes(c) ? styles.checkOn : styles.check}>{c}</span>
        ))}
      </div>
      {collab.includes('기타') && x.collabEtc && (
        <input className={styles.input} style={{ marginTop: 10 }} value={x.collabEtc} readOnly />
      )}

      <div className={styles.field}>
        <label className={styles.label}>제휴 내용</label>
        <textarea className={styles.textarea} value={content ?? ''} readOnly rows={5} />
      </div>
    </div>
  )
}

function F({ label, v }: { label: string; v?: string }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <input className={styles.input} value={v ?? ''} readOnly />
    </div>
  )
}