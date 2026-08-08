import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { setSessionStatus } from '@/lib/routeRun/sessionService'
import { requireUser } from '@/lib/routeRun/apiAuth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  const { sessionId } = await req.json().catch(() => ({}))
  if (!sessionId) return NextResponse.json({ error: 'sessionId 필요' }, { status: 400 })
  const r = await setSessionStatus(serviceClient(), sessionId, user.id, 'active')
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ status: r.status })
}
