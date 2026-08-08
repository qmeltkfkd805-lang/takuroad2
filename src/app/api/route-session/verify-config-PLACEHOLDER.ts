import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { fetchVerifyConfig } from '@/lib/routeRun/configServer'
import { clientSafeConfig } from '@/lib/routeRun/config'

export const runtime = 'nodejs'

// 클라이언트엔 UI용 비민감 설정만. 실제 판정은 서버가 DB값으로 수행.
export async function GET() {
  const cfg = await fetchVerifyConfig(serviceClient())
  return NextResponse.json(clientSafeConfig(cfg))
}
