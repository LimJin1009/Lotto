// 추첨기 소리. 북·마림바·철금은 브라우저가 직접 만들고(Web Audio), 트럼펫은 저작권 없는(CC0) 진짜 녹음을 쓴다(public/sfx).
// 경기장 선수 입장 분위기로 새로 지은 곡(다른 곡을 베끼지 않음): 큰북·팀파니 심장 박동 + 마림바 반복 가락 + 철금 + 진짜 트럼펫 + 관중 떼창 "오—" + 넓은 공연장 울림.
// 전자 오르간 같은 소리와 딱딱한 잡음(스네어·박수)은 쓰지 않는다.
// - 섞이는 동안: 반복 가락이 깔리고, 공이 나오기 전까지 철금이 얹히며 커지다 팀파니가 "두르르르" 몰아친다
// - 공이 나올 때: 큰북·팀파니 "두-둥!" + 철금 "띵" + 관중 "오!"(나올수록 음이 올라감)
// - 번호가 하나씩 뽑힐 때마다 빨라지고 반음씩 높아지고 북이 촘촘해져 점점 더 조여 온다
// - 6개를 다 뽑으면: 팀파니 "두르르르" → 큰북·밝은 화음, 그리고 아저씨가 힘 빠진 목소리로 "짜라~"(폰의 음성 합성)
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
  loadTrumpet(ctx);
  return ctx;
}

// ── 진짜 트럼펫 녹음 ──
// VSCO 2 Community Edition(CC0, 누구나 상업적으로도 쓸 수 있음)의 트럼펫 녹음 6음 × 2가지(길게·짧게). public/sfx/CREDITS.txt 참고.
// 처음 소리를 켤 때만 받아 온다(합쳐서 약 260KB). 다 받기 전에는 트럼펫 자리를 철금이 대신한다.
const TP_ROOTS = [67, 70, 74, 77, 81, 84]; // 녹음된 음 높이(솔·시♭·레·파·라·도)
const tpSus = new Map<number, AudioBuffer>();
const tpStac = new Map<number, AudioBuffer>();
let tpLoading = false;
function loadTrumpet(c: AudioContext) {
  if (tpLoading) return;
  tpLoading = true;
  const base = `${import.meta.env.BASE_URL}sfx/`;
  for (const m of TP_ROOTS) {
    for (const [kind, map] of [
      ['s', tpSus],
      ['t', tpStac],
    ] as const) {
      fetch(`${base}tp_${kind}${m}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((a) => c.decodeAudioData(a))
        .then((buf) => map.set(m, buf))
        .catch(() => {
          /* 못 받으면 그 음은 철금이 대신한다 */
        });
    }
  }
}

/**
 * 트럼펫 한 음. 가장 가까운 녹음을 골라 높이를 살짝 옮겨 분다.
 * long이면 떨림 있는 긴 소리를 dur만큼 불고 자연스럽게 끊고, 아니면 "따!" 하고 짧게 끊는다.
 */
function trumpet(t: number, m: number, dur: number, vol: number, long: boolean, soft = false) {
  if (!ctx || !master) return;
  const map = long ? tpSus : tpStac;
  let root = -1;
  for (const r of TP_ROOTS) if (map.has(r) && (root < 0 || Math.abs(r - m) < Math.abs(root - m))) root = r;
  if (root < 0) {
    glock(t, m, vol * 0.4); // 아직 못 받았으면 철금으로
    return;
  }
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = map.get(root)!;
  src.playbackRate.value = 2 ** ((m - root) / 12);
  const len = long ? dur : Math.min(dur, 0.8);
  vol *= 0.45; // 트럼펫이 너무 커서 줄임
  if (soft) {
    // 부드럽게: 천천히 불기 시작하고 날카로운 높은 소리를 깎는다
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.06);
  } else g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(vol, t + Math.max(0.02, len - 0.1));
  g.gain.linearRampToValueAtTime(0.0001, t + len + 0.08);
  if (soft) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    lp.Q.value = 0.5;
    src.connect(lp).connect(g).connect(master);
  } else src.connect(g).connect(master);
  src.start(t);
  src.stop(t + len + 0.1);
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
// 경기장 조명이 꺼지고 선수가 들어오는 분위기. D단조.
// - 큰북·팀파니가 심장 뛰듯 "쿵… 쿵…" 울리고, 마림바가 낮게 반복하는 가락을 깐다.
// - 공이 나오기 전까지 반복 가락에 철금이 얹히며 커지고, 꼭대기에선 팀파니가 "두르르르" 몰아친다.
// - 번호가 하나씩 뽑힐 때마다 더 조여 온다: 빨라지고(96→156박), 반음씩 높아지고, 북이 촘촘해지고, 더 빨리 차오른다.
// 코드: Dm – B♭ – F – C (한 마디씩)
const ROOTS = [50, 46, 53, 48]; // 레, 시♭, 파, 도
const ARP = [0, 7, 12, 15, 12, 7, 12, 19]; // 근음에서 위아래로 오르내리는 반복 가락(반음 수)
const MAJOR3 = [false, true, true, true]; // 이 마디 화음이 장조면 반복 가락의 3도를 반음 올린다(장3도)

let timer = 0;
let step = 0;
let nextT = 0;
let buildFrom = 0; // 이번에 커지기 시작한 시각
let level = 0; // 지금까지 나온 공 수(0~5). 많을수록 더 긴장된다

const bpm = () => 116 + level * 12; // 공 하나마다 12박씩 빨라진다(116→176)
const eighth = () => 60 / bpm() / 2;
const growSec = () => Math.max(1, 2.2 - level * 0.25); // 뒤로 갈수록 더 빨리 차오른다

function tick() {
  if (!ready() || !ctx) return;
  if (nextT < ctx.currentTime - 0.1) nextT = ctx.currentTime; // 잠깐 멈췄다 오면 밀린 걸 한꺼번에 치지 않게
  while (nextT < ctx.currentTime + 0.12) {
    const t = nextT;
    const e = eighth();
    const i = step % 8;
    const bar = Math.floor(step / 8) % 4;
    const root = ROOTS[bar] + level; // 공 하나마다 반음씩 높아진다
    const grow = Math.max(0, Math.min(1, (t - buildFrom) / growSec()));
    const vol = 0.36 + grow * 0.24 + level * 0.03; // 배경 북을 크게
    const drumF = hz(root - 12);

    // 심장 박동: 처음엔 "쿵… 쿵-쿵", 공이 나올수록 촘촘해진다
    if (i === 0) {
      kick(t, vol + 0.25, 110, 38, 0.6);
      timpani(t, vol * 0.8, drumF, 0.9);
    }
    if (i === 4 || i === 5) kick(t, (vol + 0.1) * (i === 5 ? 0.7 : 1), 110, 40, 0.5);
    if (level >= 2 && (i === 2 || i === 6)) kick(t, vol * 0.8, 110, 40, 0.4); // 2개부터: 박마다 쿵
    if (level >= 4 && i % 2 === 1) kick(t, vol * 0.5, 110, 45, 0.3); // 4개부터: 반 박마다 쿵

    // 반복 가락: 마림바 (장조 마디는 3도를 장3도로)
    let s = ARP[i];
    if (MAJOR3[bar] && s === 15) s = 16;
    marimba(t, root + s - 12, 0.24 + grow * 0.12, 0.5);
    if (level >= 3) marimba(t + e / 2, root + ARP[(i + 3) % 8] - 12, 0.07 + grow * 0.06, 0.3); // 3개부터: 사이사이 음이 더 끼어든다
    // 3개부터: 마디마다 트럼펫이 높은 음을 길게 불어 긴장을 끌어올린다
    if (level >= 3 && i === 0) {
      const tm = root + 31 > 86 ? root + 19 : root + 31; // 너무 높아 녹음과 멀어지면 한 옥타브 아래로
      trumpet(t, tm, e * 7, 0.12 + grow * 0.12 + (level - 3) * 0.04, true);
    }
    // 커질수록 철금이 한 옥타브 위에서 같이 반짝인다(뒤로 갈수록 일찍 들어온다)
    const glockFrom = Math.max(0, 0.3 - level * 0.06);
    if (grow > glockFrom) glock(t, root + s + 12, (grow - glockFrom) * 0.12 + level * 0.01);

    // 꼭대기: 팀파니 "두르르르" (마지막 공을 기다릴 땐 처음부터 계속 몰아친다)
    if (grow > 0.75 - level * 0.12) {
      for (let k = 0; k < 3; k++) timpani(t + (k * e) / 3, vol * (0.55 + k * 0.1), drumF, 0.35);
    }

    nextT += e;
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
  // 트럼펫 "따따 따—" (새로 지은 부름 가락)
  trumpet(t, 69, 0.12, 0.35, false);
  trumpet(t + 0.13, 74, 0.12, 0.38, false);
  trumpet(t + 0.26, 81, 0.75, 0.42, true);
  level = 0;
  drumStart(t + 0.9);
}

/** 공 하나가 나왔을 때: 큰북·팀파니 "두-둥!" + 철금 "띵" + 관중 "오!" (k번째일수록 높아진다). 다음 공은 더 긴장되게 */
export function soundPop(k: number) {
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.01;
  const up = k + 1; // 다음 반복 가락과 같은 높이로 올라간다
  const tf = 73.4 * 2 ** (up / 12);
  timpani(t, 0.12, tf, 0.5); // 두-
  timpani(t + 0.11, 0.2, tf * 1.335, 1.1); // 둥!
  kick(t + 0.11, 0.3, 110, 40, 0.6);
  // 트럼펫 "따-다—!" 공이 나올수록 한 음씩 높아진다
  trumpet(t, 62 + up, 0.11, 0.16, false, true); // 음역을 내리고 부드럽게(찢어지지 않게)
  trumpet(t + 0.11, 67 + up, 0.55, 0.2, true, true);
  glock(t + 0.11, 86 + up, 0.03);
  crowd(t + 0.11, 62 + up, 0.45, 0.04);
  level = Math.min(5, k + 1);
  buildFrom = t + 0.5;
  nextT = Math.max(nextT, t + 0.5);
  if (k >= 5) drumStop();
}

/**
 * 아저씨가 힘 빠진 목소리로 "짜라~".
 * 폰에 들어 있는 글 읽어 주는 목소리(음성 합성)를 낮고 느리고 작게 낸다. 녹음 파일이 아니라서 폰마다 목소리가 다르다.
 */
function zzara() {
  const s = window.speechSynthesis;
  if (!s || !on) return;
  try {
    const u = new SpeechSynthesisUtterance('짜라~');
    u.lang = 'ko-KR';
    const ko = s.getVoices().filter((v) => v.lang.replace('_', '-').startsWith('ko'));
    u.voice = ko.find((v) => /male|남|man|InJoon|Minsu/i.test(v.name) && !/female|여/i.test(v.name)) ?? ko[0] ?? null;
    u.pitch = 0.2; // 낮게(아저씨)
    u.rate = 0.7; // 느리게, 힘 빠지게
    u.volume = 0.8;
    s.cancel();
    s.speak(u);
  } catch {
    /* 음성 합성이 없는 폰이면 조용히 넘어간다 */
  }
}

/**
 * 한 게임(6개)을 다 뽑았을 때: 팀파니 "두르르르" → 큰북 "쿵!"과 밝은 화음으로 터뜨린 뒤,
 * 아저씨가 힘 빠진 목소리로 "짜라~".
 */
export function soundDone() {
  drumStop();
  if (!ready() || !ctx) return;
  const t = ctx.currentTime + 0.3;
  // 트럼펫 마무리 가락(새로 지음): "따 따 따 따—, 따 딴————!" (D장조로 밝게)
  const b = 0.17;
  const tune: [number, number, number, boolean][] = [
    // [몇 번째 박, 음, 길이, 길게?]
    [0, 69, b, false], // 라
    [1, 74, b, false], // 레
    [2, 78, b, false], // 파#
    [3, 81, b * 2.6, true], // 라—
    [6, 78, b, false], // 파#
    [7, 86, 1.5, true], // 높은 레————
  ];
  for (const [at, m, d, long] of tune) {
    trumpet(t + at * b, m, d, long ? 0.45 : 0.38, long);
    if (long) trumpet(t + at * b, m - 7, d, 0.25, true); // 두 번째 트럼펫이 아래에서 화음
    timpani(t + at * b, long ? 0.4 : 0.18, long ? 73.4 : 110, long ? 1 : 0.35);
  }
  kick(t + 3 * b, 0.55, 110, 38, 0.6);
  const end = t + 7 * b;
  for (let k = 0; k < 10; k++) timpani(end - 0.4 + k * 0.04, 0.1 + k * 0.025, 73.4, 0.35); // 두르르르
  // 마지막 음에 D장조 화음(레·파#·라) + 큰북 + 관중 "오—!"
  for (const m of [62, 66, 69, 74]) marimba(end, m, 0.12, 1.2);
  kick(end, 0.8, 110, 34, 1.1);
  timpani(end, 0.55, 73.4, 1.8);
  crowd(end, 69, 0.9, 0.08);
  // 트럼펫이 잦아들 즈음 "짜라~"
  const wait = (end + 1.6 - ctx.currentTime) * 1000;
  setTimeout(zzara, Math.max(0, wait));
}

/** 화면을 떠나는 등 추첨이 중간에 멈출 때 */
export function soundStop() {
  drumStop();
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* 음성 합성이 없으면 넘어간다 */
  }
}

// 다른 앱으로 가면 소리를 잠시 멈춘다
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else if (on) ctx.resume().catch(() => {});
});
