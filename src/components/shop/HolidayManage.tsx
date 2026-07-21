'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { updateShopFields } from '@/services/shopService'
import { Shop } from '@/types/shop'
import styles from './holidayManage.module.css'

export default function HolidayManage({ shop }: { shop: Shop }) {
  const { user } = useAuth()
  const router = useRouter()
  const [start, setStart] = useState(shop.temporary_holiday_start ?? '')
  const [end, setEnd] = useState(shop.temporary_holiday_end ?? '')
  const [message, setMessage] = useState(shop.temporary_holiday_message ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    if (!user || saving) return
    setSaving(true)
    const ok = await updateShopFields(shop.id, {
      temporary_holiday_start: start || null,
      temporary_holiday_end: end || null,
      temporary_holiday_message: message.trim() || null,
    }, user.id)
    setSaving(false)
    if (ok) { router.push('/shop/' + shop.slug); router.refresh() }
    else alert('저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
  }

  async function clearHoliday() {
    if (!user || saving) return
    if (!confirm('휴무 공지를 삭제할까요?')) return
    setSaving(true)
    const ok = await updateShopFields(shop.id, {
      temporary_holiday_start: null, temporary_holiday_end: null, temporary_holiday_message: null,
    }, user.id)
    setSaving(false)
    if (ok) { setStart(''); setEnd(''); setMessage(''); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  const hasHoliday = start || end || message

  return (
    <div className={styles.wrap}>
      <Link href={`/shop/${shop.slug}/manage`} className={styles.back}>← 매장 관리</Link>
      <h1 className={styles.title}>임시 휴무 공지</h1>
      <p className={styles.desc}>임시 휴무 기간과 안내문을 등록하세요. 종료일이 지나면 공지가 자동으로 사라져요.</p>

      <div className={styles.field}>
        <label className={styles.label}>시작일</label>
        <input type="date" className={styles.input} value={start} onChange={e => setStart(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>종료일</label>
        <input type="date" className={styles.input} value={end} onChange={e => setEnd(e.target.value)} min={start || undefined} />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>안내문</label>
        <textarea className={styles.textarea} value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="예: 매장 내부 공사로 인해 임시 휴무입니다." />
      </div>

      <button className={styles.saveBtn} onClick={save} disabled={saving}>
        {saving ? '저장 중…' : saved ? '저장됨 ✓' : '휴무 공지 등록'}
      </button>
      {hasHoliday && (
        <button className={styles.clearBtn} onClick={clearHoliday} disabled={saving}>휴무 공지 삭제</button>
      )}
    </div>
  )
}