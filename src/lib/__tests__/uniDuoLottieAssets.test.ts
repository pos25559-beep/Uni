import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  UNI_DUO_LOTTIE_ASSETS,
  type LoadingUnisVariant,
} from '../uniDuoLottieAssets';
import { UNI_LOTTIE_ASSETS } from '../uniLottieAssets';

interface LottieShapeGroup {
  ty?: string;
  nm?: string;
  it?: Array<{
    ty?: string;
    ks?: {
      a?: number;
      k?: {
        v?: unknown[];
        i?: unknown[];
        o?: unknown[];
        c?: boolean;
      };
    };
  }>;
}

interface LottieLayer {
  nm?: string;
  ip?: number;
  op?: number;
  shapes?: LottieShapeGroup[];
}

interface LottieDocument {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  nm: string;
  layers: LottieLayer[];
}

const VARIANTS: LoadingUnisVariant[] = ['courses', 'grades', 'materials'];

function collectAnimatedKeyframeArrays(node: unknown, out: Array<Array<Record<string, unknown>>> = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectAnimatedKeyframeArrays(item, out);
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  const obj = node as Record<string, unknown>;
  if (obj.a === 1 && Array.isArray(obj.k)) {
    out.push(obj.k as Array<Record<string, unknown>>);
    return out;
  }
  for (const val of Object.values(obj)) {
    collectAnimatedKeyframeArrays(val, out);
  }
  return out;
}

describe('UNI_DUO_LOTTIE_ASSETS & UNI_LOTTIE_ASSETS', () => {
  it('exposes distinct valid Lottie 5.7.4 duo animations for courses, grades, and materials', () => {
    const names = new Set<string>();

    for (const variant of VARIANTS) {
      const doc = UNI_DUO_LOTTIE_ASSETS[variant] as LottieDocument;
      expect(doc).toBeDefined();
      expect(doc.v).toBe('5.7.4');
      expect(doc.fr).toBe(30);
      expect(doc.ip).toBe(0);
      expect(doc.op).toBe(90);
      expect(doc.w).toBe(176);
      expect(doc.h).toBe(88);
      expect(doc.nm).toBe(`loading_unis_${variant}`);
      names.add(doc.nm);

      const layerNames = doc.layers.map((layer) => layer.nm);
      expect(layerNames).toContain(`uni_left_${variant}`);
      expect(layerNames).toContain(`uni_right_${variant}`);
      expect(doc.layers.length).toBeGreaterThanOrEqual(4);
    }

    expect(names.size).toBe(3);
  });

  it('includes task-specific interactive prop layers for each variant', () => {
    const courses = UNI_DUO_LOTTIE_ASSETS.courses as LottieDocument;
    const grades = UNI_DUO_LOTTIE_ASSETS.grades as LottieDocument;
    const materials = UNI_DUO_LOTTIE_ASSETS.materials as LottieDocument;

    expect(courses.layers.map((l) => l.nm)).toEqual(
      expect.arrayContaining(['spark', 'course_folder', 'uni_left_courses', 'uni_right_courses']),
    );
    expect(grades.layers.map((l) => l.nm)).toEqual(
      expect.arrayContaining(['grade_check', 'grade_sheet', 'uni_left_grades', 'uni_right_grades']),
    );
    expect(materials.layers.map((l) => l.nm)).toEqual(
      expect.arrayContaining(['sheet_stack', 'flying_sheet', 'uni_left_materials', 'uni_right_materials']),
    );
  });

  it('ensures every shape group ends with a transform and every Bezier path has balanced vertices and tangents', () => {
    for (const variant of VARIANTS) {
      const doc = UNI_DUO_LOTTIE_ASSETS[variant] as LottieDocument;

      for (const layer of doc.layers) {
        expect(layer.ip).toBe(0);
        expect(layer.op).toBe(90);

        for (const group of layer.shapes ?? []) {
          expect(group.ty).toBe('gr');
          const items = group.it ?? [];
          expect(items.length).toBeGreaterThan(0);
          expect(items[items.length - 1]?.ty).toBe('tr');

          for (const item of items) {
            if (item.ty === 'sh' && item.ks?.a === 0 && item.ks.k) {
              const { v = [], i = [], o = [] } = item.ks.k;
              expect(v.length).toBeGreaterThan(0);
              expect(i.length).toBe(v.length);
              expect(o.length).toBe(v.length);
            }
          }
        }
      }
    }
  });

  it('provides lottie_light-compatible i/o easing curves on all non-final keyframes', () => {
    const allDocs = [
      ...Object.values(UNI_DUO_LOTTIE_ASSETS),
      ...Object.values(UNI_LOTTIE_ASSETS),
    ];

    for (const doc of allDocs) {
      const arrays = collectAnimatedKeyframeArrays(doc);
      expect(arrays.length).toBeGreaterThan(0);

      for (const kfs of arrays) {
        for (let idx = 0; idx < kfs.length - 1; idx += 1) {
          const kf = kfs[idx];
          if (kf.h === 1) continue;
          const iObj = kf.i as { x?: unknown; y?: unknown } | undefined;
          const oObj = kf.o as { x?: unknown; y?: unknown } | undefined;
          expect(Array.isArray(iObj?.x)).toBe(true);
          expect(Array.isArray(iObj?.y)).toBe(true);
          expect(Array.isArray(oObj?.x)).toBe(true);
          expect(Array.isArray(oObj?.y)).toBe(true);
        }
      }
    }
  });

  it('renders non-empty SVG paths in lottie_light without runtime interpolation errors', () => {
    interface MockEl {
      tagName: string;
      nodeType: number;
      style: Record<string, string>;
      children: MockEl[];
      parentNode: unknown;
      setAttribute: (k: string, v: string) => void;
      getAttribute: (k: string) => string | null;
      setAttributeNS: (_ns: string, k: string, v: string) => void;
      appendChild: (c: MockEl) => MockEl;
      insertBefore: (c: MockEl) => MockEl;
      removeChild: (c: MockEl) => void;
      addEventListener: () => void;
      removeEventListener: () => void;
      getContext: () => unknown;
      getBBox: () => { x: number; y: number; width: number; height: number };
      getTotalLength: () => number;
      _attrs: Record<string, string>;
    }

    const makeEl = (tag: string): MockEl => {
      const children: MockEl[] = [];
      const attrs: Record<string, string> = {};
      const style: Record<string, string> = {};
      const el: MockEl = {
        tagName: tag,
        nodeType: 1,
        style,
        children,
        parentNode: null,
        setAttribute(k: string, v: string) {
          attrs[k] = String(v);
        },
        getAttribute(k: string) {
          return attrs[k] ?? null;
        },
        setAttributeNS(_ns: string, k: string, v: string) {
          attrs[k] = String(v);
        },
        appendChild(c: MockEl) {
          children.push(c);
          c.parentNode = el;
          return c;
        },
        insertBefore(c: MockEl) {
          children.push(c);
          c.parentNode = el;
          return c;
        },
        removeChild(c: MockEl) {
          const idx = children.indexOf(c);
          if (idx >= 0) children.splice(idx, 1);
        },
        addEventListener() {},
        removeEventListener() {},
        getContext() {
          return {
            fillStyle: '',
            fillRect() {},
            fillText() {},
            getImageData() {
              return { data: [0, 0, 0, 0] };
            },
            measureText() {
              return { width: 10 };
            },
          };
        },
        getBBox() {
          return { x: 0, y: 0, width: 100, height: 100 };
        },
        getTotalLength() {
          return 10;
        },
        _attrs: attrs,
      };
      return el;
    };

    const g = globalThis as unknown as Record<string, unknown>;
    const prevWindow = g.window;
    const prevDoc = g.document;
    const prevRaf = g.requestAnimationFrame;
    const prevCaf = g.cancelAnimationFrame;

    g.window = g;
    g.document = {
      createElement: (t: string) => makeEl(t),
      createElementNS: (_ns: string, t: string) => makeEl(t),
      getElementsByTagName: () => [],
    };
    g.requestAnimationFrame = () => 1;
    g.cancelAnimationFrame = () => {};

    try {
      const require = createRequire(import.meta.url);
      const lottie = require('lottie-web/build/player/lottie_light.js') as {
        loadAnimation: (opts: {
          container: unknown;
          renderer: string;
          loop: boolean;
          autoplay: boolean;
          animationData: unknown;
        }) => {
          totalFrames: number;
          renderer: { renderFrame: (f: number) => void };
          destroy: () => void;
        };
      };

      const walk = (node: MockEl, acc: MockEl[] = []): MockEl[] => {
        acc.push(node);
        for (const c of node.children) walk(c, acc);
        return acc;
      };

      for (const variant of VARIANTS) {
        const container = makeEl('div');
        const anim = lottie.loadAnimation({
          container,
          renderer: 'svg',
          loop: true,
          autoplay: false,
          animationData: structuredClone(UNI_DUO_LOTTIE_ASSETS[variant]),
        });
        for (const f of [0, 15, 30, 45, 72]) {
          anim.renderer.renderFrame(f);
        }
        const nodes = walk(container);
        const paths = nodes.filter((n) => n.tagName === 'path' && Boolean(n._attrs.d));
        expect(paths.length).toBeGreaterThanOrEqual(20);
        for (const p of paths) {
          expect(p._attrs.d).not.toContain('NaN');
        }
        anim.destroy();
      }
    } finally {
      g.window = prevWindow;
      g.document = prevDoc;
      g.requestAnimationFrame = prevRaf;
      g.cancelAnimationFrame = prevCaf;
    }
  });
});
