const ALLOWED_TAGS = new Set([
  'a', 'article', 'b', 'blockquote', 'br', 'caption', 'code', 'dd', 'div', 'dl', 'dt', 'em', 'figcaption',
  'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'li', 'ol', 'p', 'pre', 'section', 'small',
  'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
]);
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'video', 'audio', 'canvas', 'foreignobject', 'link', 'meta', 'base']);
const SAFE_STYLE_PROPERTIES = new Set([
  'background-color', 'border', 'border-color', 'border-radius', 'border-style', 'border-width', 'box-sizing', 'color',
  'display', 'font-family', 'font-size', 'font-style', 'font-weight', 'height', 'letter-spacing', 'line-height', 'margin',
  'margin-bottom', 'margin-left', 'margin-right', 'margin-top', 'max-width', 'padding', 'padding-bottom', 'padding-left',
  'padding-right', 'padding-top', 'text-align', 'text-decoration', 'text-transform', 'vertical-align', 'white-space', 'width',
]);
const SAFE_SVG_ATTRIBUTES = new Set([
  'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
  'fill', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'transform',
]);

function cleanStyle(value: string) {
  return value.split(';').map((declaration) => {
    const colon = declaration.indexOf(':');
    if (colon < 1) return '';
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const content = declaration.slice(colon + 1).trim();
    if (!SAFE_STYLE_PROPERTIES.has(property) || !content || /[<>\u0000-\u001f]/.test(content) || /url\s*\(|expression\s*\(|javascript:|@import|-moz-binding|behavior\s*:/i.test(content)) return '';
    return `${property}: ${content}`;
  }).filter(Boolean).join('; ');
}

/** Keep only simple selectors and safe declarations; external resources and at-rules are rejected. */
export function sanitizeCanvasCss(css: string) {
  return String(css || '').replace(/<\/?style[^>]*>/gi, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import\b[^;]*;?/gi, '')
    .replace(/([^{}]+)\{([^{}]*)\}/g, (_whole, selector: string, declarations: string) => {
      const safeSelector = selector.trim();
      if (!safeSelector || safeSelector.startsWith('@') || !/^[\w\s.#,:>+~\-]+$/.test(safeSelector)) return '';
      const safeDeclarations = cleanStyle(declarations);
      return safeDeclarations ? `${safeSelector}{${safeDeclarations}}` : '';
    });
}

function sanitizeNode(node: Element, document: Document): Node | null {
  const tag = node.localName.toLowerCase();
  if (DROP_TAGS.has(tag)) return null;
  if (!ALLOWED_TAGS.has(tag)) {
    const fragment = document.createDocumentFragment();
    while (node.firstChild) fragment.appendChild(node.firstChild);
    return fragment;
  }
  const clean = document.createElementNS(tag === 'svg' || ['g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'].includes(tag)
    ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml', tag);
  for (const attribute of Array.from(node.attributes)) {
    const name = attribute.name;
    if (/^on/i.test(name) || name === 'src' || name === 'href' || name === 'xlink:href' || name === 'xmlns') continue;
    if (name === 'style') {
      const style = cleanStyle(attribute.value);
      if (style) clean.setAttribute('style', style);
      continue;
    }
    if (name === 'class' && /^[\w\s-]{1,120}$/.test(attribute.value)) clean.setAttribute('class', attribute.value);
    else if (name === 'id' && /^[\w-]{1,80}$/.test(attribute.value)) clean.setAttribute('id', attribute.value);
    else if (SAFE_SVG_ATTRIBUTES.has(name) && /^[\w\s.,%#()\-]+$/.test(attribute.value) && !/url\s*\(|javascript:/i.test(attribute.value)) clean.setAttribute(name, attribute.value);
    else if (['colspan', 'rowspan', 'title', 'alt'].includes(name) && attribute.value.length <= 240) clean.setAttribute(name, attribute.value);
  }
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 1) {
      const sanitized = sanitizeNode(child as Element, document);
      if (sanitized) clean.appendChild(sanitized);
    } else if (child.nodeType === 3) clean.appendChild(document.createTextNode(child.textContent || ''));
  }
  return clean;
}

/** Strip executable/remote markup and return a safe HTML fragment for a canvas SVG block. */
export function sanitizeCanvasHtml(html: string) {
  if (typeof DOMParser === 'undefined') throw new Error('Le navigateur ne prend pas en charge le collage HTML dans le canvas.');
  const parsed = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
  const output = parsed.createElement('div');
  for (const child of Array.from(parsed.body.childNodes)) {
    if (child.nodeType === 1) {
      const sanitized = sanitizeNode(child as Element, parsed);
      if (sanitized) output.appendChild(sanitized);
    } else if (child.nodeType === 3) output.appendChild(parsed.createTextNode(child.textContent || ''));
  }
  return output.innerHTML;
}

export function htmlBlockToSvg(html: string, css: string, width: number, height: number) {
  const safeWidth = Math.min(3000, Math.max(64, Math.round(Number(width) || 480)));
  const safeHeight = Math.min(3000, Math.max(64, Math.round(Number(height) || 280)));
  const safeCss = sanitizeCanvasCss(css);
  const safeHtml = sanitizeCanvasHtml(html);
  const pageStyle = `box-sizing:border-box;width:${safeWidth}px;height:${safeHeight}px;overflow:hidden;padding:16px;font-family:Arial,sans-serif;color:#0B0D10;background:#FFFFFF;`;
  const cssText = safeCss.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const content = `<div xmlns="http://www.w3.org/1999/xhtml" style="${pageStyle}"><style>${cssText}</style>${safeHtml}</div>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}"><foreignObject x="0" y="0" width="100%" height="100%">${content}</foreignObject></svg>`;
}
