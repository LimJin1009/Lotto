import { beforeAll, describe, expect, it } from 'vitest';
import { handle } from './app.mjs';
import { FakeD1 } from './fake-d1.mjs';
import { isPushEndpoint, runPushRound, vapidJwt, winMessage } from './push.mjs';

const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const bytesToB64url = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const FCM = (n) => `https://fcm.googleapis.com/fcm/send/device-${n}`;
const draw1248 = { draw_no: 1248, numbers: [16, 18, 27, 36, 38, 42], bonus_no: 22, date: '2026-10-31T00:00:00Z' };

let env;
let keys;
const pushed = [];
let pushStatus = () => 201;
let drawReady = true;

// 공개 당첨번호 + 푸시 서버를 흉내
const fakeFetch = async (url, init) => {
  if (url.includes('smok95')) {
    return drawReady && url.endsWith('/1248.json') ? new Response(JSON.stringify(draw1248)) : new Response('', { status: 404 });
  }
  pushed.push({ url, init });
  return new Response('', { status: pushStatus(url) });
};

beforeAll(async () => {
  keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = bytesToB64url(await crypto.subtle.exportKey('raw', keys.publicKey));
  env = { DB: new FakeD1(), VAPID_PUBLIC: pub, VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', keys.privateKey)), ADMIN_TOKEN: 'secret-test' };
});

let ipNo = 0;
const post = (path, body) =>
  handle(
    new Request(`https://reviews.test/api/push/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://limjin1009.github.io', 'CF-Connecting-IP': `10.1.0.${++ipNo}` },
      body: JSON.stringify(body),
    }),
    env,
    { fetchImpl: fakeFetch },
  );

describe('당첨 알림', () => {
  it('브라우저 회사 푸시 주소만 받는다', () => {
    expect(isPushEndpoint(FCM(1))).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/abc')).toBe(true);
    expect(isPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true);
    expect(isPushEndpoint('https://evil.example/fcm.googleapis.com')).toBe(false);
    expect(isPushEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(isPushEndpoint('https://127.0.0.1/x')).toBe(false);
  });

  it('VAPID 서명은 공개키로 확인된다', async () => {
    const jwt = await vapidJwt(FCM(1), JSON.parse(env.VAPID_PRIVATE_JWK), Date.UTC(2026, 10, 3));
    const [h, b, s] = jwt.split('.');
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keys.publicKey, b64urlToBytes(s), new TextEncoder().encode(`${h}.${b}`));
    expect(ok).toBe(true);
    const body = JSON.parse(new TextDecoder().decode(b64urlToBytes(b)));
    expect(body.aud).toBe('https://fcm.googleapis.com');
    expect(body.exp).toBe(Date.UTC(2026, 10, 3) / 1000 + 12 * 3600);
  });

  it('번호 맡기기: 이상한 주소·번호는 거절, 다시 보내면 통째로 바뀜', async () => {
    expect((await post('sync', { endpoint: 'https://evil.example/x', sets: [] })).status).toBe(400);
    expect((await post('sync', { endpoint: FCM(1), sets: [{ round: 1248, nums: [1, 2, 3, 4, 5, 5] }] })).status).toBe(400);
    expect((await post('sync', { endpoint: FCM(1), sets: [{ round: 1248, nums: [1, 2, 3, 4, 5, 46] }] })).status).toBe(400);

    // 1번 기기: 처음엔 꽝 번호만, 다시 보낼 때 5등 번호로 바꿈
    expect(await (await post('sync', { endpoint: FCM(1), sets: [{ round: 1248, nums: [1, 2, 3, 4, 5, 6] }] })).json()).toEqual({ ok: true, watching: 1 });
    await post('sync', { endpoint: FCM(1), sets: [{ round: 1248, nums: [45, 16, 18, 27, 1, 2] }] });
    // 2번 기기: 1등과 4등을 저장 → 가장 높은 1등으로 알림
    await post('sync', { endpoint: FCM(2), sets: [{ round: 1248, nums: [16, 18, 27, 36, 38, 42] }, { round: 1248, nums: [16, 18, 27, 36, 1, 2] }] });
    // 3번 기기: 꽝
    await post('sync', { endpoint: FCM(3), sets: [{ round: 1248, nums: [1, 2, 3, 4, 5, 6] }] });
    // 4번 기기: 다음 회차 번호
    await post('sync', { endpoint: FCM(4), sets: [{ round: 1249, nums: [1, 2, 3, 4, 5, 6] }] });

    const rows = env.DB.db.prepare('SELECT round, nums FROM watch ORDER BY round, nums').all();
    expect(rows).toHaveLength(5);
    expect(rows.some((r) => r.nums === '[1,2,3,4,5,6]' && r.round === 1248)).toBe(true); // 3번 기기 것
  });

  it('당첨번호가 아직이면 아무것도 안 함', async () => {
    drawReady = false;
    const r = await runPushRound(env, { fetchImpl: fakeFetch });
    expect(r).toEqual({ prepared: [], sent: 0, gone: 0, failed: 0 });
    expect(pushed).toHaveLength(0);
    drawReady = true;
  });

  it('추첨이 끝나면 당첨된 기기에만 알림, 문구는 inbox 로 가져감', async () => {
    pushStatus = (url) => (url.endsWith('device-2') ? 201 : 201);
    const r = await runPushRound(env, { fetchImpl: fakeFetch });
    expect(r.prepared).toEqual([{ round: 1248, winners: 2, checked: 4 }]);
    expect(r.sent).toBe(2);
    expect(pushed.map((p) => p.url).sort()).toEqual([FCM(1), FCM(2)]);
    // 내용 없는 알림 + VAPID 서명
    expect(pushed[0].init.body).toBe('');
    expect(pushed[0].init.headers.Authorization).toMatch(/^vapid t=.+\..+\..+, k=/);

    const m1 = await (await post('inbox', { endpoint: FCM(1) })).json();
    expect(m1).toMatchObject(winMessage(1248, 5));
    const m2 = await (await post('inbox', { endpoint: FCM(2) })).json();
    expect(m2.title).toContain('1등');
    expect(m2.url).toBe('#/check');
    expect((await post('inbox', { endpoint: FCM(3) })).status).toBe(404); // 꽝은 알림 없음

    // 1248회 번호는 지우고, 1249회 것은 남김
    expect(env.DB.db.prepare('SELECT round FROM watch').all().map((x) => x.round)).toEqual([1249]);
  });

  it('같은 회차는 두 번 보내지 않고, 끝난 회차 번호는 받지 않음', async () => {
    pushed.length = 0;
    const r = await runPushRound(env, { fetchImpl: fakeFetch });
    expect(r).toEqual({ prepared: [], sent: 0, gone: 0, failed: 0 });
    expect(await (await post('sync', { endpoint: FCM(5), sets: [{ round: 1248, nums: [16, 18, 27, 36, 38, 42] }] })).json()).toEqual({ ok: true, watching: 0 });
  });

  it('없어진 기기(410)는 지우고, 실패는 3번까지 다시 시도', async () => {
    env.DB.db.exec("DELETE FROM push_rounds");
    await post('sync', { endpoint: FCM(6), sets: [{ round: 1248, nums: [16, 18, 27, 36, 38, 42] }] });
    await post('sync', { endpoint: FCM(7), sets: [{ round: 1248, nums: [16, 18, 27, 36, 38, 42] }] });
    pushStatus = (url) => (url.endsWith('device-6') ? 410 : 500);
    const r = await runPushRound(env, { fetchImpl: fakeFetch });
    expect(r.gone).toBe(1);
    expect(r.failed).toBe(1);
    expect(env.DB.db.prepare('SELECT COUNT(*) c FROM subs WHERE endpoint = ?').get(FCM(6)).c).toBe(0);
    await runPushRound(env, { fetchImpl: fakeFetch });
    await runPushRound(env, { fetchImpl: fakeFetch });
    const before = pushed.length;
    await runPushRound(env, { fetchImpl: fakeFetch }); // 3번 실패한 뒤로는 안 보냄
    expect(pushed.length).toBe(before);
  });

  it('알림 끄기는 기기 기록을 모두 지움', async () => {
    await post('unsubscribe', { endpoint: FCM(4) });
    expect(env.DB.db.prepare('SELECT COUNT(*) c FROM watch WHERE round = 1249').get().c).toBe(0);
    expect(env.DB.db.prepare('SELECT COUNT(*) c FROM subs WHERE endpoint = ?').get(FCM(4)).c).toBe(0);
  });

  it('시험 알림은 관리자 열쇠가 있어야 함', async () => {
    const r = await post('test', {});
    expect(r.status).toBe(403);
  });
});
