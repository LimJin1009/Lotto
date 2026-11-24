// 추첨기 소리. 파일 없이 브라우저가 직접 만든다(Web Audio): 앱 용량이 그대로고 저작권 걱정이 없다.
// 거친 소리(바람·딸깍)는 빼고, 유리종처럼 맑고 부드러운 소리에 은은한 울림(홀 잔향)을 입혔다.
// - 추첨 시작: 위로 흩어지는 맑은 음 몇 개
// - 섞이는 동안: 공이 세게 부딪칠 때 가끔 "띵—" (5음 음계라 아무렇게 겹쳐도 어울린다)
// - 공이 나올 때: 종소리 한 번 (나올수록 한 음씩 올라감)
// - 6개를 다 뽑으면: 종소리 화음
// 버스·사무실에서 몰래 여는 경우가 많아 처음엔 꺼 둔다. 🔊 버튼으로 켜면 기억한다.
// 브라우저 규칙상 손가락으로 누른 뒤에만 소리를 낼 수 있어서, 버튼을 누를 때 소리 장치를 깨운다.

const KEY = 'lotto.sound';
let on = false;
try {
  on = localStorage.getItem(KEY) === 'on';
} catch {
  /* 저장소를 못 쓰면 꺼진 채로 */
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let outGain: GainNode | null = null;
let lastChime = 0;

/** 잔향(홀 울림): 서서히 사그라드는 잡음을 만들어 울림판으로 쓴다 */
function makeHall(c: AudioContext, sec: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * sec);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      lp += (Math.random() * 2 - 1 - lp) * 0.35; // 날카로운 고음을 깎아 따뜻하게
      d[i] = lp * (1 - i / len) ** 2.5;
    }
  }
  return buf;
}

function init(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  comp.connect(ctx.destination);
  const out = ctx.createGain();
  out.gain.value = on ? 1 : 0;
  out.connect(comp);
  // 소리 → (그대로) + (잔향) → 출력
  master = ctx.createGain();
  const hall = ctx.createConvolver();
  hall.buffer = makeHall(ctx, 2.2);
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  master.connect(out);
  master.connect(hall).connect(wet).connect(out);
  outGain = out;
  return ctx;
}

const ready = () => !!ctx && on && ctx.state === 'running';

/** 버튼을 누르는 순간에 부른다: 소리 장치를 깨운다(꺼져 있으면 아무것도 안 함) */
export function unlock() {
  if (!on) return;
  const c = init();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}
export const isSoundOn = () => on;
export function setSoundOn(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? 'on' : 'off');
  } catch {
    /* 저장 못 해도 이번엔 적용 */
  }
  if (v) unlock();
  if (ctx && outGain) outGain.gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, 0.03);
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * 유리종 소리 한 번. 기본음 + 종 특유의 어긋난 배음 몇 개를 겹치고,
 * 높은 배음일수록 빨리 사라지게 해서 "띵—" 하고 맑게 남는다.
 */
function bell(t: number, f: number, vol: number, dur = 1.2) {
  if (!ctx || !master) return;
  const parts: [number, number, number][] = [
    [1, 1, 1],
    [2.0, 0.35, 0.55],
    [2.76, 0.18, 0.35],
    [5.4, 0.06, 0.18],
  ];
  for (const [ratio, amp, life] of parts) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * ratio;
    const end = t + dur * life;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(end + 0.05);
  }
}

// A장조 5음 음계(라·시·도#·미·파#): 아무 음이나 겹쳐도 어울린다
const PENTA = [69, 71, 73, 76, 78, 81, 83, 85, 88, 90];

/**
 * 추첨기 화면이 매 장면마다 부른다.
 * air: 바람 세기(0~1), hits: 이번 장면에 세게 부딪친 공의 수
 * 공이 부딪칠 때 가끔(1초에 서너 번) 작은 유리종이 울린다.
 */
export function ambience(air: number, hits: number) {
  if (!ready() || !ctx || hits <= 0) return;
  const now = ctx.currentTime;
  if (now - lastChime < 0.22 + Math.random() * 0.25) return;
  lastChime = now;
  const n = PENTA[Math.floor(Math.random() * PENTA.length)] + 12;
  bell(now + 0.01, hz(n), (0.025 + air * 0.02) * (0.6 + Math.random() * 0.4), 0.9);
}

/** 추첨 시작: 위로 흩어지는 맑은 음 */
export function soundStart() {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.02;
  [69, 73, 76, 81, 85].forEach((m, i) => bell(t + i * 0.06, hz(m + 12), 0.05, 1.0));
}

/** 공 하나가 나왔을 때 종소리 (k번째일수록 한 음씩 올라간다) */
export function soundPop(k: number) {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.01;
  const m = PENTA[k % 6];
  bell(t, hz(m), 0.16, 1.6);
}

/** 한 게임(6개)을 다 뽑았을 때 종소리 화음 */
export function soundDone() {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.25;
  [57, 64, 69, 73, 76].forEach((m, i) => bell(t + i * 0.09, hz(m + 12), 0.11, 2.6));
}

// 다른 앱으로 가면 소리를 잠시 멈춘다
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else if (on) ctx.resume().catch(() => {});
});
