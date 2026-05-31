import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Sparkles, BookOpen, ListChecks } from "lucide-react";
import { ThemeToggleLottie } from "@/components/ThemeToggleLottie";
import { createConversation, getPendingReviews, getProfile, recomputeStreak, subscribe, getConversations } from "@/lib/conversationStore";

export default function HomeV2() {
  const navigate = useNavigate();
  const [, force] = useState(0);

  useEffect(() => {
    recomputeStreak();
    return subscribe(() => force((x) => x + 1));
  }, []);

  const profile = getProfile();
  const pending = getPendingReviews();
  const totalLogs = getConversations().filter((c) => c.ended_at).length;

  const startConversation = () => {
    const c = createConversation();
    navigate(`/chat/${c.id}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-5">
        <div className="text-sm tracking-[0.2em] text-muted-foreground">SO-KI</div>
        <ThemeToggleLottie />
      </header>

      {/* Stats */}
      <div className="px-5 mt-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="text-2xl font-semibold tabular-nums">{profile.current_streak}</span>
            <span className="text-xs text-muted-foreground">日連続</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-400" />
            <span className="text-2xl font-semibold tabular-nums">{profile.total_words.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">語</span>
          </div>
        </div>
      </div>

      {/* Review button */}
      {pending.length > 0 && (
        <div className="px-5 mt-5">
          <button
            onClick={() => navigate("/review")}
            className="w-full flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3">
              <ListChecks className="w-5 h-5 text-primary" />
              <span className="font-medium">復習する</span>
            </div>
            <span className="text-xs font-semibold rounded-full bg-orange-500 text-white px-2.5 py-1">
              {pending.length}
            </span>
          </button>
        </div>
      )}

      {/* Big tap circle */}
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <button
          onClick={startConversation}
          aria-label="今日の会話を始める"
          className="relative w-64 h-64 rounded-full flex items-center justify-center group"
        >
          {/* Ripples */}
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border border-orange-400/40"
              initial={{ scale: 0.85, opacity: 0.6 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
            />
          ))}
          <motion.span
            className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_20px_60px_-15px_rgba(249,115,22,0.6)]"
            whileTap={{ scale: 0.96 }}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="relative text-white font-medium tracking-wide text-lg">
            話す
          </span>
        </button>
        <p className="mt-6 text-sm text-muted-foreground text-center px-8">
          今日あったこと、気になること、なんでも。
        </p>
      </div>

      {/* Footer */}
      <div className="px-5 pb-8">
        <Link
          to="/logs"
          className="w-full flex items-center justify-between rounded-2xl border border-border bg-card/50 px-5 py-4 active:scale-[0.99] transition"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">ログ一覧</span>
          </div>
          <span className="text-xs text-muted-foreground">{totalLogs} 件</span>
        </Link>
      </div>
    </div>
  );
}