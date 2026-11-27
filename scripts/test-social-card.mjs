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

const utilityCanvas = createCanvas(320, 160);
const ctx = utilityCanvas.getContext('2d');
assert.equal(renderQrCode(ctx, 'https://example.com', { x: 0, y: 0, width: 120, height: 120 }), true);
await renderLogo(ctx, null, { x: 130, y: 0, width: 48, height: 48 });
renderSocialIcons(ctx, ['facebook', 'x'], { x: 0, y: 125, width: 80, height: 30 });
ctx.font = '16px sans-serif';
assert.ok(wrapText(ctx, 'A long line that must wrap across multiple rows', 100, 2).at(-1).endsWith('…'));

const getResponse = await GET(new Request('https://cms.example/api/social-card?kind=article&format=landscape&title=Example&url=https%3A%2F%2Fexample.com'));
assert.equal(getResponse.status, 200);
assert.equal(getResponse.headers.get('content-type'), 'image/png');
assert.equal(getResponse.headers.get('access-control-allow-origin'), '*');
assert.equal(getResponse.headers.get('x-image-width'), '1200');
assert.ok(Buffer.from(await getResponse.arrayBuffer()).subarray(0, 8).equals(pngSignature));
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
console.log('Social card tests passed: 25 type/format combinations, transparent PNG, themes, QR, logo, icons, wrapping, and API GET/POST/CORS.');
