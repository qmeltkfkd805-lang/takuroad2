import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const { data: profile } = await userSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  }

  const { table, id, field, value } = await request.json()

  if (!table || !id || !field) {
    return NextResponse.json({ error: '필수 값이 없어요' }, { status: 400 })
  }

  const ALLOWED_TABLES = ['shops', 'shop_products', 'shop_events']
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: '허용되지 않은 테이블이에요' }, { status: 400 })
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await adminSupabase
    .from(table)
    .update({ [field]: value })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}