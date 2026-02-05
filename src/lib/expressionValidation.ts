import { normalizeForExpression } from '@/lib/textComparison';

export function isExpressionInText(englishText: string, expression: string): boolean {
  const textNorm = normalizeForExpression(englishText);
  const exprNorm = normalizeForExpression(expression);
  if (!exprNorm) return false;
  return textNorm.includes(exprNorm);
}

export function partitionExpressionsForText<T extends { id: string; expression: string }>(
  expressions: T[],
  englishText: string
): { valid: T[]; invalid: T[] } {
  const valid: T[] = [];
  const invalid: T[] = [];

  for (const exp of expressions) {
    if (isExpressionInText(englishText, exp.expression)) valid.push(exp);
    else invalid.push(exp);
  }

  return { valid, invalid };
}

/**
 * Global cleanup: if an expression is linked to a diary but does not appear
 * in that diary's English content, unlink it from that diary.
 */
export async function cleanupInvalidDiaryLinkedExpressions(
  supabase: any,
  userId: string
): Promise<{ cleaned: number }> {
  const { data, error } = await supabase
    .from('expressions')
    .select('id, expression, diary_entry_id, diary_entries:diary_entry_id(content)')
    .eq('user_id', userId)
    .not('diary_entry_id', 'is', null);

  if (error) {
    console.warn('[expression-validation] Failed to fetch expressions for cleanup', error);
    return { cleaned: 0 };
  }

  const invalidIds: string[] = [];

  for (const row of data || []) {
    const content = (row as any).diary_entries?.content as string | undefined;
    if (!content) continue;
    if (!isExpressionInText(content, (row as any).expression)) {
      invalidIds.push((row as any).id);
    }
  }

  if (invalidIds.length === 0) return { cleaned: 0 };

  const { error: updateError } = await supabase
    .from('expressions')
    .update({ diary_entry_id: null })
    .in('id', invalidIds)
    .eq('user_id', userId);

  if (updateError) {
    console.warn('[expression-validation] Failed to unlink invalid expressions', updateError);
    return { cleaned: 0 };
  }

  console.warn(
    `[expression-validation] Unlinked ${invalidIds.length} expression(s) that were not in the diary text.`
  );

  return { cleaned: invalidIds.length };
}
