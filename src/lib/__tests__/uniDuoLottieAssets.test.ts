import { describe, expect, it } from 'vitest';
import {
  UNI_DUO_LOTTIE_ASSETS,
  type LoadingUnisVariant,
} from '../uniDuoLottieAssets';

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

describe('UNI_DUO_LOTTIE_ASSETS', () => {
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
});
