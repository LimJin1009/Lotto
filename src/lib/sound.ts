// 추첨기 소리. 파일 없이 브라우저가 직접 만든다(Web Audio): 앱 용량이 그대로고 저작권 걱정이 없다.
// TV 추첨 방송처럼 "두구두구두구… 짠!" 하는 긴장감을 낸다. 귀를 찌르는 높은 소리는 깎아서 거슬리지 않게 했다.
// - 섞이는 동안: 부드러운 드럼롤이 점점 커진다 (공이 나올수록 밑바탕이 조금씩 더 세짐)
// - 공이 나올 때: "쿵-짠!" (북 + 짧은 화음, 나올수록 한 음씩 올라감). 드럼롤은 다시 작게부터
// - 6개를 다 뽑으면: "따-단!" 팡파르
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
let noiseBuf: AudioBuffer | null = null;

/** 짧은 잔향: 소리가 방 안에서 울리는 느낌만 살짝 */
function makeRoom(c: AudioContext, sec: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * sec);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      lp += (Math.random() * 2 - 1 - lp) * 0.3;
      d[i] = lp * (1 - i / len) ** 3;
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
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.connect(ctx.destination);
  outGain = ctx.createGain();
  outGain.gain.value = on ? 1 : 0;
  // 귀를 찌르는 높은 소리를 깎는다
  const soft = ctx.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 6000;
  soft.Q.value = 0.5;
  soft.connect(outGain);
  outGain.connect(comp);
  master = ctx.createGain();
  const room = ctx.createConvolver();
  room.buffer = makeRoom(ctx, 1.2);
  const wet = ctx.createGain();
  wet.gain.value = 0.18;
  master.connect(soft);
  master.connect(room).connect(wet).connect(soft);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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

/** 스네어 한 타: 잡음을 중간 음역만 남겨 "타" 소리 */
function snare(t: number, vol: number) {
  if (!ctx || !master || !noiseBuf) return;
  const s = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  s.buffer = noiseBuf;
  f.type = 'bandpass';
  f.frequency.value = 1700;
  f.Q.value = 0.7;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 1.8);
  s.stop(t + 0.08);
}

/** 북 한 타: 아래로 떨어지는 낮은 음 "쿵" */
function drum(t: number, vol: number, from = 150, to = 65, dur = 0.28) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** 금관 느낌의 화음 한 번: 톱니파를 필터로 열었다 닫아 "빠-" */
function stab(t: number, notes: number[], vol: number, dur: number) {
  if (!ctx || !master) return;
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  f.type = 'lowpass';
  f.Q.value = 1;
  f.frequency.setValueAtTime(500, t);
  f.frequency.exponentialRampToValueAtTime(3200, t + 0.04);
  f.frequency.exponentialRampToValueAtTime(900, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.setTargetAtTime(vol * 0.6, t + 0.05, 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(master);
  for (const m of notes) {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(m);
      o.detune.value = det; // 두 개를 살짝 어긋나게 겹쳐 풍성하게
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}

// ── 드럼롤 ──
// 1초에 16번 "타"를 예약해 둔다. 공이 나올 때마다 작게 시작해 다시 커진다.
let rollTimer = 0;
let rollNext = 0;
let rollFrom = 0; // 이번 크레센도가 시작된 시각
let rollLevel = 0; // 나온 공 수(많을수록 밑바탕이 세짐)
function rollTick() {
  if (!ready() || !ctx) return;
  if (rollNext < ctx.currentTime - 0.1) rollNext = ctx.currentTime; // 잠깐 멈췄다 오면 밀린 걸 한꺼번에 치지 않게
  while (rollNext < ctx.currentTime + 0.1) {
    const grow = Math.min(1, (rollNext - rollFrom) / 2.2);
    const base = 0.03 + rollLevel * 0.006;
    const vol = (base + grow * 0.09) * (0.8 + Math.random() * 0.2);
    snare(rollNext, vol);
    if (Math.round((rollNext - rollFrom) * 16) % 4 === 0) drum(rollNext, 0.06 + grow * 0.08, 120, 80, 0.15); // 낮게 "둥" 받쳐 줌
    rollNext += 1 / 16;
  }
}
function rollStart() {
  if (!ctx) return;
  rollStop();
  rollFrom = rollNext = ctx.currentTime + 0.05;
  rollTimer = window.setInterval(rollTick, 25);
  rollTick();
}
function rollStop() {
  clearInterval(rollTimer);
  rollTimer = 0;
}

/** 추첨 시작: "쿵!" 하고 드럼롤이 깔린다 */
export function soundStart() {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.02;
  drum(t, 0.5, 170, 55, 0.4);
  rollLevel = 0;
  rollStart();
}

/** 공 하나가 나왔을 때 "쿵-짠!" (k번째일수록 한 음씩 올라간다). 드럼롤은 작게부터 다시 */
export function soundPop(k: number) {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.01;
  const up = [0, 2, 4, 5, 7, 9][k % 6];
  drum(t, 0.45);
  stab(t, [64 + up, 69 + up], 0.07, 0.32);
  rollLevel = k + 1;
  if (k < 5) {
    rollFrom = t + 0.35;
    rollNext = Math.max(rollNext, rollFrom);
  } else rollStop();
}

/** 한 게임(6개)을 다 뽑았을 때 "따-단!" */
export function soundDone() {
  rollStop();
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.3;
  stab(t, [64, 69, 73], 0.07, 0.16);
  drum(t, 0.3);
  stab(t + 0.18, [69, 73, 76, 81], 0.09, 1.1);
  drum(t + 0.18, 0.55, 160, 50, 0.5);
}

/** 화면을 떠나는 등 추첨이 중간에 멈출 때 */
export function soundStop() {
  rollStop();
}

// 다른 앱으로 가면 소리를 잠시 멈춘다
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else if (on) ctx.resume().catch(() => {});
});
