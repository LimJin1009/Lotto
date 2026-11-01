// 이미지에서 QR 글자를 읽는다. 브라우저 기본 기능(BarcodeDetector)이 있으면 쓰고, 없으면 jsQR을 쓴다.
// 사진·카메라 영상은 이 기기 안에서만 처리하고 어디로도 보내지 않는다.

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

/** 픽셀 데이터에서 QR 읽기 (jsQR) */
export async function decodeImageData(data: Uint8ClampedArray, width: number, height: number, thorough = false): Promise<string | null> {
  const { default: jsQR } = await import('jsqr');
  const r = jsQR(data, width, height, { inversionAttempts: thorough ? 'attemptBoth' : 'dontInvert' });
  return r?.data ?? null;
}

/** 캔버스에 그려진 화면에서 QR 읽기 */
export async function decodeCanvas(canvas: HTMLCanvasElement, thorough = false): Promise<string | null> {
  const det = nativeDetector();
  if (det) {
    try {
      const found = await det.detect(canvas);
      if (found[0]?.rawValue) return found[0].rawValue;
      if (!thorough) return null;
    } catch {
      detector = null;
    }
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return decodeImageData(img.data, canvas.width, canvas.height, thorough);
}

/** 사진 파일에서 QR 읽기. 크기를 바꿔 가며 몇 번 시도한다. */
export async function decodeFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    for (const max of [1400, 900, 2200]) {
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
