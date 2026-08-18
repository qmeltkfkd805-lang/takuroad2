/* 자기 제거용 서비스워커 (kill-switch) — 조용히 정리(강제 새로고침 없음).
   예전 next-pwa 빌드에서 등록됐던 서비스워커/캐시를 비우고 스스로 등록 해제한다.
   ⚠️ 이전 버전은 activate 때 열린 창을 새로고침(clients.navigate)했는데,
      등록이 반복되는 상황에서 "새로고침 → 재등록 → 새로고침" 무한 루프를 만들었다.
      그래서 강제 새로고침 로직을 제거했다. 정리 후 사용자가 다음에 새로고침할 때 깨끗한 상태가 된다.
   서비스워커가 없던 기기에서는 등록되지 않으므로 아무 영향이 없다.
   ⚠️ 나중에 실제 PWA 서비스워커를 다시 쓰려면 이 파일을 지우고 next-pwa SW 생성을 활성화해야 한다. */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* noop */ }
    try {
      await self.registration.unregister();
    } catch (e) { /* noop */ }
    // ⚠️ 창을 강제로 새로고침하지 않는다(무한 리로드 원인 제거).
  })());
});
