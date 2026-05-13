import { useEffect, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { MessageSquareHeart } from 'lucide-react';
import { useUISound } from '@/hooks/useUISound';

const FEEDBACK_MESSAGES = [
  'SOKIをもっとよくするにゃ🐱 感想を教えてくれると嬉しいにゃ',
  '開発者へのコメントも待ってるにゃ。',
  '開発者が喜んでるにゃ。',
  'フィードバックはSOKIの成長の糧にゃ！',
  '要望があれば遠慮なく伝えてにゃ〜',
  'みんなの声でどんどん進化するにゃ',
];

export function FeedbackSection() {
  const { playTap } = useUISound();
  const [message, setMessage] = useState(FEEDBACK_MESSAGES[0]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * FEEDBACK_MESSAGES.length);
    setMessage(FEEDBACK_MESSAGES[randomIndex]);
  }, []);

  const openForm = () => {
    playTap();
    window.open(
      'https://docs.google.com/forms/d/e/1FAIpQLSeaXCGDeNCmL4E6tgpTVo9seyc9_Z3knUTSIvTVS-1upznKcg/viewform?usp=preview',
      '_blank',
    );
  };

  return (
    <div className="mt-6 mb-2 flex flex-col items-center fade-in">
      <div className="relative flex items-end gap-2">
        {/* Speech bubble */}
        <div className="relative max-w-[200px] rounded-2xl bg-card/90 border border-border/70 px-3 py-2 text-[11px] leading-snug text-foreground/90 shadow-sm font-japanese">
          {message}
          <span
            aria-hidden
            className="absolute -bottom-1.5 right-6 w-3 h-3 rotate-45 bg-card/90 border-r border-b border-border/70"
          />
        </div>
        {/* Cat */}
        <div className="w-12 h-12 -mb-1">
          <DotLottieReact
            src="/anim/cat-playing.lottie"
            autoplay
            loop
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
      <button
        onClick={openForm}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
      >
        <MessageSquareHeart className="w-4 h-4" />
        感想を送る
      </button>
    </div>
  );
}
