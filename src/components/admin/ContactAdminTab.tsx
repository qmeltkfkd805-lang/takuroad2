'use client'
import { useState, useEffect, useCallback, Fragment } from 'react'
import { getAllContactMessages, updateContactMessage } from '@/services/contactService'
import { CONTACT_TYPES } from '@/components/contact/contactConfig'
import styles from './ContactAdminTab.module.css'
import PartnerDetailView from './PartnerDetailView'
import ContactDetailView from './ContactDetailView'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '대기' },
  { key: 'processing', label: '처리중' },
  { key: 'done', label: '완료' },
]
const PARTNER_KEYS = ['partnerType','manager','company','phone','homepage','instagram','x','snsEtc','collab','collabEtc','address','works','branches','eventName','eventPeriod','eventPlace','brandName','brandGoal','adPeriod','adPlace','adBudget']
const STATUS_LABEL: Record<string, string> = { pending: '대기', processing: '처리중', done: '완료' }

export default function ContactAdminTab({ onlyType, excludeType }: { onlyType?: string; excludeType?: string } = {}) {
  const [filter, setFilter] = useState('all')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getAllContactMessages(filter).then(data => {
      let rows = data
      if (onlyType) rows = rows.filter((m: any) => m.type === onlyType)
      if (excludeType) rows = rows.filter((m: any) => m.type !== excludeType)
      setItems(rows); setLoading(false)
    })
  }, [filter, onlyType, excludeType])

  useEffect(() => { load() }, [load])

  function typeLabel(t: string) {
    return CONTACT_TYPES.find(c => c.key === t)?.label ?? t
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.filters}>
        {FILTERS.map(f => (
          <button key={f.key} className={filter === f.key ? styles.filterOn : styles.filter} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      {loading ? <p className={styles.empty}>불러오는 중…</p>
        : items.length === 0 ? <p className={styles.empty}>문의가 없어요.</p>
        : (
          <table className={styles.table}>
            <thead>
              <tr><th>유형</th><th>제목</th><th>이메일</th><th>상태</th><th>작성일</th></tr>
            </thead>
            <tbody>
              {items.map(m => (
                <Fragment key={m.id}>
                  <tr className={styles.row} onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                    <td>{typeLabel(m.type)}</td>
                    <td className={styles.subject}>{m.title}</td>
                    <td className={styles.email}>{m.email}</td>
                    <td><span className={styles['s_' + m.status]}>{STATUS_LABEL[m.status] ?? m.status}</span></td>
                    <td className={styles.date}>{new Date(m.created_at).toLocaleDateString('ko-KR')}</td>
                  </tr>
                  {openId === m.id && (
                    <tr><td colSpan={5}><Detail m={m} onSaved={load} /></td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
    </div>
  )
}

function Detail({ m, onSaved }: { m: any; onSaved: () => void }) {
  const [status, setStatus] = useState(m.status)
  const [note, setNote] = useState(m.admin_note ?? '')
  const [answer, setAnswer] = useState(m.answer ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await updateContactMessage(m.id, { status, adminNote: note, answer })
    setSaving(false)
    if (res.ok) onSaved()
    else alert('저장 실패: ' + res.error)
  }

  const x = m.extra ?? {}
  const isPartner = m.type === 'partner'
  const extraEntries = Object.entries(x).filter(([k]) => !isPartner || !PARTNER_KEYS.includes(k))

  function Row({ label, value }: { label: string; value: any }) {
    if (value === undefined || value === null || value === '') return null
    return <div className={styles.extraRow}><span className={styles.extraKey}>{label}</span><span>{String(value)}</span></div>
  }

  return (
    <div className={styles.detail}>
      <div className={styles.detailBody}>
        {isPartner ? (
          <PartnerDetailView extra={x} content={m.content} />
        ) : (
          <ContactDetailView m={m} />
        )}
        {m.attachment_urls?.length > 0 && (
          <div className={styles.files}>
            {m.attachment_urls.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className={styles.fileLink}>📎 첨부 {i + 1}</a>
            ))}
          </div>
        )}
      </div>
      <div className={styles.admin}>
        <label className={styles.aLabel}>상태</label>
        <select value={status} onChange={e => setStatus(e.target.value)} className={styles.select}>
          <option value="pending">대기</option>
          <option value="processing">처리중</option>
          <option value="done">완료</option>
        </select>
        <label className={styles.aLabel}>사용자 답변 (문의자에게 보임)</label>
        <textarea value={answer} onChange={e => setAnswer(e.target.value)} className={styles.noteArea} rows={4} placeholder="문의자에게 전달할 답변을 작성하세요." />
        <label className={styles.aLabel}>관리자 메모 (내부용)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} className={styles.noteArea} rows={3} placeholder="예: 재현 불가, 메일 발송 완료, 개발 예정…" />
        <button className={styles.saveBtn} onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
      </div>
    </div>
  )
}