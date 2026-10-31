// 2D 추첨기. 번호는 밖에서 먼저 정하고, 여기서는 그 공을 꺼내는 모습만 그린다.
import { useEffect, useRef } from 'react';
import { ballColor } from './Ball';

export interface MachineApi {
  setMixing: (on: boolean) => void;
  /** 해당 번호 공을 출구로 꺼낸다. 다 꺼내면 resolve */
  extract: (n: number) => Promise<void>;
  reset: () => void;
}

interface B {
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  out?: { start: number; sx: number; sy: number };
}

const EXTRACT_MS = 650;

const SIZE = 320;
const C = SIZE / 2;
const R = 140;
const BR = 12.5;

function makeBalls(): B[] {
  const balls: B[] = [];
  for (let n = 1; n <= 45; n++) {
    const row = Math.floor((n - 1) / 9);
    const col = (n - 1) % 9;
    balls.push({ n, x: C - 100 + col * 25 + (row % 2) * 12, y: C + 110 - row * 23, vx: 0, vy: 0 });
  }
  return balls;
}

export function DrawMachine({ apiRef }: { apiRef: React.RefObject<MachineApi | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const balls = useRef<B[]>(makeBalls());
  const mixing = useRef(false);

  useEffect(() => {
    apiRef.current = {
      setMixing: (on) => {
        mixing.current = on;
      },
      // 화면 그리기가 멈춰도(다른 탭으로 감 등) 추첨은 시간에 맞춰 끝난다
      extract: (n) =>
        new Promise<void>((done) => {
          const b = balls.current.find((x) => x.n === n && !x.out);
          if (!b) return done();
          b.out = { start: performance.now(), sx: b.x, sy: b.y };
          setTimeout(() => {
            balls.current = balls.current.filter((x) => x !== b);
            done();
          }, EXTRACT_MS);
        }),
      reset: () => {
        balls.current = makeBalls();
        mixing.current = false;
      },
    };
  }, [apiRef]);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = SIZE * dpr;
    cv.height = SIZE * dpr;
    ctx.scale(dpr, dpr);
    let raf = 0;

    const step = () => {
      const list = balls.current;
      const mix = mixing.current;
      for (const b of list) {
        if (b.out) continue;
        b.vy += mix ? 0.28 : 0.35;
        if (mix && b.y > C + R * 0.25) {
          // 아래에서 바람이 불어 공을 띄움
          b.vy -= Math.random() * 2.6;
          b.vx += (Math.random() - 0.5) * 2.2;
        }
        b.vx *= 0.995;
        b.vy *= 0.995;
        b.x += b.vx;
        b.y += b.vy;
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
            b.vx -= 1.75 * vn * nx;
            b.vy -= 1.75 * vn * ny;
          }
        }
      }
      // 공끼리 부딪힘
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
            const k = rel * 0.95;
            a.vx += k * nx;
            a.vy += k * ny;
            b.vx -= k * nx;
            b.vy -= k * ny;
          }
        }
      }
      // 꺼내는 공: 위쪽 출구로 올라감
      for (const b of list) {
        if (!b.out) continue;
        const t = Math.min((performance.now() - b.out.start) / EXTRACT_MS, 1);
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        b.x = b.out.sx + (C - b.out.sx) * e;
        b.y = b.out.sy + (8 - b.out.sy) * e;
      }
    };

    const drawBall = (b: B) => {
      const g = ctx.createRadialGradient(b.x - 4, b.y - 5, 2, b.x, b.y, BR);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, ballColor(b.n));
      g.addColorStop(1, ballColor(b.n));
      ctx.beginPath();
      ctx.arc(b.x, b.y, BR, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '800 11px Pretendard Variable, Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(b.n), b.x, b.y + 0.5);
    };

    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      // 출구 관
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(C - 17, -4, 34, C - R + 14, 6);
      ctx.fill();
      ctx.stroke();
      // 유리 통
      const glass = ctx.createRadialGradient(C - 50, C - 60, 10, C, C, R);
      glass.addColorStop(0, 'rgba(255,255,255,0.35)');
      glass.addColorStop(1, 'rgba(255,255,255,0.06)');
      ctx.beginPath();
      ctx.arc(C, C, R, 0, Math.PI * 2);
      ctx.fillStyle = glass;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.stroke();
      for (const b of balls.current) if (!b.out) drawBall(b);
      for (const b of balls.current) if (b.out) drawBall(b);
      // 반사광
      ctx.beginPath();
      ctx.arc(C, C, R - 10, Math.PI * 1.1, Math.PI * 1.45);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
    };

    // 화면 주사율과 관계없이 1초에 60번 계산한다 (느린 기기에서도 같은 속도)
    let last = performance.now();
    let acc = 0;
    const loop = (ts: number) => {
      acc += Math.min(ts - last, 100);
      last = ts;
      while (acc >= 1000 / 60) {
        step();
        acc -= 1000 / 60;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvas} className="machine-canvas" style={{ width: SIZE, height: SIZE }} role="img" aria-label="로또 추첨기" />;
}
