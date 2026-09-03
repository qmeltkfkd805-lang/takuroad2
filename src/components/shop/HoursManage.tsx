'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { updateShopFields } from '@/services/shopService'
import { ROUTES } from '@/lib/constants/routes'
import { BusinessHours } from '@/types/database'
import { Shop } from '@/types/shop'
import ShopHoursEditor, { HOURS_HINT } from './ShopHoursEditor'
import styles from './hoursManage.module.css'

/* 사장님 매장 관리 > 영업시간.

   편집 UI는 샵 등록 위저드와 같은 ShopHoursEditor를 쓴다. 예전에는 여기에
   요일 on/off와 시작·종료 시간만 있는 별개 구현이 있어서, 일괄 적용·선택 요일 적용·
   공휴일 휴무·연중무휴·휴게시간을 사장님은 쓸 수 없었다.

   저장은 기존 그대로 updateShopFields — hours만 부분 갱신하고 다른 필드는 안 건드린다. */

export default function HoursManage({ shop }: { shop: Shop }) {
  const { user } = useAuth()
  const router = useRouter()
  const [hours, setHours] = useState<BusinessHours>(shop.hours ?? {})
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!user || saving) return
    setSaving(true)
    const ok = await updateShopFields(shop.id, { hours }, user.id)
    if (!ok) {
      setSaving(false)
      alert('저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    // 저장하면 매장 화면으로 — 바뀐 영업시간이 실제로 어떻게 보이는지 바로 확인한다.
    // saving은 그대로 둔다. 이동하는 사이 버튼이 다시 눌리지 않게.
    router.push(ROUTES.shop(shop.slug))
    router.refresh()   // 매장 페이지는 서버에서 그리므로 캐시를 비워야 새 값이 보인다
  }

  return (
    <div className={styles.wrap}>
      <Link href={`/shop/${shop.slug}/manage`} className={styles.back}>← 매장 관리</Link>
      <h1 className={styles.title}>영업시간</h1>
      <p className={styles.desc}>{HOURS_HINT}</p>

      <ShopHoursEditor value={hours} onChange={setHours} />

      <button className={styles.saveBtn} onClick={save} disabled={saving}>
        {saving ? '저장 중…' : '저장하기'}
      </button>
    </div>
  )
}
