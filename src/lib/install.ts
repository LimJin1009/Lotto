// 휴대폰에 앱으로 설치(홈 화면에 추가)하기
import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// 안드로이드 크롬이 "설치할 수 있음"을 알려주는 신호는 앱이 뜨자마자 오므로 바로 잡아 둔다
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export type Platform = 'installed' | 'kakao' | 'inapp' | 'ios' | 'ios-other' | 'android' | 'desktop';

export function detectPlatform(ua = navigator.userAgent): Platform {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) return 'installed';
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  if (/NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua)) return 'inapp';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|Whale/i.test(ua) ? 'ios-other' : 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  const platform = detectPlatform();
  return {
    platform,
    /** 버튼 한 번으로 바로 설치할 수 있는지 (안드로이드 크롬 등) */
    canPrompt: !!deferred,
    prompt: async (): Promise<boolean> => {
      if (!deferred) return false;
      const e = deferred;
      await e.prompt();
      const { outcome } = await e.userChoice;
      deferred = null;
      notify();
      return outcome === 'accepted';
    },
  };
}
