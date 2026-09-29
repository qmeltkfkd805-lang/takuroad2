import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RouteBuilder from '@/components/route/RouteBuilder'

interface Props {
  params: Promise<{ token: string }>
}

export const metadata = {
  title: '루트 수정',
}

export default async function RouteEditPage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('routes')
    .select('id, user_id, is_shared, is_official, created_at, share_token')
    .eq('share_token', token)
    .maybeSingle()
  if (!data) notFound()
  const r = data as any
  return (
    <RouteBuilder
      mode="edit"
      editRouteId={r.id}
      editToken={token}
      ownerId={r.user_id}
      initialShared={!!r.is_shared}
      isOfficial={!!r.is_official}
      lastEdited={r.created_at}
    />
  )
}
