#!/usr/bin/env node
// 로또 찐번호 — 당첨 인증 후기 서버 (맥미니에서 돈다)
//
// - Node 24 기본 기능만 씀 (node:http, node:sqlite). 설치할 라이브러리 없음.
// - 127.0.0.1:3400 에서만 듣고, Tailscale Funnel 이 이 포트 하나만 인터넷에 공개한다.
// - 데이터: ~/LottoData/reviews.sqlite (매일 backups/ 에 복사, 14개 보관)
//
// 규칙
// - 복권 QR 글자를 받아 서버가 다시 풀고, 서버가 받아 온 당첨번호와 직접 맞춰 등수를 정한다.
// - 3개 이상 맞은 5등부터만 저장. 꽝은 거절. 같은 복권의 같은 게임은 한 번만.
// - 당첨번호는 공개 데이터(smok95/lotto)에서 받아 DB에 저장해 둔다.
//
// API
//   GET  /health
//   GET  /api/reviews?rank=all|top|4|5&offset=0   (20개씩, 최신순, 숨김 제외)
//   GET  /api/stats                                ({ "1": 2, "5": 10 })
//   POST /api/reviews  { qr, game, nickname, content, method? }
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PAGE_SIZE = 20;
const DRAW_SOURCE = 'https://smok95.github.io/lotto/results';
const DEFAULT_ORIGINS = ['https://limjin1009.github.io', 'http://localhost:5179', 'http://localhost:5180', 'http://localhost:4173'];

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

// ── DB ──
export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS draws (
      no INTEGER PRIMARY KEY,
      draw_date TEXT NOT NULL,
      nums TEXT NOT NULL,
      bonus INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      round INTEGER NOT NULL,
      rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 5),
      game_label TEXT NOT NULL,
      game_type TEXT NOT NULL DEFAULT '',
      numbers TEXT NOT NULL,
      nickname TEXT NOT NULL,
      content TEXT NOT NULL,
      method TEXT,
      ticket_key TEXT NOT NULL UNIQUE,
      hidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS reviews_created ON reviews (created_at DESC);
  `);
  return db;
}

/** 당첨번호: DB에 있으면 그것, 없으면 공개 데이터에서 받아 저장. 아직 추첨 전이면 null */
export function drawGetter(db, fetchImpl = fetch) {
  const select = db.prepare('SELECT no, draw_date, nums, bonus FROM draws WHERE no = ?');
  const insert = db.prepare('INSERT OR REPLACE INTO draws (no, draw_date, nums, bonus) VALUES (?, ?, ?, ?)');
  return async (round) => {
    const row = select.get(round);
    if (row) return { no: row.no, nums: JSON.parse(row.nums), bonus: row.bonus };
    try {
      const res = await fetchImpl(`${DRAW_SOURCE}/${round}.json`);
      if (!res.ok) return null;
      const d = await res.json();
      if (d?.draw_no !== round || !Array.isArray(d.numbers) || d.numbers.length !== 6) return null;
      const nums = [...d.numbers].sort((a, b) => a - b);
      insert.run(round, String(d.date).slice(0, 10), JSON.stringify(nums), d.bonus_no);
      return { no: round, nums, bonus: d.bonus_no };
    } catch {
      return null;
    }
  };
}

class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
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
export async function submitReview(db, getDraw, input, now = new Date()) {
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

  const draw = await getDraw(qr.round);
  if (!draw) throw new UserError(`${qr.round}회 당첨번호가 아직 없어요. 추첨이 끝난 뒤 다시 올려 주세요`);
  const rank = rankOf(game.nums, draw);
  if (!rank) throw new UserError('낙첨된 번호는 후기를 올릴 수 없어요 (3개 이상 맞아야 해요)');

  const ticketKey = createHash('sha256').update(`${qr.v}:${label}`).digest('hex');
  const row = {
    id: randomUUID(),
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
    db.prepare(
      `INSERT INTO reviews (id, created_at, round, rank, game_label, game_type, numbers, nickname, content, method, ticket_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(row.id, row.created_at, row.round, row.rank, row.game_label, row.game_type, row.numbers, row.nickname, row.content, row.method, ticketKey);
  } catch (e) {
    if (String(e?.message).includes('UNIQUE')) throw new UserError(`이 복권의 ${label} 게임은 이미 후기가 올라와 있어요`, 409);
    throw e;
  }
  return toReview(row);
}

export function listReviews(db, rank = 'all', offset = 0) {
  const where = rank === 'top' ? 'AND rank <= 3' : ['4', '5', 4, 5].includes(rank) ? `AND rank = ${Number(rank)}` : '';
  const off = Math.max(0, Math.min(Number(offset) || 0, 100000));
  return db.prepare(`SELECT * FROM reviews WHERE hidden = 0 ${where} ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${off}`).all().map(toReview);
}

export function reviewStats(db) {
  const out = {};
  for (const r of db.prepare('SELECT rank, COUNT(*) AS c FROM reviews WHERE hidden = 0 GROUP BY rank').all()) out[r.rank] = r.c;
  return out;
}

// ── 도배 막기: 한 곳(IP)에서 10분에 5번, 서버 전체 1시간에 300번까지 ──
export function rateLimiter({ perIp = 5, ipWindowMs = 10 * 60_000, global = 300, globalWindowMs = 60 * 60_000 } = {}) {
  const hits = new Map();
  let all = [];
  return (ip, now = Date.now()) => {
    all = all.filter((t) => now - t < globalWindowMs);
    const mine = (hits.get(ip) ?? []).filter((t) => now - t < ipWindowMs);
    if (mine.length >= perIp || all.length >= global) return false;
    mine.push(now);
    all.push(now);
    hits.set(ip, mine);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}

// ── HTTP ──
export function createHandler({ db, getDraw, allowOrigins = DEFAULT_ORIGINS, limiter = rateLimiter() }) {
  return async (req, res) => {
    const origin = req.headers.origin;
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    };
    if (origin && allowOrigins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type';
      headers['Access-Control-Max-Age'] = '86400';
    }
    const send = (status, body) => {
      res.writeHead(status, headers);
      res.end(body === undefined ? '' : JSON.stringify(body));
    };

    try {
      const url = new URL(req.url ?? '/', 'http://local');
      if (req.method === 'OPTIONS') return send(204);
      if (req.method === 'GET' && url.pathname === '/health') return send(200, { ok: true });
      if (req.method === 'GET' && url.pathname === '/api/reviews') {
        return send(200, listReviews(db, url.searchParams.get('rank') ?? 'all', url.searchParams.get('offset') ?? 0));
      }
      if (req.method === 'GET' && url.pathname === '/api/stats') return send(200, reviewStats(db));
      if (req.method === 'POST' && url.pathname === '/api/reviews') {
        const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
        if (!limiter(ip)) return send(429, { message: '잠시 뒤에 다시 올려 주세요' });
        const body = await readBody(req, 8 * 1024);
        const saved = await submitReview(db, getDraw, body);
        console.log(`${new Date().toISOString()} 후기 저장 ${saved.round}회 ${saved.game_label} ${saved.rank}등`);
        return send(201, saved);
      }
      return send(404, { message: '없는 주소예요' });
    } catch (e) {
      if (e instanceof UserError) return send(e.status, { message: e.message });
      console.error(new Date().toISOString(), e);
      return send(500, { message: '서버에 문제가 생겼어요. 잠시 뒤 다시 해 주세요' });
    }
  };
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    // 너무 크면 더 모으지 않고 끝까지 읽기만 한 뒤 안내를 보낸다 (연결을 끊으면 안내를 못 받음)
    req.on('data', (c) => {
      size += c.length;
      if (size <= limit) chunks.push(c);
    });
    req.on('end', () => {
      if (size > limit) return reject(new UserError('보낸 내용이 너무 커요', 413));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new UserError('보낸 내용을 읽지 못했어요'));
      }
    });
    req.on('error', reject);
  });
}

/** 매일 백업 (14개 보관) */
function backup(db, dir) {
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const file = join(dir, `reviews-${stamp}.sqlite`);
  try {
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  } catch {
    /* 오늘 것이 이미 있으면 넘어감 */
  }
  const old = readdirSync(dir).filter((f) => /^reviews-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort();
  for (const f of old.slice(0, Math.max(0, old.length - 14))) unlinkSync(join(dir, f));
}

// ── 직접 실행할 때 ──
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dataDir = process.env.LOTTO_DATA ?? join(homedir(), 'LottoData');
  mkdirSync(dataDir, { recursive: true });
  const db = openDb(join(dataDir, 'reviews.sqlite'));
  const getDraw = drawGetter(db);
  const port = Number(process.env.PORT ?? 3400);
  const origins = process.env.ALLOW_ORIGINS ? process.env.ALLOW_ORIGINS.split(',') : DEFAULT_ORIGINS;
  backup(db, join(dataDir, 'backups'));
  setInterval(() => backup(db, join(dataDir, 'backups')), 24 * 60 * 60_000).unref();
  createServer(createHandler({ db, getDraw, allowOrigins: origins })).listen(port, '127.0.0.1', () => {
    console.log(`${new Date().toISOString()} 후기 서버 시작 127.0.0.1:${port} 데이터 ${dataDir}`);
  });
}
