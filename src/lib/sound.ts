// 추첨기 소리. 파일 없이 브라우저가 직접 만든다(Web Audio): 앱 용량이 그대로고 저작권 걱정이 없다.
// - 바람 소리: 추첨기에 바람이 불 때 "쉬이—"
// - 공 소리: 공이 통이나 서로 부딪칠 때 "딸깍" (많이 세게 부딪칠수록 자주)
// - 공이 나올 때 "톡", 6개를 다 뽑으면 "짠"
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
let noiseBuf: AudioBuffer | null = null;
let hiss: { g: GainNode; f: BiquadFilterNode } | null = null;
let lastClack = 0;

function init(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 4;
  comp.connect(ctx.destination);
  master = ctx.createGain();
  master.gain.value = on ? 1 : 0;
  master.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // 바람 소리는 계속 틀어 두고 크기만 바꾼다
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1200;
  f.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(f).connect(g).connect(master);
  src.start();
  hiss = { g, f };
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
  if (ctx && master) master.gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, 0.03);
}

function tone(t: number, f: number, f2: number, type: OscillatorType, dur: number, vol: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** 플라스틱 공이 부딪치는 "딸깍" */
function clack(t: number, vol: number) {
  if (!ctx || !master || !noiseBuf) return;
  const s = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  s.buffer = noiseBuf;
  f.type = 'bandpass';
  f.frequency.value = 2600 + Math.random() * 2600;
  f.Q.value = 6;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 1.5);
  s.stop(t + 0.05);
  tone(t, 1800 + Math.random() * 1400, 0, 'sine', 0.03, vol * 0.25);
}

/**
 * 추첨기 화면이 매 장면마다 부른다.
 * air: 바람 세기(0~1), hits: 이번 장면에 세게 부딪친 공의 수
 */
export function ambience(air: number, hits: number) {
  if (!ready() || !ctx || !hiss) return;
  const now = ctx.currentTime;
  hiss.g.gain.setTargetAtTime(air * 0.09, now, 0.12);
  hiss.f.frequency.setTargetAtTime(900 + air * 900, now, 0.2);
  // 너무 다닥다닥 겹치지 않게 1초에 최대 약 40번
  if (hits > 0 && now - lastClack > 0.025) {
    lastClack = now;
    clack(now + Math.random() * 0.01, Math.min(0.5, 0.12 + hits * 0.05));
  }
}

/** 추첨 시작: 바람이 들어가는 "푸슉" */
export function soundStart() {
  if (!ready() || !ctx || !master || !noiseBuf) return;
  const t = ctx.currentTime + 0.01;
  const s = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  s.buffer = noiseBuf;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(4000, t + 0.4);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + 0.65);
}

/** 공 하나가 나왔을 때 "톡" (k번째일수록 조금씩 높아진다) */
export function soundPop(k: number) {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.01;
  const base = 660 * 2 ** (([0, 2, 4, 5, 7, 9][k % 6] ?? 0) / 12);
  tone(t, base * 1.6, base, 'sine', 0.09, 0.3);
  tone(t + 0.02, base * 2, 0, 'triangle', 0.18, 0.12);
}

/** 한 게임(6개)을 다 뽑았을 때 "짠" */
export function soundDone() {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.05;
  [72, 76, 79, 84].forEach((m, i) => {
    const f = 440 * 2 ** ((m - 69) / 12);
    tone(t + i * 0.07, f, 0, 'triangle', i === 3 ? 0.7 : 0.2, 0.16);
    tone(t + i * 0.07, f * 2, 0, 'sine', i === 3 ? 0.5 : 0.12, 0.05);
  });
}

// 다른 앱으로 가면 소리를 잠시 멈춘다
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else if (on) ctx.resume().catch(() => {});
});
