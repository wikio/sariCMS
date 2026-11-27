import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { htmlBlockToSvg, sanitizeCanvasCss, sanitizeCanvasHtml } from '../lib/canvas/html-block.ts';

const { window } = new JSDOM('');
globalThis.DOMParser = window.DOMParser;
const safeHtml = sanitizeCanvasHtml('<h2 class="title" onclick="alert(1)">Bonjour</h2><script>alert(2)</script><img src="https://evil.example/x.png" onerror="alert(3)"><p style="color: rgb(15, 159, 110); background-image:url(https://evil.example/x)">Texte</p>');
assert.match(safeHtml, /<h2 class="title">Bonjour<\/h2>/);
assert.doesNotMatch(safeHtml, /script|onclick|onerror|evil\.example|<img/i);
assert.match(safeHtml, /color: rgb\(15, 159, 110\)/);
const safeCss = sanitizeCanvasCss('h2 { color: #0f9f6e; font-size: 28px; background-image: url(https://evil.example/a); } @import url(https://evil.example/x); p { line-height: 1.4; }');
assert.match(safeCss, /h2\{color: #0f9f6e; font-size: 28px\}/);
assert.match(safeCss, /p\{line-height: 1\.4\}/);
assert.doesNotMatch(safeCss, /@import|url\(|evil\.example/);
const svg = htmlBlockToSvg('<p>Bloc sûr</p>', 'p { color: #0f9f6e; }', 500, 280);
assert.match(svg, /<foreignObject/);
assert.match(svg, /width="500" height="280"/);
assert.doesNotMatch(svg, /<script|javascript:|https:\/\//i);
console.log('Canvas HTML tests passed: allowlist sanitization, CSS filtering, safe SVG block generation.');
