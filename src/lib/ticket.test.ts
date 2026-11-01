import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { readFileSync } from 'node:fs';
import { decodeImageData, initZxing } from './qr-decode';
import { formatWon, manualTicket, parseLottoQr } from './ticket';

describe('복권 QR 해석', () => {
  it('공식 주소 형식', () => {
    const t = parseLottoQr('https://dhlottery.co.kr/qr.do?method=winQr&v=1248q243032353738');
    expect(t).toMatchObject({ round: 1248, source: 'qr', games: [{ label: 'A', type: '자동', nums: [24, 30, 32, 35, 37, 38] }] });
    expect(t!.raw).toContain('v=1248q');
  });

  it('여러 게임, 자동·수동·반자동, 뒤의 일련번호는 무시', () => {
    const t = parseLottoQr('http://m.dhlottery.co.kr/?v=0911q041215283337m010203040506s450133221110n0000000000000123456789');
    expect(t!.round).toBe(911);
    expect(t!.games.map((g) => [g.label, g.type, g.nums.join(',')])).toEqual([
      ['A', '자동', '4,12,15,28,33,37'],
      ['B', '수동', '1,2,3,4,5,6'],
      ['C', '반자동', '1,10,11,22,33,45'],
    ]);
  });

  it('로또 QR이 아니면 null', () => {
    expect(parseLottoQr('https://example.com')).toBeNull();
    expect(parseLottoQr('안녕하세요')).toBeNull();
    // 번호가 45를 넘거나 겹치면 그 게임은 버림
    expect(parseLottoQr('https://x.kr/?v=1248q010203040599')).toBeNull();
    expect(parseLottoQr('https://x.kr/?v=1248q010101020304')).toBeNull();
  });

  it('직접 입력', () => {
    expect(manualTicket(1248, [38, 16, 18, 27, 36, 42]).games[0].nums).toEqual([16, 18, 27, 36, 38, 42]);
  });

  it('금액 표시', () => {
    expect(formatWon(1_933_658_450)).toBe('19억 3,365만원');
    expect(formatWon(53_122_485)).toBe('5,312만 2,485원');
    expect(formatWon(50_000)).toBe('5만원');
    expect(formatWon(5_000)).toBe('5,000원');
  });
});

describe('QR 이미지 읽기', () => {
  it('QR 그림에서 글자를 읽어 해석까지 된다 (ZXing)', async () => {
    const wasm = readFileSync('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm');
    const z = await initZxing({ wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer });
    expect(z).not.toBeNull();
    const text = 'https://dhlottery.co.kr/qr.do?method=winQr&v=1248q161827363842m010203040506';
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const scale = 5;
    const margin = 4;
    const w = (size + margin * 2) * scale;
    const data = new Uint8ClampedArray(w * w * 4).fill(255);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!qr.modules.get(x, y)) continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const i = (((y + margin) * scale + dy) * w + (x + margin) * scale + dx) * 4;
            data[i] = data[i + 1] = data[i + 2] = 0;
          }
        }
      }
    }
    const read = await decodeImageData(data, w, w);
    expect(read).toBe(text);
    const t = parseLottoQr(read!)!;
    expect(t.round).toBe(1248);
    expect(t.games[0].nums).toEqual([16, 18, 27, 36, 38, 42]);
  });
});

describe('새 버전 확인', () => {
  it('첫 화면 HTML에서 앱 파일 이름을 찾는다', async () => {
    (globalThis as { __BUILD_TIME__?: string }).__BUILD_TIME__ = '2026-11-01T01:52:00.000Z';
    const { scriptName, buildLabel } = await import('./version');
    expect(scriptName('<script type="module" crossorigin src="./assets/index-CoUz35dZ.js"></script>')).toBe('assets/index-CoUz35dZ.js');
    expect(scriptName('<html></html>')).toBeNull();
    expect(buildLabel()).toBe('11.01 10:52');
  });
});
