import { beforeAll, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { allowHit, handle, parseQr } from './reviews.mjs';

// Cloudflare D1 과 같은 모양의 가짜 DB (내 PC 의 SQLite 로 흉내)
class FakeD1 {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) {
    const st = this.db.prepare(sql);
    let args = [];
    const q = {
      bind: (...a) => ((args = a), q),
      first: async () => st.get(...args) ?? null,
      all: async () => ({ results: st.all(...args) }),
      run: async () => (st.run(...args), { success: true }),
    };
    return q;
  }
}

const QR5 = 'http://m.dhlottery.co.kr/?v=1248q161827363842m162736384245s010203040506q161827363822q182736384243n0000000000001234567890';
const draw1248 = { draw_no: 1248, numbers: [16, 18, 27, 36, 38, 42], bonus_no: 22, date: '2026-10-31T00:00:00Z' };

let env;
let fetchCount = 0;
let ipNo = 0;
// 공개 데이터 대신 가짜: 1248회만 있음
const fakeFetch = async (url) => {
  fetchCount++;
  return url.endsWith('/1248.json') ? new Response(JSON.stringify(draw1248)) : new Response('not found', { status: 404 });
};

beforeAll(() => {
  env = { DB: new FakeD1() };
});

const call = (path, init = {}) => handle(new Request(`https://reviews.test${path}`, init), env, { fetchImpl: fakeFetch });
// 도배 막기에 걸리지 않게 요청마다 다른 곳에서 온 것처럼
const post = (body, origin = 'https://limjin1009.github.io') =>
  call('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'CF-Connecting-IP': `10.0.0.${++ipNo}` },
    body: JSON.stringify(body),
  });

describe('후기 서버 (Cloudflare)', () => {
  it('QR 해석은 앱과 같다 (꽝 C게임 포함 5게임)', () => {
    const t = parseQr(QR5);
    expect(t.round).toBe(1248);
    expect(t.games.map((g) => `${g.label}${g.type}`)).toEqual(['A자동', 'B수동', 'C반자동', 'D자동', 'E자동']);
  });

  it('1등 저장, 같은 복권 같은 게임은 거절', async () => {
    const r = await post({ qr: QR5, game: 'A', nickname: '찐팬', content: '돼지꿈 꾸고 샀어요', method: '꿈 해몽(으)로 뽑은 번호 · 돼지꿈' });
    expect(r.status).toBe(201);
    expect(r.headers.get('access-control-allow-origin')).toBe('https://limjin1009.github.io');
    const saved = await r.json();
    expect(saved).toMatchObject({ round: 1248, rank: 1, game_label: 'A', game_type: '자동', numbers: [16, 18, 27, 36, 38, 42], nickname: '찐팬' });

    const again = await post({ qr: QR5, game: 'a', nickname: '또', content: '또 올려 봅니다' });
    expect(again.status).toBe(409);
    expect((await again.json()).message).toContain('이미 후기가');
  });

  it('2등·3등·5등 저장, 꽝·2개는 거절', async () => {
    expect((await (await post({ qr: QR5, game: 'D', nickname: '넷째', content: '보너스까지 맞음' })).json()).rank).toBe(2);
    expect((await (await post({ qr: QR5, game: 'B', nickname: '둘째', content: '다섯 개 맞음' })).json()).rank).toBe(3);
    expect((await (await post({ qr: 'https://x.kr/?v=1248q011627384445', game: 'A', nickname: '오등', content: '세 개 맞았어요' })).json()).rank).toBe(5);

    const lose = await post({ qr: QR5, game: 'C', nickname: '꽝', content: '꽝도 올려 볼게요' });
    expect(lose.status).toBe(400);
    expect((await lose.json()).message).toContain('낙첨');
    const two = await post({ qr: 'https://x.kr/?v=1248q011627394445', game: 'A', nickname: '두개', content: '두 개 맞았어요' });
    expect((await two.json()).message).toContain('낙첨');
  });

  it('추첨 전 회차, 로또 아닌 QR, 없는 게임, 글자 수는 거절', async () => {
    const msg = async (body) => (await (await post(body)).json()).message;
    expect(await msg({ qr: 'https://x.kr/?v=1249q011627384445', game: 'A', nickname: 'a', content: '아직 추첨 전' })).toContain('1249회 당첨번호가 아직 없어요');
    expect(await msg({ qr: 'https://example.com', game: 'A', nickname: 'a', content: '아무거나 써요' })).toContain('QR이 아니에요');
    expect(await msg({ qr: 'https://x.kr/?v=1248q011627384440', game: 'B', nickname: 'a', content: '없는 게임이에요' })).toContain('B 게임을 찾지 못했어요');
    expect(await msg({ qr: 'https://x.kr/?v=1248q011627384440', game: 'A', nickname: 'a', content: '짧' })).toContain('5~300자');
    expect(await msg({ qr: 'https://x.kr/?v=1248q011627384440', game: 'A', nickname: '   ', content: '닉네임이 비었어요' })).toContain('닉네임');
  });

  it('당첨번호는 한 번만 받아 와서 저장해 둔다', () => {
    // 1248회는 처음 한 번만 받아 오고, 1249회는 없어서 받을 때마다 시도
    expect(fetchCount).toBeLessThanOrEqual(2);
  });

  it('목록·등수 필터·통계', async () => {
    const all = await (await call('/api/reviews')).json();
    expect(all.map((r) => r.nickname)).toEqual(['오등', '둘째', '넷째', '찐팬']);
    const top = await (await call('/api/reviews?rank=top')).json();
    expect(top.map((r) => r.rank).sort()).toEqual([1, 2, 3]);
    const five = await (await call('/api/reviews?rank=5')).json();
    expect(five).toHaveLength(1);
    expect(await (await call('/api/stats')).json()).toEqual({ 1: 1, 2: 1, 3: 1, 5: 1 });
  });

  it('숨긴 후기는 목록과 통계에서 빠진다', async () => {
    env.DB.db.exec("UPDATE reviews SET hidden = 1 WHERE nickname = '오등'");
    const all = await (await call('/api/reviews')).json();
    expect(all.map((r) => r.nickname)).not.toContain('오등');
    expect(await (await call('/api/stats')).json()).toEqual({ 1: 1, 2: 1, 3: 1 });
  });

  it('허용 안 된 사이트에는 CORS 허가를 주지 않고, 큰 요청과 없는 주소는 거절', async () => {
    const r = await post({ qr: 'x', game: 'A', nickname: 'a', content: 'aaaaa' }, 'https://evil.example');
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
    const big = await post({ qr: QR5, game: 'E', nickname: 'a', content: 'x'.repeat(10_000) });
    expect(big.status).toBe(413);
    expect((await call('/nope')).status).toBe(404);
    const pre = await call('/api/reviews', { method: 'OPTIONS', headers: { Origin: 'https://limjin1009.github.io' } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('도배 막기: 한 곳에서 너무 자주, 서버 전체로 너무 많이', async () => {
    const db = new FakeD1();
    const lim = { perIp: 2, ipWindowMs: 10 * 60_000, global: 3, globalWindowMs: 60 * 60_000 };
    expect([await allowHit(db, 'a', 0, lim), await allowHit(db, 'a', 1, lim), await allowHit(db, 'a', 2, lim)]).toEqual([true, true, false]);
    expect(await allowHit(db, 'b', 3, lim)).toBe(true);
    expect(await allowHit(db, 'c', 4, lim)).toBe(false); // 전체 3번 다 씀
    expect(await allowHit(db, 'a', 61 * 60_000, lim)).toBe(true); // 1시간 지나면 풀림
    // IP 는 그대로 저장하지 않는다
    expect(db.db.prepare("SELECT COUNT(*) AS c FROM hits WHERE ip = 'a'").get().c).toBe(0);
  });

  it('같은 곳에서 6번째 글은 429', async () => {
    const send = () =>
      call('/api/reviews', { method: 'POST', headers: { 'CF-Connecting-IP': '9.9.9.9' }, body: JSON.stringify({ qr: 'x' }) });
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await send()).status);
    expect(codes).toEqual([400, 400, 400, 400, 400, 429]);
  });
});
