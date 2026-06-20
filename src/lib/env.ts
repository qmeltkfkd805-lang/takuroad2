export const env = {
  supabase: {
    url:     process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },
  kakao: {
    appKey: process.env.NEXT_PUBLIC_KAKAO_APP_KEY ?? '42255d70b37fcf98f7f82cbffcc71771',
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://takuroad.jonjonnni.com',
  },
} as const

