// 당첨 알림 (웹 푸시)
//
// - 알림을 켠 기기는 추첨 전 회차에 저장한 번호를 서버에 맡겨 둔다 (/api/push/sync).
// - 추첨이 끝나면(토요일 밤·일요일 낮, 정해진 시간마다) 서버가 맞춰 보고, 5등 이상이면 알림을 보낸다.
// - 알림에는 내용을 싣지 않는다(암호화 없이 보내려고). 알림을 받은 휴대폰의 서비스 워커가
//   /api/push/inbox 로 와서 문구를 가져가 보여 준다.
// - 보낸 회차의 번호는 지운다. 받는 곳이 없어진 기기(404·410)는 지운다.
// - 구매 알림: 받겠다고 한 기기에는 토요일 18시(한국)에 "오늘 20시 판매 마감" 을 알린다.
import { allowHit, getDraw, rankOf, readJson, sha256, UserError } from './reviews.mjs';

const SITE = 'https://limjin1009.github.io/Lotto/';
const MAX_SETS = 100;
const SEND_PER_RUN = 40; // 무료 요금제는 한 번 실행에 바깥 요청 50개까지
const SYNC_LIMITS = { perIp: 30, ipWindowMs: 10 * 60_000, global: 5000, globalWindowMs: 60 * 60_000 };

/** 브라우저 회사의 푸시 서버 주소만 받는다 (아무 주소로나 요청을 보내지 않게) */
export function isPushEndpoint(endpoint) {
  let u;
  try {
    u = new URL(String(endpoint));
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || String(endpoint).length > 1000) return false;
  const h = u.hostname;
  return (
    h === 'fcm.googleapis.com' ||
    h === 'updates.push.services.mozilla.com' ||
    h === 'push.services.mozilla.com' ||
    h === 'web.push.apple.com' ||
    h.endsWith('.push.apple.com') ||
    h.endsWith('.notify.windows.com')
  );
}

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = (text) => b64url(new TextEncoder().encode(text));

/** VAPID 서명(JWT). 푸시 서버가 "이 사이트가 보낸 알림"인지 확인하는 데 쓴다 */
export async function vapidJwt(endpoint, privateJwk, now = Date.now()) {
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64urlText(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64urlText(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: SITE }));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

/** 내용 없는 알림 하나 보내기. 푸시 서버의 응답 코드를 돌려준다 */
export async function sendPush(endpoint, env, fetchImpl = fetch) {
  const jwt = await vapidJwt(endpoint, JSON.parse(env.VAPID_PRIVATE_JWK));
  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { TTL: String(3 * 24 * 3600), Urgency: 'high', Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC}`, 'Content-Length': '0' },
    body: '',
  });
  return res.status;
}

function validSets(sets) {
  if (!Array.isArray(sets) || sets.length > MAX_SETS) throw new UserError('번호가 너무 많아요');
  const out = [];
  for (const s of sets) {
    const round = Number(s?.round);
    const nums = Array.isArray(s?.nums) ? s.nums.map(Number) : [];
    if (!Number.isInteger(round) || round < 1 || round > 9999) throw new UserError('회차가 이상해요');
    if (nums.length !== 6 || new Set(nums).size !== 6 || nums.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) throw new UserError('번호가 이상해요');
    out.push({ round, nums: JSON.stringify([...nums].sort((a, b) => a - b)) });
  }
  return out;
}

/** 알림 켜기 + 저장한 번호 맡기기 (그 기기의 번호를 통째로 바꿔 넣음) */
export async function syncSubscription(db, input, now = new Date()) {
  const endpoint = String(input?.endpoint ?? '');
  if (!isPushEndpoint(endpoint)) throw new UserError('알림 받을 주소가 이상해요');
  const sets = validSets(input?.sets ?? []);
  const id = await sha256(endpoint);
  const at = now.toISOString();
  const done = new Set(((await db.prepare('SELECT round FROM push_rounds').all()).results ?? []).map((r) => r.round));
  // 구매 알림을 받을지. 값을 안 보낸 (예전) 앱이면 지금 설정을 그대로 둔다
  const remind = typeof input?.remind === 'boolean' ? Number(input.remind) : null;
  const stmts = [
    db
      .prepare(
        `INSERT INTO subs (id, endpoint, created_at, updated_at, remind) VALUES (?, ?, ?, ?, COALESCE(?, 0))
         ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, remind = COALESCE(?, subs.remind)`,
      )
      .bind(id, endpoint, at, at, remind, remind),
    db.prepare('DELETE FROM watch WHERE sub_id = ?').bind(id),
    // 이미 알림을 끝낸 회차는 받지 않는다
    ...sets.filter((s) => !done.has(s.round)).map((s) => db.prepare('INSERT OR IGNORE INTO watch (sub_id, round, nums) VALUES (?, ?, ?)').bind(id, s.round, s.nums)),
  ];
  await db.batch(stmts);
  return { ok: true, watching: stmts.length - 2 };
}

export async function removeSubscription(db, endpoint) {
  const id = await sha256(String(endpoint ?? ''));
  await db.batch([
    db.prepare('DELETE FROM watch WHERE sub_id = ?').bind(id),
    db.prepare('DELETE FROM inbox WHERE sub_id = ?').bind(id),
    db.prepare('DELETE FROM subs WHERE id = ?').bind(id),
  ]);
}

/** 알림을 받은 휴대폰이 가져가는 문구 (3일 지난 것은 안 줌) */
export async function inboxFor(db, endpoint, now = new Date()) {
  const id = await sha256(String(endpoint ?? ''));
  const row = await db.prepare('SELECT round, title, body, url, created_at FROM inbox WHERE sub_id = ?').bind(id).first();
  if (!row || now.getTime() - new Date(row.created_at).getTime() > 3 * 24 * 3600_000) return null;
  return { round: row.round, title: row.title, body: row.body, url: row.url };
}

export function winMessage(round, rank) {
  return {
    title: `🎉 저장한 번호가 ${round}회 ${rank}등!`,
    body: '이 번호로 복권을 샀다면, QR로 당첨을 확인하고 당첨 후기를 남겨 주세요.',
    url: '#/check',
  };
}

export function buyReminderMessage() {
  return {
    title: '🎱 오늘 저녁 8시에 로또 판매가 끝나요',
    body: '이번 주 번호는 정하셨나요? 눌러서 번호를 뽑아 보세요.',
    url: '#/',
  };
}

/** 당첨 알림이 아닌 안내를 알림함에 넣는다. 아직 못 보낸 당첨 알림은 덮어쓰지 않는다 */
function putNotice(db, subId, m, at) {
  return db
    .prepare(
      `INSERT INTO inbox (sub_id, round, title, body, url, created_at, sent, tries) VALUES (?, 0, ?, ?, ?, ?, 1, 0)
       ON CONFLICT(sub_id) DO UPDATE SET round = 0, title = excluded.title, body = excluded.body, url = excluded.url, created_at = excluded.created_at
       WHERE inbox.sent = 1`,
    )
    .bind(subId, m.title, m.body, m.url, at)
    .run();
}

/**
 * 구매 알림: 토요일 18시대(한국)에만 일한다. 받겠다고 한 기기에 하루 한 번, 한 번 실행에 SEND_PER_RUN 개까지.
 */
export async function runBuyReminder(env, { fetchImpl = fetch, now = new Date() } = {}) {
  const db = env.DB;
  const report = { sent: 0, gone: 0, failed: 0 };
  const kst = new Date(now.getTime() + 9 * 3600_000);
  if (kst.getUTCDay() !== 6 || kst.getUTCHours() !== 18) return report;
  const today = kst.toISOString().slice(0, 10);
  const { results: subs } = await db
    .prepare('SELECT id, endpoint FROM subs WHERE remind = 1 AND (reminded_on IS NULL OR reminded_on <> ?) ORDER BY updated_at LIMIT ?')
    .bind(today, SEND_PER_RUN)
    .all();
  const m = buyReminderMessage();
  for (const s of subs) {
    await putNotice(db, s.id, m, now.toISOString());
    // 실패해도 오늘은 다시 보내지 않는다 (다음 주에 다시)
    await db.prepare('UPDATE subs SET reminded_on = ? WHERE id = ?').bind(today, s.id).run();
    let status = 0;
    try {
      status = await sendPush(s.endpoint, env, fetchImpl);
    } catch {
      status = 0;
    }
    if (status >= 200 && status < 300) report.sent++;
    else if (status === 404 || status === 410) {
      await removeSubscription(db, s.endpoint);
      report.gone++;
    } else report.failed++;
  }
  return report;
}

/**
 * 정해진 시간마다 실행. 추첨이 끝난 회차가 있으면 당첨자를 골라 알림 내용을 만들고,
 * 아직 안 보낸 알림을 SEND_PER_RUN 개까지 보낸다.
 */
export async function runPushRound(env, { fetchImpl = fetch, now = new Date() } = {}) {
  const db = env.DB;
  const report = { prepared: [], sent: 0, gone: 0, failed: 0 };

  // 1) 추첨이 끝난 회차 준비
  const { results: rounds } = await db.prepare('SELECT DISTINCT round FROM watch WHERE round NOT IN (SELECT round FROM push_rounds) ORDER BY round').all();
  for (const { round } of rounds) {
    const draw = await getDraw(db, round, fetchImpl);
    if (!draw) continue; // 아직 당첨번호가 안 나옴
    const { results: rows } = await db.prepare('SELECT sub_id, nums FROM watch WHERE round = ?').bind(round).all();
    const best = new Map();
    for (const r of rows) {
      const rank = rankOf(JSON.parse(r.nums), draw);
      if (rank && (!best.has(r.sub_id) || rank < best.get(r.sub_id))) best.set(r.sub_id, rank);
    }
    const at = now.toISOString();
    await db.batch([
      ...[...best].map(([sub, rank]) => {
        const m = winMessage(round, rank);
        return db
          .prepare('INSERT OR REPLACE INTO inbox (sub_id, round, title, body, url, created_at, sent, tries) VALUES (?, ?, ?, ?, ?, ?, 0, 0)')
          .bind(sub, round, m.title, m.body, m.url, at);
      }),
      db.prepare('DELETE FROM watch WHERE round <= ?').bind(round),
      db.prepare('INSERT OR IGNORE INTO push_rounds (round, done_at) VALUES (?, ?)').bind(round, at),
    ]);
    report.prepared.push({ round, winners: best.size, checked: rows.length });
  }

  // 2) 보내기
  const { results: queue } = await db
    .prepare('SELECT i.sub_id, s.endpoint FROM inbox i JOIN subs s ON s.id = i.sub_id WHERE i.sent = 0 AND i.tries < 3 ORDER BY i.created_at LIMIT ?')
    .bind(SEND_PER_RUN)
    .all();
  for (const q of queue) {
    let status = 0;
    try {
      status = await sendPush(q.endpoint, env, fetchImpl);
    } catch {
      status = 0;
    }
    if (status >= 200 && status < 300) {
      await db.prepare('UPDATE inbox SET sent = 1 WHERE sub_id = ?').bind(q.sub_id).run();
      report.sent++;
    } else if (status === 404 || status === 410) {
      await removeSubscription(db, q.endpoint);
      report.gone++;
    } else {
      await db.prepare('UPDATE inbox SET tries = tries + 1 WHERE sub_id = ?').bind(q.sub_id).run();
      report.failed++;
    }
  }
  return report;
}

/** /api/push/* 요청 처리. 해당 없으면 null */
export async function handlePush(request, env, url, send) {
  const db = env.DB;
  if (request.method !== 'POST' || !url.pathname.startsWith('/api/push/')) return null;
  const path = url.pathname.slice('/api/push/'.length);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';

  if (path === 'sync') {
    if (!(await allowHit(db, ip, Date.now(), SYNC_LIMITS, 'sync_hits'))) return send(429, { message: '잠시 뒤에 다시 해 주세요' });
    return send(200, await syncSubscription(db, await readJson(request)));
  }
  if (path === 'unsubscribe') {
    await removeSubscription(db, (await readJson(request)).endpoint);
    return send(200, { ok: true });
  }
  if (path === 'inbox') {
    const m = await inboxFor(db, (await readJson(request)).endpoint);
    return m ? send(200, m) : send(404, { message: '받을 알림이 없어요' });
  }
  // 관리자 시험 알림: 알림을 켠 기기에 "알림 시험" 을 보낸다 (ADMIN_TOKEN 이 맞을 때만)
  if (path === 'test') {
    const token = request.headers.get('X-Admin-Token') ?? '';
    if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return send(403, { message: '허락되지 않았어요' });
    const { results: subs } = await db.prepare('SELECT id, endpoint FROM subs ORDER BY updated_at DESC LIMIT 20').all();
    const at = new Date().toISOString();
    const out = [];
    for (const s of subs) {
      await db
        // 아직 못 보낸 당첨 알림은 덮어쓰지 않는다
        .prepare(
          `INSERT INTO inbox (sub_id, round, title, body, url, created_at, sent, tries) VALUES (?, 0, ?, ?, ?, ?, 1, 0)
           ON CONFLICT(sub_id) DO UPDATE SET round = 0, title = excluded.title, body = excluded.body, url = excluded.url, created_at = excluded.created_at
           WHERE inbox.sent = 1`,
        )
        .bind(s.id, '🔔 로또 찐 명당 알림 시험', '알림이 잘 와요! 저장한 번호가 당첨되면 이렇게 알려 드려요.', '#/saved', at)
        .run();
      out.push(await sendPush(s.endpoint, env).catch(() => 0));
    }
    return send(200, { sent: out });
  }
  return send(404, { message: '없는 주소예요' });
}
