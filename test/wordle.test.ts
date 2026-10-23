import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { matchGuess } from '../src/wordle';

// Recitation Part 1: follow along with your TA, filling in the todos below.
// Problem set Task 1: keep adding properties until `npm run mutants:wordle`
// kills every mutant. Read the spec in src/wordle/matchGuess.ts.
//
// Label every property with its pattern, on the line above its `it(`:
//   // Pattern: invariant. The result always has exactly five colors.
// (invariant, algebraic, metamorphic, differential, or conditional)

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const wordFrom = (letters: string) =>
  fc.array(fc.constantFrom(...letters), { minLength: 5, maxLength: 5 }).map(cs => cs.join(''));
const word = fc.oneof(wordFrom('ABC'), wordFrom(ALPHABET));

const pair = fc.oneof(
  fc.tuple(word, word),
  fc.constantFrom('AB', 'ABC', 'XYZ').chain(ls => fc.tuple(wordFrom(ls), wordFrom(ls))),
);

const anagramPair = word.chain(secret =>
  fc
    .shuffledSubarray([...secret], { minLength: 5, maxLength: 5 })
    .map(cs => [secret, cs.join('')] as const),
);

const renaming = fc
  .shuffledSubarray([...ALPHABET], { minLength: 26, maxLength: 26 })
  .map(cs => new Map([...ALPHABET].map((c, i) => [c, cs[i]])));

const count = (w: string, letter: string) => [...w].filter(c => c === letter).length;

describe('matchGuess', () => {
  // Pattern: invariant. The result always has exactly five colors.
  it('returns exactly five colors', () => {
    fc.assert(
      fc.property(pair, ([secret, guess]) => {
        expect(matchGuess(secret, guess)).toHaveLength(5);
      }),
    );
  });

  // Pattern: invariant. Every color is G, Y, or B.
  it('only uses the colors G, Y, B', () => {
    fc.assert(
      fc.property(pair, ([secret, guess]) => {
        for (const c of matchGuess(secret, guess)) {
          expect(['G', 'Y', 'B']).toContain(c);
        }
      }),
    );
  });

  // Pattern: conditional. If the guess equals the secret, every position is green.
  it('guessing the secret gives all greens', () => {
    fc.assert(
      fc.property(word, w => {
        expect(matchGuess(w, w)).toEqual(['G', 'G', 'G', 'G', 'G']);
      }),
    );
  });

  // Pattern: invariant. A letter is never credited more times than the secret contains it.
  it('never credits a letter more times than the secret contains it', () => {
    fc.assert(
      fc.property(pair, ([secret, guess]) => {
        const result = matchGuess(secret, guess);
        for (const letter of new Set(guess)) {
          const credited = [...guess].filter((c, i) => c === letter && result[i] !== 'B').length;
          expect(credited).toBeLessThanOrEqual(count(secret, letter));
        }
      }),
    );
  });

  // Pattern: invariant. Position i is green exactly when guess[i] === secret[i].
  it('marks green exactly the positions where the letters match', () => {
    fc.assert(
      fc.property(pair, ([secret, guess]) => {
        const result = matchGuess(secret, guess);
        for (let i = 0; i < 5; i++) {
          expect(result[i] === 'G').toBe(guess[i] === secret[i]);
        }
      }),
    );
  });

  // Pattern: differential. Each letter is credited min(count in secret, count in guess) times.
  it('credits each letter min(count in secret, count in guess) times', () => {
    fc.assert(
      fc.property(pair, ([secret, guess]) => {
        const result = matchGuess(secret, guess);
        for (const letter of new Set(guess)) {
          const credited = [...guess].filter((c, i) => c === letter && result[i] !== 'B').length;
          expect(credited).toBe(Math.min(count(secret, letter), count(guess, letter)));
        }
      }),
    );
  });

  // Pattern: conditional. If the guess is a rearrangement of the secret, no position is black.
  it('gives no blacks when the guess is an anagram of the secret', () => {
    fc.assert(
      fc.property(anagramPair, ([secret, guess]) => {
        expect(matchGuess(secret, guess)).not.toContain('B');
      }),
    );
  });

  // Pattern: invariant. Among the non-green copies of a letter, yellows come before blacks.
  it('assigns yellows to the leftmost non-green copies of a letter', () => {
    fc.assert(
      fc.property(pair, ([secret, guess]) => {
        const result = matchGuess(secret, guess);
        for (const letter of new Set(guess)) {
          const colors = [...guess]
            .map((c, i) => (c === letter && result[i] !== 'G' ? result[i] : null))
            .filter(c => c !== null)
            .join('');
          expect(colors).toMatch(/^Y*B*$/);
        }
      }),
    );
  });

  // Pattern: metamorphic. Renaming letters consistently in both words does not change the colors.
  it('is unchanged by a consistent renaming of letters', () => {
    fc.assert(
      fc.property(pair, renaming, ([secret, guess], rename) => {
        const r = (w: string) => [...w].map(c => rename.get(c)!).join('');
        expect(matchGuess(r(secret), r(guess))).toEqual(matchGuess(secret, guess));
      }),
    );
  });

  // Pattern: invariant. Anything other than five uppercase letters throws a RangeError.
  it('rejects words that are not five uppercase letters', () => {
    const bad = fc.oneof(
      fc.string({ maxLength: 4 }),
      fc.string({ minLength: 6, maxLength: 8 }),
      word.map(w => w.toLowerCase()),
    );
    fc.assert(
      fc.property(bad, word, (b, w) => {
        expect(() => matchGuess(b, w)).toThrow(RangeError);
        expect(() => matchGuess(w, b)).toThrow(RangeError);
      }),
    );
  });
});
