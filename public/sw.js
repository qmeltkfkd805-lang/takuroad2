/* 자기 제거용 서비스워커 (kill-switch)
   예전 next-pwa 빌드에서 등록됐던 서비스워커가 남아 예전 화면을 캐시하는 문제를 정리한다.
   낡은 SW가 이 스크립트로 업데이트되면 캐시를 모두 비우고 스스로 등록 해제한 뒤 열린 창을 새로고침한다.
   서비스워커가 없던 기기에서는 등록되지 않으므로 아무 영향이 없다.
   ⚠️ 나중에 실제 PWA 서비스워커를 다시 쓰려면 이 파일을 지우고 SW 생성을 활성화해야 한다. */
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
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => { try { c.navigate(c.url); } catch (e) { /* noop */ } });
    } catch (e) { /* noop */ }
  })());
});
