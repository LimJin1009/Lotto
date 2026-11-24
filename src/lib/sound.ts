// 추첨기 소리. 파일 없이 브라우저가 직접 만든다(Web Audio): 앱 용량이 그대로고 저작권 걱정이 없다.
// 경기장 선수 입장 분위기로 새로 지은 곡(다른 곡을 베끼지 않음): 큰북·팀파니 심장 박동 + 마림바 반복 가락 + 철금 + 관중 떼창 "오—" + 넓은 공연장 울림.
// 전자 오르간 같은 소리와 딱딱한 잡음(스네어·박수)은 쓰지 않는다.
// - 섞이는 동안: 반복 가락이 깔리고, 공이 나오기 전까지 철금이 얹히며 커지다 팀파니가 "두르르르" 몰아친다
// - 공이 나올 때: 큰북·팀파니 "두-둥!" + 철금 "띵" + 관중 "오!"(나올수록 음이 올라감)
// - 6개를 다 뽑으면: 마무리 가락 후 밝은 화음 + 큰북 + 관중 "오—오—!"
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

/** 공연장 울림: 넓은 홀에 퍼지며 길게 남는다(웅장하게) */
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
  room.buffer = makeRoom(ctx, 2.8);
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
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

/** 큰북 "쿵": 잡음 없이 아래로 떨어지는 낮은 음만 */
function kick(t: number, vol: number, from = 120, to = 42, dur = 0.45) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** 팀파니 "둥": 오케스트라 북. 음이 있고 끝이 둥글게 길게 울린다 */
function timpani(t: number, vol: number, f: number, dur = 0.7) {
  if (!ctx || !master) return;
  for (const [ratio, amp] of [
    [1, 1],
    [1.5, 0.4],
    [1.99, 0.25],
    [2.44, 0.12],
  ] as const) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * ratio * 1.25, t);
    o.frequency.exponentialRampToValueAtTime(f * ratio, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur / ratio);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

/** 글로켄슈필(철금) "띵": 맑고 짧게 반짝이는 쇠막대 소리 */
function glock(t: number, m: number, vol: number) {
  if (!ctx || !master) return;
  const f = hz(m);
  for (const [ratio, amp, life] of [
    [1, 1, 1.2],
    [2.76, 0.3, 0.4],
    [5.4, 0.12, 0.15],
  ] as const) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * ratio;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + life);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + life + 0.02);
  }
}

/** 마림바 "똥": 나무 건반을 채로 치는 따뜻한 소리 */
function marimba(t: number, m: number, vol: number, life0 = 0.7) {
  if (!ctx || !master) return;
  const f = hz(m);
  for (const [ratio, amp, life] of [
    [1, 1, life0],
    [3.9, 0.25, 0.12],
    [9.2, 0.06, 0.05],
  ] as const) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * ratio;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + life);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + life + 0.02);
  }
}

/**
 * 관중 떼창 "오—": 여러 사람 목소리처럼 음을 조금씩 어긋나게 겹치고,
 * 사람 입 모양 "오"에서 울리는 대역(약 450Hz·850Hz)만 남겨 목소리처럼 들리게 한다.
 */
function crowd(t: number, m: number, dur: number, vol: number) {
  if (!ctx || !master) return;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(vol, t + 0.07);
  out.gain.setTargetAtTime(vol * 0.8, t + 0.1, 0.1);
  out.gain.setTargetAtTime(0.0001, t + dur - 0.05, 0.07);
  out.connect(master);
  for (const [fc, q, amp] of [
    [450, 5, 1],
    [850, 6, 0.6],
  ] as const) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = fc;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = amp;
    bp.connect(g).connect(out);
    for (const [oct, det] of [
      [0, -14],
      [0, -5],
      [0, 6],
      [0, 15],
      [-12, -8],
      [-12, 9],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(hz(m + oct) * 0.96, t); // 사람이 소리 지르듯 살짝 아래에서 올라간다
      o.frequency.exponentialRampToValueAtTime(hz(m + oct), t + 0.08);
      o.detune.value = det;
      const vib = ctx.createOscillator();
      const va = ctx.createGain();
      vib.frequency.value = 4.5 + Math.random() * 1.5;
      va.gain.value = hz(m + oct) * 0.01;
      vib.connect(va).connect(o.frequency);
      o.connect(bp);
      o.start(t);
      vib.start(t);
      o.stop(t + dur + 0.3);
      vib.stop(t + dur + 0.3);
    }
  }
}

// ── 선수 입장 곡(새로 지은 곡) ──
// 경기장 조명이 꺼지고 선수가 들어오는 분위기. D단조, 1분에 100박.
// - 큰북·팀파니가 심장 뛰듯 "쿵… 쿵…" 울리고, 마림바가 낮게 반복하는 가락을 깐다.
// - 공이 나오기 전까지 반복 가락에 철금이 얹히며 커지고, 꼭대기에선 팀파니가 "두르르르" 몰아친다.
// 코드: Dm – B♭ – F – C (한 마디씩)
const ROOTS = [50, 46, 53, 48]; // 레, 시♭, 파, 도
const ARP = [0, 7, 12, 15, 12, 7, 12, 19]; // 근음에서 위아래로 오르내리는 반복 가락(반음 수)
const MAJOR3 = [false, true, true, true]; // 이 마디 화음이 장조면 반복 가락의 3도를 반음 올린다(장3도)
const BPM = 100;
const EIGHTH = 60 / BPM / 2;
const GROW = 2.2; // 몇 초에 걸쳐 가장 커지나

let timer = 0;
let step = 0;
let nextT = 0;
let buildFrom = 0; // 이번에 커지기 시작한 시각
let level = 0; // 나온 공 수(많을수록 전체가 조금씩 더 셈)

function tick() {
  if (!ready() || !ctx) return;
  if (nextT < ctx.currentTime - 0.1) nextT = ctx.currentTime; // 잠깐 멈췄다 오면 밀린 걸 한꺼번에 치지 않게
  while (nextT < ctx.currentTime + 0.12) {
    const t = nextT;
    const i = step % 8;
    const bar = Math.floor(step / 8) % 4;
    const root = ROOTS[bar];
    const grow = Math.max(0, Math.min(1, (t - buildFrom) / GROW));
    const vol = 0.18 + grow * 0.2 + level * 0.015;

    // 심장 박동 "쿵… 쿵-쿵"
    if (i === 0) {
      kick(t, vol + 0.25, 110, 38, 0.6);
      timpani(t, vol * 0.8, hz(root - 24) * 2, 0.9);
    }
    if (i === 4 || i === 5) kick(t, (vol + 0.1) * (i === 5 ? 0.7 : 1), 110, 40, 0.5);

    // 반복 가락: 마림바 (장조 마디는 3도를 장3도로)
    let s = ARP[i];
    if (MAJOR3[bar] && s === 15) s = 16;
    marimba(t, root + s - 12, 0.1 + grow * 0.1, 0.5);
    // 커질수록 철금이 한 옥타브 위에서 같이 반짝인다
    if (grow > 0.3) glock(t, root + s + 12, (grow - 0.3) * 0.12);

    // 꼭대기: 팀파니 "두르르르"
    if (grow > 0.75) for (let k = 0; k < 3; k++) timpani(t + (k * EIGHTH) / 3, vol * (0.55 + k * 0.1), hz(root - 24) * 2, 0.35);

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

/** 추첨 시작: 조명이 탁 켜지듯 큰북 "쿵!" + 팀파니 + 관중 "오—", 그리고 입장 곡이 시작된다 */
export function soundStart() {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.02;
  kick(t, 0.75, 110, 34, 1.0);
  timpani(t, 0.5, 73.4, 1.6);
  crowd(t + 0.05, 62, 0.9, 0.1);
  glock(t, 86, 0.08);
  level = 0;
  drumStart(t + 0.9);
}

/** 공 하나가 나왔을 때: 큰북·팀파니 "두-둥!" + 철금 "띵" + 관중 "오!" (k번째일수록 한 음씩 올라간다) */
export function soundPop(k: number) {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.01;
  const up = [0, 2, 3, 5, 7, 10][k % 6];
  const tf = 73.4 * 2 ** (up / 12);
  timpani(t, 0.28, tf, 0.5); // 두-
  timpani(t + 0.11, 0.5, tf * 1.335, 1.1); // 둥!
  kick(t + 0.11, 0.7, 110, 40, 0.6);
  glock(t + 0.11, 86 + up, 0.12);
  glock(t + 0.11, 93 + up, 0.06);
  crowd(t + 0.11, 62 + up, 0.45, 0.09);
  level = k + 1;
  buildFrom = t + 0.6;
  nextT = Math.max(nextT, t + 0.6);
  if (k >= 5) drumStop();
}

/**
 * 한 게임(6개)을 다 뽑았을 때: 새로 지은 마무리 가락 "따-단 따—, 따 따 딴—!"을
 * 철금·마림바·팀파니로 치고, 마지막엔 D장조로 밝게 풀리며 관중 "오—오—!"와 큰북으로 끝낸다.
 */
export function soundDone() {
  drumStop();
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.35;
  const b = 60 / BPM / 2; // 8분음 길이
  const notes: [number, number, boolean][] = [
    // [몇 번째 8분음, 가락, 길게?]
    [0, 62, false], // 레
    [1, 69, false], // 라
    [2, 74, true], // 레—
    [4, 72, false], // 도
    [5, 69, false], // 라
    [6, 78, true], // 파#— (밝게 풀림)
  ];
  for (const [at, m, long] of notes) {
    const tt = t + at * b;
    const hits = long ? 8 : 1;
    for (let i = 0; i < hits; i++) {
      // 긴 음은 채를 빠르게 굴려 "또로로롱" 이어 간다
      const v = i === 0 ? 1 : 0.5;
      glock(tt + i * 0.055, m + 12, 0.1 * v);
      marimba(tt + i * 0.055, m, 0.14 * v);
    }
    timpani(tt, long ? 0.4 : 0.2, long ? 73.4 : 110, long ? 1 : 0.35);
    if (long) kick(tt, 0.55, 110, 38, 0.6);
  }
  const end = t + 6 * b;
  for (let k = 0; k < 10; k++) timpani(end - 0.4 + k * 0.04, 0.12 + k * 0.025, 73.4, 0.35); // 두르르르
  // 마지막: D장조 화음(레·파#·라) + 큰북 + 관중 "오—오—!"
  for (const m of [62, 66, 69, 74]) marimba(end, m, 0.12, 1.2);
  for (const m of [78, 81, 86]) glock(end, m, 0.08);
  kick(end, 0.8, 110, 34, 1.1);
  timpani(end, 0.55, 73.4, 1.8);
  crowd(end, 66, 0.5, 0.1);
  crowd(end + 0.55, 69, 1.2, 0.11);
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
