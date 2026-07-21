// 문의 유형별 필드 정의 — 이 파일만 고치면 폼이 바뀐다.
// 나중에 DB 연결 시 이 구조를 그대로 contact_messages에 매핑.

export type FieldKey =
  | 'title' | 'content' | 'reproduce' | 'browser' | 'benefit'
  | 'company' | 'manager' | 'homepage'
  | 'rightsHolder' | 'targetUrl' | 'reason' | 'evidence'

export type FieldDef = {
  label: string
  placeholder?: string
  multiline?: boolean
  required?: boolean
}

export const FIELD_DEFS: Record<FieldKey, FieldDef> = {
  title:        { label: '제목', placeholder: '한 줄로 요약해 주세요', required: true },
  content:      { label: '문의 내용', placeholder: '자세히 적어주실수록 좋아요', multiline: true, required: true },
  reproduce:    { label: '재현 방법', placeholder: '어떤 순서로 하면 문제가 생기나요?', multiline: true },
  browser:      { label: '사용 환경', placeholder: '예: 크롬 / 아이폰 사파리 / 갤럭시' },
  benefit:      { label: '기대 효과', placeholder: '이 기능이 있으면 무엇이 좋아지나요?', multiline: true },
  company:      { label: '회사명', placeholder: '회사 또는 단체 이름' },
  manager:      { label: '담당자', placeholder: '담당자 성함' },
  homepage:     { label: '홈페이지', placeholder: 'https://' },
  rightsHolder: { label: '권리자명', placeholder: '권리를 가진 개인 또는 회사', required: true },
  targetUrl:    { label: '대상 URL', placeholder: '수정·삭제를 원하는 페이지 주소', required: true },
  reason:       { label: '요청 사유', placeholder: '권리 관계와 요청 내용을 적어주세요', multiline: true, required: true },
  evidence:     { label: '증빙 자료', placeholder: '증빙 링크가 있으면 적어주세요 (선택)' },
}

export type ContactType = {
  key: string
  label: string
  fields: FieldKey[]
  hint?: string
}

export const CONTACT_TYPES: ContactType[] = [
  { key: 'general',   label: '일반 문의',   fields: ['title', 'content'] },
  { key: 'bug',       label: '오류 신고',   fields: ['title', 'reproduce', 'browser', 'content'], hint: '어떤 화면에서 무슨 일이 있었는지 알려주시면 빠르게 고칠게요.' },
  { key: 'feature',   label: '기능 제안',   fields: ['title', 'content', 'benefit'] },
  { key: 'partner',   label: '제휴 문의',   fields: ['company', 'manager', 'homepage', 'content'] },
  { key: 'copyright', label: '저작권 문의', fields: ['title', 'content'] },
  { key: 'rights',    label: '권리자 요청', fields: ['rightsHolder', 'company', 'targetUrl', 'reason', 'evidence'], hint: '확인 후 수정 또는 삭제 등 필요한 조치를 신속히 진행합니다.' },
]