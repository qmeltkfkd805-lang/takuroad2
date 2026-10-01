import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/* GPS 자동 방문 확인은 쓰지 않는다 (2026-10-01).
   방문은 직접 체크로만 남기고, 이용자 위치는 서버로 받지 않는다.
   예전 화면이 보내는 요청이 와도 위치를 읽지 않고 그대로 돌려보낸다. */
export async function POST() {
  return NextResponse.json({ ok: true, confirmed: [], disabled: true })
}
