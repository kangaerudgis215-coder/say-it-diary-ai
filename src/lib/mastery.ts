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