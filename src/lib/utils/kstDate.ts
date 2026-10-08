/* 한국 날짜(YYYY-MM-DD).
   new Date().toISOString().slice(0, 10) 은 UTC 날짜라서, 한국 시간 00:00~09:00 사이엔 "어제"가 나온다.
   그 시간대엔 어제 끝난 이벤트가 '진행 중'으로, 오늘 시작한 이벤트가 '예정'으로 보이고,
   방문 인증 날짜도 하루 전으로 저장됐다. 서버(Vercel, UTC)·브라우저 어디서 불러도 한국 날짜를 준다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 그 순간의 한국 날짜 */
export function kstDateStr(d: Date = new Date()): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** 오늘(한국) */
export function kstToday(): string {
  return kstDateStr(new Date())
}
