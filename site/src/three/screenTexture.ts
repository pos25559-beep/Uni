import * as THREE from 'three';
import type { Copy } from '../i18n';

/**
 * Desenha o ecrã «Hoje» da app num canvas 2D (mesmas fontes, cores e hierarquia),
 * para servir de textura ao telemóvel 3D. Sem DOM nem rasterização de HTML: é rápido e determinístico.
 */

const W = 290;
const H = 612;
const S = 2.5;

const THEME = {
  light: {
    bg: '#FAF8F2', surface: '#FFFFFF', surface2: '#F2ECE1', line: '#E6DFD3', fg: '#141312', muted: '#5F5B54',
    accent: '#0F6344', sage: '#C9DC9F', sky: '#C4E0FD', mint: '#BCEEE0', butter: '#FCE99F', ink: '#141312', inkFg: '#FAF8F2',
  },
  dark: {
    bg: '#141311', surface: '#1E1C18', surface2: '#28241E', line: '#342F28', fg: '#FAF6EC', muted: '#B5AFA4',
    accent: '#4ADE80', sage: '#23311B', sky: '#192A3D', mint: '#17312B', butter: '#352D14', ink: '#FAF6EC', inkFg: '#141311',
  },
};

const SANS = '"Geist Variable", system-ui, sans-serif';
const DISPLAY = '"Bricolage Grotesque Variable", "Geist Variable", system-ui, sans-serif';
const SERIF = '"Instrument Serif", Georgia, serif';
const MONO = '"Geist Mono Variable", ui-monospace, monospace';

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function fit(g: CanvasRenderingContext2D, text: string, max: number) {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > max && line) {
      g.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = next;
  }
  if (line) g.fillText(line, x, y);
}

export function drawTodayTexture(copy: Copy, dark: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W * S;
  c.height = H * S;
  const g = c.getContext('2d')!;
  g.scale(S, S);
  const t = dark ? THEME.dark : THEME.light;
  const m = copy.mock;

  // Fundo com cantos do ecrã.
  rr(g, 0, 0, W, H, 28);
  g.fillStyle = t.bg;
  g.fill();
  g.save();
  g.clip();
  g.textBaseline = 'alphabetic';

  // Cabeçalho.
  g.fillStyle = t.sage;
  g.beginPath();
  g.arc(32, 50, 15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = t.fg;
  g.beginPath();
  g.arc(27, 49, 1.8, 0, Math.PI * 2);
  g.arc(37, 49, 1.8, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = t.fg;
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(32, 52, 4, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  g.font = `400 12px ${SANS}`;
  g.fillStyle = t.muted;
  g.fillText(fit(g, `${m.today} · ${m.week.toLowerCase()}`, 200), 56, 54);

  // Saudação.
  g.font = `700 24px ${DISPLAY}`;
  g.fillStyle = t.fg;
  g.fillText(m.greeting, 18, 100);
  const gw = g.measureText(`${m.greeting} `).width;
  g.font = `italic 400 27px ${SERIF}`;
  g.fillStyle = t.accent;
  g.fillText(m.name, 18 + gw, 100);

  // Segmentos Hoje / Semana.
  rr(g, 16, 116, W - 32, 34, 17);
  g.fillStyle = t.surface2;
  g.fill();
  rr(g, 19, 119, (W - 38) / 2, 28, 14);
  g.fillStyle = t.surface;
  g.fill();
  g.font = `600 12px ${SANS}`;
  g.textAlign = 'center';
  g.fillStyle = t.fg;
  g.fillText(`${m.today} 3`, 19 + (W - 38) / 4, 138);
  g.fillStyle = t.muted;
  g.fillText(m.week, W / 2 + (W - 38) / 4, 138);
  g.textAlign = 'left';

  // Cartão «Foco de hoje».
  const cardY = 164;
  const cardH = 300;
  rr(g, 16, cardY, W - 32, cardH, 18);
  g.fillStyle = t.surface;
  g.fill();
  g.strokeStyle = t.line;
  g.lineWidth = 1;
  g.stroke();
  g.save();
  rr(g, 16, cardY, W - 32, cardH, 18);
  g.clip();
  g.fillStyle = t.sage;
  g.fillRect(16, cardY, W - 32, 44);
  // Linhas de caderno.
  g.strokeStyle = t.line;
  for (let y = cardY + 60; y < cardY + cardH; y += 24) {
    g.beginPath();
    g.moveTo(16, y);
    g.lineTo(W - 16, y);
    g.stroke();
  }
  g.restore();
  g.font = `700 14px ${SANS}`;
  g.fillStyle = t.fg;
  g.fillText(`✦ ${m.focusToday}`, 28, cardY + 27);
  g.font = `600 11.5px ${SANS}`;
  const pill = `${m.openPlan} →`;
  const pw = g.measureText(pill).width + 20;
  rr(g, W - 28 - pw, cardY + 10, pw, 24, 12);
  g.fillStyle = t.surface;
  g.fill();
  g.fillStyle = t.fg;
  g.fillText(pill, W - 18 - pw, cardY + 26);

  const rows = [
    { course: m.course1, tone: t.sky, time: '17:00', topic: m.topic1, active: true },
    { course: m.course2, tone: t.mint, time: '18:30', topic: m.topic2 },
    { course: m.course3, tone: t.butter, time: '19:05', topic: m.topic3 },
  ];
  rows.forEach((r, i) => {
    const y = cardY + 56 + i * 62;
    rr(g, 26, y, W - 52, 54, 12);
    g.fillStyle = r.active ? t.butter : t.surface2;
    g.fill();
    g.strokeStyle = r.active ? t.accent : t.muted;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(46, y + 27, 9, 0, Math.PI * 2);
    g.stroke();
    g.font = `600 11px ${SANS}`;
    const cw = g.measureText(r.course).width + 22;
    rr(g, 64, y + 9, cw, 18, 9);
    g.fillStyle = r.tone;
    g.fill();
    g.fillStyle = t.fg;
    g.fillText(r.course, 77, y + 22);
    g.beginPath();
    g.arc(71, y + 18, 2.5, 0, Math.PI * 2);
    g.fillStyle = t.accent;
    g.fill();
    g.font = `400 11px ${MONO}`;
    g.fillStyle = t.muted;
    g.fillText(r.time, 70 + cw, y + 22);
    g.fillText("25′", W - 56, y + 31);
    g.font = `500 13px ${SANS}`;
    g.fillStyle = t.fg;
    g.fillText(fit(g, r.topic, W - 150), 64, y + 44);
  });
  g.font = `400 11.5px ${SANS}`;
  g.fillStyle = t.muted;
  wrap(g, m.why, 28, cardY + 252, W - 56, 16);

  // Dock.
  rr(g, 14, H - 62, W - 28, 46, 23);
  g.fillStyle = t.ink;
  g.fill();
  const slot = (W - 28) / m.dock.length;
  g.font = `500 10.5px ${SANS}`;
  g.textAlign = 'center';
  m.dock.forEach((d, i) => {
    const cx = 14 + slot * i + slot / 2;
    if (i === 2) {
      rr(g, cx - slot / 2 + 3, H - 58, slot - 6, 38, 19);
      g.fillStyle = t.inkFg;
      g.fill();
      g.fillStyle = t.ink;
    } else g.fillStyle = dark ? 'rgba(20,19,17,.7)' : 'rgba(250,248,242,.72)';
    g.fillText(fit(g, d, slot - 8), cx, H - 34);
  });
  g.textAlign = 'left';
  g.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
