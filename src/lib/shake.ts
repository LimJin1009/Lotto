// 휴대폰 흔들기 알아채기: 짧은 시간 안에 세게 여러 번 움직이면 "흔들었다"고 본다.

export interface Accel {
  x: number;
  y: number;
  z: number;
}

interface Options {
  /** 이보다 센 움직임만 셈 (m/s², 중력은 뺀 값) */
  threshold?: number;
  /** 이만큼 세게 움직여야 흔든 것 */
  jolts?: number;
  /** 이 시간 안에 */
  windowMs?: number;
  /** 한 번 알아챈 뒤 쉬는 시간 */
  cooldownMs?: number;
}

/**
 * 가속도 값을 차례로 넣으면, 흔들었을 때 true 를 돌려주는 함수를 만든다.
 * gravityIncluded 가 true 면 중력이 섞인 값이므로, 천천히 바뀌는 부분(중력)을 빼고 본다.
 */
export function makeShakeDetector({ threshold = 12, jolts = 3, windowMs = 1000, cooldownMs = 2500 }: Options = {}) {
  let gravity: Accel | null = null;
  let above = false;
  let times: number[] = [];
  let quietUntil = -Infinity;

  return (a: Accel, t: number, gravityIncluded = false): boolean => {
    let { x, y, z } = a;
    if (gravityIncluded) {
      gravity = gravity ? { x: gravity.x * 0.8 + x * 0.2, y: gravity.y * 0.8 + y * 0.2, z: gravity.z * 0.8 + z * 0.2 } : { x, y, z };
      x -= gravity.x;
      y -= gravity.y;
      z -= gravity.z;
    }
    const strong = Math.hypot(x, y, z) > threshold;
    // 약했다가 세질 때만 한 번으로 셈 (한 번 흔든 동안 여러 번 세지 않게)
    const jolt = strong && !above;
    above = strong;
    if (!jolt || t < quietUntil) return false;
    times = [...times.filter((ts) => t - ts <= windowMs), t];
    if (times.length < jolts) return false;
    times = [];
    quietUntil = t + cooldownMs;
    return true;
  };
}
