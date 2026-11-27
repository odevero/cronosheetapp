import { DateScenario, EnrichedGoal } from '../entities/models';
import { TranslationKey } from '../../i18n/it';

export type SocialCardFormat = 'post' | 'story';
export type SocialCardTheme = 'gradient' | 'light' | 'dark';
export type SocialCardMessageKind = 'days' | 'ymw';

export interface SocialCardDimensions {
  readonly width: number;
  readonly height: number;
}

export const SOCIAL_CARD_DIMENSIONS: Record<SocialCardFormat, SocialCardDimensions> = {
  post: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

export interface SocialCardRenderOptions {
  readonly format: SocialCardFormat;
  readonly theme: SocialCardTheme;
  readonly messageKind: SocialCardMessageKind;
  readonly brandTitle: string;
  readonly appUrl: string;
  readonly iconUrl?: string;
}

export interface SocialCardLabels {
  readonly statusTag: string;
  readonly daysUnit: string;
  readonly dayUnit: string;
  readonly yearsLabel: string;
  readonly monthsLabel: string;
  readonly weeksLabel: string;
  readonly daysLabel: string;
  readonly scanQrCaption: string;
  readonly startDateLabel: string;
}

export function getCardStatusTagKey(scenario: DateScenario): TranslationKey {
  if (scenario === 'COMPLETED') return 'social.completedTag';
  if (scenario === 'FUTURE_START' || scenario === 'END_ONLY') return 'social.upcomingTag';
  return 'social.ongoingTag';
}

export const CANONICAL_SHARE_APP_URL = 'https://cronosheetapp.ai.studio';

export function resolveShareAppUrl(): string {
  return CANONICAL_SHARE_APP_URL;
}

export function extractDomainLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.host.replace(/^www\./i, '');
  } catch {
    return 'cronosheetapp.ai.studio';
  }
}

export function buildSocialShareFilename(title: string, format: SocialCardFormat): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const safeSlug = slug || 'activity';
  return `cronosheet_${safeSlug}_${format}.png`;
}

export function wrapTextToLines(
  text: string,
  maxCharsPerLine: number,
  maxLines: number,
): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean || maxCharsPerLine <= 0 || maxLines <= 0) return [];

  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (let idx = 0; idx < words.length; idx++) {
    const word = words[idx];
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      if (lines.length >= maxLines) {
        lines[maxLines - 1] = appendEllipsis(lines[maxLines - 1], maxCharsPerLine);
        return lines;
      }
      current = word.length > maxCharsPerLine ? truncateWithEllipsis(word, maxCharsPerLine) : word;
    } else {
      lines.push(truncateWithEllipsis(word, maxCharsPerLine));
      if (lines.length >= maxLines) {
        if (idx < words.length - 1) {
          lines[maxLines - 1] = appendEllipsis(lines[maxLines - 1], maxCharsPerLine);
        }
        return lines;
      }
      current = '';
    }
  }

  if (current) {
    if (lines.length < maxLines) {
      lines.push(current);
    } else {
      lines[maxLines - 1] = appendEllipsis(lines[maxLines - 1], maxCharsPerLine);
    }
  }

  return lines;
}

function appendEllipsis(text: string, maxLen: number): string {
  const clean = text.trimEnd();
  if (clean.endsWith('…')) return clean.slice(0, maxLen);
  if (clean.length + 1 <= maxLen) return `${clean}…`;
  return truncateWithEllipsis(clean, maxLen);
}

function truncateWithEllipsis(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  if (maxLen <= 1) return '…';
  return `${text.slice(0, maxLen - 1).trimEnd()}…`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function generateQrDataUrl(appUrl: string): Promise<string | null> {
  try {
    const qrcodeMod = await import('qrcode');
    const toDataURL = qrcodeMod.toDataURL ?? qrcodeMod.default?.toDataURL;
    if (!toDataURL) return null;
    return await toDataURL(appUrl, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111827', light: '#FFFFFF' },
    });
  } catch {
    return null;
  }
}

export async function renderSocialShareCard(
  canvas: HTMLCanvasElement,
  enriched: EnrichedGoal,
  options: SocialCardRenderOptions,
  labels: SocialCardLabels,
): Promise<void> {
  const { width, height } = SOCIAL_CARD_DIMENSIONS[options.format];
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const isStory = options.format === 'story';
  const accentHex = enriched.palette.hex || '#1A73E8';

  // 1. Background Canvas
  if (options.theme === 'gradient') {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0284C7');
    bgGrad.addColorStop(0.52, '#0D9488');
    bgGrad.addColorStop(1, '#EAB308');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle atmospheric radial blooms
    const bloom1 = ctx.createRadialGradient(width * 0.15, height * 0.12, 40, width * 0.15, height * 0.12, width * 0.65);
    bloom1.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    bloom1.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = bloom1;
    ctx.fillRect(0, 0, width, height);

    const bloom2 = ctx.createRadialGradient(width * 0.88, height * 0.88, 30, width * 0.88, height * 0.88, width * 0.6);
    bloom2.addColorStop(0, 'rgba(250, 204, 21, 0.28)');
    bloom2.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = bloom2;
    ctx.fillRect(0, 0, width, height);
  } else if (options.theme === 'dark') {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(1, '#1E293B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.5, height * 0.22, 20, width * 0.5, height * 0.22, width * 0.65);
    glow.addColorStop(0, `${accentHex}33`);
    glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = '#F8F9FA';
    ctx.fillRect(0, 0, width, height);

    // 4-color top Google/CronoSheet thin ribbon
    const ribbonColors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];
    const segW = width / 4;
    ribbonColors.forEach((hex, idx) => {
      ctx.fillStyle = hex;
      ctx.fillRect(idx * segW, 0, segW + 1, 14);
    });
  }

  // Load icon + QR code concurrently
  const [iconImg, qrDataUrl] = await Promise.all([
    loadImage(options.iconUrl ?? '/icons/pwa-192x192.png'),
    generateQrDataUrl(options.appUrl),
  ]);
  const qrImg = qrDataUrl ? await loadImage(qrDataUrl) : null;

  // 2. Central Elevated Card geometry
  const cardPadX = isStory ? 76 : 64;
  const cardX = cardPadX;
  const cardW = width - cardPadX * 2;
  const cardY = isStory ? 230 : 64;
  const cardH = isStory ? 1460 : 952;

  const isDarkCard = options.theme === 'dark';
  const cardBg = isDarkCard ? '#1E293B' : '#FFFFFF';
  const cardBorder = isDarkCard ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)';
  const primaryText = isDarkCard ? '#F8FAFC' : '#202124';
  const secondaryText = isDarkCard ? '#94A3B8' : '#5F6368';
  const subtleSurface = isDarkCard ? 'rgba(15, 23, 42, 0.55)' : '#F8F9FA';
  const subtleBorder = isDarkCard ? 'rgba(255, 255, 255, 0.09)' : '#E8EAED';

  // Card drop shadow
  ctx.save();
  ctx.shadowColor = isDarkCard ? 'rgba(0, 0, 0, 0.45)' : 'rgba(15, 23, 42, 0.18)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 20;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.fillStyle = cardBg;
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.strokeStyle = cardBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Accent bar inside top of card
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.clip();
  ctx.fillStyle = accentHex;
  ctx.fillRect(cardX, cardY, cardW, 12);
  ctx.restore();

  // 3. Card Header: App Icon + Brand Name + Status Tag
  const innerX = cardX + (isStory ? 64 : 56);
  const innerW = cardW - (isStory ? 128 : 112);
  const headerY = cardY + (isStory ? 74 : 42);
  const iconSize = isStory ? 68 : 60;

  if (iconImg) {
    ctx.save();
    drawRoundedRect(ctx, innerX, headerY, iconSize, iconSize, 16);
    ctx.clip();
    ctx.drawImage(iconImg, innerX, headerY, iconSize, iconSize);
    ctx.restore();
  } else {
    drawRoundedRect(ctx, innerX, headerY, iconSize, iconSize, 16);
    ctx.fillStyle = accentHex;
    ctx.fill();
  }

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = primaryText;
  ctx.font = `700 ${isStory ? 32 : 30}px "Plus Jakarta Sans", "Inter", system-ui, sans-serif`;
  ctx.fillText(options.brandTitle || 'CronoSheet', innerX + iconSize + 18, headerY + iconSize / 2 - 11);

  ctx.fillStyle = secondaryText;
  ctx.font = `600 ${isStory ? 20 : 18}px "Inter", system-ui, sans-serif`;
  ctx.fillText(labels.statusTag, innerX + iconSize + 18, headerY + iconSize / 2 + 16);

  // Subtle horizontal divider under header
  const divider1Y = headerY + iconSize + (isStory ? 44 : 24);
  ctx.strokeStyle = subtleBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(innerX, divider1Y);
  ctx.lineTo(innerX + innerW, divider1Y);
  ctx.stroke();

  // 4. Activity Title
  const titleLines = wrapTextToLines(enriched.goal.title, isStory ? 24 : 28, isStory ? 3 : 2);
  const titleFontSize = isStory ? (titleLines.length >= 3 ? 44 : 50) : titleLines.length >= 2 ? 40 : 46;
  const titleLineHeight = Math.round(titleFontSize * 1.18);
  let cursorY = divider1Y + (isStory ? 76 : 28);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = primaryText;
  ctx.font = `700 ${titleFontSize}px "Plus Jakarta Sans", "Inter", system-ui, sans-serif`;
  for (const line of titleLines) {
    ctx.fillText(line, width / 2, cursorY);
    cursorY += titleLineHeight;
  }

  // Optional Start Date caption
  if (enriched.goal.startDate) {
    cursorY += isStory ? 12 : 8;
    ctx.fillStyle = secondaryText;
    ctx.font = `500 ${isStory ? 24 : 22}px "JetBrains Mono", ui-monospace, monospace`;
    const dateSpan = enriched.goal.endDate
      ? `${enriched.goal.startDate}  →  ${enriched.goal.endDate}`
      : `${labels.startDateLabel} ${enriched.goal.startDate}`;
    ctx.fillText(dateSpan, width / 2, cursorY);
    cursorY += isStory ? 38 : 28;
  }

  // 5. Big Day Counter Hero
  const primaryDays = enriched.metrics.primaryDays;
  const dayText = primaryDays === null ? '—' : String(primaryDays);
  const unitText = primaryDays === 1 ? labels.dayUnit : labels.daysUnit;

  cursorY += isStory ? 56 : 16;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = isDarkCard ? '#FFFFFF' : accentHex;
  ctx.font = `800 ${isStory ? 184 : 128}px "JetBrains Mono", "Plus Jakarta Sans", ui-monospace, sans-serif`;
  ctx.fillText(dayText, width / 2, cursorY);

  cursorY += isStory ? 196 : 132;
  ctx.fillStyle = secondaryText;
  ctx.font = `700 ${isStory ? 26 : 23}px "Inter", system-ui, sans-serif`;
  ctx.fillText(unitText, width / 2, cursorY);

  // 6. A / M / S / G Breakdown Grid
  cursorY += isStory ? 72 : 34;
  const breakdown = enriched.metrics.breakdown;
  const cells = [
    { label: labels.yearsLabel, value: breakdown ? breakdown.years : 0 },
    { label: labels.monthsLabel, value: breakdown ? breakdown.months : 0 },
    { label: labels.weeksLabel, value: breakdown ? breakdown.weeks : 0 },
    { label: labels.daysLabel, value: breakdown ? breakdown.days : 0 },
  ];

  const gap = isStory ? 20 : 16;
  const cellW = (innerW - gap * 3) / 4;
  const cellH = isStory ? 148 : 102;

  cells.forEach((cell, idx) => {
    const cx = innerX + idx * (cellW + gap);
    drawRoundedRect(ctx, cx, cursorY, cellW, cellH, 20);
    ctx.fillStyle = subtleSurface;
    ctx.fill();
    ctx.strokeStyle = subtleBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = cell.value > 0 ? primaryText : secondaryText;
    ctx.font = `700 ${isStory ? 52 : 40}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(String(cell.value), cx + cellW / 2, cursorY + cellH * 0.4);

    ctx.fillStyle = secondaryText;
    ctx.font = `700 ${isStory ? 20 : 18}px "Inter", system-ui, sans-serif`;
    ctx.fillText(cell.label, cx + cellW / 2, cursorY + cellH * 0.77);
  });

  // 7. Footer geometry (computed early so quote box stays safely above divider)
  const footerH = isStory ? 152 : 128;
  const footerY = cardY + cardH - footerH - (isStory ? 52 : 28);
  const footerDividerY = footerY - (isStory ? 24 : 18);

  // 8. Shareable Message Quote Box (centered cleanly between grid and footer divider)
  const gridBottom = cursorY + cellH;
  const availableMid = footerDividerY - gridBottom;
  const msgBoxH = isStory ? 196 : Math.min(98, Math.max(76, availableMid - 28));
  const msgBoxY = isStory ? gridBottom + 56 : gridBottom + Math.round((availableMid - msgBoxH) / 2);

  const chosenMsg =
    options.messageKind === 'ymw'
      ? enriched.metrics.shareYmwMessage
      : enriched.metrics.shareDaysMessage;
  const msgLines = wrapTextToLines(chosenMsg || enriched.goal.title, isStory ? 38 : 44, isStory ? 4 : 2);

  drawRoundedRect(ctx, innerX, msgBoxY, innerW, msgBoxH, 22);
  ctx.fillStyle = subtleSurface;
  ctx.fill();
  ctx.strokeStyle = subtleBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = primaryText;
  const msgFontSize = isStory ? 31 : 24;
  const msgLineH = Math.round(msgFontSize * 1.35);
  ctx.font = `600 ${msgFontSize}px "Inter", system-ui, sans-serif`;
  const totalMsgH = msgLines.length * msgLineH;
  const startMsgY = msgBoxY + (msgBoxH - totalMsgH) / 2 + msgLineH / 2;
  msgLines.forEach((line, idx) => {
    ctx.fillText(line, width / 2, startMsgY + idx * msgLineH);
  });

  // 9. Footer with QR Code + Scan Caption + Domain
  ctx.strokeStyle = subtleBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(innerX, footerDividerY);
  ctx.lineTo(innerX + innerW, footerDividerY);
  ctx.stroke();

  const qrSize = isStory ? 136 : 114;
  const qrBoxX = innerX + innerW - qrSize;
  const qrBoxY = footerY + (footerH - qrSize) / 2;

  // White backing behind QR code so it always scans cleanly even on dark theme
  drawRoundedRect(ctx, qrBoxX - 8, qrBoxY - 8, qrSize + 16, qrSize + 16, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = subtleBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (qrImg) {
    ctx.drawImage(qrImg, qrBoxX, qrBoxY, qrSize, qrSize);
  }

  // Left side of footer: CTA + domain
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = primaryText;
  ctx.font = `700 ${isStory ? 28 : 25}px "Plus Jakarta Sans", "Inter", system-ui, sans-serif`;
  ctx.fillText(labels.scanQrCaption, innerX, footerY + footerH * 0.36);

  ctx.fillStyle = isDarkCard ? '#38BDF8' : '#1A73E8';
  ctx.font = `600 ${isStory ? 24 : 22}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.fillText(extractDomainLabel(options.appUrl), innerX, footerY + footerH * 0.68);
}
