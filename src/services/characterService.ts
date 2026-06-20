import { createClient } from '@/lib/supabase/client'

export async function getCharactersByTag(tagId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('characters')
    .select('*')
    .eq('tag_id', tagId)
    .order('name')
  return data ?? []
}

export async function searchCharacters(query: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('characters')
    .select('id, name, slug, tag_id, tags ( name )')
    .ilike('name', `%${query}%`)
    .limit(20)
  return data ?? []
}

export async function createCharacter(tagId: string, name: string, slug: string, parentCharacterId?: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('characters')
    .insert({ tag_id: tagId, name, slug, parent_character_id: parentCharacterId ?? null } as any)
  return !error
}

export async function updateCharacter(id: string, data: { name?: string; slug?: string }): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('characters').update(data as any).eq('id', id)
  return !error
}

export async function deleteCharacter(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('characters').delete().eq('id', id)
  return !error
}