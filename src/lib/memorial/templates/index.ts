import { MemorialKind, MemorialTemplate } from '../types'
import { route } from './route'
import { collection } from './collection'

export const TEMPLATES: Partial<Record<MemorialKind, MemorialTemplate>> = {
  route,
  collection,
}
