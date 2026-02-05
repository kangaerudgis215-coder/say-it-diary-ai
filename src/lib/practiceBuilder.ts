/**
 * Canonical practice sentence builder.
 * Guarantees every expression maps to a sentence where it actually appears.
 */

import { normalizeForExpression } from './textComparison';

export interface PracticeSentence {
  english: string;
  japanese: string;
  expressions: string[];
}

/**
 * Check whether an expression appears inside the english sentence (normalised).
 */
export function expressionAppearsIn(english: string, expression: string): boolean {
  const normE = normalizeForExpression(english);
  const normX = normalizeForExpression(expression);
  if (!normX) return false;
  return normE.includes(normX);
}

/**
 * Given a diary entry and its expressions, build a list of practice sentences
 * ensuring each expression is attached only to sentences where it exists.
 *
 * All provided expressions will be represented at least once in the output.
 * If no sentence contains an expression, it's attached to a synthetic sentence.
 */
export function buildPracticeSentences(
  diaryContent: string,
  japaneseSummary: string | null,
  expressionStrings: string[],
  importantSentences?: Array<{ english: string; japanese: string; expressions?: string[] }> | null
): PracticeSentence[] {
  // Dedupe expression list (case-insensitive)
  const seenNorm = new Set<string>();
  const expressions = expressionStrings.filter((e) => {
    const n = normalizeForExpression(e);
    if (!n || seenNorm.has(n)) return false;
    seenNorm.add(n);
    return true;
  });

  // Build sentences from content
  const englishSentences = (diaryContent || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const japaneseSentences = (japaneseSummary || '')
    .split(/(?<=[。！？])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Use important_sentences if provided; otherwise use content
  const baseSentences: PracticeSentence[] =
    importantSentences && importantSentences.length > 0
      ? importantSentences.map((s) => ({
          english: s.english,
          japanese: s.japanese,
          expressions: [],
        }))
      : englishSentences.map((eng, i) => ({
          english: eng,
          japanese: japaneseSentences[i] || '',
          expressions: [],
        }));

  // Assign each expression to the first sentence it belongs to
  const usedExprs = new Set<string>();
  for (const sent of baseSentences) {
    for (const expr of expressions) {
      if (expressionAppearsIn(sent.english, expr)) {
        sent.expressions.push(expr);
        usedExprs.add(normalizeForExpression(expr));
      }
    }
  }

  // Find orphan expressions (don't appear in any sentence)
  const orphans = expressions.filter((e) => !usedExprs.has(normalizeForExpression(e)));

  // Dedupe final expressions per sentence
  for (const sent of baseSentences) {
    sent.expressions = Array.from(new Set(sent.expressions));
  }

  // Append orphans as synthetic sentences so they still get practiced
  for (const orphan of orphans) {
    baseSentences.push({
      english: `Use "${orphan}" in your own sentence.`,
      japanese: `「${orphan}」を使った文を作ってください。`,
      expressions: [orphan],
    });
  }

  return baseSentences;
}

/**
 * Persist the canonical sentence list to the new diary_sentences table (upsert).
 */
export async function persistDiarySentences(
  supabase: any,
  userId: string,
  diaryEntryId: string,
  sentences: PracticeSentence[]
) {
  // Clear old rows if any
  await supabase
    .from('diary_sentences')
    .delete()
    .eq('user_id', userId)
    .eq('diary_entry_id', diaryEntryId);

  if (sentences.length === 0) return;

  const rows = sentences.map((s, i) => ({
    user_id: userId,
    diary_entry_id: diaryEntryId,
    sentence_index: i,
    english_sentence: s.english,
    japanese_sentence: s.japanese,
    key_expressions: s.expressions,
  }));

  await supabase.from('diary_sentences').insert(rows);
}

/**
 * Load canonical sentences from diary_sentences table.
 * Returns null if none exist yet.
 */
export async function loadDiarySentences(
  supabase: any,
  userId: string,
  diaryEntryId: string
): Promise<PracticeSentence[] | null> {
  const { data } = await supabase
    .from('diary_sentences')
    .select('*')
    .eq('user_id', userId)
    .eq('diary_entry_id', diaryEntryId)
    .order('sentence_index', { ascending: true });

  if (!data || data.length === 0) return null;

  return data.map((row: any) => ({
    english: row.english_sentence,
    japanese: row.japanese_sentence,
    expressions: row.key_expressions ?? [],
  }));
}
