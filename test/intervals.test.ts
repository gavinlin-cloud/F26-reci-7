import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mergeIntervals, type Interval } from '../src/intervals';

// Recitation Part 2 (groups) and problem set Task 2.
// Read the spec in src/intervals/mergeIntervals.ts, then check your progress
// with `npm run mutants:intervals`.
//
// Label every property with its pattern, on the line above its `it(`:
//   // Pattern: invariant. The output is sorted.
// (invariant, algebraic, metamorphic, differential, or conditional)

const intervalIn = (lo: number, hi: number, maxLen: number): fc.Arbitrary<Interval> =>
  fc.tuple(fc.integer({ min: lo, max: hi }), fc.nat(maxLen)).map(([s, len]): Interval => [s, s + len]);
const interval = fc.oneof(
  { arbitrary: intervalIn(-10, 10, 4), weight: 4 },
  { arbitrary: intervalIn(-1000, 1000, 100), weight: 1 },
);
const intervalList = fc.array(interval, { maxLength: 12 });

const disjointList = fc
  .tuple(
    fc.integer({ min: -20, max: 20 }),
    fc.array(fc.tuple(fc.integer({ min: 1, max: 4 }), fc.nat(4)), { maxLength: 10 }),
  )
  .chain(([start, steps]) => {
    let pos = start - 1;
    const sorted: Interval[] = steps.map(([gap, len]) => {
      const s = pos + gap;
      pos = s + len;
      return [s, pos];
    });
    return fc
      .shuffledSubarray(sorted, { minLength: sorted.length, maxLength: sorted.length })
      .map(shuffled => ({ sorted, shuffled }));
  });

const covers = (xs: readonly Interval[], p: number) => xs.some(([s, e]) => s <= p && p <= e);

const probePoints = (xs: readonly Interval[]) => {
  if (xs.length === 0) return [0];
  const lo = Math.min(...xs.map(([s]) => s)) - 1;
  const hi = Math.max(...xs.map(([, e]) => e)) + 1;
  const pts = new Set<number>();
  for (const [s, e] of xs) {
    for (const p of [s - 1, s - 0.5, s, s + 0.5, e - 0.5, e, e + 0.5, e + 1]) pts.add(p);
  }
  if (hi - lo <= 200) for (let p = lo; p <= hi; p += 0.5) pts.add(p);
  return [...pts];
};

describe('mergeIntervals', () => {
  // Pattern: invariant. Every input interval lies inside some output interval.
  it('every input interval lies inside some output interval', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        const uncovered = xs.filter(([s, e]) => !out.some(([a, b]) => a <= s && e <= b));
        expect(uncovered).toEqual([]);
      }),
    );
  });

  // Pattern: invariant. The output is valid, sorted, and consecutive intervals neither overlap nor touch.
  it('returns sorted intervals separated by gaps', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (const [s, e] of out) {
          expect(Number.isInteger(s) && Number.isInteger(e)).toBe(true);
          expect(s).toBeLessThanOrEqual(e);
        }
        for (let i = 0; i + 1 < out.length; i++) {
          expect(out[i][1]).toBeLessThan(out[i + 1][0]);
        }
      }),
    );
  });

  // Pattern: differential. A point is covered by the output exactly when it is covered by the input.
  it('covers exactly the same points as the input', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (const p of probePoints([...xs, ...out])) {
          expect(covers(out, p)).toBe(covers(xs, p));
        }
      }),
    );
  });

  // Pattern: metamorphic. Reordering or duplicating the input does not change the output.
  it('is unchanged by shuffling or duplicating the input', () => {
    const listAndShuffle = intervalList.chain(xs =>
      fc
        .shuffledSubarray([...xs, ...xs.slice(0, 3)], {
          minLength: xs.length + Math.min(3, xs.length),
          maxLength: xs.length + Math.min(3, xs.length),
        })
        .map(ys => [xs, ys] as const),
    );
    fc.assert(
      fc.property(listAndShuffle, ([xs, ys]) => {
        expect(mergeIntervals(ys)).toEqual(mergeIntervals(xs));
      }),
    );
  });

  // Pattern: algebraic. Merging is idempotent: merge(merge(xs)) equals merge(xs).
  it('is idempotent', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const once = mergeIntervals(xs);
        expect(mergeIntervals(once)).toEqual(once);
      }),
    );
  });

  // Pattern: conditional. If no two input intervals overlap or touch, the output is the input sorted.
  it('returns already-disjoint input sorted and unchanged', () => {
    fc.assert(
      fc.property(disjointList, ({ sorted, shuffled }) => {
        expect(mergeIntervals(shuffled)).toEqual(sorted);
      }),
    );
  });

  // Pattern: invariant. The input array and its intervals are not modified, even when the output is.
  it('does not modify its input', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const before = structuredClone(xs);
        const out = mergeIntervals(xs);
        expect(xs).toEqual(before);
        for (const iv of out) {
          iv[0] -= 1000;
          iv[1] += 1000;
        }
        out.push([0, 0]);
        expect(xs).toEqual(before);
      }),
    );
  });

  // Pattern: invariant. Intervals with start > end or non-integer endpoints throw a RangeError.
  it('rejects invalid intervals', () => {
    const bad: fc.Arbitrary<Interval> = fc.oneof(
      fc.tuple(fc.integer({ min: -50, max: 50 }), fc.integer({ min: 1, max: 10 })).map(([s, d]): Interval => [s, s - d]),
      fc.tuple(fc.integer({ min: -50, max: 50 }), fc.nat(5)).map(([s, len]): Interval => [s + 0.5, s + len + 1]),
      fc.tuple(fc.integer({ min: -50, max: 50 }), fc.nat(5)).map(([s, len]): Interval => [s, s + len + 0.5]),
    );
    const withBad = fc
      .tuple(intervalList, bad)
      .chain(([xs, b]) => fc.nat(xs.length).map(i => [...xs.slice(0, i), b, ...xs.slice(i)]));
    fc.assert(
      fc.property(withBad, xs => {
        expect(() => mergeIntervals(xs)).toThrow(RangeError);
      }),
    );
  });

  it('handles a few examples from the spec', () => {
    expect(mergeIntervals([])).toEqual([]);
    expect(mergeIntervals([[1, 3], [3, 5]])).toEqual([[1, 5]]);
    expect(mergeIntervals([[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]]);
  });
});
