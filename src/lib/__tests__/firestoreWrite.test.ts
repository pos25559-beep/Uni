import { deleteField } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { buildFirestorePatch, buildFirestoreWrite, stripUndefined } from '../firestoreWrite';

const isDelete = (v: unknown) => JSON.stringify(v) === JSON.stringify(deleteField());

describe('buildFirestoreWrite', () => {
  const prev = { id: 's1', userId: 'u', title: 'A', locked: true, materialId: 'm1', topic: 'T' };

  it('apaga `locked` quando passa de true para undefined', () => {
    const out = buildFirestoreWrite(prev, { ...prev, locked: undefined });
    expect(isDelete(out.locked)).toBe(true);
    expect(out.title).toBe('A');
  });

  it('apaga campos removidos do objeto (materialId, topic)', () => {
    const { materialId: _m, topic: _t, ...rest } = prev;
    const out = buildFirestoreWrite(prev, rest);
    expect(isDelete(out.materialId)).toBe(true);
    expect(isDelete(out.topic)).toBe(true);
    expect(out.locked).toBe(true);
  });

  it('não toca em campos inalterados nem apaga id/userId/createdAt', () => {
    const out = buildFirestoreWrite({ ...prev, createdAt: 1 }, { title: 'B' });
    expect(out.title).toBe('B');
    expect('id' in out).toBe(false);
    expect('userId' in out).toBe(false);
    expect('createdAt' in out).toBe(false);
  });

  it('sem versão anterior só limpa undefined', () => {
    expect(buildFirestoreWrite(undefined, { id: 'x', locked: undefined })).toEqual({ id: 'x' });
  });

  it('remove undefined aninhado sem usar deleteField em arrays/objetos', () => {
    const out = buildFirestoreWrite({ id: 'x', meta: { a: 1, b: 2 }, arr: [1] }, {
      id: 'x',
      meta: { a: 1, b: undefined },
      arr: [{ k: 1, z: undefined }],
    });
    expect(out.meta).toEqual({ a: 1 });
    expect(out.arr).toEqual([{ k: 1 }]);
  });
});

describe('buildFirestorePatch', () => {
  it('chave explicitamente undefined vira deleteField', () => {
    const out = buildFirestorePatch({ locked: undefined, title: 'x', nested: { a: undefined, b: 1 } });
    expect(isDelete(out.locked)).toBe(true);
    expect(out.title).toBe('x');
    expect(out.nested).toEqual({ b: 1 });
  });
});

describe('stripUndefined', () => {
  it('mantém o comportamento recursivo', () => {
    expect(stripUndefined({ a: undefined, b: [{ c: undefined, d: 1 }], photoURL: '' })).toEqual({ b: [{ d: 1 }] });
  });
});
