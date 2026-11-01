// assets/icon.svg 로 앱 아이콘 PNG를 만든다. 사용법: node scripts/make-icons.mjs
import sharp from 'sharp';
import { copyFile } from 'node:fs/promises';

const src = new URL('../assets/icon.svg', import.meta.url);
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const svg = src.pathname.replace(/^\/(\w:)/, '$1');

for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
  await sharp(svg, { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out(name));
  console.log('만듦:', name);
}
await copyFile(svg, out('favicon.svg'));
console.log('만듦: favicon.svg');
