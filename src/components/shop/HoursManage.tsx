'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { updateShopFields } from '@/services/shopService'
import { WEEKDAYS, WEEKDAY_LABEL } from '@/lib/constants/categories'
import { BusinessHours } from '@/types/database'
import { Shop } from '@/types/shop'
import styles from './hoursManage.module.css'

export default function HoursManage({ shop }: { shop: Shop }) {
  const { user } = useAuth()
  const [hours, setHours] = useState<BusinessHours>(shop.hours ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggleDay(day: string) {
    setHours(prev => {
      const next: BusinessHours = { ...prev }
      if ((next as any)[day]) (next as any)[day] = null
      else (next as any)[day] = { open: '10:00', close: '20:00' }
      return next
    })
  }
  function setTime(day: string, field: 'open' | 'close', value: string) {
    setHours(prev => {
      const cur = (prev as any)[day]
      if (!cur) return prev
      return { ...prev, [day]: { ...cur, [field]: value } }
    })
  }

  async function save() {
    if (!user || saving) return
    setSaving(true)
    const ok = await updateShopFields(shop.id, { hours }, user.id)
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
    else alert('저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
  }

  return (
    <div className={styles.wrap}>
      <Link href={`/shop/${shop.slug}/manage`} className={styles.back}>← 매장 관리</Link>
      <h1 className={styles.title}>영업시간</h1>
      <p className={styles.desc}>요일별 영업시간을 설정하세요. 휴무일은 요일 버튼을 눌러 끄면 돼요.</p>

      <div className={styles.days}>
        {WEEKDAYS.map(day => {
          const dh = (hours as any)[day]
          const isOpen = !!dh
          return (
            <div key={day} className={styles.dayRow}>
              <button className={isOpen ? styles.dayOn : styles.dayOff} onClick={() => toggleDay(day)}>
                {WEEKDAY_LABEL[day]}
              </button>
              {isOpen ? (
                <div className={styles.times}>
                  <input type="time" className={styles.time} value={dh.open} onChange={e => setTime(day, 'open', e.target.value)} />
                  <span className={styles.tilde}>~</span>
                  <input type="time" className={styles.time} value={dh.close} onChange={e => setTime(day, 'close', e.target.value)} />
                </div>
              ) : (
                <span className={styles.closed}>휴무</span>
              )}
            </div>
          )
        })}
      </div>

      <button className={styles.saveBtn} onClick={save} disabled={saving}>
        {saving ? '저장 중…' : saved ? '저장됨 ✓' : '저장하기'}
      </button>
    </div>
  )
}