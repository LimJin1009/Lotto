// 추첨기 소리. 파일 없이 브라우저가 직접 만든다(Web Audio): 앱 용량이 그대로고 저작권 걱정이 없다.
// TV 추첨 방송처럼 "둥둥둥… 짠!" 하는 긴장감을 낸다. 귀를 찌르는 높은 소리는 깎아서 거슬리지 않게 했다.
// - 섞이는 동안: 팀파니 "둥둥둥"이 점점 세지고, 부드러운 화음이 서서히 밝아지며 차오른다 (딱딱한 잡음 소리는 쓰지 않음)
// - 공이 나올 때: "쿵-짠!" (북 + 짧은 화음, 나올수록 한 음씩 올라감). 긴장 소리는 다시 작게부터
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
  return ctx;
}

// 막 깨우는 중(suspended)이어도 미리 예약해 두면 깨어나는 순간 울린다
const ready = () => !!ctx && on && ctx.state !== 'closed';

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

/** 팀파니 한 타: 끝이 둥글게 "둥" (딱딱한 잡음 없이 음만) */
function timpani(t: number, vol: number, f = 110) {
  if (!ctx || !master) return;
  for (const [ratio, amp] of [[1, 1], [1.5, 0.35], [2, 0.2]] as const) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * ratio * 1.03, t);
    o.frequency.exponentialRampToValueAtTime(f * ratio, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.015); // 살짝 늦게 올라와 딱 소리가 없다
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.5);
  }
}

// ── 긴장 올리는 소리 ──
// 팀파니가 1초에 12번 "둥둥둥" 점점 세지고, 밑에 부드러운 화음이 서서히 밝아지며 차오른다.
// 공이 나오면 둘 다 작게부터 다시.
let rollTimer = 0;
let rollNext = 0;
let rollFrom = 0; // 이번 크레센도가 시작된 시각
let rollLevel = 0; // 나온 공 수(많을수록 밑바탕이 세짐)
let riser: { g: GainNode; f: BiquadFilterNode; o: OscillatorNode[] } | null = null;
const GROW = 2.4; // 몇 초에 걸쳐 가장 커지나

function rollTick() {
  if (!ready() || !ctx) return;
  if (rollNext < ctx.currentTime - 0.1) rollNext = ctx.currentTime; // 잠깐 멈췄다 오면 밀린 걸 한꺼번에 치지 않게
  while (rollNext < ctx.currentTime + 0.1) {
    const grow = Math.max(0, Math.min(1, (rollNext - rollFrom) / GROW));
    const vol = (0.07 + rollLevel * 0.01 + grow * 0.16) * (0.85 + Math.random() * 0.15);
    timpani(rollNext, vol, 110 * (Math.round((rollNext - rollFrom) * 12) % 2 ? 1 : 1.0595)); // 두 북을 번갈아
    rollNext += 1 / 12;
  }
}
/** 부드러운 화음을 서서히 밝게 차오르게 */
function riserUp(t: number) {
  if (!ctx || !master) return;
  if (!riser) {
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    g.gain.value = 0.0001;
    f.connect(g).connect(master);
    const o: OscillatorNode[] = [];
    for (const m of [57, 64, 69]) {
      for (const det of [-8, 8]) {
        const x = ctx.createOscillator();
        x.type = 'sawtooth';
        x.frequency.value = hz(m);
        x.detune.value = det;
        x.connect(f);
        x.start(t);
        o.push(x);
      }
    }
    riser = { g, f, o };
  }
  const { g, f } = riser;
  g.gain.cancelScheduledValues(t);
  f.frequency.cancelScheduledValues(t);
  g.gain.setTargetAtTime(0.012 + rollLevel * 0.002, t, 0.05);
  g.gain.setTargetAtTime(0.04 + rollLevel * 0.004, t + 0.1, GROW / 2.5);
  f.frequency.setTargetAtTime(250, t, 0.05);
  f.frequency.setTargetAtTime(1600, t + 0.1, GROW / 2);
}
function riserOff(t: number) {
  if (!riser || !ctx) return;
  const r = riser;
  riser = null;
  r.g.gain.cancelScheduledValues(t);
  r.g.gain.setTargetAtTime(0.0001, t, 0.08);
  r.o.forEach((x) => x.stop(t + 0.6));
}
function rollStart() {
  if (!ctx) return;
  rollStop();
  rollFrom = rollNext = ctx.currentTime + 0.05;
  riserUp(rollFrom);
  rollTimer = window.setInterval(rollTick, 25);
  rollTick();
}
function rollStop() {
  clearInterval(rollTimer);
  rollTimer = 0;
  if (ctx) riserOff(ctx.currentTime);
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
    riserUp(rollFrom);
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
