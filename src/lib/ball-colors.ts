// 번호대별 공 색. 앱 화면과 빌드 때 만드는 꿈 페이지가 함께 쓴다.

/** 공 한 개의 음영 3단: 빛 받는 쪽 / 기본 / 그림자 쪽 */
export interface BallPalette {
  light: string;
  base: string;
  dark: string;
}

/** 동행복권과 같은 번호대별 색: 1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록 */
export function ballPalette(n: number): BallPalette {
  if (n <= 10) return { light: '#ffe27a', base: '#f7b500', dark: '#a86f00' };
  if (n <= 20) return { light: '#9ad8ff', base: '#2b95e0', dark: '#0f4f8f' };
  if (n <= 30) return { light: '#ffa29a', base: '#ec4a45', dark: '#8f1c1f' };
  if (n <= 40) return { light: '#d9dde4', base: '#8d94a1', dark: '#454b57' };
  return { light: '#d4f28a', base: '#7cbc2c', dark: '#3c6b0d' };
}
