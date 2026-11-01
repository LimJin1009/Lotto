import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { DREAMS } from './src/lib/dream';
import { dreamIndexPage, dreamPage, homeStaticContent, SITE, sitemap } from './seo/pages';

/** 검색엔진용: 첫 화면에 글·구조화 정보를 넣고, 꿈별 페이지와 사이트 지도를 만든다 */
function seoPages(): Plugin {
  return {
    name: 'seo-pages',
    transformIndexHtml(html) {
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: '로또 찐번호',
        url: SITE,
        applicationCategory: 'EntertainmentApplication',
        operatingSystem: 'Android, iOS, Windows, macOS',
        inLanguage: 'ko',
        description: '꿈 해몽, 생일·차량번호, 역대 당첨 통계로 추첨기를 돌려 뽑는 로또 번호 생성기. 복권 QR로 당첨 확인까지.',
        image: `${SITE}og-image.png`,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      };
      return html
        .replace('</head>', `    <link rel="canonical" href="${SITE}" />\n    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`)
        .replace('<div id="root"></div>', `<div id="root">${homeStaticContent()}</div>`);
    },
    generateBundle() {
      const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source });
      emit('dream/index.html', dreamIndexPage());
      for (const d of DREAMS) emit(`dream/${d.id}/index.html`, dreamPage(d));
      emit('sitemap.xml', sitemap(new Date().toISOString().slice(0, 10)));
    },
  };
}

export default defineConfig({
  plugins: [react(), seoPages()],
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  base: './',
});
