// 당첨 인증 후기: 맥미니 후기 서버(server/reviews-server.mjs)에 읽고 쓴다
import { REVIEWS_API } from './config';

export const reviewsEnabled = Boolean(REVIEWS_API);

export interface Review {
  id: string;
  created_at: string;
  round: number;
  rank: number;
  game_label: string;
  game_type: string;
  numbers: number[];
  nickname: string;
  content: string;
  method: string | null;
}

export type RankFilter = 'all' | 'top' | 4 | 5;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${REVIEWS_API.replace(/\/$/, '')}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new Error('후기 서버에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body as { message?: string } | null)?.message ?? '후기 서버에 문제가 생겼어요. 잠시 뒤 다시 해 주세요.');
  return body as T;
}

export const PAGE_SIZE = 20;

export function listReviews(filter: RankFilter, offset: number): Promise<Review[]> {
  return call<Review[]>(`/api/reviews?rank=${filter}&offset=${offset}`);
}

export async function reviewStats(): Promise<Record<number, number>> {
  return call<Record<number, number>>('/api/stats');
}

export function submitReview(input: { qr: string; game: string; nickname: string; content: string; method?: string | null }): Promise<Review> {
  return call<Review>('/api/reviews', { method: 'POST', body: JSON.stringify(input) });
}

const NICK_KEY = 'lotto.nickname.v1';
export function savedNickname(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? '';
  } catch {
    return '';
  }
}
export function rememberNickname(n: string) {
  try {
    localStorage.setItem(NICK_KEY, n);
  } catch {
    /* 무시 */
  }
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}일 전`;
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
