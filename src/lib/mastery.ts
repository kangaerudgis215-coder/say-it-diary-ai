/**
 * Unified mastery scale used across Phrases, Game, Progress, and AI feedback.
 * mastery_level is a 0–100 integer stored on the `expressions` table.
 *
 *   <  30  -> "new"        (✕ — not learned yet)
 *   30-79  -> "learning"   (△ — fuzzy / in progress)
 *   >= 80  -> "mastered"   (〇 — locked in)
 */
export type MasteryBucket = "new" | "learning" | "mastered";

export const MASTERY_THRESHOLDS = {
  learning: 30,
  mastered: 80,
} as const;

export function bucketOf(level: number | null | undefined): MasteryBucket {
  const v = level ?? 0;
  if (v >= MASTERY_THRESHOLDS.mastered) return "mastered";
  if (v >= MASTERY_THRESHOLDS.learning) return "learning";
  return "new";
}

export const BUCKET_META: Record<
  MasteryBucket,
  { label: string; symbol: "〇" | "△" | "✕"; color: string; bg: string; ring: string }
> = {
  mastered: {
    label: "Mastered",
    symbol: "〇",
    color: "text-emerald-400",
    bg: "bg-emerald-400/15",
    ring: "ring-emerald-400/40",
  },
  learning: {
    label: "In Progress",
    symbol: "△",
    color: "text-amber-400",
    bg: "bg-amber-400/15",
    ring: "ring-amber-400/40",
  },
  new: {
    label: "New",
    symbol: "✕",
    color: "text-sky-400",
    bg: "bg-sky-400/15",
    ring: "ring-sky-400/40",
  },
};

/** Apply a flashcard answer and return the next mastery_level (0-100). */
export function nextMasteryLevel(current: number | null | undefined, answer: MasteryBucket): number {
  const v = Math.max(0, Math.min(100, current ?? 0));
  switch (answer) {
    case "mastered":
      // Big bump up; 〇 always pushes toward / above the mastered threshold.
      return Math.min(100, Math.max(MASTERY_THRESHOLDS.mastered, v + 25));
    case "learning":
      // Nudge into the learning band, but never auto-master.
      return Math.min(MASTERY_THRESHOLDS.mastered - 5, Math.max(MASTERY_THRESHOLDS.learning, v + 10));
    case "new":
      // Drop back below the learning threshold so it keeps showing up.
      return Math.max(0, Math.min(MASTERY_THRESHOLDS.learning - 5, v - 15));
  }
}

/** The six fixed scene categories used everywhere in the app. */
export const SCENE_CATEGORIES = [
  "日常",
  "仕事",
  "学習",
  "感情",
  "人間関係",
  "その他",
] as const;
export type SceneCategory = (typeof SCENE_CATEGORIES)[number];

/** Fixed POS / phrase-type buckets used in the Phrases list. */
export const POS_CATEGORIES = [
  "verb phrase",
  "adjective phrase",
  "noun phrase",
  "adverb phrase",
  "idiom",
  "other",
] as const;
export type PosCategory = (typeof POS_CATEGORIES)[number];

/** Friendly Japanese label for each POS bucket. */
export const POS_LABELS_JA: Record<PosCategory, string> = {
  "verb phrase": "動詞句",
  "adjective phrase": "形容詞句",
  "noun phrase": "名詞句",
  "adverb phrase": "副詞句",
  "idiom": "イディオム・決まり文句",
  "other": "その他",
};

/**
 * Normalise a raw `pos_or_type` value coming from the database (which may
 * still hold the legacy "fixed phrase" tag) into the active POS bucket. Used
 * by every UI that surfaces the type label so the merged
 * "イディオム・決まり文句" reads consistently.
 */
export function normalizePosType(raw: string | null | undefined): PosCategory | null {
  if (!raw) return null;
  const merged = raw === "fixed phrase" ? "idiom" : raw;
  return (POS_CATEGORIES as readonly string[]).includes(merged)
    ? (merged as PosCategory)
    : null;
}

/** Human-friendly Japanese label, tolerant of legacy / unknown values. */
export function posLabelJa(raw: string | null | undefined): string | null {
  const normalised = normalizePosType(raw);
  if (!normalised) return raw ?? null;
  return POS_LABELS_JA[normalised];
}