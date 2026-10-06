'use client'

/* 목록·카드용 사진 — 원본 대신 작은 썸네일을 먼저 쓴다 (Supabase 전송량 절약).
   썸네일이 아직 없으면 원본으로 바꿔 보여주고, 서버(/api/thumb)에 한 번 만들어 달라고 부탁한다.
   다음에 보는 사람부터는 썸네일이 나간다. 일반 <img> 처럼 쓰면 된다. */
import { useEffect, useState } from 'react'
import { thumbUrl } from '@/lib/utils/thumb'

const requested = new Set<string>()   // 같은 사진을 여러 번 부탁하지 않게

export function requestThumb(original: string) {
  if (requested.has(original)) return
  requested.add(original)
  try {
    fetch('/api/thumb', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: original }),
      keepalive: true,
    }).catch(() => {})
  } catch { /* noop */ }
}

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string }

export default function ThumbImg({ src, onError, ...rest }: Props) {
  const thumb = thumbUrl(src)
  const [cur, setCur] = useState(thumb ?? src)
  useEffect(() => { setCur(thumbUrl(src) ?? src) }, [src])

  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      {...rest}
      src={cur}
      onError={e => {
        if (thumb && cur === thumb) {   // 썸네일이 아직 없음 → 원본으로, 그리고 만들어 달라고
          setCur(src)
          requestThumb(src)
          return
        }
        onError?.(e)
      }}
    />
  )
}
