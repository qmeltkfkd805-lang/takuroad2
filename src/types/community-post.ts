export type Board =
  | 'free' | 'promo' | 'tips' | 'goods' | 'exchange' | 'companion'
  | 'fanart' | 'fancraft'
  | 'question' | 'info' // 레거시(탭 미노출)
export type PostSort = 'popular' | 'latest'
export type PostStatus = 'active' | 'hidden'
export type ReportReason = 'copy' | 'ai' | 'nsfw' | 'spam' | 'etc'

export interface BoardMeta {
  value: Board
  label: string
  desc: string
  tagRequired: boolean
  tagRecommended?: boolean
  imageRequired?: boolean
}

// 실제 사용 게시판 (작성 폼 선택지 = 이 순서)
export const BOARDS: BoardMeta[] = [
  { value: 'free',      label: '자유게시판',  desc: '자유롭게',                       tagRequired: false },
  { value: 'promo',     label: '홍보게시판',  desc: '내 채널·창작물·모임 홍보',        tagRequired: false },
  { value: 'tips',      label: '덕질 노하우',        desc: '덕질 꿀팁·정보 공유',            tagRequired: false },
  { value: 'goods',     label: '굿즈자랑',    desc: '내 굿즈 컬렉션 자랑',            tagRequired: false, tagRecommended: true },
  { value: 'exchange',  label: '교환&나눔',   desc: '굿즈 교환·나눔',                 tagRequired: false, tagRecommended: true },
  { value: 'companion', label: '덕메게시판',  desc: '이벤트·성지순례 동행',           tagRequired: false, tagRecommended: true },
  { value: 'fanart',    label: '팬아트',      desc: '직접 그린 그림',                 tagRequired: true, imageRequired: true },
  { value: 'fancraft',  label: '팬창작물',    desc: '직접 만든 창작물(피규어·레진·코스프레 소품 등)', tagRequired: true, imageRequired: true },
]

export const BOARD_LABEL: Record<string, string> = {
  free: '자유게시판', promo: '홍보게시판', tips: '덕질 노하우', goods: '굿즈자랑',
  exchange: '교환&나눔', companion: '덕메게시판', fanart: '팬아트', fancraft: '팬창작물',
  question: '질문&답변', info: '정보공유',
}

// 게시판별 말머리
export const BOARD_FLAIRS: Partial<Record<Board, string[]>> = {
  exchange: ['교환', '나눔', '구해요'],
}

export function boardMeta(board: string): BoardMeta | undefined {
  return BOARDS.find(b => b.value === board)
}

// 커뮤니티 상단 탭 구성 (창작게시판은 그룹 → 세부탭 팬아트/팬창작물)
export type CommunityNavItem =
  | { type: 'board'; board: Board; label: string }
  | { type: 'group'; label: string; boards: Board[] }

export const COMMUNITY_NAV: CommunityNavItem[] = [
  { type: 'board', board: 'free',      label: '자유게시판' },
  { type: 'board', board: 'promo',     label: '홍보게시판' },
  { type: 'board', board: 'tips',      label: '덕질 노하우' },
  { type: 'board', board: 'goods',     label: '굿즈자랑' },
  { type: 'board', board: 'exchange',  label: '교환&나눔' },
  { type: 'board', board: 'companion', label: '덕메게시판' },
  { type: 'group', label: '창작게시판', boards: ['fanart', 'fancraft'] },
]

// 창작 게시판(세부탭)
export const CREATION_BOARDS: Board[] = ['fanart', 'fancraft']

// 작품 상세에 탭으로 노출되는 게시판
export const WORK_TAB_BOARDS: Board[] = ['fanart', 'fancraft', 'goods']

// ── 신고 ──
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

// ── 엔티티 ──
export interface PostWorkRef { id: string; name: string; slug: string | null }
export interface PostAuthor { id: string; nickname: string; avatarUrl: string | null }

export interface CommunityPost {
  id: string
  board: Board
  tagId: string | null
  tagIds: string[]
  work: PostWorkRef | null
  author: PostAuthor | null
  title: string | null
  content: string | null
  images: string[]
  showOnWork: boolean
  isNotice: boolean
  isSpoiler: boolean
  flair: string | null
  visibility: 'public' | 'private'
  status: PostStatus
  hiddenReason: string | null
  hiddenBy: string | null
  viewCount: number
  likeCount: number
  commentCount: number
  likedByMe: boolean
  createdAt: string
}

export interface NewPost {
  board: Board
  tagIds: string[]
  title?: string | null
  content?: string | null
  images?: string[]
  showOnWork: boolean
  isNotice?: boolean
  noticeAll?: boolean
  spoiler?: boolean
  flair?: string | null
}

export interface PostComment {
  id: string
  author: PostAuthor | null
  content: string
  createdAt: string
  parentId: string | null
  likeCount: number
  likedByMe: boolean
  replies: PostComment[]
}

export interface NewAppeal {
  message?: string
  originalUrl?: string
  snsLinks?: string[]
  proofImages?: string[]
}

export interface ReportedPost {
  post: CommunityPost
  reportCount: number
  reasonCounts: Record<string, number>
  reports: { reason: string; content: string | null; createdAt: string }[]
}

export interface PostAppeal {
  id: string
  message: string | null
  originalUrl: string | null
  snsLinks: string[]
  proofImages: string[]
  status: string
  createdAt: string
}

// ── 커뮤니티 홈 사이드바 ──
export interface CommunityStats {
  totalPosts: number
  todayPosts: number
  todayComments: number
}
export interface TrendingTag {
  id: string
  name: string
  slug: string | null
  count: number
}

// ── 투표 ──
export type PollViewMode = 'after' | 'always' | 'ended'
export type PollEndMode = 'date' | 'count' | 'none'

export interface NewPoll {
  title: string
  multi: boolean
  anonymous: boolean
  viewMode: PollViewMode
  sortMode: 'number' | 'votes'
  endMode: PollEndMode
  endAt?: string | null
  maxParticipants?: number | null
  options: string[]
}

export interface PollOption {
  id: string
  label: string
  position: number
  voteCount: number
  votedByMe: boolean
}

export interface Poll {
  id: string
  title: string
  multi: boolean
  anonymous: boolean
  viewMode: PollViewMode
  sortMode: 'number' | 'votes'
  endMode: PollEndMode
  endAt: string | null
  maxParticipants: number | null
  closed: boolean
  totalVotes: number
  participants: number
  hasVoted: boolean
  canSeeResults: boolean
  options: PollOption[]
}
