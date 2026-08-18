import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  turbopack: {},
};

// 개발 모드에선 next-pwa를 아예 감싸지 않는다.
// (webpack dev에서 next-pwa가 /sw.js 킬스위치 SW를 등록 → 자기 새로고침 → 무한 리로드 방지)
// 배포(production) 빌드에서만 PWA 활성화.
const isDev = process.env.NODE_ENV === "development";

export default isDev
  ? nextConfig
  : withPWA({
      dest: "public",
      register: true,
      skipWaiting: true,
    })(nextConfig);
