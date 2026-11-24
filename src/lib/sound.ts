// 추첨기 소리. 파일 없이 브라우저가 직접 만든다(Web Audio): 앱 용량이 그대로고 저작권 걱정이 없다.
// 야구장 응원 가락을 오케스트라처럼 웅장하게: 큰북·팀파니 "쿵, 쿵, 둥둥둥" + 금관 합주 + 넓은 공연장 울림. 전자 오르간 같은 소리와 딱딱한 잡음(스네어·박수)은 쓰지 않는다.
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

/**
 * 금관 한 음(트럼펫·호른·트롬본). 오르간처럼 납작하지 않게:
 * 살짝 아래에서 밀어 올리듯 시작하고, "빠—" 하고 밝아졌다 가라앉고, 긴 음엔 떨림을 준다.
 * bright가 낮을수록 어둡고 두툼한 소리(트롬본), 높을수록 밝은 소리(트럼펫).
 */
function horn(t: number, m: number, dur: number, vol: number, bright = 1) {
  if (!ctx || !master) return;
  const f = hz(m);
  const fl = ctx.createBiquadFilter();
  const g = ctx.createGain();
  fl.type = 'lowpass';
  fl.Q.value = 1.1;
  fl.frequency.setValueAtTime(300, t);
  fl.frequency.exponentialRampToValueAtTime(3400 * bright, t + 0.05);
  fl.frequency.setTargetAtTime(1900 * bright, t + 0.08, 0.1);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  g.gain.setTargetAtTime(vol * 0.8, t + 0.06, 0.08);
  g.gain.setTargetAtTime(0.0001, t + dur - 0.03, 0.04);
  fl.connect(g).connect(master);
  const vib = ctx.createOscillator();
  const vibAmt = ctx.createGain();
  vib.frequency.value = 5 + Math.random();
  vibAmt.gain.setValueAtTime(0, t);
  if (dur > 0.3) vibAmt.gain.linearRampToValueAtTime(f * 0.007, t + dur);
  vib.connect(vibAmt);
  for (const det of [-9, 0, 9]) {
    // 여러 대가 함께 부는 것처럼 음을 아주 살짝씩 어긋나게 겹친다
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.97, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    o.detune.value = det;
    vibAmt.connect(o.frequency);
    o.connect(fl);
    o.start(t);
    o.stop(t + dur + 0.2);
  }
  vib.start(t);
  vib.stop(t + dur + 0.2);
}

/** 금관 합주: 가락(트럼펫) + 한 옥타브 아래(호른) + 화음 + 맨 아래 받침(트롬본) */
function brass(t: number, melody: number, chord: number[], dur: number, vol: number) {
  horn(t, melody, dur, vol, 1.1);
  horn(t, melody - 12, dur, vol * 0.6, 0.8);
  for (const m of chord) horn(t, m, dur, vol * 0.45, 0.75);
  horn(t, chord[0] - 12, dur, vol * 0.5, 0.5);
}

// ── 응원 북 ──
// 야구장 응원처럼 "쿵, 쿵, 둥둥둥" (8분음 8칸 중 0·2·4·5·6에 친다). 큰북과 팀파니가 함께 친다.
// 공이 나오기 전까지 점점 세지다가 팀파니가 "두르르르" 몰아친다. 밑에서는 낮은 금관이 "우우웅" 차오른다.
const HITS = [1, 0, 1, 0, 1, 1, 1, 0];
const BPM = 120;
const EIGHTH = 60 / BPM / 2;
const GROW = 2.2; // 몇 초에 걸쳐 가장 세지나

let timer = 0;
let step = 0;
let nextT = 0;
let buildFrom = 0; // 이번에 세지기 시작한 시각
let level = 0; // 나온 공 수(많을수록 전체가 조금씩 더 셈)

/** 낮은 금관이 서서히 차오르는 소리(긴장감). 공이 나오면 사라진다 */
let swell: { g: GainNode; o: OscillatorNode[] } | null = null;
function swellUp(t: number) {
  if (!ctx || !master) return;
  swellOff(t);
  const fl = ctx.createBiquadFilter();
  const g = ctx.createGain();
  fl.type = 'lowpass';
  fl.Q.value = 0.9;
  fl.frequency.setValueAtTime(220, t);
  fl.frequency.exponentialRampToValueAtTime(1300, t + GROW);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05 + level * 0.006, t + GROW);
  fl.connect(g).connect(master);
  const o: OscillatorNode[] = [];
  for (const m of [43, 48, 55]) {
    for (const det of [-7, 7]) {
      const x = ctx.createOscillator();
      x.type = 'sawtooth';
      x.frequency.value = hz(m);
      x.detune.value = det;
      x.connect(fl);
      x.start(t);
      o.push(x);
    }
  }
  swell = { g, o };
}
function swellOff(t: number) {
  if (!swell) return;
  const s = swell;
  swell = null;
  s.g.gain.cancelScheduledValues(t);
  s.g.gain.setTargetAtTime(0.0001, t, 0.06);
  s.o.forEach((x) => x.stop(t + 0.5));
}

function tick() {
  if (!ready() || !ctx) return;
  if (nextT < ctx.currentTime - 0.1) nextT = ctx.currentTime; // 잠깐 멈췄다 오면 밀린 걸 한꺼번에 치지 않게
  while (nextT < ctx.currentTime + 0.12) {
    const t = nextT;
    const i = step % 8;
    const grow = Math.max(0, Math.min(1, (t - buildFrom) / GROW));
    const vol = 0.2 + grow * 0.22 + level * 0.02;
    if (grow > 0.7) {
      // 꼭대기 무렵: 팀파니 "두르르르" (16분음으로 몰아침)
      for (let k = 0; k < 4; k++) timpani(t + (k * EIGHTH) / 4, vol * (0.7 + k * 0.08), 98, 0.4);
    } else if (HITS[i]) {
      if (i === 0 || i === 2) {
        kick(t, vol + 0.15);
        timpani(t, vol * 0.7, 98);
      } else timpani(t, vol, i === 5 ? 131 : 110);
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
  swellUp(at);
  timer = window.setInterval(tick, 25);
  tick();
}
function drumStop() {
  clearInterval(timer);
  timer = 0;
  if (ctx) swellOff(ctx.currentTime);
}

/** 추첨 시작: 금관 "빠-밤!" + 큰북, 그리고 응원 북이 시작된다 */
export function soundStart() {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.02;
  brass(t, 67, [60, 64], 0.13, 0.06);
  brass(t + 0.15, 72, [64, 67], 0.5, 0.07);
  kick(t + 0.15, 0.6, 110, 38, 0.7);
  timpani(t + 0.15, 0.4, 65, 1.2);
  level = 0;
  drumStart(t + 0.75);
}

/** 공 하나가 나왔을 때 금관 "빠밤!" (k번째일수록 한 음씩 올라간다). 북은 다시 작게부터 */
export function soundPop(k: number) {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.01;
  const up = [0, 2, 4, 5, 7, 9][k % 6];
  swellOff(t);
  kick(t + 0.1, 0.6, 110, 40, 0.6);
  timpani(t + 0.1, 0.4, 65 * 2 ** (up / 12), 1);
  brass(t, 67 + up, [60 + up], 0.09, 0.06);
  brass(t + 0.1, 72 + up, [64 + up, 67 + up], 0.4, 0.07);
  level = k + 1;
  buildFrom = t + 0.6;
  nextT = Math.max(nextT, t + 0.6);
  if (k >= 5) drumStop();
  else swellUp(t + 0.6);
}

/**
 * 한 게임(6개)을 다 뽑았을 때: 야구장 "차지(Charge)" 가락 "따라라 딴~ 따 따—!"를 금관 합주로.
 * 옛 군대 나팔 신호에서 온 누구나 쓰는 가락이다. 마지막 음은 팀파니 "두르르르"와 큰북으로 크게 맺는다.
 */
export function soundDone() {
  drumStop();
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.35;
  const n = 0.14; // 짧은 음 길이
  const notes: [number, number, number, number[]][] = [
    [0, 67, n, [60]], // 솔
    [n, 72, n, [64]], // 도
    [2 * n, 76, n, [67]], // 미
    [3 * n, 79, 0.34, [72, 76]], // 솔—
    [3 * n + 0.38, 76, n, [67, 72]], // 미
    [4 * n + 0.4, 79, 1.5, [64, 67, 72]], // 솔————
  ];
  for (const [at, m, d, ch] of notes) brass(t + at, m, ch, d, 0.065);
  kick(t + 3 * n, 0.5);
  timpani(t + 3 * n, 0.35, 98);
  const end = t + 4 * n + 0.4;
  for (let k = 0; k < 10; k++) timpani(end - 0.4 + k * 0.04, 0.12 + k * 0.025, 65, 0.35); // 두르르르
  kick(end, 0.75, 110, 36, 1.0);
  timpani(end, 0.5, 65, 1.6);
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
