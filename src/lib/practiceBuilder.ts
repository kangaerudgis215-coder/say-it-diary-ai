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
 * IMPORTANT (strict rule): expressions that do not appear in the diary English text
 * are dropped here (they should also be cleaned up at save-time / load-time).
 */
export function buildPracticeSentences(
  diaryContent: string,
  japaneseSummary: string | null,
  expressionStrings: string[],
  importantSentences?: Array<{ english: string; japanese: string; expressions?: string[] }> | null
): PracticeSentence[] {
  // Dedupe expression list (case-insensitive)
  const seenNorm = new Set<string>();
  const deduped = expressionStrings.filter((e) => {
    const n = normalizeForExpression(e);
    if (!n || seenNorm.has(n)) return false;
    seenNorm.add(n);
    return true;
  });

  // STRICT: keep only expressions that appear in the diary English text.
  const diaryNorm = normalizeForExpression(diaryContent || '');
  const expressions = deduped.filter((e) => diaryNorm.includes(normalizeForExpression(e)));

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

  // Attach expressions only to sentences where they appear
  for (const sent of baseSentences) {
    for (const expr of expressions) {
      if (expressionAppearsIn(sent.english, expr)) {
        sent.expressions.push(expr);
      }
    }
    sent.expressions = Array.from(new Set(sent.expressions));
  }

  // Remove sentences that have zero expressions (practice is expression-driven)
  return baseSentences.filter((s) => s.expressions.length > 0);
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
