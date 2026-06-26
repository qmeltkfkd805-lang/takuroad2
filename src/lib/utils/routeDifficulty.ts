export type RouteDifficultyLevel = 'light' | 'half' | 'full'

export interface RouteDifficulty {
  level: RouteDifficultyLevel
  label: string
  dots: number
  color: string
}

export function getRouteDifficulty(durationMin: number | null | undefined): RouteDifficulty | null {
  if (durationMin == null) return null
  if (durationMin <= 30) return { level: 'light', label: '가볍게', dots: 1, color: '#0E7A63' }
  if (durationMin <= 60) return { level: 'half', label: '반나절', dots: 2, color: '#835700' }
  return { level: 'full', label: '하루코스', dots: 3, color: '#A23E18' }
}

const DOT_COLOR: Record<RouteDifficultyLevel, string> = {
  light: '#6EDCCA',
  half: '#F5B100',
  full: '#FF8B66',
}

export function difficultyDotColor(level: RouteDifficultyLevel): string {
  return DOT_COLOR[level]
}
