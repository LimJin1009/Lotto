// 추첨기 공 움직임 계산. 화면 그리기와 분리해서 테스트할 수 있게 둔다.
// 실제 공기식 추첨기처럼: 바닥 가운데에서 바람이 위로 세게 불고,
// 공은 가운데로 솟구쳤다가 양옆 벽을 타고 떨어지며 계속 섞인다.

export const SIZE = 320;
export const C = SIZE / 2;
export const R = 140;
export const BR = 12.5;
/** 출구(통 맨 위) 입구 위치 */
export const EXIT = { x: C, y: C - R + BR + 2 };

const SEEK_MS = 900; // 공이 출구로 빨려 가는 최대 시간
const TUBE_MS = 380; // 관을 타고 올라가는 시간
export const EXTRACT_MAX_MS = SEEK_MS + TUBE_MS + 400;

export interface PBall {
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  out?: {
    phase: 'seek' | 'tube';
    start: number;
    tubeStart: number;
    sx: number;
    sy: number;
    finish: () => void;
  };
}

export interface World {
  balls: PBall[];
  /** 바람 세기 0~1 (켜고 끌 때 서서히 바뀜) */
  air: number;
  mixing: boolean;
  /** 빨리 감기: 공이 더 빨리 빠져나감 */
  fast: boolean;
  /** 지금 중력 방향 (화면 기준, 길이 1). 기본은 아래 (0, 1) */
  gx: number;
  gy: number;
  /** 휴대폰 기울기로 정한 목표 중력 방향. 지금 방향이 이쪽으로 부드럽게 따라감 */
  tx: number;
  ty: number;
}

export function makeWorld(): World {
  const balls: PBall[] = [];
  for (let n = 1; n <= 45; n++) {
    const row = Math.floor((n - 1) / 9);
    const col = (n - 1) % 9;
    balls.push({ n, x: C - 100 + col * 25 + (row % 2) * 12, y: C + 110 - row * 23, vx: 0, vy: 0 });
  }
  return { balls, air: 0, mixing: false, fast: false, gx: 0, gy: 1, tx: 0, ty: 1 };
}

const GRAVITY = 0.32;

/**
 * 휴대폰 기울기(deviceorientation 의 beta·gamma, 도)와 화면 회전 각도로
 * 화면 안에서 "아래"가 어느 쪽인지 구한다. 화면 기준 x 오른쪽·y 아래, 길이 1.
 * 휴대폰을 거의 평평하게 눕혀 방향을 알 수 없으면 null.
 */
export function tiltGravity(beta: number, gamma: number, screenAngle = 0): { x: number; y: number } | null {
  const rad = Math.PI / 180;
  // 지구 중력을 휴대폰 화면 평면에 비춘 것 (세로 화면 기준)
  let x = Math.cos(beta * rad) * Math.sin(gamma * rad);
  let y = Math.sin(beta * rad);
  // 가로 화면이면 그만큼 돌려 준다
  const a = (((screenAngle % 360) + 360) % 360) as number;
  if (a === 90) [x, y] = [y, -x];
  else if (a === 180) [x, y] = [-x, -y];
  else if (a === 270) [x, y] = [-y, x];
  const len = Math.hypot(x, y);
  if (len < 0.12) return null;
  return { x: x / len, y: y / len };
}
const MAX_SPEED = 11;
const JET_WIDTH = 46;

/** 1/60초만큼 움직인다. now는 performance.now() 값 */
export function stepWorld(w: World, now: number, rand: () => number = Math.random): void {
  w.air += ((w.mixing ? 1 : 0) - w.air) * 0.04;
  const air = w.air;
  const list = w.balls;
  // 중력 방향은 휴대폰 기울기를 부드럽게 따라감
  w.gx += (w.tx - w.gx) * 0.12;
  w.gy += (w.ty - w.gy) * 0.12;
  const gl = Math.hypot(w.gx, w.gy) || 1;
  const gx = (w.gx / gl) * GRAVITY;
  const gy = (w.gy / gl) * GRAVITY;

  for (const b of list) {
    if (b.out) continue;
    b.vx += gx;
    b.vy += gy;
    if (air > 0.01) {
      const dx = b.x - C;
      const below = (b.y - C) / R; // -1(위) ~ 1(아래)
      // 1) 바닥 가운데 노즐에서 위로 부는 강한 바람 (가운데일수록, 아래일수록 셈)
      const jet = Math.exp(-(dx * dx) / (2 * JET_WIDTH * JET_WIDTH)) * (0.55 + 0.45 * Math.max(below, 0));
      b.vy -= air * jet * 1.05;
      // 2) 바닥에 깔린 공을 가운데 바람 쪽으로 쓸어 모으고 띄움
      if (below > 0.45) {
        b.vx -= air * dx * 0.006;
        b.vy -= air * (0.25 + rand() * 0.5);
      }
      // 3) 위쪽에서는 바람이 양옆으로 갈라져 벽을 타고 내려가게 함
      if (below < -0.3) b.vx += air * Math.sign(dx || rand() - 0.5) * 0.18;
      // 4) 난기류
      b.vx += (rand() - 0.5) * 1.1 * air;
      b.vy += (rand() - 0.5) * 1.1 * air;
    }
    b.vx *= 0.99;
    b.vy *= 0.99;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAX_SPEED) {
      b.vx *= MAX_SPEED / sp;
      b.vy *= MAX_SPEED / sp;
    }
    b.x += b.vx;
    b.y += b.vy;
    bounceWall(b);
  }

  collide(list);
  for (const b of list) if (!b.out) bounceWall(b);

  // 꺼내는 공
  for (const b of [...list]) {
    const o = b.out;
    if (!o) continue;
    if (o.phase === 'seek') {
      // 출구로 빨려 들어감
      b.vx = b.vx * 0.86 + (EXIT.x - b.x) * 0.035;
      b.vy = b.vy * 0.86 + (EXIT.y - b.y) * 0.035;
      b.x += b.vx;
      b.y += b.vy;
      bounceWall(b);
      if (Math.hypot(EXIT.x - b.x, EXIT.y - b.y) < 7 || now - o.start > (w.fast ? SEEK_MS / 2.5 : SEEK_MS)) {
        o.phase = 'tube';
        o.tubeStart = now;
        o.sx = b.x;
        o.sy = b.y;
      }
    } else {
      const t = Math.min((now - o.tubeStart) / (w.fast ? TUBE_MS / 2 : TUBE_MS), 1);
      const e = t * t;
      b.x = o.sx + (C - o.sx) * Math.min(t * 3, 1);
      b.y = o.sy + (-BR * 2 - o.sy) * e;
      if (t >= 1) o.finish();
    }
  }
}

function bounceWall(b: PBall) {
  const dx = b.x - C;
  const dy = b.y - C;
  const d = Math.hypot(dx, dy);
  if (d > R - BR) {
    const nx = dx / d;
    const ny = dy / d;
    b.x = C + nx * (R - BR);
    b.y = C + ny * (R - BR);
    const vn = b.vx * nx + b.vy * ny;
    if (vn > 0) {
      b.vx -= 1.8 * vn * nx;
      b.vy -= 1.8 * vn * ny;
    }
  }
}

function collide(list: PBall[]) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.out) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.out) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= 4 * BR * BR || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const push = (2 * BR - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const k = rel * 0.92;
        a.vx += k * nx;
        a.vy += k * ny;
        b.vx -= k * nx;
        b.vy -= k * ny;
      }
    }
  }
}

/**
 * 해당 번호 공을 출구로 꺼낸다. 공이 관을 빠져나가면 resolve.
 * 화면 그리기가 멈춰도(다른 탭으로 감 등) 정해진 시간 안에 반드시 끝난다.
 */
export function extractBall(w: World, n: number, now: number): Promise<void> {
  return new Promise((resolve) => {
    const b = w.balls.find((x) => x.n === n && !x.out);
    if (!b) return resolve();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      w.balls = w.balls.filter((x) => x !== b);
      resolve();
    };
    b.out = { phase: 'seek', start: now, tubeStart: 0, sx: b.x, sy: b.y, finish };
    setTimeout(finish, EXTRACT_MAX_MS);
  });
}
