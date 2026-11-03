// 로또 찐번호 — 당첨 인증 후기 서버의 규칙과 처리 (Cloudflare Workers + D1)
// 진입 파일은 index.mjs (Cloudflare 는 진입 파일이 서버 함수만 내보내야 한다)
//
// 규칙
// - 복권 QR 글자를 받아 서버가 다시 풀고, 서버가 받아 온 당첨번호와 직접 맞춰 등수를 정한다.
// - 3개 이상 맞은 5등부터만 저장. 꽝은 거절. 같은 복권의 같은 게임은 한 번만.
// - 당첨번호는 공개 데이터(smok95/lotto)에서 받아 DB에 저장해 둔다.
// - 도배 막기: 한 곳(IP)에서 10분에 5번, 서버 전체 1시간에 300번.
//
// API
//   GET  /health
//   GET  /api/reviews?rank=all|top|4|5&offset=0   (20개씩, 최신순, 숨김 제외)
//   GET  /api/stats                                ({ "1": 2, "5": 10 })
//   POST /api/reviews  { qr, game, nickname, content, method? }

export const PAGE_SIZE = 20;
const DRAW_SOURCE = 'https://smok95.github.io/lotto/results';
const BODY_LIMIT = 8 * 1024;
const LIMITS = { perIp: 5, ipWindowMs: 10 * 60_000, global: 300, globalWindowMs: 60 * 60_000 };

// ── 복권 QR 해석 (앱의 src/lib/ticket.ts 와 같은 규칙) ──
const TYPE = { q: '자동', m: '수동', s: '반자동' };
const LABELS = ['A', 'B', 'C', 'D', 'E'];

export function parseQr(text) {
  const raw = String(text ?? '').trim();
  const v = raw.match(/[?&]v=([0-9a-zA-Z]+)/)?.[1] ?? (/^\d{4}[a-zA-Z]\d{12}/.test(raw) ? raw : null);
  if (!v) return null;
  const round = Number(v.slice(0, 4));
  if (!round) return null;
  const games = [];
  for (const m of v.slice(4).matchAll(/([a-zA-Z])(\d{12})/g)) {
    const nums = (m[2].match(/\d\d/g) ?? []).map(Number);
    if (new Set(nums).size !== 6 || nums.some((n) => n < 1 || n > 45)) continue;
    games.push({ label: LABELS[games.length], type: TYPE[m[1].toLowerCase()] ?? '', nums: nums.sort((a, b) => a - b) });
    if (games.length === 5) break;
  }
  return games.length ? { v, round, games } : null;
}

export function rankOf(nums, draw) {
  const hit = nums.filter((n) => draw.nums.includes(n)).length;
  if (hit === 6) return 1;
  if (hit === 5) return nums.includes(draw.bonus) ? 2 : 3;
  if (hit === 4) return 4;
  if (hit === 3) return 5;
  return 0;
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// ── DB ──

/** 당첨번호: DB에 있으면 그것, 없으면 공개 데이터에서 받아 저장. 아직 추첨 전이면 null */
export async function getDraw(db, round, fetchImpl = fetch) {
  const row = await db.prepare('SELECT no, nums, bonus FROM draws WHERE no = ?').bind(round).first();
  if (row) return { no: row.no, nums: JSON.parse(row.nums), bonus: row.bonus };
  try {
    const res = await fetchImpl(`${DRAW_SOURCE}/${round}.json`);
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.draw_no !== round || !Array.isArray(d.numbers) || d.numbers.length !== 6) return null;
    const nums = [...d.numbers].sort((a, b) => a - b);
    await db
      .prepare('INSERT OR REPLACE INTO draws (no, draw_date, nums, bonus) VALUES (?, ?, ?, ?)')
      .bind(round, String(d.date).slice(0, 10), JSON.stringify(nums), d.bonus_no)
      .run();
    return { no: round, nums, bonus: d.bonus_no };
  } catch {
    return null;
  }
}

const toReview = (r) => ({
  id: r.id,
  created_at: r.created_at,
  round: r.round,
  rank: r.rank,
  game_label: r.game_label,
  game_type: r.game_type,
  numbers: JSON.parse(r.numbers),
  nickname: r.nickname,
  content: r.content,
  method: r.method,
});

/** 후기 저장. 틀리면 UserError */
export async function submitReview(db, input, { fetchImpl = fetch, now = new Date() } = {}) {
  const qr = parseQr(input?.qr);
  if (!qr) throw new UserError('로또 복권 QR이 아니에요');
  const label = String(input?.game ?? '').toUpperCase();
  const game = qr.games.find((g) => g.label === label);
  if (!game) throw new UserError(`복권에서 ${label || '?'} 게임을 찾지 못했어요`);

  const nickname = String(input?.nickname ?? '').trim();
  const content = String(input?.content ?? '').trim();
  const method = input?.method ? String(input.method).trim().slice(0, 60) : null;
  if ([...nickname].length < 1 || [...nickname].length > 12) throw new UserError('닉네임은 1~12자로 써 주세요');
  if ([...content].length < 5 || [...content].length > 300) throw new UserError('후기는 5~300자로 써 주세요');

  const draw = await getDraw(db, qr.round, fetchImpl);
  if (!draw) throw new UserError(`${qr.round}회 당첨번호가 아직 없어요. 추첨이 끝난 뒤 다시 올려 주세요`);
  const rank = rankOf(game.nums, draw);
  if (!rank) throw new UserError('낙첨된 번호는 후기를 올릴 수 없어요 (3개 이상 맞아야 해요)');

  const row = {
    id: crypto.randomUUID(),
    created_at: now.toISOString(),
    round: qr.round,
    rank,
    game_label: label,
    game_type: game.type,
    numbers: JSON.stringify(game.nums),
    nickname,
    content,
    method: method || null,
  };
  try {
    await db
      .prepare(
        `INSERT INTO reviews (id, created_at, round, rank, game_label, game_type, numbers, nickname, content, method, ticket_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(row.id, row.created_at, row.round, row.rank, row.game_label, row.game_type, row.numbers, row.nickname, row.content, row.method, await sha256(`${qr.v}:${label}`))
      .run();
  } catch (e) {
    if (String(e?.message).includes('UNIQUE')) throw new UserError(`이 복권의 ${label} 게임은 이미 후기가 올라와 있어요`, 409);
    throw e;
  }
  return toReview(row);
}

export async function listReviews(db, rank = 'all', offset = 0) {
  const where = rank === 'top' ? 'AND rank <= 3' : ['4', '5'].includes(String(rank)) ? `AND rank = ${Number(rank)}` : '';
  const off = Math.max(0, Math.min(Number(offset) || 0, 100000));
  const { results } = await db
    .prepare(`SELECT * FROM reviews WHERE hidden = 0 ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(PAGE_SIZE, off)
    .all();
  return results.map(toReview);
}

export async function reviewStats(db) {
  const out = {};
  const { results } = await db.prepare('SELECT rank, COUNT(*) AS c FROM reviews WHERE hidden = 0 GROUP BY rank').all();
  for (const r of results) out[r.rank] = r.c;
  return out;
}

/** 도배 막기. 통과하면 기록하고 true */
export async function allowHit(db, ip, now = Date.now(), limits = LIMITS, table = 'hits') {
  if (table !== 'hits' && table !== 'sync_hits') throw new Error('잘못된 표 이름');
  const key = await sha256(`lotto:${ip}`);
  await db.prepare(`DELETE FROM ${table} WHERE ts < ?`).bind(now - Math.max(limits.ipWindowMs, limits.globalWindowMs)).run();
  const row = await db
    .prepare(`SELECT (SELECT COUNT(*) FROM ${table} WHERE ip = ? AND ts > ?) AS mine, (SELECT COUNT(*) FROM ${table} WHERE ts > ?) AS total`)
    .bind(key, now - limits.ipWindowMs, now - limits.globalWindowMs)
    .first();
  if (row.mine >= limits.perIp || row.total >= limits.global) return false;
  await db.prepare(`INSERT INTO ${table} (ip, ts) VALUES (?, ?)`).bind(key, now).run();
  return true;
}

export async function readJson(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > BODY_LIMIT) throw new UserError('보낸 내용이 너무 커요', 413);
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new UserError('보낸 내용을 읽지 못했어요');
  }
}
