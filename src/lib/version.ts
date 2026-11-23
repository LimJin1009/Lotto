// 버전 표시와 새 버전 알림
// 설치한 앱(PWA)은 켜 둔 채로 오래 쓰므로, 사이트에 새 버전이 올라오면 알려 준다.
import { useEffect, useState } from 'react';

declare const __BUILD_TIME__: string;

/** 이 화면을 만든 시각 (한국 시간, 예: "11.01 10:52") */
export function buildLabel(): string {
  const d = new Date(__BUILD_TIME__);
  const p = (n: number) => String(n).padStart(2, '0');
  const k = new Date(d.getTime() + 9 * 3600_000);
  return `${p(k.getUTCMonth() + 1)}.${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}

/** 첫 화면 HTML 안의 앱 파일 이름 (빌드마다 바뀜) */
export function scriptName(html: string): string | null {
  return html.match(/assets\/index-[\w-]+\.js/)?.[0] ?? null;
}

function currentScript(): string | null {
  const src = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/index-"]')?.getAttribute('src') ?? '';
  return scriptName(src);
}

/** 1분 안에 이미 자동 새로고침을 했으면 true (새로고침이 되풀이되지 않게) */
function reloadedJustNow(): boolean {
  try {
    const KEY = 'lotto.autoReload';
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return true;
    sessionStorage.setItem(KEY, String(Date.now()));
    return false;
  } catch {
    return true; // 기록을 못 남기면 자동 새로고침은 하지 않는다
  }
}

/** 사이트에 새 버전이 있으면 true */
export function useUpdateAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const mine = currentScript();
    if (!mine) return;
    let busy = false;
    const started = Date.now();

    const check = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const html = await (await fetch('./', { cache: 'no-cache' })).text();
        const latest = scriptName(html);
        if (latest && latest !== mine) {
          // 앱을 막 연 참이면(아직 아무것도 안 했을 때) 묻지 않고 바로 새 버전으로 바꾼다. 쓰는 중이면 알림 띠만 띄운다.
          if (Date.now() - started < 15_000 && !reloadedJustNow()) {
            location.reload();
            return;
          }
          setAvailable(true);
        }
        // 서비스 워커도 새것이 있는지 확인
        (await navigator.serviceWorker?.getRegistration())?.update().catch(() => {});
      } catch {
        /* 인터넷이 없으면 다음에 */
      } finally {
        busy = false;
      }
    };

    const first = setTimeout(check, 3000);
    const timer = setInterval(check, 5 * 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return available;
}
