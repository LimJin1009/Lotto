// 로또 찐 명당 서버의 HTTP 처리: 후기(reviews.mjs) + 당첨 알림(push.mjs)
//
// API
//   GET  /health
//   GET  /api/reviews?rank=all|top|4|5&offset=0   (20개씩, 최신순, 숨김 제외)
//   GET  /api/stats                                ({ "1": 2, "5": 10 })
//   POST /api/reviews  { qr, game, nickname, content, method? }
//   POST /api/push/sync         { endpoint, sets: [{ round, nums }] }   알림 켜기·저장한 번호 맡기기
//   POST /api/push/unsubscribe  { endpoint }
//   POST /api/push/inbox        { endpoint }   알림 문구 가져가기 (서비스 워커)
import { handlePush } from './push.mjs';
import { allowHit, listReviews, readJson, reviewStats, submitReview, UserError } from './reviews.mjs';

const DEFAULT_ORIGINS = ['https://limjin1009.github.io', 'http://localhost:5179', 'http://localhost:5180', 'http://localhost:4173'];

export async function handle(request, env, { fetchImpl = fetch } = {}) {
  const db = env.DB;
  const allow = env.ALLOW_ORIGINS ? env.ALLOW_ORIGINS.split(',') : DEFAULT_ORIGINS;
  const origin = request.headers.get('Origin');
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (origin && allow.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  const send = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers });

  try {
    const url = new URL(request.url);
    const { method } = request;
    if (method === 'OPTIONS') return send(204);
    if (method === 'GET' && url.pathname === '/health') return send(200, { ok: true });
    if (method === 'GET' && url.pathname === '/api/reviews') {
      return send(200, await listReviews(db, url.searchParams.get('rank') ?? 'all', url.searchParams.get('offset') ?? 0));
    }
    if (method === 'GET' && url.pathname === '/api/stats') return send(200, await reviewStats(db));
    if (method === 'POST' && url.pathname === '/api/reviews') {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (!(await allowHit(db, ip))) return send(429, { message: '잠시 뒤에 다시 올려 주세요' });
      const saved = await submitReview(db, await readJson(request), { fetchImpl });
      console.log(`후기 저장 ${saved.round}회 ${saved.game_label} ${saved.rank}등`);
      return send(201, saved);
    }
    const pushed = await handlePush(request, env, url, send);
    if (pushed) return pushed;
    return send(404, { message: '없는 주소예요' });
  } catch (e) {
    if (e instanceof UserError) return send(e.status, { message: e.message });
    console.error(e);
    return send(500, { message: '서버에 문제가 생겼어요. 잠시 뒤 다시 해 주세요' });
  }
}
