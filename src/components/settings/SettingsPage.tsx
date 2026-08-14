'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import styles from './settings.module.css'

/* 계정 설정 홈 — DB 변경 없는 Phase 1. 실제로 동작하는 항목만 노출한다.
   (차단·세부알림·공개범위 세분화·위치·기기관리·데이터 다운로드·테마는 Phase 2에서 추가) */

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', kakao: 'Kakao', email: '이메일', apple: 'Apple' }

// ── 선형 아이콘 (모두 동일 스타일) ──
const svgProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const IconMail = () => <svg {...svgProps}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></svg>
const IconLink = () => <svg {...svgProps}><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></svg>
const IconChart = () => <svg {...svgProps}><path d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-6" /></svg>
const IconReport = () => <svg {...svgProps}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>
const IconDownload = () => <svg {...svgProps}><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" /></svg>
const IconNotice = () => <svg {...svgProps}><path d="M4 10v4h3l5 4V6l-5 4H4z" /><path d="M17 9a4 4 0 0 1 0 6" /></svg>
const IconChat = () => <svg {...svgProps}><path d="M4 5h16v11H9l-4 4V5z" /></svg>
const IconDoc = () => <svg {...svgProps}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 13h5M10 17h5" /></svg>
const IconLogout = () => <svg {...svgProps}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>
const IconUserX = () => <svg {...svgProps}><circle cx="9" cy="8" r="3.2" /><path d="M4 20a5 5 0 0 1 10 0" /><path d="m17 9 4 4m0-4-4 4" /></svg>
const IconLock = () => <svg {...svgProps}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
const IconBell = () => <svg {...svgProps}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10.5 20a2 2 0 0 0 3 0" /></svg>
const IconBulb = () => <svg {...svgProps}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3z" /></svg>
const Chevron = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
const CheckMini = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>

type Row = { icon: React.ReactNode; label: string; value?: string; href?: string; onClick?: () => void; danger?: boolean; static?: boolean }

export default function SettingsPage() {
  const router = useRouter()
  const { user, profile, loading, signOut } = useAuth()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading || !user || !profile) {
    return <div className={styles.page}><div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div></div>
  }

  const email = user.email ?? ''
  const provider = (user.app_metadata as any)?.provider as string | undefined
  const providerLabel = provider ? (PROVIDER_LABEL[provider] ?? provider) : '-'
  const identityCount = (user.identities?.length ?? 1)
  const verified = !!user.email_confirmed_at
  const year = new Date().getFullYear()

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/profile')
  }
  async function handleLogout() { await signOut(); router.push('/') }

  const groups: { title?: string; rows: Row[] }[] = [
    {
      title: '개인정보 · 알림',
      rows: [
        { icon: <IconLock />, label: '공개 범위', href: '/profile/settings/privacy' },
        { icon: <IconBell />, label: '알림 설정', href: '/profile/settings/notifications' },
        { icon: <IconUserX />, label: '차단 관리', href: '/profile/settings/blocked' },
      ],
    },
    {
      title: '데이터',
      rows: [
        { icon: <IconChart />, label: '내 활동 및 경험치', href: '/profile/activity' },
        { icon: <IconReport />, label: `${year} 타쿠로드 리포트`, href: `/profile/report/${year}` },
      ],
    },
    {
      title: '지원 및 정보',
      rows: [
        { icon: <IconNotice />, label: '공지사항 · 자주 묻는 질문', href: '/support/notice' },
        { icon: <IconChat />, label: '문의하기', href: '/support/contact' },
        { icon: <IconBulb />, label: '제안하기', href: '/support/suggest' },
        { icon: <IconDoc />, label: '약관 및 개인정보처리방침', href: '/policies/terms' },
      ],
    },
    {
      rows: [
        { icon: <IconLogout />, label: '로그아웃', onClick: handleLogout },
        // 계정 탈퇴: 현재 deleteAccount가 닉네임 익명화+로그아웃(재로그인 시 복구)일 뿐이라
        // 실제 탈퇴/비활성화가 아니므로 운영 UI에서 숨김. 진짜 삭제 RPC 구현 후 다시 노출.
      ],
    },
  ]

  const runRow = (r: Row) => { if (r.static) return; if (r.onClick) r.onClick(); else if (r.href) router.push(r.href) }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <button className={styles.back} onClick={goBack} aria-label="뒤로">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span className={styles.title}>계정 설정</span>
        </div>
      </div>

      <div className={styles.container}>
        {/* 계정 요약 — 누르면 프로필 편집으로 */}
        <button className={styles.summary} onClick={() => router.push('/profile/settings/profile')}>
          {profile.avatar_url
            ? <img className={styles.summaryAvatar} src={profile.avatar_url} alt="" />
            : <span className={styles.summaryAvatarPh}>{profile.nickname?.[0] ?? '?'}</span>}
          <span className={styles.summaryBody}>
            <span className={styles.summaryName}>
              {profile.nickname}
              {verified && <span className={styles.verifyBadge}><CheckMini />이메일 인증 완료</span>}
            </span>
            <span className={styles.summaryEmail}>{email}</span>
          </span>
          <span className={styles.summaryChev}><Chevron /></span>
        </button>

        {/* 로그인 정보 — 읽기 전용 (수정/이동 기능 없음) */}
        <div className={styles.group}>
          <div className={styles.groupLabel}>로그인 정보</div>
          <div className={styles.infoCard}>
            <div className={styles.infoRow}><span className={styles.infoKey}>이메일</span><span className={styles.infoVal}>{email || '-'}</span></div>
            <div className={styles.infoRow}><span className={styles.infoKey}>이메일 인증</span><span className={styles.infoVal}>{verified ? '인증 완료' : '미인증'}</span></div>
            <div className={styles.infoRow}><span className={styles.infoKey}>로그인 방식</span><span className={styles.infoVal}>{providerLabel}</span></div>
            <div className={styles.infoRow}><span className={styles.infoKey}>연결된 계정</span><span className={styles.infoVal}>{provider ? `${providerLabel} · ` : ''}{identityCount}개</span></div>
          </div>
        </div>

        {groups.map((g, gi) => (
          <div key={gi} className={styles.group}>
            {g.title && <div className={styles.groupLabel}>{g.title}</div>}
            <div className={styles.list}>
              {g.rows.map((r, ri) => (
                <button
                  key={ri}
                  className={`${styles.row}${r.static ? ' ' + styles.rowStatic : ''}${r.danger ? ' ' + styles.danger : ''}`}
                  onClick={() => runRow(r)}
                >
                  <span className={styles.rowIcon}>{r.icon}</span>
                  <span className={styles.rowLabel}>{r.label}</span>
                  {r.value && <span className={styles.rowValue}>{r.value}</span>}
                  {!r.static && <span className={styles.rowChev}><Chevron /></span>}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className={styles.version}>타쿠로드</div>
      </div>
    </div>
  )
}
