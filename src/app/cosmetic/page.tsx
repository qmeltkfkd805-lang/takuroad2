import { redirect } from 'next/navigation'

/* 프로필 꾸미기(프레임·배경·효과)는 없앴다 (2026-10).
   남은 칭호·대표 배지·최애 작품은 프로필 수정에서 고른다 — 옛 링크는 그리로 보낸다. */
export default function Page() {
  redirect('/profile/settings/profile')
}
