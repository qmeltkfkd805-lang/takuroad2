import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // 우리가 쓴 코드가 아닌 것들 — 검사할 이유가 없다.
    // (빼기 전에는 전체 문제 6,300여 건 중 4,500건 넘게 여기서 나왔다)
    "src/tmp/**",              // 스크래치: 미니파이된 번들, 브라우저 확장 프로그램 복사본
    "src/scripts/**/*.json",   // 스크립트가 남긴 백업 스냅샷
    "public/sw.js",            // next-pwa가 빌드 때 생성
    "public/workbox-*.js",     // next-pwa가 빌드 때 생성
  ]),
]);

export default eslintConfig;
