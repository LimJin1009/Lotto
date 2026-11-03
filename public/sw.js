// 로또 찐번호 서비스 워커: 한 번 연 화면은 인터넷이 없어도 열리게 저장해 둔다.
// - 화면(HTML): 인터넷 먼저 (브라우저 저장본도 건너뛰고 사이트에 새 버전을 물어봄), 안 되면 저장본
// - 같은 사이트의 파일(JS·CSS·아이콘): 저장본 먼저 (파일 이름에 버전이 붙어 있음)
// - 다른 사이트(당첨번호 데이터, 글꼴): 건드리지 않음
const CACHE = 'lotto-v3';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // 앱 첫 화면과 꿈 페이지를 각자 주소로 저장 (꿈 페이지가 앱 화면을 덮어쓰지 않게)
    // GitHub Pages가 HTML을 10분간 저장하라고 하므로, cache: 'no-cache'로 매번 새 버전인지 확인한다
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./'))),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// ── 당첨 알림 ──
// 서버는 내용 없는 알림만 보낸다. 받으면 서버에 문구를 물어보고 보여 준다.
const API = 'https://lotto-reviews.lottojjin.workers.dev';

self.addEventListener('push', (e) => {
  e.waitUntil(
    (async () => {
      let msg = { title: '🎉 로또 찐번호', body: '저장한 번호의 추첨 결과가 나왔어요. 눌러서 확인해 보세요.', url: '#/saved' };
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) {
          const res = await fetch(`${API}/api/push/inbox`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          if (res.ok) msg = { ...msg, ...(await res.json()) };
        }
      } catch {
        /* 문구를 못 가져오면 기본 문구로 */
      }
      await self.registration.showNotification(msg.title, {
        body: msg.body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: 'lotto-win',
        data: { url: msg.url },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(`./${e.notification.data?.url ?? '#/saved'}`, self.registration.scope).href;
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const mine = wins.find((w) => w.url.startsWith(self.registration.scope));
      if (mine) {
        await mine.focus();
        return mine.navigate(target).catch(() => {});
      }
      return self.clients.openWindow(target);
    })(),
  );
});
