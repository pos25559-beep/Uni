// Renderiza o Guia de Estudo fora do ecrã (tema claro, largura de uma página A4) e converte-o
// em fatias JPEG, uma por página (capturadas uma a uma), cortadas só entre blocos [data-guide-block].

import type { CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { computePageSlices, PAGE_CONTENT_H_PX, PAGE_CONTENT_W_PX, type PdfSliceImage } from '../../lib/studyGuidePdf';
import { groupSlicesForCapture, pageCaptureRatio } from '../../lib/studyGuideRaster';
import type { StudyGuide } from '../../lib/studyGuide';
import StudyGuideView from './StudyGuideView';

/** Tokens do tema claro (de index.css), para ignorar .dark e a paleta escolhida. */
const LIGHT_TOKENS: Record<string, string> = {
  '--bg': '#FFFFFF',
  '--surface': '#FFFFFF',
  '--surface-2': '#F2ECE1',
  '--line': '#E6DFD3',
  '--fg': '#141312',
  '--muted': '#5F5B54',
  '--accent': '#157F58',
  '--accent-ink': '#0F6344',
  '--accent-fg': '#FFFFFF',
  '--accent-soft': '#DCF4EA',
  '--coral': '#E04F33',
  '--coral-ink': '#B83A22',
  '--coral-soft': '#FDE8E2',
  '--ink-cta': '#141312',
  '--ink-cta-fg': '#FAF8F2',
  '--ok': '#157F58',
  '--ok-ink': '#0D5C3E',
  '--warn': '#A16207',
  '--danger': '#D64550',
  '--shadow-card': 'none',
  '--shadow-float': 'none',
  '--shadow-dock': 'none',
};

const JPEG_QUALITY = 0.92;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('jpeg'));
        blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject);
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}


const FONT_FETCH_TIMEOUT_MS = 12000;

function parseUnicodeRanges(value: string): [number, number][] | null {
  const v = value.trim();
  if (!v) return null;
  const out: [number, number][] = [];
  for (const part of v.split(',')) {
    const m = /U\+([0-9a-f?]+)(?:-([0-9a-f]+))?/i.exec(part.trim());
    if (!m) continue;
    if (m[1].includes('?')) {
      out.push([parseInt(m[1].replaceAll('?', '0'), 16), parseInt(m[1].replaceAll('?', 'f'), 16)]);
    } else {
      const a = parseInt(m[1], 16);
      out.push([a, m[2] ? parseInt(m[2], 16) : a]);
    }
  }
  return out;
}

function toDataUri(url: string, mime: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), FONT_FETCH_TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onerror = () => reject(fr.error);
          fr.onload = () => resolve(String(fr.result).replace(/^data:[^,]*/, `data:${mime};base64`));
          fr.readAsDataURL(blob);
        }),
    )
    .finally(() => window.clearTimeout(timer));
}

function collectFontFaceRules(rules: CSSRuleList, out: CSSFontFaceRule[]) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSFontFaceRule) out.push(rule);
    else if ('cssRules' in rule) collectFontFaceRules((rule as CSSGroupingRule).cssRules, out);
  }
}

/**
 * CSS @font-face só com o que o conteúdo usa (famílias e caracteres) e só em woff2, em data URI.
 * Mais leve e fiável do que o embutir geral do html-to-image (que traz woff+ttf de todos os subconjuntos).
 */
export async function buildFontEmbedCss(content: HTMLElement): Promise<string> {
  const families = new Set<string>();
  const nodes = [content, ...Array.from(content.querySelectorAll<HTMLElement>('*'))];
  for (const el of nodes) {
    for (const f of getComputedStyle(el).fontFamily.split(',')) families.add(f.trim().replace(/^["']|["']$/g, ''));
  }
  const codepoints = new Set<number>();
  for (const ch of content.textContent ?? '') codepoints.add(ch.codePointAt(0) ?? 0);
  const hasMath = content.querySelector('.katex') !== null;

  const rules: CSSFontFaceRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      collectFontFaceRules(sheet.cssRules, rules);
    } catch {
      // folha de outra origem: não se lê
    }
  }

  const jobs: Promise<string>[] = [];
  for (const rule of rules) {
    const family = rule.style.getPropertyValue('font-family').trim().replace(/^["']|["']$/g, '');
    if (!families.has(family)) continue;
    const ranges = parseUnicodeRanges(rule.style.getPropertyValue('unicode-range'));
    if (ranges && !family.startsWith('KaTeX')) {
      const used = [...codepoints].some((cp) => ranges.some(([a, b]) => cp >= a && cp <= b));
      if (!used) continue;
    }
    if (family.startsWith('KaTeX') && !hasMath) continue;
    const src = rule.style.getPropertyValue('src');
    const m = /url\(\s*["']?([^"')]+?\.woff2[^"')]*?)["']?\s*\)/i.exec(src);
    if (!m) continue;
    const abs = new URL(m[1], rule.parentStyleSheet?.href || document.baseURI).href;
    const decl = ['font-style', 'font-weight', 'font-stretch', 'unicode-range']
      .map((p) => {
        const v = rule.style.getPropertyValue(p);
        return v ? `${p}:${v};` : '';
      })
      .join('');
    jobs.push(
      toDataUri(abs, 'font/woff2')
        .then((uri) => `@font-face{font-family:"${family}";${decl}src:url(${uri}) format("woff2");}`)
        .catch(() => ''),
    );
  }
  return (await Promise.all(jobs)).join('\n');
}

/** Blocos [top,bottom] relativos ao topo do conteúdo; blocos mais altos que a página descem aos filhos. */
export function measureGuideBlocks(root: HTMLElement, pageHeight: number): [number, number][] {
  const base = root.getBoundingClientRect().top;
  const out: [number, number][] = [];
  const headingIdx = new Set<number>();
  const visit = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const nested = Array.from(el.querySelectorAll<HTMLElement>('[data-guide-block]')).filter(
      (c) => c.closest('[data-guide-block]') === el,
    );
    if (r.height > pageHeight && nested.length > 0) {
      nested.forEach(visit);
      return;
    }
    if (/^H[1-4]$/.test(el.tagName)) headingIdx.add(out.length);
    out.push([r.top - base, r.bottom - base]);
  };
  Array.from(root.querySelectorAll<HTMLElement>('[data-guide-block]'))
    .filter((el) => !el.parentElement?.closest('[data-guide-block]'))
    .forEach(visit);
  // Um título nunca fica sozinho no fim da página: junta-se ao bloco seguinte.
  const merged: [number, number][] = [];
  for (let i = 0; i < out.length; i++) {
    if (headingIdx.has(i) && i + 1 < out.length) {
      merged.push([out[i][0], Math.max(out[i][1], out[i + 1][1])]);
      i++;
    } else merged.push(out[i]);
  }
  return merged;
}

/** Rasteriza o guia em fatias de página. Lança erro se algo falhar (o chamador usa o PDF de texto). */
export async function rasterizeStudyGuide(guide: StudyGuide, subtitle: string): Promise<PdfSliceImage[]> {
  const { toCanvas } = await import('html-to-image');

  const host = document.createElement('div');
  host.setAttribute('data-theme', 'light');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_CONTENT_W_PX}px;pointer-events:none;background:#fff;color:#141312;color-scheme:light;`;
  for (const [k, v] of Object.entries(LIGHT_TOKENS)) host.style.setProperty(k, v);
  document.body.appendChild(host);
  const content = document.createElement('div');
  content.style.cssText = `width:${PAGE_CONTENT_W_PX}px;background:#fff;font-family:var(--font-sans, system-ui, sans-serif);`;
  host.appendChild(content);
  const root = createRoot(content);

  try {
    const style: CSSProperties = { color: '#6b6963', fontSize: 11, marginBottom: 10 };
    flushSync(() => {
    root.render(
      <>
        <p data-guide-block style={style}>
          {subtitle}
        </p>
        <StudyGuideView guide={guide} variant="print" />
      </>,
    );
    });
    await nextFrame();
    await nextFrame();
    await document.fonts.ready;
    await nextFrame();

    const totalHeight = content.getBoundingClientRect().height;
    const slices = computePageSlices(measureGuideBlocks(content, PAGE_CONTENT_H_PX), PAGE_CONTENT_H_PX, totalHeight);
    if (slices.length === 0) throw new Error('empty');

    const fontEmbedCSS = await buildFontEmbedCss(content);
    // Nunca o guia inteiro num só canvas: ultrapassava os limites do Safari/iOS e dava páginas em
    // branco sem erro. Agrupa páginas seguidas até ao limite de canvas (poucas capturas, porque cada
    // uma clona o guia inteiro) e corta cada grupo em páginas. Cada canvas é libertado logo a seguir.
    const images: PdfSliceImage[] = [];
    for (const group of groupSlicesForCapture(slices, PAGE_CONTENT_W_PX)) {
      const groupStart = group[0][0];
      const groupHeight = Math.max(1, Math.ceil(group[group.length - 1][1] - groupStart));
      const ratio = pageCaptureRatio(PAGE_CONTENT_W_PX, groupHeight);
      if (!(ratio > 0)) throw new Error('canvas');
      const chunk = await toCanvas(content, {
        width: PAGE_CONTENT_W_PX,
        height: groupHeight,
        pixelRatio: ratio,
        backgroundColor: '#ffffff',
        fontEmbedCSS,
        style: {
          transform: `translateY(${-groupStart}px)`,
          transformOrigin: 'top left',
          width: `${PAGE_CONTENT_W_PX}px`,
          height: `${Math.ceil(totalHeight)}px`,
        },
      });
      try {
        const scale = chunk.width / PAGE_CONTENT_W_PX;
        for (const [start, end] of group) {
          const page = document.createElement('canvas');
          const sy = Math.round((start - groupStart) * scale);
          page.width = chunk.width;
          page.height = Math.max(1, Math.min(chunk.height - sy, Math.round((end - start) * scale)));
          const ctx = page.getContext('2d');
          if (!ctx) throw new Error('canvas');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, page.width, page.height);
          ctx.drawImage(chunk, 0, sy, page.width, page.height, 0, 0, page.width, page.height);
          try {
            images.push({ jpeg: await canvasToJpeg(page), widthPx: PAGE_CONTENT_W_PX, heightPx: page.height / scale });
          } finally {
            page.width = page.height = 0;
          }
        }
      } finally {
        chunk.width = chunk.height = 0;
      }
    }
    return images;
  } finally {
    root.unmount();
    host.remove();
  }
}
