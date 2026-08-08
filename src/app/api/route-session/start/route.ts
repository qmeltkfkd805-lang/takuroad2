import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { fetchVerifyConfig } from '@/lib/routeRun/configServer'
import { clientSafeConfig } from '@/lib/routeRun/config'
import { createOrResumeSession } from '@/lib/routeRun/sessionService'
import { requireUser, publicSession, publicVisit, publicCheckpoint } from '@/lib/routeRun/apiAuth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  const { routeId } = await req.json().catch(() => ({}))
  if (!routeId || typeof routeId !== 'string') return NextResponse.json({ error: 'routeId 필요' }, { status: 400 })

  const svc = serviceClient()
  const cfg = await fetchVerifyConfig(svc)
  const r = await createOrResumeSession(svc, routeId, user.id, cfg)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.error === 'route_not_found' ? 404 : 400 })

  return NextResponse.json({
    session: publicSession(r.session),
    visits: r.visits.map(publicVisit),
    checkpoints: ((r.session as any).checkpoints ?? []).map(publicCheckpoint),
    resumed: r.resumed,
    config: clientSafeConfig(cfg),
  })
}
