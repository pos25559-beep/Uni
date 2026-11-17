import { tr } from '../i18n/tr';
import { flattenMarkdownMathForText } from './latexText';

/** Converte markdown/texto para caracteres seguros no font Standard Helvetica (WinAnsi). */
export function sanitizePdfWinAnsi(text: string): string {
  return flattenMarkdownMathForText(text)
    .replaceAll('\u2022', '*')
    .replaceAll('\u2192', '->')
    .replaceAll('\u2190', '<-')
    .replaceAll('\u2014', '--')
    .replaceAll('\u2013', '-')
    .replaceAll('\u201c', '"')
    .replaceAll('\u201d', '"')
    .replaceAll('\u2018', "'")
    .replaceAll('\u2019', "'")
    .replaceAll('\u2026', '...')
    .replaceAll('\u2713', '[OK]')
    .replaceAll('\u2714', '[OK]')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function wrapLine(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Gera um PDF A4 legível a partir do resumo gerado no Caderno do Uni.
 * Carrega `pdf-lib` apenas sob demanda (`vendor-pdf` chunk).
 */
export async function buildNotebookPdfBytes(input: {
  title: string;
  subtitle?: string;
  markdown: string;
}): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 52;
  const marginBottom = 56;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 54;

  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - 54;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < marginBottom) newPage();
  };

  // Cabeçalho
  page.drawText(sanitizePdfWinAnsi(input.title), {
    x: marginX,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.09, 0.24, 0.16),
  });
  y -= 20;

  if (input.subtitle) {
    page.drawText(sanitizePdfWinAnsi(input.subtitle), {
      x: marginX,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.42),
    });
    y -= 16;
  }

  page.drawLine({
    start: { x: marginX, y },
    end: { x: pageWidth - marginX, y },
    thickness: 1,
    color: rgb(0.82, 0.85, 0.82),
  });
  y -= 20;

  const rawLines = input.markdown.replace(/\r\n/g, '\n').split('\n');
  for (const raw of rawLines) {
    const line = sanitizePdfWinAnsi(raw).trimEnd();
    if (!line.trim()) {
      y -= 8;
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(line.trim());
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].replace(/\*\*/g, '');
      const fontSize = level === 1 ? 14 : level === 2 ? 12.5 : 11;
      y -= 6;
      for (const wrapped of wrapLine(text, 76)) {
        ensureSpace(fontSize + 8);
        page.drawText(wrapped, {
          x: marginX,
          y,
          size: fontSize,
          font: fontBold,
          color: rgb(0.11, 0.22, 0.17),
        });
        y -= fontSize + 6;
      }
      continue;
    }

    const bulletMatch = /^[-*]\s+(.*)$/.exec(line.trim());
    const cleanText = (bulletMatch ? `* ${bulletMatch[1]}` : line.trim()).replace(/\*\*/g, '');
    const indent = bulletMatch ? 12 : 0;
    for (const wrapped of wrapLine(cleanText, bulletMatch ? 82 : 88)) {
      ensureSpace(16);
      page.drawText(wrapped, {
        x: marginX + indent,
        y,
        size: 10.5,
        font: fontRegular,
        color: rgb(0.16, 0.16, 0.17),
      });
      y -= 15;
    }
  }

  // Numeração de páginas no rodapé
  const pages = doc.getPages();
  pages.forEach((p, idx) => {
    p.drawText(
      sanitizePdfWinAnsi(tr('assistant:notebook.pdfPage', { current: idx + 1, total: pages.length })),
      {
      x: marginX,
      y: 28,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.52),
    });
  });

  return doc.save();
}

export function downloadPdfFile(filename: string, bytes: Uint8Array): void {
  const safeCopy = new Uint8Array(bytes.byteLength);
  safeCopy.set(bytes);
  const blob = new Blob([safeCopy], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
