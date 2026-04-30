import { useEffect, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface CatBuddyProps {
  /** Most recent diary content (English) used to flavor the cat's comment. */
  recentDiary?: string | null;
}

/**
 * Tiny laid-back cat companion that comments on the user's recent diary
 * with a short reaction + encouragement, nyaa~. Pure client-side keyword
 * matching — no AI calls, no PII leaving the device.
 */
export function CatBuddy({ recentDiary }: CatBuddyProps) {
  const [bubble, setBubble] = useState<string>('');

  useEffect(() => {
    setBubble(pickBubble(recentDiary ?? ''));
  }, [recentDiary]);

  return (
    <div className="relative h-full flex flex-col items-center justify-end pb-1">
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
    </div>
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