// 이미지에서 QR 글자를 읽는다.
// 1) 휴대폰 기본 QR 인식(BarcodeDetector)이 있으면 먼저 쓰고
// 2) 없거나 못 읽으면 ZXing(휴대폰 카메라 앱들과 같은 계열의 인식기, WebAssembly)을 쓴다.
//    jsQR보다 흐리거나 기울어진 QR을 훨씬 잘 읽는다 (흐린 로또 QR 시험: jsQR 0/6, ZXing 6/6).
// 사진·카메라 영상은 이 기기 안에서만 처리하고 어디로도 보내지 않는다.
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

interface DetectorLike {
  detect(src: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

let detector: DetectorLike | null | undefined;

function nativeDetector(): DetectorLike | null {
  if (detector !== undefined) return detector;
  const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }).BarcodeDetector;
  try {
    detector = BD ? new BD({ formats: ['qr_code'] }) : null;
  } catch {
    detector = null;
  }
  return detector;
}

/** 휴대폰 기본 QR 인식으로 영상·이미지를 통째로 읽기. 기능이 없으면 null */
export async function detectNative(source: CanvasImageSource): Promise<string | null> {
  const det = nativeDetector();
  if (!det) return null;
  try {
    const found = await det.detect(source);
    return found[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

export const hasNativeDetector = () => nativeDetector() !== null;

// ── ZXing ──
type ZxingReader = typeof import('zxing-wasm/reader');
let zxing: Promise<ZxingReader | null> | null = null;

/** ZXing 준비. 테스트에서는 wasm 내용을 직접 넘긴다. */
export function initZxing(overrides?: { wasmBinary?: ArrayBuffer }): Promise<ZxingReader | null> {
  if (!zxing) {
    zxing = import('zxing-wasm/reader')
      .then(async (z) => {
        await z.prepareZXingModule({
          overrides: overrides ?? { locateFile: (p: string, prefix: string) => (p.endsWith('.wasm') ? wasmUrl : prefix + p) },
          fireImmediately: true,
        });
        return z;
      })
      .catch(() => null);
  }
  return zxing;
}

/** 픽셀 데이터에서 QR 읽기. ZXing이 안 되면 jsQR로 대신 읽는다. */
export async function decodeImageData(data: Uint8ClampedArray, width: number, height: number, thorough = false): Promise<string | null> {
  const z = await initZxing();
  if (z) {
    try {
      const img = typeof ImageData !== 'undefined' ? new ImageData(data as Uint8ClampedArray<ArrayBuffer>, width, height) : ({ data, width, height, colorSpace: 'srgb' } as ImageData);
      const r = await z.readBarcodes(img, { formats: ['QRCode'], tryHarder: thorough, tryRotate: thorough, tryInvert: thorough, maxNumberOfSymbols: 1 });
      if (r[0]?.text) return r[0].text;
      if (!thorough) return null;
    } catch {
      /* 아래 jsQR로 */
    }
  }
  const { default: jsQR } = await import('jsqr');
  return jsQR(data, width, height, { inversionAttempts: thorough ? 'attemptBoth' : 'dontInvert' })?.data ?? null;
}

/** 캔버스에 그려진 화면에서 QR 읽기 */
export async function decodeCanvas(canvas: HTMLCanvasElement, thorough = false): Promise<string | null> {
  const native = await detectNative(canvas);
  if (native) return native;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return decodeImageData(img.data, canvas.width, canvas.height, thorough);
}

/** 사진 파일에서 QR 읽기. 크기를 바꿔 가며 몇 번 시도한다. */
export async function decodeFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const native = await detectNative(bitmap);
    if (native) return native;
    for (const max of [1600, 1000, 2600]) {
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d', { willReadFrequently: true })!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const text = await decodeCanvas(canvas, true);
      if (text) return text;
    }
    return null;
  } finally {
    bitmap.close();
  }
}
