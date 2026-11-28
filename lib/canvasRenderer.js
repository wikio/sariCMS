import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import QRCode from 'qrcode';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { contrastText, convertThemeConfig } from '../config/socialTheme.js';
import { resolveSocialTemplate } from '../config/socialTemplates.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const safeText = (value, limit = 1200) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, limit);
const networkNames = new Set(['facebook', 'instagram', 'x', 'twitter', 'linkedin', 'youtube', 'pinterest', 'whatsapp']);
let fontsRegistered = false;
function registerBundledFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;
  const root = path.join(process.cwd(), 'public', 'fonts');
  const bundled = [
    ...[400, 500, 600, 700].map((weight) => [path.join(root, 'inter', `inter-${weight}.woff2`), 'Inter', weight]),
    ...[400, 500, 600, 700].map((weight) => [path.join(root, 'cairo', `cairo-lat-${weight}.woff2`), 'Cairo', weight]),
    ...[400, 500, 600, 700].map((weight) => [path.join(root, 'cairo', `cairo-ar-${weight}.woff2`), 'Cairo', weight]),
  ];
  for (const [fontPath, family, weight] of bundled) {
    if (existsSync(fontPath)) {
      try { GlobalFonts.registerFromPath(fontPath, family, { weight }); } catch { /* System fallback remains available. */ }
    }
  }
}

function setFont(ctx, size, weight = 400, family = 'sans-serif') {
  const safeFamily = /^[\w\s,\-'".]{1,80}$/.test(family) ? family : 'sans-serif';
  ctx.font = `${weight} ${Math.max(8, Math.round(size))}px ${safeFamily}`;
}

/** Word-wrap text to a measured width and safely ellipsize the last visible row. */
export function wrapText(ctx, text, maxWidth, maxLines = 3) {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join(' ').length;
  if (lines.length && consumed < words.join(' ').length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function drawTextBlock(ctx, text, x, y, width, options = {}) {
  if (!text) return 0;
  const { size = 24, weight = 400, color = '#FFFFFF', maxLines = 3, lineHeight = 1.28, family = 'sans-serif' } = options;
  setFont(ctx, size, weight, family);
  ctx.fillStyle = color;
  const align = options.align || (options.direction === 'rtl' ? 'right' : 'left');
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const anchorX = align === 'right' ? x + width : x;
  const lines = wrapText(ctx, text, width, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, anchorX, y + index * size * lineHeight, width));
  return lines.length * size * lineHeight;
}

function drawSquareGrid(ctx, rect, color, step, alpha = 0.1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = rect.x; x <= rect.x + rect.width; x += step) {
    ctx.moveTo(Math.round(x) + 0.5, rect.y);
    ctx.lineTo(Math.round(x) + 0.5, rect.y + rect.height);
  }
  for (let y = rect.y; y <= rect.y + rect.height; y += step) {
    ctx.moveTo(rect.x, Math.round(y) + 0.5);
    ctx.lineTo(rect.x + rect.width, Math.round(y) + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function drawPixelAccents(ctx, rect, color, unit) {
  const size = Math.max(3, Math.round(unit * 0.12));
  ctx.fillStyle = color;
  // A restrained 3-by-3 motif at two corners, aligned to square grid cells.
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      if ((row + col) % 2 === 0) {
        ctx.fillRect(rect.x + col * size * 1.8, rect.y + row * size * 1.8, size, size);
        ctx.fillRect(rect.x + rect.width - size - col * size * 1.8, rect.y + rect.height - size - row * size * 1.8, size, size);
      }
    }
  }
}

/** Draw a logo using contain geometry; an absent source gets a square geometric monogram. */
export async function renderLogo(ctx, logoSource, rect, options = {}) {
  const { primary = '#0F9F6E', foreground = '#FFFFFF', title = 'S' } = options;
  if (!rect || rect.width <= 0 || rect.height <= 0) return;
  if (logoSource) {
    const image = logoSource.width && logoSource.height ? logoSource : await loadCanvasImage(logoSource);
    if (image) {
      const scale = Math.min(rect.width / image.width, rect.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      ctx.drawImage(image, Math.round(rect.x + (rect.width - width) / 2), Math.round(rect.y + (rect.height - height) / 2), Math.round(width), Math.round(height));
      return;
    }
  }
  const side = Math.min(rect.width, rect.height);
  ctx.fillStyle = primary;
  ctx.fillRect(rect.x, rect.y, side, side);
  ctx.fillStyle = foreground;
  setFont(ctx, side * 0.48, 800, 'sans-serif');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(safeText(title, 2).slice(0, 1).toUpperCase() || 'S', rect.x + side / 2, rect.y + side / 2);
}

/** Draw a standards-compliant QR matrix, with an opaque square quiet-zone tile. */
export function renderQrCode(ctx, url, rect, options = {}) {
  const content = safeText(url, 2048);
  if (!content || !rect || rect.width < 64 || rect.height < 64) return false;
  const matrix = QRCode.create(content, { errorCorrectionLevel: 'M' }).modules;
  const margin = Math.max(4, Math.round(options.quietZone ?? 4));
  const outer = Math.floor(Math.min(rect.width, rect.height));
  const moduleSize = Math.floor((outer - margin * 2) / matrix.size);
  if (moduleSize < 1) return false;
  const qrSize = matrix.size * moduleSize;
  const x = Math.round(rect.x + (rect.width - qrSize) / 2);
  const y = Math.round(rect.y + (rect.height - qrSize) / 2);
  const quiet = margin * moduleSize;
  ctx.fillStyle = options.background || '#FFFFFF';
  ctx.fillRect(x - quiet, y - quiet, qrSize + quiet * 2, qrSize + quiet * 2);
  ctx.strokeStyle = options.border || '#D5D9DE';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - quiet + 0.5, y - quiet + 0.5, qrSize + quiet * 2 - 1, qrSize + quiet * 2 - 1);
  ctx.fillStyle = options.foreground || '#0B0D10';
  const data = matrix.data;
  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (data[row * matrix.size + col]) ctx.fillRect(x + col * moduleSize, y + row * moduleSize, moduleSize, moduleSize);
    }
  }
  return true;
}

/** Draw compact, square network marks in the supplied brand colors. */
export function renderSocialIcons(ctx, networks = [], rect, theme = {}) {
  if (!rect || !Array.isArray(networks)) return;
  const names = networks.map((item) => String(item).toLowerCase()).filter((name) => networkNames.has(name)).slice(0, 8);
  if (!names.length) return;
  const gap = Math.max(5, Math.round(rect.height * 0.18));
  const side = Math.min(rect.height, Math.floor((rect.width - gap * (names.length - 1)) / names.length));
  const labels = { facebook: 'f', instagram: 'ig', x: 'X', twitter: 'X', linkedin: 'in', youtube: '▶', pinterest: 'P', whatsapp: 'wa' };
  const palette = [theme.primary || 'rgb(15, 159, 110)', theme.secondary || 'rgb(22, 158, 201)', theme.accent || 'rgb(234, 182, 22)', '#0B0D10', '#FFFFFF'];
  names.forEach((name, index) => {
    const x = rect.x + index * (side + gap);
    const iconColor = palette[index % palette.length];
    ctx.fillStyle = iconColor;
    ctx.fillRect(x, rect.y, side, side);
    if (iconColor === '#FFFFFF') {
      ctx.strokeStyle = '#B8C0C8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, rect.y + 0.5, side - 1, side - 1);
    }
    ctx.fillStyle = contrastText(iconColor);
    setFont(ctx, side * 0.48, 700, 'sans-serif');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[name], x + side / 2, rect.y + side / 2, side - 4);
  });
}

async function loadCanvasImage(source) {
  if (!source) return null;
  try {
    if (Buffer.isBuffer(source)) return await loadImage(source);
    if (typeof source === 'string' && source.startsWith('data:image/')) return await loadImage(source);
    if (source instanceof URL) return await loadImage(source);
  } catch { /* Missing or invalid media is omitted and the layout reflows. */ }
  return null;
}

function drawCoverImage(ctx, image, rect) {
  if (!image || !rect?.width || !rect?.height) return;
  const scale = Math.max(rect.width / image.width, rect.height / image.height);
  const sourceWidth = rect.width / scale;
  const sourceHeight = rect.height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.clip();
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

async function renderPressLayout(ctx, data) {
  const { width, height, theme, image, logo, input, template, kind, contentAccent } = data;
  const { primary, secondary, foreground, fontFamily, direction } = theme;
  const rtl = direction === 'rtl';
  const isTall = height > width * 1.15;
  const isStory = height > width * 1.5;
  const isWide = height < width * 0.8;
  const pad = Math.round(Math.min(width, height) * 0.055);
  const unit = Math.max(16, Math.round(Math.min(width, height) / (isTall ? 24 : 18)));
  const logoScale = clamp(Number(input.logoScale) || 1, 0.4, 2.5);
  const brandScale = clamp(Number(input.brandScale) || 1, 0.5, 2);
  const photo = { x: 0, y: 0, width, height };
  if (image) drawCoverImage(ctx, image, photo);
  if (theme.gridOverlay) drawSquareGrid(ctx, photo, theme.gridColor || foreground, unit, theme.gridOpacity);

  if (theme.gradientOverlay) {
    const gradient = ctx.createLinearGradient(0, Math.round(height * 0.34), 0, height);
    gradient.addColorStop(0, 'rgba(11, 13, 16, 0)');
    gradient.addColorStop(1, 'rgba(11, 13, 16, 0.94)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, Math.round(height * 0.34), width, height - Math.round(height * 0.34));
  }

  const logoSide = Math.max(32, Math.round(unit * 1.35 * logoScale));
  const logoX = rtl ? width - pad - logoSide : pad;
  const logoY = pad;
  if (logo && input.showLogo !== false) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(logoX - 7, logoY - 7, logoSide + 14, logoSide + 14);
  }
  if (input.showLogo !== false) await renderLogo(ctx, logo, { x: logoX, y: logoY, width: logoSide, height: logoSide }, {
    primary, foreground: '#FFFFFF', title: input.brand || 'S',
  });
  if (input.brand && input.showLogo !== false) {
    ctx.fillStyle = '#FFFFFF';
    setFont(ctx, Math.max(13, unit * 0.3 * brandScale), 700, fontFamily);
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(safeText(input.brand, 48), rtl ? logoX - 14 : logoX + logoSide + 14, logoY + 5, width * 0.32);
  }

  const title = safeText(input.title, 240);
  const summary = safeText(input.summary, 900);
  const topic = template.topic ? safeText(input.topic, 80) : '';
  const date = template.date ? safeText(input.date, 100) : '';
  const location = template.location ? safeText(input.location, 160) : '';
  const networks = template.networks && Array.isArray(input.networks) ? input.networks : [];
  const footerHeight = Math.max(unit * 1.65, 76);
  const qrSide = template.qr && input.url ? Math.min(Math.round(unit * 2.55), Math.round(height * 0.12), Math.round(width * 0.16)) : 0;
  const iconSide = Math.max(24, Math.round(unit * 0.82));
  const iconWidth = Math.min(networks.length, 8) * iconSide + Math.max(0, Math.min(networks.length, 8) - 1) * Math.max(5, Math.round(iconSide * 0.18));
  const meta = [date && { label: kind === 'event' ? 'DATE' : 'PUBLIÉ', value: date, fill: primary }, location && { label: 'LIEU', value: location, fill: secondary }].filter(Boolean);
  const metaHeight = meta.length ? Math.max(40, Math.round(unit * 1.05)) : 0;
  const metaY = height - pad - footerHeight - (meta.length ? metaHeight + Math.round(unit * 0.28) : 0);
  const startRatio = isStory ? 0.49 : isTall ? 0.43 : isWide ? 0.34 : 0.39;
  let cursorY = Math.round(height * startRatio);
  const textX = pad;
  const textWidth = width - pad * 2;

  if (topic) {
    setFont(ctx, Math.max(14, unit * 0.43), 800, fontFamily);
    const badgeWidth = Math.min(textWidth, Math.max(unit * 2.6, ctx.measureText(topic).width + unit * 1.05));
    const badgeHeight = Math.max(30, Math.round(unit * 0.68));
    const badgeX = rtl ? width - pad - badgeWidth : pad;
    ctx.fillStyle = contentAccent;
    ctx.fillRect(badgeX, cursorY, badgeWidth, badgeHeight);
    const railWidth = Math.max(4, Math.round(unit * 0.1));
    ctx.fillStyle = rtl ? secondary : primary;
    ctx.fillRect(rtl ? badgeX + badgeWidth - railWidth : badgeX, cursorY, railWidth, badgeHeight);
    ctx.fillStyle = contrastText(contentAccent);
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(topic, rtl ? badgeX + badgeWidth - railWidth - 10 : badgeX + railWidth + 10, cursorY + badgeHeight / 2, badgeWidth - railWidth - 20);
    cursorY += badgeHeight + Math.round(unit * 0.32);
  }

  const titleSize = Math.max(28, Math.round(Math.min(width * 0.08, height * (isWide ? 0.075 : 0.065)) * clamp(Number(input.textScale) || 1, 0.65, 1.8)));
  if (title) {
    const titleHeight = drawTextBlock(ctx, title, textX, cursorY, textWidth, {
      size: titleSize, weight: 800, color: '#FFFFFF',
      maxLines: isStory || isTall ? 3 : isWide ? 2 : 3,
      lineHeight: 1.12, family: fontFamily, direction,
    });
    cursorY += titleHeight + Math.round(unit * 0.25);
  }
  if (summary) {
    const summaryHeight = drawTextBlock(ctx, summary, textX, cursorY, textWidth, {
      size: Math.max(17, Math.round(titleSize * 0.34)), weight: 400, color: '#FFFFFF',
      maxLines: isStory ? 3 : 2, lineHeight: 1.35, family: fontFamily, direction,
    });
    cursorY += summaryHeight;
  }

  if (meta.length) {
    const gap = Math.max(6, Math.round(unit * 0.16));
    const availableMeta = width - pad * 2 - (qrSide ? qrSide + gap : 0);
    const chipGap = Math.max(5, Math.round(unit * 0.14));
    const chipWidth = Math.floor((availableMeta - chipGap * (meta.length - 1)) / meta.length);
    meta.forEach((item, index) => {
      const logicalIndex = index;
      const x = rtl ? width - pad - chipWidth - logicalIndex * (chipWidth + chipGap) : pad + logicalIndex * (chipWidth + chipGap);
      drawInfoChip(ctx, item.label, item.value, x, metaY, chipWidth, {
        fill: item.fill, foreground: contrastText(item.fill), fontFamily, size: unit * 0.78,
        height: metaHeight, emphasized: true, direction,
      });
    });
  }

  const footerY = height - pad - footerHeight;
  const qrX = rtl ? pad : width - pad - qrSide;
  if (qrSide) renderQrCode(ctx, input.url, { x: qrX, y: footerY, width: qrSide, height: qrSide }, { quietZone: 4 });
  if (networks.length) {
    const side = Math.min(iconSide, footerHeight);
    const maxWidth = width - pad * 2 - (qrSide ? qrSide + pad * 0.5 : 0);
    const visibleWidth = Math.min(iconWidth, maxWidth);
    const x = rtl ? width - pad - visibleWidth : pad;
    renderSocialIcons(ctx, networks, { x, y: footerY + Math.max(0, (footerHeight - side) / 2), width: visibleWidth, height: side }, theme);
  }
}

async function renderNoImageLayout(ctx, data) {
  const { width, height, theme, logo, input, template, kind, contentAccent } = data;
  const { primary, secondary, accent, foreground, fontFamily, direction } = theme;
  const rtl = direction === 'rtl';
  const blocks = theme.blockComposition;
  const pad = Math.round(Math.min(width, height) * 0.06);
  const unit = Math.max(18, Math.round(Math.min(width, height) / 18));
  const logoScale = clamp(Number(input.logoScale) || 1, 0.4, 2.5);
  const brandScale = clamp(Number(input.brandScale) || 1, 0.5, 2);
  const title = safeText(input.title, 240);
  const summary = safeText(input.summary, 900);
  const topic = template.topic ? safeText(input.topic, 80) : '';
  const date = template.date ? safeText(input.date, 100) : '';
  const location = template.location ? safeText(input.location, 160) : '';
  const networks = template.networks && Array.isArray(input.networks) ? input.networks : [];
  const footerHeight = Math.max(unit * 1.6, 72);
  const qrSide = template.qr && input.url ? Math.min(Math.round(unit * 2.55), Math.round(height * 0.12), Math.round(width * 0.16)) : 0;
  const metadata = [date && { label: kind === 'event' ? 'DATE' : 'PUBLIÉ', value: date, color: primary }, location && { label: 'LIEU', value: location, color: secondary }].filter(Boolean);
  const metadataHeight = metadata.length ? Math.max(38, Math.round(unit * (blocks ? 1.05 : 0.85))) : 0;
  const footerY = height - pad - footerHeight;
  const metadataY = footerY - (metadata.length ? metadataHeight + Math.round(unit * 0.3) : 0);
  const headerHeight = Math.max(Math.round(height * 0.14), unit * 2.1);
  const logoSide = Math.max(32, Math.round(unit * 1.25 * logoScale));
  const logoX = rtl ? width - pad - logoSide : pad;
  const logoY = Math.round((headerHeight - logoSide) / 2);

  if (blocks) {
    // Layered, non-rounded color panels and a compact geometric mark replace the photo.
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, width, headerHeight);
    ctx.fillStyle = secondary;
    ctx.fillRect(rtl ? 0 : width - Math.round(width * 0.24), 0, Math.round(width * 0.24), headerHeight);
    ctx.fillStyle = accent;
    ctx.fillRect(rtl ? width - Math.round(width * 0.12) : 0, headerHeight, Math.round(width * 0.12), Math.round(height * 0.14));
    const unitSq = Math.max(7, Math.round(unit * 0.3));
    const motifX = rtl ? pad : width - pad - unitSq * 3;
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        if ((row + col) % 2 === 0) {
          ctx.fillStyle = [primary, secondary, accent][(row + col) % 3];
          ctx.fillRect(motifX + col * unitSq, headerHeight + pad + row * unitSq, unitSq, unitSq);
        }
      }
    }
    const lightSurface = contrastText(theme.background) === '#0B0D10';
    ctx.fillStyle = theme.transparent
      ? (lightSurface ? 'rgba(255, 255, 255, 0.92)' : 'rgba(11, 13, 16, 0.88)')
      : (lightSurface ? 'rgba(255, 255, 255, 0.96)' : 'rgba(11, 13, 16, 0.92)');
    ctx.fillRect(pad, headerHeight + Math.round(unit * 0.5), width - pad * 2, height - headerHeight - pad * 1.5);
    ctx.fillStyle = accent;
    ctx.fillRect(rtl ? width - pad - 7 : pad, headerHeight + Math.round(unit * 0.5), 7, height - headerHeight - pad * 1.5);
  } else {
    // The no-block variant stays open: a single fine rule and typographic hierarchy only.
    ctx.fillStyle = contentAccent;
    ctx.fillRect(rtl ? width - pad - 4 : pad, Math.round(height * 0.27), 4, Math.round(height * 0.46));
  }

  if (input.showLogo !== false) {
    await renderLogo(ctx, logo, { x: logoX, y: logoY, width: logoSide, height: logoSide }, {
      primary: blocks ? '#FFFFFF' : primary,
      foreground: blocks ? primary : foreground,
      title: input.brand || 'S',
    });
  }
  if (input.brand && input.showLogo !== false) {
    ctx.fillStyle = blocks ? '#FFFFFF' : foreground;
    setFont(ctx, Math.max(13, unit * 0.3 * brandScale), 700, fontFamily);
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(safeText(input.brand, 48), rtl ? logoX - unit * 0.35 : logoX + logoSide + unit * 0.35, headerHeight / 2, width * 0.35);
  }

  const textX = pad + (blocks && !rtl ? unit * 0.55 : 0);
  const textWidth = width - pad * 2 - (blocks ? unit * 0.55 : 0);
  const startY = headerHeight + Math.round(unit * (blocks ? 1.05 : 1.1));
  const textBottom = metadata.length ? metadataY - Math.round(unit * 0.35) : footerY - Math.round(unit * 0.35);
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad, startY, width - pad * 2, Math.max(0, textBottom - startY));
  ctx.clip();
  let cursorY = startY;
  if (topic) {
    if (blocks) {
      setFont(ctx, Math.max(14, unit * 0.42), 800, fontFamily);
      const badgeWidth = Math.min(textWidth, Math.max(unit * 2.4, ctx.measureText(topic).width + unit));
      const badgeHeight = Math.max(28, Math.round(unit * 0.67));
      const badgeX = rtl ? width - pad - badgeWidth : textX;
      ctx.fillStyle = contentAccent;
      ctx.fillRect(badgeX, cursorY, badgeWidth, badgeHeight);
      ctx.fillStyle = accent;
      ctx.fillRect(rtl ? badgeX + badgeWidth - 5 : badgeX, cursorY, 5, badgeHeight);
      ctx.fillStyle = contrastText(contentAccent);
      ctx.textAlign = rtl ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(topic, rtl ? badgeX + badgeWidth - 14 : badgeX + 14, cursorY + badgeHeight / 2, badgeWidth - 25);
      cursorY += badgeHeight + Math.round(unit * 0.35);
    } else {
      ctx.fillStyle = contentAccent;
      setFont(ctx, Math.max(14, unit * 0.48), 800, fontFamily);
      ctx.textAlign = rtl ? 'right' : 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(topic.toUpperCase(), rtl ? width - pad : pad, cursorY);
      cursorY += unit * 0.9;
    }
  }

  const titleSize = Math.max(28, Math.round(Math.min(width * (blocks ? 0.073 : 0.078), height * 0.082) * clamp(Number(input.textScale) || 1, 0.65, 1.8)));
  if (title) {
    const titleHeight = drawTextBlock(ctx, title, textX, cursorY, textWidth, {
      size: titleSize, weight: 800, color: foreground, maxLines: 3,
      lineHeight: 1.12, family: fontFamily, direction,
    });
    cursorY += titleHeight + Math.round(unit * 0.34);
  }
  if (summary) {
    const summaryHeight = drawTextBlock(ctx, summary, textX, cursorY, textWidth, {
      size: Math.max(16, Math.round(titleSize * 0.35)), weight: 400, color: foreground,
      maxLines: 3, lineHeight: 1.38, family: fontFamily, direction,
    });
    cursorY += summaryHeight;
  }
  ctx.restore();
  if (metadata.length) {
    const gap = Math.max(6, Math.round(unit * 0.16));
    const available = width - pad * 2 - (qrSide ? qrSide + gap : 0);
    const cellGap = Math.max(5, Math.round(unit * 0.12));
    const cellWidth = Math.floor((available - cellGap * (metadata.length - 1)) / metadata.length);
    metadata.forEach((item, index) => {
      const x = rtl ? width - pad - cellWidth - index * (cellWidth + cellGap) : pad + index * (cellWidth + cellGap);
      if (blocks) {
        ctx.fillStyle = item.color;
        ctx.fillRect(x, metadataY, cellWidth, metadataHeight);
        drawInfoChip(ctx, item.label, item.value, x, metadataY, cellWidth, {
          fill: item.color, foreground: contrastText(item.color), fontFamily,
          size: unit * 0.78, height: metadataHeight, emphasized: true, direction,
        });
      } else if (index === 0) {
        const label = metadata.map(({ value }) => value).join('  ·  ');
        drawTextBlock(ctx, label, pad, metadataY, width - pad * 2 - (qrSide ? qrSide + gap : 0), {
          size: Math.max(14, unit * 0.38), weight: 700, color: contentAccent,
          maxLines: 2, family: fontFamily, direction,
        });
      }
    });
  }

  const qrX = rtl ? pad : width - pad - qrSide;
  if (qrSide) renderQrCode(ctx, input.url, { x: qrX, y: footerY, width: qrSide, height: qrSide }, { quietZone: 4 });
  if (networks.length) {
    const iconSide = Math.min(Math.max(24, Math.round(unit * 0.82)), footerHeight);
    const gap = Math.max(5, Math.round(iconSide * 0.18));
    const rowWidth = Math.min(width - pad * 2 - (qrSide ? qrSide + gap : 0), Math.min(networks.length, 8) * iconSide + Math.max(0, Math.min(networks.length, 8) - 1) * gap);
    renderSocialIcons(ctx, networks, { x: rtl ? width - pad - rowWidth : pad, y: footerY + Math.max(0, (footerHeight - iconSide) / 2), width: rowWidth, height: iconSide }, theme);
  }
}

function drawInfoChip(ctx, label, value, x, y, width, options) {
  if (!value) return 0;
  const { fill, foreground, fontFamily, size, height, emphasized, direction = 'ltr' } = options;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = foreground;
  setFont(ctx, Math.max(12, size * 0.36), 800, fontFamily);
  ctx.textBaseline = 'top';
  const rtl = direction === 'rtl';
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.fillText(label.toUpperCase(), rtl ? x + width - 12 : x + 12, y + 7, width - 24);
  drawTextBlock(ctx, value, x + 12, y + Math.max(24, height * 0.38), width - 24, {
    size: Math.max(14, size * (emphasized ? 0.48 : 0.4)), weight: emphasized ? 800 : 600,
    color: foreground, maxLines: 2, family: fontFamily, direction,
  });
  return height;
}

/** Render a configurable social card to a PNG Buffer (alpha retained when transparent=true). */
export async function renderSocialCard(input = {}) {
  registerBundledFonts();
  const { kind, template: baseTemplate } = resolveSocialTemplate(input.kind);
  const template = { ...baseTemplate, qr: input.includeQr == null ? baseTemplate.qr : input.includeQr === true };
  const theme = convertThemeConfig(input.theme || {}, input.format, input);
  const { width, height, transparent, background, foreground, primary, fontFamily, direction } = theme;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.direction = direction;
  if (transparent) ctx.clearRect(0, 0, width, height);
  else {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  const padding = Math.round(Math.min(width, height) * 0.055);
  const isTall = height > width * 1.15;
  const isStory = height > width * 1.5;
  const unit = Math.max(16, Math.round(Math.min(width, height) / (isTall ? 24 : 18)));
  const logoScale = clamp(Number(input.logoScale) || 1, 0.4, 2.5);
  const brandScale = clamp(Number(input.brandScale) || 1, 0.5, 2);
  const title = safeText(input.title, 240);
  const summary = safeText(input.summary, 900);
  const topic = template.topic ? safeText(input.topic, 80) : '';
  const date = template.date ? safeText(input.date, 100) : '';
  const location = template.location ? safeText(input.location, 120) : '';
  const image = template.image && theme.imageEnabled ? await loadCanvasImage(input.image || input.imageUrl) : null;
  const logo = await loadCanvasImage(input.logo || input.logoUrl);
  const contentAccent = theme[template.accent] || primary;
  if (theme.blockComposition || theme.minimalComposition) {
    await renderNoImageLayout(ctx, { width, height, theme, logo, input, template, kind, contentAccent });
    return canvas.toBuffer('image/png');
  }
  if (theme.fullBleed) {
    await renderPressLayout(ctx, { width, height, theme, image, logo, input, template, kind, contentAccent });
    return canvas.toBuffer('image/png');
  }
  const hasImage = Boolean(image);
  const imageRect = !hasImage ? null : isTall
    ? { x: 0, y: 0, width, height: Math.round(height * 0.43) }
    : { x: 0, y: 0, width: Math.round(width * 0.39), height };

  // Grid variants are deliberate, orthogonal, and individually configurable.
  if (theme.grid) drawSquareGrid(ctx, { x: 0, y: 0, width, height }, theme.gridColor, unit, transparent ? Math.min(theme.gridOpacity, 0.04) : theme.gridOpacity);
  if (hasImage) {
    drawCoverImage(ctx, image, imageRect);
    // Hard-edged accent rail ties the photo to the grid.
    ctx.fillStyle = contentAccent;
    if (isTall) ctx.fillRect(0, imageRect.height - Math.max(5, unit * 0.16), width, Math.max(5, unit * 0.16));
    else ctx.fillRect(imageRect.width - Math.max(5, unit * 0.16), 0, Math.max(5, unit * 0.16), height);
  }

  const contentX = hasImage && !isTall ? imageRect.width + padding : padding;
  const contentY = hasImage && isTall ? imageRect.height + padding : padding;
  const contentWidth = width - contentX - padding;
  const footerSpace = Math.max(unit * 2.5, 110);
  const contentHeight = height - contentY - padding - footerSpace;
  const fontScale = clamp(Number(input.textScale) || 1, 0.65, 1.8);
  const titleSize = clamp(Math.round(Math.min(contentWidth * (isTall ? 0.07 : 0.095), height * (isTall ? 0.055 : 0.085)) * fontScale), 28, Math.round(width * 0.115));
  const bodySize = Math.max(16, Math.round(titleSize * 0.36));
  const lightPanel = !transparent && contrastText(background) === '#0B0D10';
  const cardFill = transparent ? 'rgba(11, 13, 16, 0.88)' : (lightPanel ? 'rgba(255, 255, 255, 0.94)' : 'rgba(11, 13, 16, 0.88)');
  const cardForeground = transparent ? '#FFFFFF' : foreground;
  const hasText = Boolean(title || summary || topic || date || location);
  if (hasText) {
    // Opaque text panel keeps glyphs legible even when the surrounding canvas is transparent.
    ctx.fillStyle = cardFill;
    ctx.fillRect(contentX, contentY, contentWidth, contentHeight);
    if (theme.grid) drawSquareGrid(ctx, { x: contentX, y: contentY, width: contentWidth, height: contentHeight }, theme.gridColor, unit, theme.gridOpacity);
  }

  let cursorY = contentY + Math.round(unit * 0.8);
  const headerLogoSide = input.showLogo === false ? 0 : Math.min(unit * 1.25 * logoScale, contentWidth * 0.38);
  const headerLogoX = direction === 'rtl' ? width - padding - headerLogoSide : contentX + Math.round(unit * 0.55);
  if (input.showLogo !== false) await renderLogo(ctx, logo, { x: headerLogoX, y: cursorY, width: headerLogoSide, height: headerLogoSide }, {
    primary, foreground: cardForeground, title: input.brand || 'S',
  });
  if (input.showLogo !== false && input.brand) {
    setFont(ctx, Math.max(12, bodySize * 0.72 * brandScale), 700, fontFamily);
    ctx.fillStyle = cardForeground;
    ctx.textBaseline = 'middle';
    ctx.textAlign = direction === 'rtl' ? 'right' : 'left';
    const brandX = direction === 'rtl' ? headerLogoX - unit * 0.35 : headerLogoX + headerLogoSide + unit * 0.35;
    ctx.fillText(safeText(input.brand, 48), brandX, cursorY + headerLogoSide / 2, Math.max(0, contentWidth - headerLogoSide - unit * 2));
  }
  if (input.showLogo !== false) cursorY += headerLogoSide + Math.round(unit * 0.65);

  const topicHeight = Math.max(30, Math.round(unit * 0.68));
  if (topic) {
    setFont(ctx, Math.max(13, bodySize * 0.82), 800, fontFamily);
    const topicWidth = Math.min(contentWidth - unit, Math.max(unit * 2.4, ctx.measureText(topic).width + unit));
    const topicX = direction === 'rtl' ? contentX + contentWidth - Math.round(unit * 0.55) - topicWidth : contentX + Math.round(unit * 0.55);
    ctx.fillStyle = contentAccent;
    ctx.fillRect(topicX, cursorY, topicWidth, topicHeight);
    ctx.fillStyle = contrastText(contentAccent);
    ctx.textBaseline = 'middle';
    ctx.textAlign = direction === 'rtl' ? 'right' : 'left';
    ctx.fillText(topic, direction === 'rtl' ? topicX + topicWidth - Math.round(unit * 0.75) : topicX + Math.round(unit * 0.75), cursorY + topicHeight / 2, topicWidth - unit * 0.4);
    cursorY += topicHeight + Math.round(unit * 0.55);
  }

  const textX = contentX + Math.round(unit * 0.55);
  const textWidth = contentWidth - unit * 1.1;
  if (title) {
    const titleHeight = drawTextBlock(ctx, title, textX, cursorY, textWidth, {
      size: titleSize, weight: 800, color: cardForeground,
      maxLines: isStory ? 4 : isTall ? 2 : 3, lineHeight: 1.12, family: fontFamily, direction,
    });
    cursorY += titleHeight + Math.round(unit * 0.55);
  }
  if (summary) {
    const summaryHeight = drawTextBlock(ctx, summary, textX, cursorY, textWidth, {
      size: bodySize, weight: 400, color: cardForeground,
      maxLines: isStory ? 5 : isTall ? 3 : 4, lineHeight: 1.42, family: fontFamily, direction,
    });
    cursorY += summaryHeight + Math.round(unit * 0.7);
  }

  const infoGap = Math.max(8, Math.round(unit * 0.28));
  const chips = [];
  if (date) chips.push({ label: kind === 'event' ? 'Date' : 'Publié', value: date, emphasis: template.emphasize?.includes('date') });
  if (location) chips.push({ label: 'Lieu', value: location, emphasis: template.emphasize?.includes('location') });
  const chipWidth = chips.length > 1 ? Math.floor((textWidth - infoGap) / 2) : textWidth;
  const chipHeight = Math.max(unit * (template.emphasize?.length ? 1.9 : 1.45), 58);
  chips.forEach((chip, index) => {
    const visualIndex = direction === 'rtl' ? chips.length - 1 - index : index;
    const x = textX + visualIndex * (chipWidth + infoGap);
    drawInfoChip(ctx, chip.label, chip.value, x, cursorY, chipWidth, {
      fill: contentAccent, foreground: contrastText(contentAccent),
      fontFamily, size: bodySize, height: chipHeight, emphasized: chip.emphasis, direction,
    });
  });
  if (chips.length) cursorY += chipHeight + infoGap;

  const footerY = height - padding - Math.max(unit * 1.6, 72);
  const qrSide = template.qr && input.url ? Math.min(Math.round(unit * 2.75), Math.floor(Math.min(contentWidth * 0.32, footerSpace))) : 0;
  const qrX = direction === 'rtl' ? padding : width - padding - qrSide;
  if (qrSide) renderQrCode(ctx, input.url, { x: qrX, y: footerY, width: qrSide, height: qrSide }, { quietZone: 4 });
  const socialNetworks = template.networks && Array.isArray(input.networks) ? input.networks : [];
  const iconSide = Math.max(24, Math.round(unit * 0.82));
  const iconWidth = Math.min(socialNetworks.length, 8) * iconSide + Math.max(0, Math.min(socialNetworks.length, 8) - 1) * 8;
  if (socialNetworks.length) {
    const rowWidth = Math.max(iconWidth, iconSide);
    renderSocialIcons(ctx, socialNetworks, { x: direction === 'rtl' ? width - padding - rowWidth : padding, y: footerY + Math.max(0, (qrSide - iconSide) / 2), width: rowWidth, height: iconSide }, theme);
  }
  ctx.fillStyle = contentAccent;
  const pixelSize = Math.max(3, Math.round(unit * 0.14));
  if (theme.pixelAccents) drawPixelAccents(ctx, { x: width - padding - pixelSize * 5, y: padding, width: pixelSize * 5, height: pixelSize * 5 }, contentAccent, unit);
  ctx.fillRect(padding, height - Math.max(9, padding * 0.45), Math.max(48, Math.round(width * 0.12)), Math.max(4, Math.round(unit * 0.12)));

  return canvas.toBuffer('image/png');
}
