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
  ctx.textAlign = options.align || 'left';
  ctx.textBaseline = 'top';
  const lines = wrapText(ctx, text, width, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * size * lineHeight, width));
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

function drawInfoChip(ctx, label, value, x, y, width, options) {
  if (!value) return 0;
  const { fill, foreground, fontFamily, size, height, emphasized } = options;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = foreground;
  setFont(ctx, Math.max(12, size * 0.36), 800, fontFamily);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(label.toUpperCase(), x + 12, y + 7, width - 24);
  drawTextBlock(ctx, value, x + 12, y + Math.max(24, height * 0.38), width - 24, {
    size: Math.max(14, size * (emphasized ? 0.48 : 0.4)), weight: emphasized ? 800 : 600,
    color: foreground, maxLines: 2, family: fontFamily,
  });
  return height;
}

/** Render a configurable social card to a PNG Buffer (alpha retained when transparent=true). */
export async function renderSocialCard(input = {}) {
  registerBundledFonts();
  const { kind, template } = resolveSocialTemplate(input.kind);
  const theme = convertThemeConfig(input.theme || {}, input.format, input);
  const { width, height, transparent, background, foreground, primary, fontFamily } = theme;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (transparent) ctx.clearRect(0, 0, width, height);
  else {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  const padding = Math.round(Math.min(width, height) * 0.055);
  const isTall = height > width * 1.15;
  const isStory = height > width * 1.5;
  const unit = Math.max(16, Math.round(Math.min(width, height) / (isTall ? 24 : 18)));
  const title = safeText(input.title, 240);
  const summary = safeText(input.summary, 900);
  const topic = template.topic ? safeText(input.topic, 80) : '';
  const date = template.date ? safeText(input.date, 100) : '';
  const location = template.location ? safeText(input.location, 120) : '';
  const image = template.image ? await loadCanvasImage(input.image || input.imageUrl) : null;
  const logo = await loadCanvasImage(input.logo || input.logoUrl);
  const contentAccent = theme[template.accent] || primary;
  const hasImage = Boolean(image);
  const imageRect = !hasImage ? null : isTall
    ? { x: 0, y: 0, width, height: Math.round(height * 0.43) }
    : { x: 0, y: 0, width: Math.round(width * 0.39), height };

  // The faint orthogonal grid is deliberately regular and never rounded.
  drawSquareGrid(ctx, { x: 0, y: 0, width, height }, foreground, unit, transparent ? 0.04 : 0.065);
  if (hasImage) {
    const scale = Math.max(imageRect.width / image.width, imageRect.height / image.height);
    const sw = imageRect.width / scale;
    const sh = imageRect.height / scale;
    const sx = (image.width - sw) / 2;
    const sy = (image.height - sh) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
    ctx.clip();
    ctx.drawImage(image, sx, sy, sw, sh, imageRect.x, imageRect.y, imageRect.width, imageRect.height);
    ctx.restore();
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
    drawSquareGrid(ctx, { x: contentX, y: contentY, width: contentWidth, height: contentHeight }, contentAccent, unit, 0.09);
  }

  let cursorY = contentY + Math.round(unit * 0.8);
  const headerLogoSide = Math.min(unit * 1.25, contentWidth * 0.23);
  await renderLogo(ctx, logo, { x: contentX + Math.round(unit * 0.55), y: cursorY, width: headerLogoSide, height: headerLogoSide }, {
    primary, foreground: cardForeground, title: input.brand || 'S',
  });
  cursorY += headerLogoSide + Math.round(unit * 0.65);

  const topicHeight = Math.max(30, Math.round(unit * 0.68));
  if (topic) {
    const topicWidth = Math.min(contentWidth - unit, Math.max(unit * 2.4, ctx.measureText(topic).width + unit));
    ctx.fillStyle = contentAccent;
    ctx.fillRect(contentX + Math.round(unit * 0.55), cursorY, topicWidth, topicHeight);
    ctx.fillStyle = contrastText(contentAccent);
    setFont(ctx, Math.max(13, bodySize * 0.82), 800, fontFamily);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(topic, contentX + Math.round(unit * 0.75), cursorY + topicHeight / 2, topicWidth - unit * 0.4);
    cursorY += topicHeight + Math.round(unit * 0.55);
  }

  const textX = contentX + Math.round(unit * 0.55);
  const textWidth = contentWidth - unit * 1.1;
  if (title) {
    const titleHeight = drawTextBlock(ctx, title, textX, cursorY, textWidth, {
      size: titleSize, weight: 800, color: cardForeground,
      maxLines: isStory ? 4 : isTall ? 2 : 3, lineHeight: 1.12, family: fontFamily,
    });
    cursorY += titleHeight + Math.round(unit * 0.55);
  }
  if (summary) {
    const summaryHeight = drawTextBlock(ctx, summary, textX, cursorY, textWidth, {
      size: bodySize, weight: 400, color: cardForeground,
      maxLines: isStory ? 5 : isTall ? 3 : 4, lineHeight: 1.42, family: fontFamily,
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
    const x = textX + index * (chipWidth + infoGap);
    cursorY += index === 0 ? 0 : 0;
    drawInfoChip(ctx, chip.label, chip.value, x, cursorY, chipWidth, {
      fill: contentAccent, foreground: contrastText(contentAccent),
      fontFamily, size: bodySize, height: chipHeight, emphasized: chip.emphasis,
    });
  });
  if (chips.length) cursorY += chipHeight + infoGap;

  const footerY = height - padding - Math.max(unit * 1.6, 72);
  const qrSide = template.qr && input.url ? Math.min(Math.round(unit * 2.75), Math.floor(Math.min(contentWidth * 0.32, footerSpace))) : 0;
  const qrX = width - padding - qrSide;
  if (qrSide) renderQrCode(ctx, input.url, { x: qrX, y: footerY, width: qrSide, height: qrSide }, { quietZone: 4 });
  const socialNetworks = template.networks && Array.isArray(input.networks) ? input.networks : [];
  const iconSide = Math.max(24, Math.round(unit * 0.82));
  const iconWidth = Math.min(socialNetworks.length, 8) * iconSide + Math.max(0, Math.min(socialNetworks.length, 8) - 1) * 8;
  if (socialNetworks.length) renderSocialIcons(ctx, socialNetworks, { x: padding, y: footerY + Math.max(0, (qrSide - iconSide) / 2), width: Math.max(iconWidth, iconSide), height: iconSide }, theme);
  if (!logo && input.brand) {
    // The fallback monogram in the header is sufficient; add a small wordmark only when there is room.
    ctx.fillStyle = cardForeground;
    setFont(ctx, Math.max(12, bodySize * 0.72), 700, fontFamily);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(safeText(input.brand, 48), contentX + headerLogoSide + unit * 0.8, contentY + headerLogoSide / 2, Math.max(0, contentWidth - headerLogoSide - unit * 2));
  }
  ctx.fillStyle = contentAccent;
  const pixelSize = Math.max(3, Math.round(unit * 0.14));
  drawPixelAccents(ctx, { x: width - padding - pixelSize * 5, y: padding, width: pixelSize * 5, height: pixelSize * 5 }, contentAccent, unit);
  ctx.fillRect(padding, height - Math.max(9, padding * 0.45), Math.max(48, Math.round(width * 0.12)), Math.max(4, Math.round(unit * 0.12)));

  return canvas.toBuffer('image/png');
}
