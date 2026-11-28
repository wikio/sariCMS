import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { convertThemeConfig, parseColor } from '../config/socialTheme.js';
import { renderQrCode, renderSocialCard, renderSocialIcons, renderLogo, wrapText } from '../lib/canvasRenderer.js';
import { GET, POST, OPTIONS } from '../app/api/social-card/route.js';

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
assert.equal(parseColor('rgb(15, 159, 110)', '#000'), 'rgba(15, 159, 110, 1)');
assert.equal(parseColor('#abc', '#000'), 'rgba(170, 187, 204, 1)');
const lightTheme = convertThemeConfig({ mode: 'light', background: '#FFFFFF', foreground: '#FFFFFF' });
assert.equal(lightTheme.foreground, '#0B0D10', 'enforce contrast against a light background');
assert.equal(convertThemeConfig({ transparent: true }).transparent, true);
assert.equal(convertThemeConfig({ locale: 'ar' }).direction, 'rtl');
assert.equal(convertThemeConfig({ locale: 'ar', direction: 'ltr' }).direction, 'ltr');
const strictPress = convertThemeConfig({ style: 'presse-immersive', grid: true, pixelAccents: true });
assert.equal(strictPress.fullBleed, true);
assert.equal(strictPress.grid, false, 'press style is strictly grid-free');
assert.equal(strictPress.pixelAccents, false, 'press style is strictly pixel-free');
for (const style of ['modular-grid', 'editorial-grid', 'blueprint-grid', 'grille-plein-cadre']) {
  assert.equal(convertThemeConfig({ style }).grid, true, `${style} enables a square grid`);
}
assert.equal(convertThemeConfig({ style: 'sans-photo-blocs' }).imageEnabled, false);
assert.equal(convertThemeConfig({ style: 'sans-photo-blocs' }).blockComposition, true);
assert.equal(convertThemeConfig({ style: 'sans-photo-minimal' }).imageEnabled, false);
assert.equal(convertThemeConfig({ style: 'sans-photo-minimal' }).minimalComposition, true);
const arabicPressPng = await renderSocialCard({
  kind: 'article', format: 'portrait', title: 'الانتقال الحضري نحو مدن مستدامة',
  summary: 'حلول جديدة ومستدامة للمدن والمساحات العامة.',
  theme: { style: 'presse-immersive', locale: 'ar' },
});
assert.ok(arabicPressPng.subarray(0, 8).equals(pngSignature), 'Arabic RTL press card renders as PNG');
const testLogoCanvas = createCanvas(96, 48);
const testLogoCtx = testLogoCanvas.getContext('2d');
testLogoCtx.fillStyle = '#169EC9';
testLogoCtx.fillRect(0, 0, 96, 48);
const testLogo = testLogoCanvas.toBuffer('image/png');
const brandedCard = await renderSocialCard({
  kind: 'article', format: 'square', title: 'Visuel de marque', brand: 'SARI Atelier', logo: testLogo,
  logoScale: 1.8, brandScale: 1.5, theme: { style: 'editorial-grid', locale: 'fr' },
});
assert.ok(brandedCard.subarray(0, 8).equals(pngSignature), 'custom brand name and independent logo/name scales render');

const formats = ['square', 'portrait', 'landscape', 'widescreen', 'story'];
const kinds = ['article', 'event', 'product', 'announcement', 'job'];
for (const kind of kinds) {
  for (const format of formats) {
    const png = await renderSocialCard({
      kind, format, topic: 'Information', title: `A ${kind} card`, summary: 'Readable, concise content for a social channel.',
      date: '2026-11-28', location: 'Montréal, Québec', url: 'https://example.com/content',
      networks: ['facebook', 'linkedin', 'instagram'], theme: { primary: 'rgb(15, 159, 110)' },
    });
    assert.ok(png.subarray(0, 8).equals(pngSignature), `${kind}/${format} is a PNG`);
  }
}

const transparentPng = await renderSocialCard({ title: 'Transparent card', theme: { transparent: true } });
const sampleCanvas = createCanvas(1080, 1080);
const sampleCtx = sampleCanvas.getContext('2d');
sampleCtx.drawImage(await loadImage(transparentPng), 0, 0);
assert.equal(sampleCtx.getImageData(20, 20, 1, 1).data[3], 0, 'untouched transparent corner retains alpha');
assert.ok(sampleCtx.getImageData(400, 400, 1, 1).data[3] > 0, 'text backing remains opaque enough for legibility');
const pressPng = await renderSocialCard({ kind: 'article', format: 'square', theme: { style: 'presse-immersive', transparent: true } });
const pressCanvas = createCanvas(1080, 1080);
const pressCtx = pressCanvas.getContext('2d');
pressCtx.drawImage(await loadImage(pressPng), 0, 0);
assert.equal(pressCtx.getImageData(500, 20, 1, 1).data[3], 0, 'press theme leaves upper photo area free of grid and pixels');
for (const style of ['sans-photo-blocs', 'sans-photo-minimal']) {
  const input = {
    kind: 'announcement', topic: 'Annonce', title: `Theme ${style}`, summary: 'A composition with no photo source.',
    url: 'https://example.com', networks: ['facebook', 'linkedin'], includeQr: false, theme: { style },
  };
  const png = await renderSocialCard({ ...input, image: transparentPng });
  const withoutImage = await renderSocialCard(input);
  assert.ok(png.subarray(0, 8).equals(pngSignature), `${style} renders as PNG`);
  assert.deepEqual(png, withoutImage, `${style} output ignores photo input entirely`);
}

const utilityCanvas = createCanvas(320, 160);
const ctx = utilityCanvas.getContext('2d');
assert.equal(renderQrCode(ctx, 'https://example.com', { x: 0, y: 0, width: 120, height: 120 }), true);
await renderLogo(ctx, null, { x: 130, y: 0, width: 48, height: 48 });
renderSocialIcons(ctx, ['facebook', 'x'], { x: 0, y: 125, width: 80, height: 30 });
ctx.font = '16px sans-serif';
assert.ok(wrapText(ctx, 'A long line that must wrap across multiple rows', 100, 2).at(-1).endsWith('…'));

const getResponse = await GET(new Request('https://cms.example/api/social-card?kind=article&format=landscape&title=Example&brand=SARI%20Atelier&logoScale=1.5&brandScale=1.25&url=https%3A%2F%2Fexample.com'));
assert.equal(getResponse.status, 200);
assert.equal(getResponse.headers.get('content-type'), 'image/png');
assert.equal(getResponse.headers.get('access-control-allow-origin'), '*');
assert.equal(getResponse.headers.get('x-image-width'), '1200');
assert.ok(Buffer.from(await getResponse.arrayBuffer()).subarray(0, 8).equals(pngSignature));
const compositionUrl = new URL('https://cms.example/api/social-card');
compositionUrl.searchParams.set('style', 'sans-photo-blocs');
compositionUrl.searchParams.set('kind', 'announcement');
compositionUrl.searchParams.set('title', 'Annonce sans photo');
compositionUrl.searchParams.set('includeQr', 'false');
compositionUrl.searchParams.set('themeConfig', JSON.stringify({ primary: 'rgb(15, 159, 110)', background: '#0B0D10' }));
const compositionResponse = await GET(new Request(compositionUrl));
assert.equal(compositionResponse.status, 200, 'new composition presets are accepted through the public API');
assert.ok(Buffer.from(await compositionResponse.arrayBuffer()).subarray(0, 8).equals(pngSignature));
const originalFetch = globalThis.fetch;
let mediaFetchCount = 0;
globalThis.fetch = async () => {
  mediaFetchCount += 1;
  return new Response(transparentPng, { headers: { 'content-type': 'image/png', 'content-length': String(transparentPng.length) } });
};
try {
  const mediaResponse = await GET(new Request('https://cms.example/api/social-card?kind=article&title=With%20photo&imageUrl=https%3A%2F%2Fimages.unsplash.com%2Fphoto-test'));
  assert.equal(mediaResponse.status, 200);
  assert.equal(mediaFetchCount, 1, 'allowlisted article photo is fetched once');
  assert.equal(mediaResponse.headers.get('cross-origin-resource-policy'), 'cross-origin');
} finally {
  globalThis.fetch = originalFetch;
}
const postResponse = await POST(new Request('https://cms.example/api/social-card', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ kind: 'job', title: 'Designer', theme: { mode: 'light', background: '#fff' }, networks: ['linkedin'] }),
}));
assert.equal(postResponse.status, 200);
const optionsResponse = await OPTIONS(new Request('https://cms.example/api/social-card', { method: 'OPTIONS', headers: { origin: 'https://third-party.example' } }));
assert.equal(optionsResponse.status, 204);
console.log('Social card tests passed: 25 type/format combinations, transparent PNG, themes, logo and brand sizing, QR, icons, wrapping, and API GET/POST/CORS.');
