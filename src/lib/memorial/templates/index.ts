import { MemorialKind, MemorialTemplate } from '../types'
import { routeComplete } from './routeComplete'

export const TEMPLATES: Partial<Record<MemorialKind, MemorialTemplate>> = {
  'route-complete': routeComplete,
}
