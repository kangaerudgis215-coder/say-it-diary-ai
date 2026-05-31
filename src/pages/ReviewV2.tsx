import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mic, Square, Loader2, Check, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { getPendingReviews, markReviewed, type Conversation } from "@/lib/conversationStore";
import { VoiceRecorder, transcribeAudio } from "@/lib/audioRecorder";

type Question = { convoId: string; idx: number; en: string; jp: string };

function buildQueue(convos: Conversation[]): Question[] {
  const q: Question[] = [];
  for (const c of convos) {
    const en = c.summary_sentences || [];
    const jp = c.summary_jp || [];
    for (let i = 0; i < en.length; i++) {
      q.push({ convoId: c.id, idx: i, en: en[i], jp: jp[i] || "" });
    }
  }
  return q;
}

export default function ReviewV2() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Question[]>([]);
  const [i, setI] = useState(0);
  const [convoIds, setConvoIds] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; praise: string; userText: string } | null>(null);
  const [done, setDone] = useState(false);
  const recRef = useRef<VoiceRecorder | null>(null);

  useEffect(() => {
    const list = getPendingReviews();
    setConvoIds(list.map((c) => c.id));
    setQueue(buildQueue(list));
  }, []);

  const current = queue[i];
  const totalQuestions = queue.length;

  const start = async () => {
    try {
      const r = new VoiceRecorder();
      await r.start();
      recRef.current = r;
      setRecording(true);
    } catch {
      toast.error("マイクが使えません");
    }
  };

  const stop = async () => {
    if (!recRef.current || !current) return;
    setRecording(false);
    setProcessing(true);
    try {
      const { base64, mimeType } = await recRef.current.stop();
      const text = await transcribeAudio(base64, mimeType, "en");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-recall`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ target_en: current.en, target_jp: current.jp, user_answer: text }),
      });
      const json = await resp.json();
      setResult({ correct: !!json.correct, praise: json.praise || "", userText: text });
    } catch (e) {
      console.error(e);
      toast.error("判定に失敗しました");
    } finally {
      setProcessing(false);
      recRef.current = null;
    }
  };

  const next = () => {
    setResult(null);
    if (i + 1 >= queue.length) {
      convoIds.forEach((id) => markReviewed(id));
      setDone(true);
    } else {
      setI((x) => x + 1);
    }
  };

  if (queue.length === 0) {
    return (
      <div className="min-h-screen bg-white text-zinc-900 flex flex-col items-center justify-center p-8">
        <p className="text-zinc-500">復習する会話がありません。</p>
        <button onClick={() => navigate("/")} className="mt-6 text-orange-600 underline">ホームへ戻る</button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white text-zinc-900 flex flex-col items-center justify-center p-8">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-6xl mb-4">🎉</motion.div>
        <h2 className="text-2xl font-semibold mb-2">復習完了！</h2>
        <p className="text-zinc-500 mb-8">{totalQuestions} 問お疲れさま</p>
        <button onClick={() => navigate("/")} className="px-6 py-3 rounded-full bg-orange-500 text-white font-medium">ホームへ</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate("/")} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
        <div className="text-xs text-zinc-500 tabular-nums">{i + 1} / {totalQuestions}</div>
        <div className="w-9" />
      </header>

      <div className="h-1 bg-zinc-100">
        <div className="h-1 bg-orange-500 transition-all" style={{ width: `${((i + 1) / totalQuestions) * 100}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-xs tracking-widest text-zinc-400 mb-3">英語で言ってみよう</p>
        <h1 className="text-2xl font-medium leading-relaxed">{current.jp}</h1>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 w-full max-w-md"
            >
              <div className={`flex items-center justify-center gap-2 text-sm font-medium ${result.correct ? "text-emerald-600" : "text-zinc-500"}`}>
                {result.correct ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                {result.praise}
              </div>
              <div className="mt-6 rounded-2xl border border-zinc-100 p-4 text-left">
                <div className="text-xs text-zinc-400 mb-1">あなた</div>
                <div className="text-zinc-700">{result.userText || "(無音)"}</div>
                <div className="text-xs text-zinc-400 mt-3 mb-1">参考</div>
                <div className="text-zinc-900 font-medium">{current.en}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-6 pb-10 flex items-center justify-center">
        {!result ? (
          recording ? (
            <button onClick={stop} className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center animate-pulse">
              <Square className="w-7 h-7" />
            </button>
          ) : processing ? (
            <div className="w-20 h-20 rounded-full bg-zinc-200 flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-zinc-500" />
            </div>
          ) : (
            <button onClick={start} className="w-20 h-20 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg">
              <Mic className="w-7 h-7" />
            </button>
          )
        ) : (
          <button onClick={next} className="px-8 py-3 rounded-full bg-zinc-900 text-white flex items-center gap-2">
            次へ <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}