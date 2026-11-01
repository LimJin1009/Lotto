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

/** 사이트에 새 버전이 있으면 true */
export function useUpdateAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const mine = currentScript();
    if (!mine) return;
    let busy = false;

    const check = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const html = await (await fetch('./', { cache: 'no-cache' })).text();
        const latest = scriptName(html);
        if (latest && latest !== mine) setAvailable(true);
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
