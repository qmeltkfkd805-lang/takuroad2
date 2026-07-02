import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const ALLOWED: Record<string, string[]> = {
  tags: ['name', 'english_name', 'slug', 'ip_type', 'release_year', 'genres', 'description', 'cover_url', 'banner_image'],
  featured_banners: ['title', 'subtitle', 'image_url', 'cta_label', 'cta_href', 'cta_label2', 'cta_href2', 'bg_color', 'text_color', 'sort_order', 'is_active'],
}

export async function POST(request: NextRequest) {
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  const { data: profile } = await userSupabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })

  const { table, id, fields, action = 'update' } = await request.json()
  if (!table || !ALLOWED[table]) return NextResponse.json({ error: '허용되지 않은 테이블이에요' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const allowedCols = ALLOWED[table]
  const clean: Record<string, any> = {}
  for (const key of Object.keys(fields ?? {})) { if (allowedCols.includes(key)) clean[key] = fields[key] }

  try {
    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'id가 필요해요' }, { status: 400 })
      const { error } = await admin.from(table).delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }
    if (action === 'insert') {
      const { data, error } = await admin.from(table).insert(clean).select().single()
      if (error) throw error
      return NextResponse.json({ success: true, row: data })
    }
    if (!id) return NextResponse.json({ error: 'id가 필요해요' }, { status: 400 })
    if (Object.keys(clean).length === 0) return NextResponse.json({ error: '수정할 값이 없어요' }, { status: 400 })
    const { data, error } = await admin.from(table).update(clean).eq('id', id).select().single()
    if (error) throw error
    return NextResponse.json({ success: true, row: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? '알 수 없는 오류' }, { status: 500 })
  }
}
