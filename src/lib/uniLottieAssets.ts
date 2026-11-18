/**
 * Pequenas animações vetoriais Lottie (formato JSON v5, 100% offline/locais)
 * alinhadas com a paleta "Estúdio Caderno Vivo" da Unipedia.
 */

export type UniLottieKind = 'spark' | 'pagePass' | 'syncWave' | 'checkBurst' | 'alertPulse';

type Rgba = [number, number, number, number];

const FOREST: Rgba = [0.082, 0.498, 0.345, 1]; // #157F58
const CORAL: Rgba = [0.878, 0.31, 0.2, 1]; // #E04F33
const BUTTER: Rgba = [0.988, 0.914, 0.624, 1]; // #FCE99F
const SAGE: Rgba = [0.788, 0.863, 0.624, 1]; // #C9DC9F
const CREAM: Rgba = [0.98, 0.973, 0.949, 1]; // #FAF8F2
const INK: Rgba = [0.078, 0.075, 0.071, 1]; // #141312

const SPARK_ANIMATION = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 45,
  w: 48,
  h: 48,
  nm: 'uni_spark',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'star',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [60] }, { t: 22, s: [100] }, { t: 45, s: [60] }] },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 22, s: [18] }, { t: 45, s: [0] }] },
        p: { a: 0, k: [24, 24, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [75, 75, 100] }, { t: 22, s: [112, 112, 100] }, { t: 45, s: [75, 75, 100] }] },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'sr',
              sy: 1,
              d: 1,
              pt: { a: 0, k: 4 },
              p: { a: 0, k: [0, 0] },
              r: { a: 0, k: 0 },
              ir: { a: 0, k: 5 },
              is: { a: 0, k: 0 },
              or: { a: 0, k: 14 },
              os: { a: 0, k: 0 },
              nm: 'star_path',
            },
            { ty: 'fl', c: { a: 0, k: BUTTER }, o: { a: 0, k: 100 }, nm: 'fill' },
            { ty: 'st', c: { a: 0, k: INK }, o: { a: 0, k: 100 }, w: { a: 0, k: 2 }, lc: 2, lj: 2, nm: 'stroke' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'star_grp',
        },
      ],
      ip: 0,
      op: 45,
      st: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'dot',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [35] }, { t: 22, s: [100] }, { t: 45, s: [35] }] },
        r: { a: 0, k: 0 },
        p: { a: 1, k: [{ t: 0, s: [37, 13, 0] }, { t: 22, s: [39, 9, 0] }, { t: 45, s: [37, 13, 0] }] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', d: 1, s: { a: 0, k: [6, 6] }, p: { a: 0, k: [0, 0] }, nm: 'dot_path' },
            { ty: 'fl', c: { a: 0, k: CORAL }, o: { a: 0, k: 100 }, nm: 'dot_fill' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'dot_grp',
        },
      ],
      ip: 0,
      op: 45,
      st: 0,
    },
  ],
};

const PAGE_PASS_ANIMATION = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 48,
  w: 64,
  h: 40,
  nm: 'uni_page_pass',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'sheet',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [0] }, { t: 8, s: [100] }, { t: 38, s: [100] }, { t: 48, s: [0] }] },
        r: { a: 1, k: [{ t: 0, s: [-10] }, { t: 24, s: [6] }, { t: 48, s: [12] }] },
        p: {
          a: 1,
          k: [
            { t: 0, s: [12, 22, 0] },
            { t: 24, s: [32, 13, 0] },
            { t: 48, s: [52, 22, 0] },
          ],
        },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [85, 85, 100] }, { t: 24, s: [105, 105, 100] }, { t: 48, s: [85, 85, 100] }] },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [18, 22] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 4 }, nm: 'card' },
            { ty: 'fl', c: { a: 0, k: CREAM }, o: { a: 0, k: 100 }, nm: 'card_fill' },
            { ty: 'st', c: { a: 0, k: INK }, o: { a: 0, k: 100 }, w: { a: 0, k: 2 }, nm: 'card_stroke' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'card_grp',
        },
        {
          ty: 'gr',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [10, 2.2] }, p: { a: 0, k: [0, -3] }, r: { a: 0, k: 1 }, nm: 'line1' },
            { ty: 'rc', d: 1, s: { a: 0, k: [8, 2.2] }, p: { a: 0, k: [-1, 2] }, r: { a: 0, k: 1 }, nm: 'line2' },
            { ty: 'fl', c: { a: 0, k: FOREST }, o: { a: 0, k: 100 }, nm: 'lines_fill' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'lines_grp',
        },
      ],
      ip: 0,
      op: 48,
      st: 0,
    },
  ],
};

const SYNC_WAVE_ANIMATION = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 45,
  w: 48,
  h: 48,
  nm: 'uni_sync_wave',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'outer_ring',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [90] }, { t: 45, s: [0] }] },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [24, 24, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [35, 35, 100] }, { t: 45, s: [115, 115, 100] }] },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', d: 1, s: { a: 0, k: [34, 34] }, p: { a: 0, k: [0, 0] }, nm: 'ring' },
            { ty: 'st', c: { a: 0, k: FOREST }, o: { a: 0, k: 100 }, w: { a: 0, k: 2.5 }, nm: 'ring_stroke' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'ring_grp',
        },
      ],
      ip: 0,
      op: 45,
      st: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'core_dot',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [24, 24, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [85, 85, 100] }, { t: 22, s: [110, 110, 100] }, { t: 45, s: [85, 85, 100] }] },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', d: 1, s: { a: 0, k: [12, 12] }, p: { a: 0, k: [0, 0] }, nm: 'core' },
            { ty: 'fl', c: { a: 0, k: SAGE }, o: { a: 0, k: 100 }, nm: 'core_fill' },
            { ty: 'st', c: { a: 0, k: FOREST }, o: { a: 0, k: 100 }, w: { a: 0, k: 2 }, nm: 'core_stroke' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'core_grp',
        },
      ],
      ip: 0,
      op: 45,
      st: 0,
    },
  ],
};

const CHECK_BURST_ANIMATION = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 36,
  w: 36,
  h: 36,
  nm: 'uni_check_burst',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'badge',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [18, 18, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [60, 60, 100] }, { t: 10, s: [110, 110, 100] }, { t: 18, s: [100, 100, 100] }] },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', d: 1, s: { a: 0, k: [26, 26] }, p: { a: 0, k: [0, 0] }, nm: 'bg' },
            { ty: 'fl', c: { a: 0, k: FOREST }, o: { a: 0, k: 100 }, nm: 'bg_fill' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'bg_grp',
        },
        {
          ty: 'gr',
          it: [
            {
              ty: 'sh',
              ks: {
                a: 0,
                k: {
                  i: [[0, 0], [0, 0], [0, 0]],
                  o: [[0, 0], [0, 0], [0, 0]],
                  v: [[-5.5, 0.5], [-1.5, 4.5], [6, -4.5]],
                  c: false,
                },
              },
              nm: 'tick',
            },
            { ty: 'st', c: { a: 0, k: CREAM }, o: { a: 0, k: 100 }, w: { a: 0, k: 2.6 }, lc: 2, lj: 2, nm: 'tick_stroke' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'tick_grp',
        },
      ],
      ip: 0,
      op: 36,
      st: 0,
    },
  ],
};

const ALERT_PULSE_ANIMATION = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 36,
  w: 36,
  h: 36,
  nm: 'uni_alert_pulse',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'alert_circle',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 6, s: [-6] }, { t: 12, s: [6] }, { t: 18, s: [0] }] },
        p: { a: 0, k: [18, 18, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [78, 78, 100] }, { t: 10, s: [108, 108, 100] }, { t: 18, s: [100, 100, 100] }] },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', d: 1, s: { a: 0, k: [26, 26] }, p: { a: 0, k: [0, 0] }, nm: 'bg' },
            { ty: 'fl', c: { a: 0, k: CORAL }, o: { a: 0, k: 100 }, nm: 'bg_fill' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'bg_grp',
        },
        {
          ty: 'gr',
          it: [
            {
              ty: 'sh',
              ks: {
                a: 0,
                k: { i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], v: [[0, -5.5], [0, 1]], c: false },
              },
              nm: 'bar',
            },
            { ty: 'st', c: { a: 0, k: CREAM }, o: { a: 0, k: 100 }, w: { a: 0, k: 2.6 }, lc: 2, nm: 'bar_stroke' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'bar_grp',
        },
        {
          ty: 'gr',
          it: [
            { ty: 'el', d: 1, s: { a: 0, k: [3.2, 3.2] }, p: { a: 0, k: [0, 5.5] }, nm: 'dot' },
            { ty: 'fl', c: { a: 0, k: CREAM }, o: { a: 0, k: 100 }, nm: 'dot_fill' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'dot_grp',
        },
      ],
      ip: 0,
      op: 36,
      st: 0,
    },
  ],
};

const LOTTIE_EASE_IN = { x: [0.42], y: [1] };
const LOTTIE_EASE_OUT = { x: [0.58], y: [0] };

function withLottieEasing<T>(node: T): T {
  if (Array.isArray(node)) {
    return node.map((item) => withLottieEasing(item)) as unknown as T;
  }
  if (!node || typeof node !== 'object') {
    return node;
  }
  const obj = node as Record<string, unknown>;
  if (obj.a === 1 && Array.isArray(obj.k)) {
    const frames = obj.k as Array<Record<string, unknown>>;
    return {
      ...obj,
      k: frames.map((kf, idx) => {
        if (idx >= frames.length - 1 || kf.h === 1 || (kf.i && kf.o)) {
          return kf;
        }
        return {
          ...kf,
          i: LOTTIE_EASE_IN,
          o: LOTTIE_EASE_OUT,
        };
      }),
    } as unknown as T;
  }
  const next: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    next[key] = withLottieEasing(val);
  }
  return next as T;
}

export const UNI_LOTTIE_ASSETS: Record<UniLottieKind, object> = {
  spark: withLottieEasing(SPARK_ANIMATION),
  pagePass: withLottieEasing(PAGE_PASS_ANIMATION),
  syncWave: withLottieEasing(SYNC_WAVE_ANIMATION),
  checkBurst: withLottieEasing(CHECK_BURST_ANIMATION),
  alertPulse: withLottieEasing(ALERT_PULSE_ANIMATION),
};
