// 내 번호함: 기기(브라우저)에 저장한다. 회원 기능은 2차에서 붙인다.
import type { GenResult, SavedSet } from './types';

const KEY = 'lotto.saved.v1';
const LIMIT = 200;

export function loadSaved(): SavedSet[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function store(list: SavedSet[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
    return true;
  } catch {
    return false;
  }
}

export function addSaved(result: GenResult, drawNo: number): SavedSet[] {
  const item: SavedSet = {
    ...result,
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    drawNo,
    createdAt: new Date().toISOString(),
  };
  const list = [item, ...loadSaved()];
  store(list);
  return list;
}

export function removeSaved(id: string): SavedSet[] {
  const list = loadSaved().filter((s) => s.id !== id);
  store(list);
  return list;
}

export function isSameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}
