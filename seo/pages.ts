// 검색엔진용 정적 페이지 (빌드할 때 vite.config.ts 의 seoPages 플러그인이 만든다)
// - /dream/          꿈 해몽 모음
// - /dream/{id}/     꿈별 해몽과 행운 숫자 (38개)
// - /sitemap.xml
// 앱 화면은 자바스크립트로 그려져서 검색 로봇이 잘 못 읽으므로, 글이 그대로 들어간 페이지를 따로 만든다.
import { ballPalette } from '../src/lib/ball-colors';
import { DREAM_CATEGORIES, DREAMS, type Dream } from '../src/lib/dream';

export const SITE = 'https://limjin1009.github.io/Lotto/';
const OG_IMAGE = `${SITE}og-image.png`;
const FONT = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';

/** 첫 화면·꿈 모음에서 먼저 보여줄 꿈 (많이 찾는 꿈) */
export const POPULAR = ['pig', 'poop', 'ancestor', 'dragon', 'snake', 'fire', 'money', 'lottery', 'teeth', 'death'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "돼지꿈을" / "용꿈을" 처럼 받침에 맞는 조사 */
function josa(word: string, withFinal: string, without: string): string {
  const ch = word[word.length - 1];
  // 숫자는 읽는 소리로: 0영 1일 3삼 6육 7칠 8팔 은 받침이 있음
  if (/\d/.test(ch)) return '013678'.includes(ch) ? withFinal : without;
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return without;
  return (last - 0xac00) % 28 ? withFinal : without;
}

function ball(n: number, size = 40): string {
  const p = ballPalette(n);
  return `<span class="ball" style="--s:${size}px;--l:${p.light};--b:${p.base};--d:${p.dark}"><span>${n}</span></span>`;
}

const STYLE = `
:root{--bg:#141b2e;--card:#1d2540;--ink:#eef1f6;--ink2:#aab3c5;--line:#2c3656;--gold:#f7b500;--accent:#ff5c61}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'Pretendard Variable',Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.65;word-break:keep-all;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:680px;margin:0 auto;padding:16px 18px 48px}
.top{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px;text-decoration:none;margin-bottom:18px}
.top img{width:32px;height:32px;border-radius:9px}
.crumb{font-size:13px;color:var(--ink2);margin:0 0 8px}
.crumb a{text-decoration:none}
h1{font-size:28px;line-height:1.3;letter-spacing:-.02em;margin:0 0 10px}
h2{font-size:19px;letter-spacing:-.01em;margin:34px 0 12px}
p{margin:0 0 12px}
.lead{font-size:17px;color:var(--ink2)}
.card{background:var(--card);border-radius:18px;padding:18px;margin:14px 0}
.balls{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ball{position:relative;flex:none;display:inline-grid;place-items:center;width:var(--s);height:var(--s);border-radius:50%;
 background:radial-gradient(circle at 70% 82%,rgba(255,255,255,.32) 0,rgba(255,255,255,0) 28%),radial-gradient(circle at 36% 30%,var(--l) 0%,var(--b) 42%,var(--d) 100%);
 box-shadow:inset 0 calc(var(--s)*-.06) calc(var(--s)*.12) rgba(0,0,0,.28),0 calc(var(--s)*.08) calc(var(--s)*.14) rgba(0,0,0,.3)}
.ball span{display:grid;place-items:center;width:60%;height:60%;border-radius:50%;background:#fff;color:#18203a;font-weight:800;font-size:calc(var(--s)*.34)}
.ball::after{content:'';position:absolute;left:14%;top:9%;width:38%;height:24%;border-radius:50%;background:radial-gradient(ellipse,rgba(255,255,255,.95) 0,rgba(255,255,255,0) 70%);transform:rotate(-28deg)}
.sits{list-style:none;margin:0;padding:0}
.sits li{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}
.sits li:first-child{border-top:0}
.sits b{font-size:16px}
.sits small{grid-column:1;color:var(--ink2);font-size:14px}
.sits .ball{grid-row:1/3;grid-column:2}
.cta{display:block;text-align:center;background:var(--gold);color:#1f2a44;font-weight:800;font-size:17px;text-decoration:none;border-radius:14px;padding:15px;margin:20px 0}
.links{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:0;padding:0}
.links a{display:inline-block;padding:8px 13px;border:1px solid var(--line);border-radius:999px;text-decoration:none;font-size:14.5px;font-weight:600}
.faq dt{font-weight:800;margin-top:14px}
.faq dd{margin:4px 0 0;color:var(--ink2)}
.cat h2{margin-top:28px}
.foot{margin-top:40px;font-size:12.5px;color:var(--ink2);text-align:center}
`;

function layout(o: { title: string; description: string; path: string; root: string; body: string; jsonLd: object[] }): string {
  const url = SITE + o.path;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}" />
<link rel="canonical" href="${url}" />
<meta name="theme-color" content="#1f2a44" />
<link rel="icon" href="${o.root}favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="${o.root}apple-touch-icon.png" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="로또 찐번호" />
<meta property="og:locale" content="ko_KR" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${esc(o.title)}" />
<meta property="og:description" content="${esc(o.description)}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="stylesheet" href="${FONT}" />
<style>${STYLE}</style>
${o.jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>
<div class="wrap">
<a class="top" href="${o.root}"><img src="${o.root}icon-192.png" alt="" />로또 찐번호</a>
${o.body}
<p class="foot">해몽과 숫자는 이 사이트가 정한 재미용 해석이에요. 어떤 번호를 골라도 1등 당첨 확률은 8,145,060분의 1로 같습니다.<br />정확한 당첨번호는 동행복권(dhlottery.co.kr)에서 확인하세요.</p>
</div>
</body>
</html>
`;
}

export function dreamPage(d: Dream): string {
  const root = '../../';
  const nums = d.nums.join(', ');
  const sitNums = d.situations.map((s) => s.num).join(', ');
  const title = `${d.name} 로또 번호 — ${d.name} 해몽과 행운 숫자 | 로또 찐번호`;
  const description = `${d.name} 해몽: ${d.meaning}. ${d.name}의 상징 숫자 ${nums}와 상황별 숫자로 추첨기를 돌려 로또 번호를 뽑아 보세요.`;
  const same = DREAMS.filter((x) => x.category === d.category && x.id !== d.id);
  const others = DREAM_CATEGORIES.filter((c) => c !== d.category);
  const faq = [
    {
      q: `${d.name}${josa(d.name, '을', '를')} 꾸면 로또를 사야 하나요?`,
      a: `${d.name}의 해몽은 이래요: ${d.meaning}. 다만 해몽은 재미로 보는 이야기이고, 어떤 꿈을 꿔도 1등 확률은 8,145,060분의 1로 같아요. 기분 좋은 꿈을 꿨다면 부담 없는 금액으로 즐겨 보세요.`,
    },
    {
      q: `${d.name} 숫자 ${nums}${josa(String(d.nums.at(-1)), '은', '는')} 어떻게 정했나요?`,
      a: '꿈의 상징과 상황을 바탕으로 이 사이트가 정한 재미용 숫자예요. 정해진 공식이 있는 숫자는 아니에요. 추첨기는 이 숫자를 넣고 나머지는 무작위로 채워 6개를 뽑아요.',
    },
  ];

  const body = `
<nav class="crumb"><a href="${root}">홈</a> › <a href="../">꿈 해몽 번호</a> › ${esc(d.name)}</nav>
<h1>${d.emoji} ${esc(d.name)} 해몽과 로또 번호</h1>
<p class="lead">${esc(d.meaning)}.</p>

<div class="card">
<h2 style="margin-top:0">${esc(d.name)}의 상징 숫자</h2>
<div class="balls">${d.nums.map((n) => ball(n, 48)).join('')}</div>
<p style="margin:12px 0 0;color:var(--ink2)">${esc(d.name)}${josa(d.name, '을', '를')} 꿨다면 ${nums}${josa(String(d.nums.at(-1)), '을', '를')} 넣고, 꿈속 상황에 맞는 숫자를 하나 더 넣어 번호를 뽑아요.</p>
</div>

<h2>상황별 ${esc(d.name)} 해몽</h2>
<div class="card">
<ul class="sits">
${d.situations.map((s) => `<li><b>${esc(s.label)}</b><small>${esc(s.meaning)}</small>${ball(s.num, 40)}</li>`).join('\n')}
</ul>
</div>

<a class="cta" href="${root}#/?dream=${d.id}">${d.emoji} ${esc(d.name)} 번호 추첨기로 뽑기</a>

<h2>자주 묻는 질문</h2>
<dl class="faq">
${faq.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('\n')}
</dl>

<h2>${esc(d.category)} 꿈 더 보기</h2>
<ul class="links">${same.map((x) => `<li><a href="../${x.id}/">${x.emoji} ${esc(x.name)}</a></li>`).join('')}</ul>

<h2>다른 꿈 해몽</h2>
<ul class="links">${others.map((c) => `<li><a href="../#${encodeURIComponent(c)}">${esc(c)} 꿈</a></li>`).join('')}</ul>
`;

  return layout({
    title,
    description,
    path: `dream/${d.id}/`,
    root,
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '로또 찐번호', item: SITE },
          { '@type': 'ListItem', position: 2, name: '꿈 해몽 번호', item: `${SITE}dream/` },
          { '@type': 'ListItem', position: 3, name: d.name, item: `${SITE}dream/${d.id}/` },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
      { '@context': 'https://schema.org', '@type': 'Article', headline: `${d.name} 해몽과 로또 번호`, description, inLanguage: 'ko', image: OG_IMAGE, mainEntityOfPage: `${SITE}dream/${d.id}/` },
    ],
  });
}

export function dreamIndexPage(): string {
  const root = '../';
  const popular = POPULAR.map((id) => DREAMS.find((d) => d.id === id)!).filter(Boolean);
  const body = `
<nav class="crumb"><a href="${root}">홈</a> › 꿈 해몽 번호</nav>
<h1>🌙 꿈 해몽 로또 번호 모음</h1>
<p class="lead">돼지꿈, 똥꿈, 조상꿈처럼 로또와 함께 많이 찾는 꿈 ${DREAMS.length}가지의 해몽과 행운 숫자를 모았어요. 꿈을 고르면 추첨기로 번호를 뽑을 수 있어요.</p>

<h2>많이 찾는 꿈</h2>
<ul class="links">${popular.map((d) => `<li><a href="${d.id}/">${d.emoji} ${esc(d.name)}</a></li>`).join('')}</ul>

${DREAM_CATEGORIES.map(
  (c) => `<section class="cat" id="${esc(c)}">
<h2>${esc(c)} 꿈</h2>
<div class="card"><ul class="sits">
${DREAMS.filter((d) => d.category === c)
  .map((d) => `<li><a href="${d.id}/"><b>${d.emoji} ${esc(d.name)}</b></a><small>${esc(d.meaning)}</small><span class="balls">${d.nums.map((n) => ball(n, 30)).join('')}</span></li>`)
  .join('\n')}
</ul></div>
</section>`,
).join('\n')}

<a class="cta" href="${root}">🎱 추첨기로 번호 뽑으러 가기</a>
`;
  return layout({
    title: `꿈 해몽 로또 번호 모음 — ${DREAMS.length}가지 꿈별 행운 숫자 | 로또 찐번호`,
    description: `돼지꿈·똥꿈·조상꿈·용꿈 등 ${DREAMS.length}가지 꿈의 해몽과 상황별 행운 숫자. 꿈을 고르면 추첨기로 로또 번호를 뽑아 드려요.`,
    path: 'dream/',
    root,
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: '꿈 해몽 로또 번호',
        itemListElement: DREAMS.map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.name, url: `${SITE}dream/${d.id}/` })),
      },
    ],
  });
}

/** 첫 화면 #root 안에 넣는 글. 검색 로봇이 읽고, 앱이 뜨면 앱 화면으로 바뀐다. */
export function homeStaticContent(): string {
  const popular = POPULAR.map((id) => DREAMS.find((d) => d.id === id)!).filter(Boolean);
  return `<div class="seo-static">
<h1>로또 찐번호 — 로또 번호 생성기</h1>
<p>어젯밤 꾼 꿈, 생일·전화번호·차량번호, 1회부터 최신 회차까지의 당첨 통계로 로또 번호를 뽑는 무료 로또 번호 생성기예요. 번호는 공기식 추첨기가 돌면서 하나씩 나오고, 숫자마다 왜 나왔는지 알려 드려요.</p>
<ul>
<li><b>꿈 해몽 번호</b> — 돼지꿈, 똥꿈, 조상꿈 등 ${DREAMS.length}가지 꿈의 해몽과 행운 숫자</li>
<li><b>나만의 숫자</b> — 생일, 전화번호, 차량번호, 기념일로 만드는 번호</li>
<li><b>통계 분석</b> — 많이 나온 번호, 오래 안 나온 번호, 홀짝·합계 균형 조합</li>
<li><b>로또 당첨 확인</b> — 복권 QR을 찍거나 번호를 넣으면 등수와 당첨금을 바로 확인</li>
<li><b>내 번호함</b> — 저장한 번호를 추첨 뒤 자동으로 맞춰 봄</li>
</ul>
<p>많이 찾는 꿈: ${popular.map((d) => `<a href="./dream/${d.id}/">${esc(d.name)} 로또 번호</a>`).join(' · ')} · <a href="./dream/">꿈 해몽 전체 보기</a></p>
<p>재미로 보는 번호예요. 어떤 방법으로 골라도 1등 당첨 확률은 8,145,060분의 1로 같습니다.</p>
</div>`;
}

export function sitemap(date: string): string {
  const urls = [
    { loc: SITE, pri: '1.0', freq: 'weekly' },
    { loc: `${SITE}dream/`, pri: '0.8', freq: 'monthly' },
    ...DREAMS.map((d) => ({ loc: `${SITE}dream/${d.id}/`, pri: POPULAR.includes(d.id) ? '0.7' : '0.6', freq: 'monthly' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${date}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join('\n')}
</urlset>
`;
}
