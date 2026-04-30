import { useEffect, useMemo, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface CatDiaryEntry {
  id: string;
  date: string;
  content: string;
}

interface CatBuddyProps {
  /** Most recent diary content (English) used to flavor the cat's comment. */
  recentDiary?: string | null;
  entries?: CatDiaryEntry[];
  streak?: number;
}

/**
 * Tiny laid-back cat companion that comments on the user's recent diary
 * with a short reaction + encouragement, nyaa~.
 */
export function CatBuddy({ recentDiary, entries = [], streak = 0 }: CatBuddyProps) {
  const [comments, setComments] = useState<string[]>(() => pickFallbackBubbles(recentDiary ?? '', streak));
  const [index, setIndex] = useState(0);

  const diarySignature = useMemo(
    () => entries.map((e) => `${e.id}:${e.date}:${e.content.length}`).join('|'),
    [entries],
  );

  useEffect(() => {
    let cancelled = false;
    const fallback = pickFallbackBubbles(recentDiary ?? entries[0]?.content ?? '', streak);
    setComments(fallback);
    setIndex(0);

    const generate = async () => {
      if (entries.length === 0) return;
      const samples = pickDiarySamples(entries);
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ type: 'cat_comments', diaries: samples, streak }),
        });
        if (!response.ok) throw new Error('failed');
        const data = await response.json();
        const next = Array.isArray(data.comments)
          ? data.comments.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 3)
          : [];
        if (!cancelled && next.length >= 3) setComments(next);
      } catch {
        if (!cancelled) setComments(fallback);
      }
    };

    generate();
    return () => {
      cancelled = true;
    };
  }, [diarySignature, entries, recentDiary, streak]);

  const bubble = comments[index % comments.length] || pickFallbackBubbles('', streak)[0];
  const cycleComment = () => setIndex((prev) => (prev + 1) % Math.max(1, comments.length));

  return (
    <button
      type="button"
      onClick={cycleComment}
      className="relative h-full w-full flex flex-col items-center justify-end pb-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
      aria-label="猫のコメントを切り替える"
    >
      {/* Speech bubble */}
      <div
        className="relative mb-1 max-w-[160px] rounded-2xl bg-card/90 border border-border/70 px-3 py-2 text-[11px] leading-snug text-foreground/90 shadow-sm font-japanese"
        style={{ animation: 'fade-in 0.5s ease-out both' }}
      >
        {bubble}
        {/* tail */}
        <span
          aria-hidden
          className="absolute -bottom-1.5 left-6 w-3 h-3 rotate-45 bg-card/90 border-r border-b border-border/70"
        />
      </div>
      <div className="w-24 h-24 -mt-1">
        <DotLottieReact
          src="/anim/cat-playing.lottie"
          autoplay
          loop
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </button>
  );
}

/**
 * Map keywords in the recent diary to a chill, supportive cat comment.
 * Always end with a soft prompt about today.
 */
function pickBubble(text: string): string {
  const t = text.toLowerCase();

  const rules: Array<{ match: RegExp; line: string }> = [
    { match: /\bramen|noodle|udon|soba\b/, line: '僕もラーメン食べたくなってきたにゃ〜。今日はどんなことがあったにゃ？' },
    { match: /\bcoffee|cafe|latte|espresso\b/, line: 'カフェの匂い、想像しただけで眠くなるにゃ…。今日はどう過ごしたにゃ？' },
    { match: /\b(work|office|meeting|boss|deadline)\b/, line: 'お仕事おつかれにゃ〜。今日はどんな一日だったにゃ？' },
    { match: /\b(study|exam|test|homework|class|school)\b/, line: '勉強がんばってるにゃ〜偉い。今日はどんなことがあったにゃ？' },
    { match: /\b(run|jog|gym|workout|exercise|walk)\b/, line: '体動かすの偉いにゃ〜。今日はどう過ごしたにゃ？' },
    { match: /\b(rain|rainy|cold|snow|wind)\b/, line: 'こんな日は丸くなって寝るに限るにゃ…。今日は何があったにゃ？' },
    { match: /\b(sun|sunny|hot|warm|beach)\b/, line: '日向ぼっこ日和だったにゃ〜。今日はどんな一日にゃ？' },
    { match: /\b(friend|met|dinner|lunch|party)\b/, line: 'みんなで集まるの楽しそうにゃ〜。今日はどうだったにゃ？' },
    { match: /\b(movie|game|book|music|anime)\b/, line: 'いいなぁ、僕も一緒に観たかったにゃ。今日はどんなことがあったにゃ？' },
    { match: /\b(tired|sleepy|nap|sleep)\b/, line: '疲れた日は無理しないでにゃ〜。今日はどう過ごしたにゃ？' },
    { match: /\b(happy|fun|great|good|awesome|nice)\b/, line: 'いいことあったみたいで何よりにゃ〜。今日はどんな日にゃ？' },
    { match: /\b(sad|angry|hard|stressed|sick)\b/, line: '無理しないでにゃ。話してくれて嬉しいにゃ。今日はどうだったにゃ？' },
  ];

  for (const r of rules) {
    if (r.match.test(t)) return r.line;
  }

  if (!text.trim()) {
    return 'やぁにゃ〜。今日はどんな一日だったにゃ？ぼちぼち話してにゃ。';
  }
  return 'おつかれにゃ〜。今日はどんなことがあったにゃ？';
}