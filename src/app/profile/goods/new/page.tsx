'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// 굿즈 등록은 커뮤니티 굿즈자랑 글쓰기 화면(/community/write?board=goods)을 그대로 사용
function NewGoodsRedirect() {
  const router = useRouter()
  const sp = useSearchParams()
  useEffect(() => {
    const work = sp.get('work')
    const q = new URLSearchParams({ board: 'goods' })
    if (work) { q.set('tag', work); q.set('lockTag', '1') }
    router.replace(`/community/write?${q.toString()}`)
  }, [router, sp])
  return null
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewGoodsRedirect />
    </Suspense>
  )
}
