// 추첨기 소리. 파일 없이 브라우저가 직접 만든다(Web Audio): 앱 용량이 그대로고 저작권 걱정이 없다.
// K팝 댄스곡처럼: 124BPM 쿵쿵 킥 + 킥마다 숨 쉬듯 출렁이는 신스 화음 + 통통 튀는 베이스 + 반짝이는 아르페지오.
// 딱딱한 잡음(스네어·박수) 소리는 일부러 쓰지 않는다.
// - 섞이는 동안: 비트가 깔리고, 공이 나오기 전까지 아르페지오가 점점 밝아지고 킥이 빨라지며 차오른다(빌드업)
// - 공이 나올 때: "짠!" 터지는 신스 화음(나올수록 한 음씩 올라감). 빌드업은 다시 처음부터
// - 6개를 다 뽑으면: 짧은 후렴 멜로디 + 마무리 화음
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
let padBus: GainNode | null = null; // 킥이 칠 때마다 작아졌다 커지는 화음 통로(출렁임)

/** 짧은 잔향: 넓게 퍼지는 느낌만 살짝 */
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
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  comp.connect(ctx.destination);
  outGain = ctx.createGain();
  outGain.gain.value = on ? 1 : 0;
  outGain.connect(comp);
  // 폰 스피커에서 웅웅대기만 하는 아주 낮은 소리와, 귀를 찌르는 아주 높은 소리를 깎는다
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 45;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 9000;
  hp.connect(lp).connect(outGain);
  master = ctx.createGain();
  const room = ctx.createConvolver();
  room.buffer = makeRoom(ctx, 1.4);
  const wet = ctx.createGain();
  wet.gain.value = 0.12;
  master.connect(hp);
  master.connect(room).connect(wet).connect(hp);
  padBus = ctx.createGain();
  padBus.connect(master);
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

// ── 악기 ──

/** 킥: 짧고 단단한 "둠". 잡음 없이 아래로 떨어지는 음만 */
function kick(t: number, vol: number) {
  if (!ctx || !master || !padBus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.14);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.25);
  // 킥이 칠 때 화음이 잠깐 작아졌다 다시 커진다(K팝·EDM 특유의 출렁임)
  padBus.gain.setValueAtTime(0.25, t);
  padBus.gain.linearRampToValueAtTime(1, t + 0.2);
}

/** 슈퍼쏘: 톱니파 여러 개를 살짝 어긋나게 겹친 넓고 화려한 신스 화음 */
function supersaw(t: number, notes: number[], dur: number, vol: number, cutFrom: number, cutTo: number, bus: AudioNode) {
  if (!ctx) return;
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  f.type = 'lowpass';
  f.Q.value = 0.8;
  f.frequency.setValueAtTime(cutFrom, t);
  f.frequency.exponentialRampToValueAtTime(cutTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.setTargetAtTime(vol * 0.7, t + 0.05, 0.1);
  g.gain.setTargetAtTime(0.0001, t + dur * 0.8, dur * 0.12);
  f.connect(g).connect(bus);
  for (const m of notes) {
    for (const det of [-14, 0, 14]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(m);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.3);
    }
  }
}

/** 플럭: "똥" 하고 튕기는 짧은 신스 음 */
function pluck(t: number, m: number, vol: number, bright: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = hz(m);
  f.type = 'lowpass';
  f.Q.value = 3;
  f.frequency.setValueAtTime(bright, t);
  f.frequency.exponentialRampToValueAtTime(400, t + 0.12);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.2);
}

/** 베이스: 통통 튀는 낮은 신스 */
function bass(t: number, m: number, dur: number, vol: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.value = hz(m);
  f.type = 'lowpass';
  f.Q.value = 2;
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(250, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// ── 비트 ──
// 코드 진행: F#m – D – A – E (K팝에서 자주 쓰는 6-4-1-5). 한 마디에 코드 하나.
const CHORDS = [
  [54, 57, 61],
  [50, 54, 57],
  [57, 61, 64],
  [52, 56, 59],
];
const ARP = [0, 1, 2, 1, 2, 0, 1, 2]; // 아르페지오 순서
const BPM = 124;
const SP = 60 / BPM / 4; // 16분음 길이
const GROW = 2.2; // 몇 초에 걸쳐 빌드업이 꼭대기에 닿나

let timer = 0;
let step = 0;
let nextT = 0;
let buildFrom = 0; // 이번 빌드업이 시작된 시각
let level = 0; // 나온 공 수(많을수록 전체가 조금씩 더 신남)

function tick() {
  if (!ready() || !ctx || !padBus) return;
  if (nextT < ctx.currentTime - 0.1) nextT = ctx.currentTime; // 잠깐 멈췄다 오면 밀린 걸 한꺼번에 치지 않게
  while (nextT < ctx.currentTime + 0.12) {
    const t = nextT;
    const i = step % 16;
    const chord = CHORDS[Math.floor(step / 16) % 4];
    const grow = Math.max(0, Math.min(1, (t - buildFrom) / GROW));

    // 킥: 한 박에 한 번, 빌드업 끝 무렵엔 두 배로 빨라진다
    if (i % 4 === 0 || (grow > 0.65 && i % 2 === 0)) kick(t, i % 4 === 0 ? 0.55 : 0.3 + grow * 0.15);
    // 마디 첫 박에 화음을 깐다 (빌드업할수록 밝아짐)
    if (i === 0) supersaw(t, chord.map((m) => m + 12), SP * 16, 0.028 + level * 0.002, 700 + grow * 1500, 1200 + grow * 3000, padBus);
    // 베이스: 박과 박 사이에 통통
    if (i % 4 === 2 || i % 4 === 3) bass(t, chord[0] - 12, SP * 0.9, 0.12);
    // 아르페지오: 빌드업할수록 크고 밝아짐
    const n = chord[ARP[i % 8]] + (i % 16 < 8 ? 24 : 12);
    pluck(t, n, 0.015 + grow * 0.04 + level * 0.003, 1500 + grow * 4500);

    nextT += SP;
    step++;
  }
}
function beatStart() {
  if (!ctx) return;
  beatStop();
  step = 0;
  nextT = buildFrom = ctx.currentTime + 0.05;
  timer = window.setInterval(tick, 25);
  tick();
}
function beatStop() {
  clearInterval(timer);
  timer = 0;
}

/** 추첨 시작: "슈웅~" 올라가는 소리와 함께 비트가 시작된다 */
export function soundStart() {
  if (!ready() || !ctx || !master) return;
  const t = ctx.currentTime + 0.02;
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.35);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(600, t);
  f.frequency.exponentialRampToValueAtTime(4000, t + 0.35);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.45);
  level = 0;
  beatStart();
}

/** 공 하나가 나왔을 때 "짠!" (k번째일수록 한 음씩 올라간다). 빌드업은 처음부터 다시 */
export function soundPop(k: number) {
  if (!ready() || !ctx || !master) return;
  const t = ctx.currentTime + 0.01;
  const up = [0, 2, 4, 5, 7, 9][k % 6];
  kick(t, 0.6);
  supersaw(t, [69 + up, 73 + up, 76 + up], 0.45, 0.05, 5000, 900, master);
  pluck(t, 81 + up, 0.06, 6000);
  level = k + 1;
  buildFrom = t + 0.25;
  if (k >= 5) beatStop();
}

/** 한 게임(6개)을 다 뽑았을 때: 짧은 후렴 멜로디 + 마무리 화음 */
export function soundDone() {
  beatStop();
  if (!ready() || !ctx || !master) return;
  const t = ctx.currentTime + 0.3;
  [76, 78, 81, 85, 83, 81].forEach((m, i) => pluck(t + i * SP * 1.5, m, 0.06, 5000));
  const end = t + 6 * SP * 1.5;
  kick(end, 0.6);
  supersaw(end, [57, 64, 69, 73, 76], 1.6, 0.045, 4500, 700, master);
}

/** 화면을 떠나는 등 추첨이 중간에 멈출 때 */
export function soundStop() {
  beatStop();
}

// 다른 앱으로 가면 소리를 잠시 멈춘다
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else if (on) ctx.resume().catch(() => {});
});
