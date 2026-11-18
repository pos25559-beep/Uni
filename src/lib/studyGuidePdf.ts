// PDF do Guia de Estudo: paginação por blocos indivisíveis + montagem com pdf-lib.
// A rasterização (DOM -> imagens) vive em components/assistant/StudyGuidePrintHost.tsx.

import { tr } from '../i18n/tr';
import { sanitizePdfWinAnsi } from './pdfExport';

/** A4 em pontos PDF e margens. */
export const PDF_PAGE_W = 595.28;
export const PDF_PAGE_H = 841.89;
export const PDF_MARGIN_X = 36;
export const PDF_MARGIN_TOP = 36;
export const PDF_MARGIN_BOTTOM = 48; // inclui a linha do rodapé
/** 1 pt = 4/3 px CSS (96 dpi). */
export const PX_PER_PT = 96 / 72;
export const PDF_CONTENT_W_PT = PDF_PAGE_W - 2 * PDF_MARGIN_X;
export const PDF_CONTENT_H_PT = PDF_PAGE_H - PDF_MARGIN_TOP - PDF_MARGIN_BOTTOM;
/** Largura e altura úteis de uma página em px CSS. */
export const PAGE_CONTENT_W_PX = Math.floor(PDF_CONTENT_W_PT * PX_PER_PT);
export const PAGE_CONTENT_H_PX = Math.floor(PDF_CONTENT_H_PT * PX_PER_PT);

export type BlockRange = readonly [top: number, bottom: number];
export type PageSlice = readonly [start: number, end: number];

/**
 * Escolhe as quebras de página só nas fronteiras dos blocos. Devolve fatias contíguas
 * [início, fim] (em px, relativas ao topo do conteúdo), cada uma com altura <= pageHeight.
 * Só um bloco mais alto do que uma página é cortado (em fatias de pageHeight).
 * `totalHeight` (opcional) garante que o conteúdo depois do último bloco não se perde.
 */
export function computePageSlices(
  blocks: readonly BlockRange[],
  pageHeight: number,
  totalHeight?: number,
): PageSlice[] {
  if (!(pageHeight > 0)) return [];
  const sorted = blocks
    .filter(([t, b]) => Number.isFinite(t) && Number.isFinite(b) && b > t)
    .map(([t, b]) => [Math.max(0, t), Math.max(0, b)] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const end = Math.max(totalHeight ?? 0, sorted.length ? sorted[sorted.length - 1][1] : 0);
  if (sorted.length === 0) return end > 0 ? splitTall(0, end, pageHeight) : [];

  const EPS = 0.5; // tolerância a arredondamentos do layout
  const slices: [number, number][] = [];
  let pageStart = 0;
  let lastEnd = 0; // fim do último bloco que coube na página atual (0 = nenhum)
  let hasContent = false;

  for (const [, bottom] of sorted) {
    // Bloco já coberto por um anterior (sobreposto/aninhado): não decide nada.
    if (bottom <= lastEnd + EPS && hasContent) continue;
    if (bottom - pageStart <= pageHeight + EPS) {
      lastEnd = Math.max(lastEnd, bottom);
      hasContent = true;
      continue;
    }
    // Não cabe: fechar a página no fim do último bloco inteiro.
    if (hasContent && lastEnd > pageStart + EPS) {
      slices.push([pageStart, lastEnd]);
      pageStart = lastEnd;
    }
    // Ainda não cabe sozinho (bloco mais alto que uma página): cortar.
    if (bottom - pageStart > pageHeight + EPS) {
      let s = pageStart;
      while (bottom - s > pageHeight + EPS) {
        slices.push([s, s + pageHeight]);
        s += pageHeight;
      }
      pageStart = s;
    }
    lastEnd = bottom;
    hasContent = true;
  }

  const finalEnd = Math.max(end, lastEnd);
  if (finalEnd - pageStart > pageHeight + EPS) {
    slices.push(...splitTall(pageStart, finalEnd, pageHeight));
  } else if (finalEnd > pageStart + EPS) {
    slices.push([pageStart, finalEnd]);
  }
  // Última página sem nenhum bloco (só a margem de baixo do guia): não vale uma página quase em branco.
  const TAIL_PADDING_MAX = 48;
  const tail = slices[slices.length - 1];
  if (slices.length > 1 && tail[0] >= lastEnd - EPS && tail[1] - tail[0] < TAIL_PADDING_MAX) {
    slices.pop();
  }
  return slices;
}

function splitTall(start: number, end: number, pageHeight: number): [number, number][] {
  const out: [number, number][] = [];
  let s = start;
  while (end - s > 0.5) {
    const e = Math.min(end, s + pageHeight);
    out.push([s, e]);
    s = e;
  }
  return out;
}

export interface PdfSliceImage {
  /** JPEG já codificado. */
  jpeg: Uint8Array;
  /** Largura/altura da imagem em px CSS (antes do pixelRatio). */
  widthPx: number;
  heightPx: number;
}

/** Monta o PDF A4: uma página por fatia, imagem com margens e rodapé «Unipedia · Página X de Y». */
export async function buildStudyGuidePdfBytes(images: readonly PdfSliceImage[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const img of images) {
    const page = doc.addPage([PDF_PAGE_W, PDF_PAGE_H]);
    const embedded = await doc.embedJpg(img.jpeg);
    const w = PDF_CONTENT_W_PT;
    const h = (img.heightPx / img.widthPx) * w;
    page.drawImage(embedded, {
      x: PDF_MARGIN_X,
      y: PDF_PAGE_H - PDF_MARGIN_TOP - h,
      width: w,
      height: h,
    });
  }

  const pages = doc.getPages();
  pages.forEach((p, idx) => {
    p.drawText(
      sanitizePdfWinAnsi(tr('assistant:notebook.pdfPage', { current: idx + 1, total: pages.length })),
      { x: PDF_MARGIN_X, y: 24, size: 8.5, font, color: rgb(0.5, 0.5, 0.52) },
    );
  });
  return doc.save();
}
