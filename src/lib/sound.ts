// 추첨기 소리. 파일 없이 브라우저가 직접 만든다(Web Audio): 앱 용량이 그대로고 저작권 걱정이 없다.
// 야구장 응원처럼: 응원 북 "쿵, 쿵, 둥둥둥" + 나팔 소리. 전자 오르간 같은 소리와 딱딱한 잡음(스네어·박수)은 쓰지 않는다.
// - 섞이는 동안: 응원 북이 깔리고, 공이 나오기 전까지 점점 세지다가 "둥둥둥둥" 몰아친다
// - 공이 나올 때: 나팔 "빠밤!"(나올수록 한 음씩 올라감). 북은 다시 작게부터
// - 6개를 다 뽑으면: 야구장 "차지" 나팔 "따라라 딴~ 따 따—!"
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

/** 큰북 "쿵": 잡음 없이 아래로 떨어지는 음만 */
function kick(t: number, vol: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.15);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.32);
}

/** 응원 북 "둥": 큰북보다 높고 짧게, 끝이 둥글게 */
function tom(t: number, vol: number, f: number) {
  if (!ctx || !master) return;
  for (const [ratio, amp] of [[1, 1], [1.6, 0.3]] as const) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * ratio * 1.4, t);
    o.frequency.exponentialRampToValueAtTime(f * ratio, t + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.3);
  }
}

/**
 * 나팔(트럼펫) 한 음. 오르간처럼 납작하지 않게:
 * 살짝 아래에서 밀어 올리듯 음이 시작되고, 소리가 "빠—" 하고 밝아졌다가 가라앉고, 긴 음엔 떨림을 준다.
 */
function horn(t: number, m: number, dur: number, vol: number) {
  if (!ctx || !master) return;
  const f = hz(m);
  const fl = ctx.createBiquadFilter();
  const g = ctx.createGain();
  fl.type = 'lowpass';
  fl.Q.value = 1.2;
  fl.frequency.setValueAtTime(350, t);
  fl.frequency.exponentialRampToValueAtTime(3200, t + 0.04);
  fl.frequency.setTargetAtTime(1700, t + 0.06, 0.08);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.025);
  g.gain.setTargetAtTime(vol * 0.75, t + 0.05, 0.06);
  g.gain.setTargetAtTime(0.0001, t + dur - 0.03, 0.03);
  fl.connect(g).connect(master);
  const vib = ctx.createOscillator();
  const vibAmt = ctx.createGain();
  vib.frequency.value = 5.5;
  vibAmt.gain.setValueAtTime(0, t);
  if (dur > 0.3) vibAmt.gain.linearRampToValueAtTime(f * 0.008, t + dur); // 긴 음은 점점 떨리게
  vib.connect(vibAmt);
  for (const det of [-5, 5]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.97, t); // 아래에서 밀어 올리듯
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    o.detune.value = det;
    vibAmt.connect(o.frequency);
    o.connect(fl);
    o.start(t);
    o.stop(t + dur + 0.15);
  }
  vib.start(t);
  vib.stop(t + dur + 0.15);
}

// ── 응원 북 ──
// 야구장 응원처럼 "쿵, 쿵, 둥둥둥" (8분음 8칸 중 0·2·4·5·6에 친다). 공이 나오기 전까지 점점 세지고 빨라진다.
const HITS = [1, 0, 1, 0, 1, 1, 1, 0];
const BPM = 120;
const EIGHTH = 60 / BPM / 2;
const GROW = 2.2; // 몇 초에 걸쳐 가장 세지나

let timer = 0;
let step = 0;
let nextT = 0;
let buildFrom = 0; // 이번에 세지기 시작한 시각
let level = 0; // 나온 공 수(많을수록 전체가 조금씩 더 셈)

function tick() {
  if (!ready() || !ctx) return;
  if (nextT < ctx.currentTime - 0.1) nextT = ctx.currentTime; // 잠깐 멈췄다 오면 밀린 걸 한꺼번에 치지 않게
  while (nextT < ctx.currentTime + 0.12) {
    const t = nextT;
    const i = step % 8;
    const grow = Math.max(0, Math.min(1, (t - buildFrom) / GROW));
    const vol = 0.22 + grow * 0.25 + level * 0.02;
    if (grow > 0.7) {
      // 꼭대기 무렵엔 "둥둥둥둥" 몰아친다
      tom(t, vol, 150);
      tom(t + EIGHTH / 2, vol * 0.8, 165);
    } else if (HITS[i]) {
      if (i === 0 || i === 2) kick(t, vol + 0.1);
      else tom(t, vol, i === 5 ? 165 : 150);
    }
    nextT += EIGHTH;
    step++;
  }
}
function drumStart(at: number) {
  if (!ctx) return;
  drumStop();
  step = 0;
  nextT = buildFrom = at;
  timer = window.setInterval(tick, 25);
  tick();
}
function drumStop() {
  clearInterval(timer);
  timer = 0;
}

/** 추첨 시작: 나팔 "빠-밤!" 하고 응원 북이 시작된다 */
export function soundStart() {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.02;
  horn(t, 67, 0.12, 0.07);
  horn(t + 0.14, 72, 0.3, 0.08);
  kick(t + 0.14, 0.5);
  level = 0;
  drumStart(t + 0.6);
}

/** 공 하나가 나왔을 때 나팔 "빠밤!" (k번째일수록 한 음씩 올라간다). 북은 다시 작게부터 */
export function soundPop(k: number) {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.01;
  const up = [0, 2, 4, 5, 7, 9][k % 6];
  kick(t, 0.55);
  horn(t, 67 + up, 0.09, 0.07);
  horn(t + 0.1, 72 + up, 0.32, 0.08);
  horn(t + 0.1, 76 + up, 0.32, 0.05); // 화음으로 두툼하게
  level = k + 1;
  buildFrom = t + 0.5;
  nextT = Math.max(nextT, t + 0.5);
  if (k >= 5) drumStop();
}

/**
 * 한 게임(6개)을 다 뽑았을 때: 야구장 "차지(Charge)" 나팔 "따라라 딴~ 따 따—!"
 * 옛 군대 나팔 신호에서 온 누구나 쓰는 가락이다.
 */
export function soundDone() {
  drumStop();
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.35;
  const n = 0.13; // 짧은 음 길이
  const notes: [number, number, number][] = [
    [0, 67, n], // 솔
    [n, 72, n], // 도
    [2 * n, 76, n], // 미
    [3 * n, 79, 0.32], // 솔—
    [3 * n + 0.36, 76, n], // 미
    [4 * n + 0.38, 79, 0.9], // 솔————
  ];
  for (const [at, m, d] of notes) {
    horn(t + at, m, d, 0.08);
    horn(t + at, m - 12, d, 0.035); // 한 옥타브 아래를 겹쳐 힘 있게
  }
  kick(t + 3 * n, 0.45);
  kick(t + 4 * n + 0.38, 0.6);
}

/** 화면을 떠나는 등 추첨이 중간에 멈출 때 */
export function soundStop() {
  drumStop();
}

// 다른 앱으로 가면 소리를 잠시 멈춘다
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else if (on) ctx.resume().catch(() => {});
});
