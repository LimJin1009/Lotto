// 당첨 알림: 알림을 켜면 추첨 전 회차에 저장한 번호를 서버(worker/src/push.mjs)에 맡겨 둔다.
// 추첨이 끝나면 서버가 맞춰 보고 5등 이상이면 휴대폰으로 알림을 보낸다.
import { useCallback, useEffect, useState } from 'react';
import { REVIEWS_API, VAPID_PUBLIC_KEY } from './config';
import { detectPlatform } from './install';
import type { SavedSet } from './types';

export type PushState = 'checking' | 'on' | 'off' | 'denied' | 'ios-install' | 'inapp' | 'unsupported';

const SYNC_KEY = 'lotto.push.synced';

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!REVIEWS_API && !!VAPID_PUBLIC_KEY;
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

async function currentSub(): Promise<PushSubscription | null> {
  return (await (await registration())?.pushManager.getSubscription()) ?? null;
}

export async function pushState(): Promise<PushState> {
  const p = detectPlatform();
  if (p === 'kakao' || p === 'inapp') return 'inapp';
  // 아이폰은 홈 화면에 추가한 앱에서만 알림을 받을 수 있다
  if ((p === 'ios' || p === 'ios-other') && !supported()) return 'ios-install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.permission === 'granted' && (await currentSub()) ? 'on' : 'off';
}

/** 서버에 맡길 번호: 아직 추첨 전인 회차에 저장한 번호 */
export function pendingSets(saved: SavedSet[], latestNo: number) {
  return saved.filter((s) => s.drawNo > latestNo).map((s) => ({ round: s.drawNo, nums: s.numbers }));
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${REVIEWS_API}/api/push/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

/** 번호가 바뀌었을 때만 서버에 다시 보낸다 */
export async function syncPush(saved: SavedSet[], latestNo: number, force = false): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return;
  const sub = await currentSub();
  if (!sub) return;
  const sets = pendingSets(saved, latestNo);
  const sig = `${sub.endpoint}|${JSON.stringify(sets)}`;
  try {
    if (!force && localStorage.getItem(SYNC_KEY) === sig) return;
  } catch {
    /* 기록을 못 읽으면 그냥 보냄 */
  }
  const res = await post('sync', { endpoint: sub.endpoint, sets });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '알림 설정을 저장하지 못했어요');
  try {
    localStorage.setItem(SYNC_KEY, sig);
  } catch {
    /* 다음에 다시 보내면 됨 */
  }
}

export async function enablePush(saved: SavedSet[], latestNo: number): Promise<PushState> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = (await registration()) ?? (await navigator.serviceWorker.ready);
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  if (!sub) return 'off';
  await syncPush(saved, latestNo, true);
  return 'on';
}

export async function disablePush(): Promise<void> {
  const sub = await currentSub();
  if (!sub) return;
  await post('unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
  try {
    localStorage.removeItem(SYNC_KEY);
  } catch {
    /* 무시 */
  }
}

/** 화면에서 쓰는 알림 상태 */
export function usePush(saved: SavedSet[], latestNo: number) {
  const [state, setState] = useState<PushState>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pushState().then(setState);
  }, []);

  const turnOn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setState(await enablePush(saved, latestNo));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : '알림을 켜지 못했어요');
      setState(await pushState());
    } finally {
      setBusy(false);
    }
  }, [saved, latestNo]);

  const turnOff = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await disablePush();
    } finally {
      setState(await pushState());
      setBusy(false);
    }
  }, []);

  return { state, busy, error, turnOn, turnOff };
}
