import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const baseDir = import.meta.dirname
nextEnv.loadEnvConfig(path.resolve(baseDir, '..', '..', '..'))
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase server environment variables are missing')
const supabase = createClient(url, key, { auth: { persistSession: false } })
const batchFiles = fs.readdirSync(baseDir).filter((name) => /^batch-\d{3}\.json$/.test(name)).sort()
const candidates = batchFiles.flatMap((name) => JSON.parse(fs.readFileSync(path.join(baseDir, name), 'utf8')))
const { data: existing, error } = await supabase.from('tags').select('name, slug, english_name, aliases')
if (error) throw error
const allowedGenres = new Set(['액션', '격투', '판타지', '모험', '학원', '일상', '가족', 'SF', '추리', '퍼즐', '로맨스', 'BL', 'GL', '코미디', '스포츠', '음악', '아이돌', '요리', '호러', '드라마', '마법소녀', '소년물', '로봇/메카', '19', '고어', '기타'])
const allowedTypes = new Set(['웹툰', '웹소설', '소설', '애니', '영화', '특촬', '만화', '버튜버', '캐릭터', '게임', '카드게임', '완구', '보컬로이드', '브랜드', '제작사'])
const norm = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, '').trim()
const duplicateValues = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
const existingValues = new Map()
for (const row of existing) for (const value of [row.name, row.english_name, ...(row.aliases ?? [])]) if (norm(value)) existingValues.set(norm(value), row.name)
const liveConflicts = []
for (const candidate of candidates) for (const value of [candidate.name, candidate.englishName, ...(candidate.aliases ?? [])]) {
  const hit = existingValues.get(norm(value))
  if (hit) liveConflicts.push(`${candidate.name}: ${value} -> ${hit}`)
}
const candidateValues = candidates.flatMap((candidate) => [candidate.name, candidate.englishName, ...(candidate.aliases ?? [])].filter(Boolean).map(norm))
const result = {
  batches: batchFiles.length, reviewed: candidates.length, existingRows: existing.length,
  liveConflicts: [...new Set(liveConflicts)], candidateValueDuplicates: duplicateValues(candidateValues),
  candidateSlugDuplicates: duplicateValues(candidates.map((item) => item.slug)),
  badGenres: candidates.filter((item) => item.genres.some((genre) => !allowedGenres.has(genre))).map((item) => item.name),
  badTypes: candidates.filter((item) => item.ipType.some((type) => !allowedTypes.has(type))).map((item) => item.name),
  over80: candidates.filter((item) => [...item.description].length > 80).map((item) => [item.name, [...item.description].length]),
  officialBlank: candidates.filter((item) => !item.officialUrl).map((item) => item.name),
}
console.log(JSON.stringify(result, null, 2))
if (result.liveConflicts.length || result.candidateValueDuplicates.length || result.candidateSlugDuplicates.length || result.badGenres.length || result.badTypes.length || result.over80.length) process.exitCode = 1
