/* 불러오는 중 화면 — 타쿠로드 로고(TAKUROAD 글자 로고)가 살짝 통통 튀고, 아래에 안내 문구
   size: page = 화면 전체(첫 로딩·페이지 이동) / md = 페이지 본문 자리 / sm = 목록·탭·모달 안
   로고 이미지는 가벼운 480px 버전(public/brand/takuroad-loading.png, 원본 takuroad-logo.png 에서 여백 자르고 줄임) */
import s from './LogoLoader.module.css'

export default function LogoLoader({ text = '불러오는 중…', size = 'md' }: { text?: string; size?: 'page' | 'md' | 'sm' }) {
  return (
    <div className={`${s.wrap} ${s[size]}`} role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={s.logo} src="/brand/takuroad-loading.png" alt="" aria-hidden width={480} height={141} />
      {text && <span className={s.text}>{text}</span>}
    </div>
  )
}
