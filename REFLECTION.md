# Reflection

**Name / Andrew ID:** Gavin Lin / gavinlin

**Recitation group members (Task 2):** Annie Min, Riya Kadakia

---

### 1. Valid but weak

`returns exactly five colors` (Wordle) passes on the correct implementation and only kills the mutants that other properties already kill. It is still valid because the spec says the result is five colors, one per position of `guess`, so any correct implementation must satisfy it. It would catch a bug like an off-by-one loop (`for (let i = 0; i <= 5; i++)`) that writes a sixth entry, or an early `return` that only scores the greens and returns a shorter array.

### 2. A generator problem, not a property problem

`touchingNotMerged` and `mergesIntegerNeighbors` survived when I ran my gap invariant and point-coverage property with the starter generator, which picks endpoints from all of `fc.integer()`. Two random intervals from that range basically never share an endpoint or sit exactly one apart, so the properties never saw the inputs that trigger the bugs. I fixed it by building intervals as `[s, s + len]` with `s` in -10..10 and a short `len`, so touching and adjacent intervals show up all the time (with an occasional wider range mixed in).

Before (wide generator):

```
  ✘ touchingNotMerged       SURVIVED
  ✘ mergesIntegerNeighbors  SURVIVED
Mutation score: 5/7 killed (71%)
```

After (small-range generator):

```
  ✔ touchingNotMerged       killed  by: returns sorted intervals separated by gaps; ...
      Counterexample: [[[3,4],[4,4]]]
      AssertionError: expected 4 to be less than 4
  ✔ mergesIntegerNeighbors  killed  by: covers exactly the same points as the input; ...
      Counterexample: [[[-1,-1],[0,0]]]
      AssertionError: expected true to be false // Object.is equality
Mutation score: 7/7 killed (100%)
```

### 3. Reading a counterexample

```
  ✔ mergesIntegerNeighbors  killed  by: covers exactly the same points as the input
      Counterexample: [[[-1,-1],[0,0]]]
      AssertionError: expected true to be false // Object.is equality
```

The spec says the output covers exactly the same points as the input, and points means all real numbers. `[-1, -1]` and `[0, 0]` leave a gap (-1 < x < 0), so -0.5 is not covered by the input. The mutant merged them into `[-1, 0]` because they are neighboring integers, so the output covers -0.5 and the coverage check returns `true` where it should be `false`.

### 4. Your project

`SessionBudget` in `packages/opencode/src/session/budget.ts` (the session budget feature I added to opencode). `check` decides whether a session has hit its cost/token budget and `warning` decides whether to show the 80% warning, given the budget, the usage so far, and how many times the user approved going over.

- **Invariant:** `check` and `warning` never both fire for the same input. If `check` returns an exceeded limit, `warning` returns `undefined`, and if `warning` returns something its ratio is in [0.8, 1).
- **Metamorphic:** raising the usage never un-exceeds a budget (if `check` fires for some usage it still fires for any larger usage), and adding one more approval never makes `check` fire when it didn't before.

The generator has to produce budgets with only `cost`, only `tokens`, both, or neither, plus a small number of approvals. For usage it should mostly pick values right around the thresholds (exactly 80% and exactly 100% of `max * (approvals + 1)`, and one unit on either side) instead of uniform random numbers, because a naive generator of random floats almost never lands exactly on the limit, and the `>=` vs `>` and `< 0.8` boundaries are where bugs would be. It should also include a budget of 0: `pressure` skips limits where `max` is 0 but `check` does not, so a 0 cost budget plus tokens at 85% would make both fire and break the first property. A generator that only picks positive budgets would never find that.
