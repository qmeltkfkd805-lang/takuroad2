import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..', '..', '..')
nextEnv.loadEnvConfig(projectRoot)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const allowedGenres = new Set(['액션','격투','판타지','모험','학원','일상','가족','SF','추리','로맨스','BL','GL','코미디','스포츠','음악','아이돌','요리','호러','드라마','마법소녀','소년물','로봇/메카','19','고어','기타'])
const allowedTypes = new Set(['애니','게임','캐릭터','버튜버','웹툰','웹소설','만화','영화','드라마','소설','라이트노벨','음악','아이돌','웹드라마','방송','예능','스포츠','브랜드','기타'])
const norm = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, '').trim()

async function fetchAllTags() {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('tags').select('name,english_name,aliases,slug').order('name').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

const files = (await readdir(here)).filter((name) => /^batch-\d{3}\.json$/.test(name)).sort()
const candidates = []
for (const file of files) candidates.push(...JSON.parse(await readFile(resolve(here, file), 'utf8')))
const existing = await fetchAllTags()
const existingValues = new Map()
for (const row of existing) for (const value of [row.name, row.english_name, ...(row.aliases ?? [])]) if (norm(value)) existingValues.set(norm(value), row.name)
const candidateValues = new Map()
const valueDuplicates = []
for (const row of candidates) for (const value of [row.name, row.englishName, ...(row.aliases ?? [])]) {
  if (!norm(value)) continue
  const previous = candidateValues.get(norm(value))
  if (previous && previous !== row.name) valueDuplicates.push(`${row.name}: ${value} -> ${previous}`)
  candidateValues.set(norm(value), row.name)
}
const result = {
  batches: files.length,
  reviewed: candidates.length,
  existingRows: existing.length,
  liveConflicts: [...new Set(candidates.flatMap((row) => [row.name, row.englishName, ...(row.aliases ?? [])].filter((value) => norm(value) && existingValues.has(norm(value))).map((value) => `${row.name}: ${value} -> ${existingValues.get(norm(value))}`)))],
  candidateValueDuplicates: [...new Set(valueDuplicates)],
  candidateSlugDuplicates: [...new Set(candidates.map((row) => row.slug).filter((slug, index, all) => all.indexOf(slug) !== index))],
  badGenres: candidates.filter((row) => row.genres.some((genre) => !allowedGenres.has(genre))).map((row) => `${row.name}: ${row.genres.join(',')}`),
  badTypes: candidates.filter((row) => row.ipType.some((type) => !allowedTypes.has(type))).map((row) => `${row.name}: ${row.ipType.join(',')}`),
  over80: candidates.filter((row) => [...row.description].length > 80).map((row) => `${row.name}: ${[...row.description].length}`),
  officialBlank: candidates.filter((row) => !row.officialUrl).map((row) => row.name),
}
console.log(JSON.stringify(result, null, 2))
if (existing.length !== 1380 || result.liveConflicts.length || result.candidateValueDuplicates.length || result.candidateSlugDuplicates.length || result.badGenres.length || result.badTypes.length || result.over80.length) process.exitCode = 1
