'use client'
/* 가입 전 동의사항 — 필수 4개(이용약관 · 개인정보 수집·이용 · 국외이전 · 만 14세 이상) + 선택 1개(이벤트·새 소식 알림)
 * /profile/setup(새 회원)과 /consent(기존 회원 · 동의 내용이 바뀌었을 때)에서 같이 쓴다.
 * ⚠️ 문구를 바꾸면 lib/consent.ts 의 CONSENT_VERSION 을 올리고, 개인정보처리방침(/policies/privacy)도 같이 고친다. */
import { useState } from 'react'
import s from './ConsentChecklist.module.css'

export type ConsentValue = { terms: boolean; privacy: boolean; overseas: boolean; age14: boolean; marketing: boolean }
export const EMPTY_CONSENT: ConsentValue = { terms: false, privacy: false, overseas: false, age14: false, marketing: false }
export const requiredDone = (v: ConsentValue) => v.terms && v.privacy && v.overseas && v.age14

/** 아직 체크 안 한 필수 항목 이름 — 버튼이 왜 안 눌리는지 알려줄 때 */
export const missingRequired = (v: ConsentValue): string[] => [
  !v.terms && '이용약관',
  !v.privacy && '개인정보 수집·이용',
  !v.overseas && '개인정보 국외이전',
  !v.age14 && '만 14세 이상 확인',
].filter(Boolean) as string[]

type Key = keyof ConsentValue

const Check = ({ on }: { on: boolean }) => (
  <span className={on ? `${s.check} ${s.checkOn}` : s.check} aria-hidden>
    {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17l9-10" /></svg>}
  </span>
)
const ExtIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>
)

function Detail({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={s.more} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        내용 {open ? '접기' : '보기'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && <div className={s.detail}>{children}</div>}
    </>
  )
}

// 한 줄 — 컴포넌트를 바깥에 둬야 다시 그릴 때 '내용 보기' 펼침 상태가 유지된다
function Row({ on, onToggle, required, children, extra }: { on: boolean; onToggle: () => void; required: boolean; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className={s.item}>
      <button type="button" className={s.row} onClick={onToggle} role="checkbox" aria-checked={on}>
        <Check on={on} />
        <span className={s.label}>{required ? <b>(필수)</b> : <span className={s.opt}>(선택)</span>} {children}</span>
      </button>
      {extra && <div className={s.extra}>{extra}</div>}
    </div>
  )
}

export default function ConsentChecklist({ value, onChange }: { value: ConsentValue; onChange: (v: ConsentValue) => void }) {
  const set = (k: Key, on: boolean) => onChange({ ...value, [k]: on })
  const allReq = requiredDone(value)
  const toggleAllReq = () => onChange({ ...value, terms: !allReq, privacy: !allReq, overseas: !allReq, age14: !allReq })

  const row = (k: Key) => ({ on: value[k], onToggle: () => set(k, !value[k]) })

  return (
    <section className={s.wrap} aria-label="가입 전 동의사항">
      <h2 className={s.title}>가입 전 동의사항</h2>

      <button type="button" className={`${s.item} ${s.all}`} onClick={toggleAllReq} role="checkbox" aria-checked={allReq}>
        <span className={s.row} style={{ padding: 0 }}>
          <Check on={allReq} />
          <span className={s.label}><b>필수 항목 모두 동의</b></span>
        </span>
      </button>

      <Row {...row('terms')} required extra={
        <a className={s.link} href="/policies/terms" target="_blank" rel="noopener noreferrer">이용약관 전문 <ExtIcon /></a>
      }>서비스 이용약관에 동의합니다.</Row>

      <Row {...row('privacy')} required extra={<>
        <Detail>
          <dl className={s.dl}>
            <dt>수집 항목</dt>
            <dd>이메일, 닉네임, 소셜 로그인 계정 식별 정보(카카오·구글), 서비스 이용 기록(후기·게시글·방문 기록·저장·루트), 접속 기록(IP 주소, 브라우저·기기 정보, 쿠키)</dd>
            <dt>이용 목적</dt>
            <dd>회원 식별과 로그인, 후기·커뮤니티·방문 기록·루트 등 서비스 제공, 부정 이용 방지와 보안, 문의 응대, 꼭 필요한 공지 전달</dd>
            <dt>보유 기간</dt>
            <dd>회원 탈퇴 시까지. 관계 법령에서 보관하도록 정한 정보는 그 기간 동안 보관한 뒤 파기합니다.</dd>
          </dl>
          <p className={s.note}>동의를 거부할 수 있지만, 필수 항목이라 거부하면 가입할 수 없어요.</p>
        </Detail>
        <a className={s.link} href="/policies/privacy" target="_blank" rel="noopener noreferrer">개인정보처리방침 전문 <ExtIcon /></a>
      </>}>개인정보 수집·이용에 동의합니다.</Row>

      <Row {...row('overseas')} required extra={
        <Detail>
          <p className={s.p}>타쿠로드는 해외 클라우드 서비스를 이용해 운영되어, 회원 정보가 아래와 같이 국외에서 저장·처리됩니다.</p>
          <dl className={s.dl}>
            <dt>이전받는 자 (국가)</dt>
            <dd>Supabase Inc. (미국) — 회원 인증, 데이터베이스·사진 파일 저장<br />Vercel Inc. (미국) — 웹사이트 운영·서버 처리</dd>
            <dt>이전 항목</dt>
            <dd>위 &lsquo;개인정보 수집·이용&rsquo;의 항목 전체</dd>
            <dt>이전 시기·방법</dt>
            <dd>서비스를 이용할 때마다 암호화된 네트워크로 전송되어 저장·처리됩니다.</dd>
            <dt>보유 기간</dt>
            <dd>회원 탈퇴 또는 해당 업체와의 이용 계약이 끝날 때까지</dd>
          </dl>
          <p className={s.note}>동의를 거부할 수 있지만, 서비스 운영에 꼭 필요해 거부하면 가입할 수 없어요.</p>
        </Detail>
      }>클라우드 이용을 위한 개인정보 국외이전에 동의합니다.</Row>

      <Row {...row('age14')} required>만 14세 이상입니다.</Row>

      <Row {...row('marketing')} required={false} extra={<>
        <Detail>
          <dl className={s.dl}>
            <dt>수집 항목</dt>
            <dd>이메일, 닉네임</dd>
            <dt>이용 목적</dt>
            <dd>새 이벤트·팝업 소식, 새 기능과 혜택 안내</dd>
            <dt>보유 기간</dt>
            <dd>동의를 철회하거나 회원 탈퇴할 때까지</dd>
          </dl>
        </Detail>
        <p className={s.optNote}>선택 항목은 동의하지 않아도 가입할 수 있어요. 동의한 경우에만 소식을 보내드리고, 언제든 철회할 수 있어요.</p>
      </>}>이벤트·새 소식 알림 수신에 동의합니다.</Row>
    </section>
  )
}
