// 당첨 인증 후기: Supabase REST 로 읽고 쓴다 (라이브러리 없이 fetch)
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export const reviewsEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

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

const headers = () => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
});

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}${path}`, { ...init, headers: { ...headers(), ...init?.headers } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body as { message?: string } | null)?.message ?? '서버에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.');
  return body as T;
}

export const PAGE_SIZE = 20;

export function listReviews(filter: RankFilter, offset: number): Promise<Review[]> {
  const q = new URLSearchParams({
    select: 'id,created_at,round,rank,game_label,game_type,numbers,nickname,content,method',
    order: 'created_at.desc',
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  if (filter === 'top') q.set('rank', 'lte.3');
  else if (filter !== 'all') q.set('rank', `eq.${filter}`);
  return call<Review[]>(`/rest/v1/reviews?${q}`);
}

export async function reviewStats(): Promise<Record<number, number>> {
  const rows = await call<{ rank: number; count: number }[]>('/rest/v1/rpc/review_stats', { method: 'POST', body: '{}' });
  return Object.fromEntries(rows.map((r) => [r.rank, Number(r.count)]));
}

export function submitReview(input: { qr: string; game: string; nickname: string; content: string; method?: string | null }): Promise<Review> {
  return call<Review>('/rest/v1/rpc/submit_review', {
    method: 'POST',
    body: JSON.stringify({ p_qr: input.qr, p_game: input.game, p_nickname: input.nickname, p_content: input.content, p_method: input.method ?? null }),
  });
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
