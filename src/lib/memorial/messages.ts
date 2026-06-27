import { MemorialKind, MemorialData, TYPE_CATEGORY } from './types'

export interface MessageVars {
  region?: string
  routeName?: string
  shopCount?: number
  walkTime?: number
  category?: string
}

export function varsFromData(data: MemorialData): MessageVars {
  return {
    region: data.area,
    routeName: data.routeName,
    shopCount: data.shopCount,
    walkTime: data.walkTime,
    category: data.type ? TYPE_CATEGORY[data.type] : undefined,
  }
}

const MAIN: Record<MemorialKind, string[]> = {
  'route-complete': [
    '또 하나의 여정을 완성했습니다.',
    '오늘의 여행을 무사히 마쳤습니다.',
    '새로운 추억이 하나 더 생겼습니다.',
    '발자국 하나를 더 남겼습니다.',
    '다음 여행도 기다리고 있습니다.',
    '오늘도 한 걸음 더 나아갔습니다.',
  ],
  'collection-complete': [
    '모든 도장을 모았습니다.',
    '컬렉션이 완성되었습니다.',
    '빈 페이지 하나가 채워졌습니다.',
    '오래 기다린 마지막 도장입니다.',
  ],
  'first-checkin': [
    '새로운 여행이 시작되었습니다.',
    '첫 발자국을 남겼습니다.',
    '여기에서 모든 것이 시작됩니다.',
  ],
  'year-report': [
    '한 해의 여정을 돌아봅니다.',
    '올해도 많은 곳을 여행했습니다.',
  ],
}

const SUB: Record<MemorialKind, string[]> = {
  'route-complete': [
    '{walkTime}분 동안\n{region}의 {category} {shopCount}곳을 모두 여행했습니다.',
    '{region}의 {category} {shopCount}곳을\n모두 돌아봤습니다.',
    '{shopCount}개의 발자국을\n{region}에 남겼습니다.',
    '{region} 랠리를 완주했습니다.',
    '{routeName}을(를)\n무사히 완주했습니다.',
    '{walkTime}분의 여행,\n{shopCount}곳의 추억.',
  ],
  'collection-complete': [
    '{region}의 모든 곳을\n빠짐없이 모았습니다.',
    '{shopCount}개의 도장이\n하나의 컬렉션이 되었습니다.',
    '{region} 컬렉션을\n완성했습니다.',
  ],
  'first-checkin': [
    '{region}에서\n첫 여행을 시작했습니다.',
    '{routeName}에서\n첫 발자국을 남겼습니다.',
  ],
  'year-report': [
    '올해 {shopCount}곳을\n여행했습니다.',
  ],
}

function seedFromRallyNo(rallyNo: string): number {
  const digits = rallyNo.replace(/\D/g, '')
  if (digits) return parseInt(digits, 10)
  let s = 0
  for (const ch of rallyNo) s += ch.charCodeAt(0)
  return s
}

function fillVars(template: string, vars: MessageVars): string | null {
  const needed = template.match(/\{(\w+)\}/g) ?? []
  for (const token of needed) {
    const key = token.slice(1, -1) as keyof MessageVars
    if (vars[key] === undefined || vars[key] === '') return null
  }
  return template
    .replace(/\{region\}/g, String(vars.region ?? ''))
    .replace(/\{routeName\}/g, String(vars.routeName ?? ''))
    .replace(/\{shopCount\}/g, String(vars.shopCount ?? ''))
    .replace(/\{walkTime\}/g, String(vars.walkTime ?? ''))
    .replace(/\{category\}/g, String(vars.category ?? ''))
}

export function pickMainMessage(kind: MemorialKind, rallyNo: string): string {
  const pool = MAIN[kind] ?? []
  if (!pool.length) return ''
  return pool[seedFromRallyNo(rallyNo) % pool.length]
}

export function pickSubMessage(kind: MemorialKind, rallyNo: string, vars: MessageVars): string[] {
  const raw = SUB[kind] ?? []
  const usable = raw.map((t) => fillVars(t, vars)).filter((v): v is string => v !== null)
  if (!usable.length) return []
  const chosen = usable[seedFromRallyNo(rallyNo) % usable.length]
  return chosen.split('\n')
}
