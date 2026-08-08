import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { getActiveSession } from '@/lib/routeRun/sessionService'
import { requireUser, publicSession, publicVisit, publicCheckpoint } from '@/lib/routeRun/apiAuth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  const routeId = req.nextUrl.searchParams.get('routeId')
  if (!routeId) return NextResponse.json({ error: 'routeId 필요' }, { status: 400 })

  const svc = serviceClient()
  const r = await getActiveSession(svc, routeId, user.id)
  if (!r) return NextResponse.json({ session: null })
  return NextResponse.json({
    session: publicSession(r.session),
    visits: r.visits.map(publicVisit),
    checkpoints: ((r.session as any).checkpoints ?? []).map(publicCheckpoint),
  })
}
