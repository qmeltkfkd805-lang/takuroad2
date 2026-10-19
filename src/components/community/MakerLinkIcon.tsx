import { makerLinkLabel } from '@/lib/utils/dukmark'

/* 만든 사람 링크 아이콘 — 브랜드 로고는 다시 그리지 않고 사이트에 있는 실제 파일(public/icons)을 쓴다.
   (EventIcon 의 SNS_ICON, 루트 상세의 sourceIcon 과 같은 파일) 아이콘 파일이 없는 곳은 홈페이지 아이콘.
   덕마크 글쓰기의 링크 칩, 글 상세의 제작자 링크 버튼에서 쓴다. */
const ICON: Record<string, string> = {
  Instagram: '/icons/instargram.png',
  X: '/icons/X.png',
  YouTube: '/icons/youtube.png',
  Threads: '/icons/threads.png',
  '네이버 블로그': '/icons/naverblog.png',
  '네이버 카페': '/icons/navercafe.png',
  카카오: '/icons/kakao.png',
}

export default function MakerLinkIcon({ url, size = 14 }: { url: string; size?: number }) {
  const label = makerLinkLabel(url)
  return <img src={ICON[label] ?? '/icons/homepage.png'} alt="" aria-hidden width={size} height={size} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />
}
