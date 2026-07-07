export type FanArtStatus = 'active' | 'hidden'
export type FanArtSort = 'popular' | 'latest'

export interface FanArtWorkRef {
  id: string
  name: string
  slug: string | null
}

export interface FanArtAuthor {
  id: string
  nickname: string
  avatarUrl: string | null
}

export interface FanArt {
  id: string
  tagId: string
  work: FanArtWorkRef | null
  author: FanArtAuthor | null
  title: string | null
  description: string | null
  imageUrl: string
  showInGallery: boolean
  status: FanArtStatus
  viewCount: number
  likeCount: number
  likedByMe: boolean
  hiddenReason: string | null
  hiddenBy: string | null
  createdAt: string
}

export interface NewFanArt {
  tagId: string
  title?: string | null
  description?: string | null
  imageUrl: string
  showInGallery: boolean
}

// ── 신고 / 이의제기 ──
export type ReportReason = 'copy' | 'ai' | 'nsfw' | 'spam' | 'etc'

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'copy', label: '도용 의심' },
  { value: 'ai', label: 'AI 의심' },
  { value: 'nsfw', label: '음란/혐오' },
  { value: 'spam', label: '스팸' },
  { value: 'etc', label: '기타' },
]

export const REASON_LABEL: Record<string, string> = {
  copy: '도용 의심', ai: 'AI 의심', nsfw: '음란/혐오', spam: '스팸', etc: '기타',
}

export interface NewAppeal {
  message?: string
  originalUrl?: string
  snsLinks?: string[]
  proofImages?: string[]
}

export interface ReportedFanArt {
  art: FanArt
  reportCount: number
  reasonCounts: Record<string, number>
  reports: { reason: string; content: string | null; createdAt: string }[]
}

export interface FanArtAppeal {
  id: string
  message: string | null
  originalUrl: string | null
  snsLinks: string[]
  proofImages: string[]
  status: string
  createdAt: string
}
