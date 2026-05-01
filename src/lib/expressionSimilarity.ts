import { levenshteinDistance, normalizeForExpression } from './textComparison';

/**
 * Reduce an English token to a rough "stem" so that inflectional differences
 * (plural / past / progressive / 3rd person) collapse together.
 * This is intentionally simple — we just want to tell apart "go to school"
 * from "went to school" or "going to school" for praise purposes.
 */
function stem(token: string): string {
  let t = token;
  // Strip very common verb / noun endings.
  if (t.length > 5 && t.endsWith('ies')) t = t.slice(0, -3) + 'y';
  else if (t.length > 5 && t.endsWith('ied')) t = t.slice(0, -3) + 'y';
  else if (t.length > 5 && t.endsWith('ying')) t = t.slice(0, -4) + 'y';
  else if (t.length > 4 && t.endsWith('ing')) t = t.slice(0, -3);
  else if (t.length > 4 && t.endsWith('ed')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('es')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1);
  // Trim duplicated trailing consonant after stripping "ing"/"ed" (e.g. "running" -> "runn" -> "run").
  if (t.length > 2 && t.charAt(t.length - 1) === t.charAt(t.length - 2)) {
    t = t.slice(0, -1);
  }
  return t;
}

function tokensOf(expression: string): string[] {
  return normalizeForExpression(expression).split(' ').filter(Boolean);
}

/**
 * Returns true when two expressions are considered "the same idea" —
 * tolerant of tense, number, articles and tiny typos.
 */
export function isSimilarExpression(a: string, b: string): boolean {
  const an = normalizeForExpression(a);
  const bn = normalizeForExpression(b);
  if (!an || !bn) return false;
  if (an === bn) return true;

  const aTokens = tokensOf(a);
  const bTokens = tokensOf(b);
  if (aTokens.length === 0 || bTokens.length === 0) return false;

  // Length heuristic: phrases of very different word count are different ideas.
  if (Math.abs(aTokens.length - bTokens.length) > 1) return false;

  // Drop a small set of fillers when comparing (so "go school" vs "go to school" can match).
  const FILLERS = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'at']);
  const aCore = aTokens.filter((t) => !FILLERS.has(t));
  const bCore = bTokens.filter((t) => !FILLERS.has(t));
  if (aCore.length === 0 || bCore.length === 0) return false;
  if (Math.abs(aCore.length - bCore.length) > 1) return false;

  const aStems = aCore.map(stem);
  const bStems = bCore.map(stem);

  // Count how many stems from the shorter side appear (in order tolerance) on the longer side.
  const [shorter, longer] = aStems.length <= bStems.length ? [aStems, bStems] : [bStems, aStems];
  let matched = 0;
  for (const s of shorter) {
    const hit = longer.find(
      (l) => l === s || (s.length > 3 && l.length > 3 && levenshteinDistance(s, l) <= 1),
    );
    if (hit) matched++;
  }
  // Require a strong overlap of stems (>=80% of the shorter side).
  return matched / shorter.length >= 0.8;
}

/**
 * Given a target expression and a list of past expressions, returns the
 * matching ones. Useful for detecting reuse and for displaying counts.
 */
export function findSimilarExpressions<T extends { expression: string }>(
  target: string,
  candidates: T[],
): T[] {
  return candidates.filter((c) => isSimilarExpression(target, c.expression));
}