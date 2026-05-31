import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { motion } from "framer-motion";
import { getConversation, type Conversation } from "@/lib/conversationStore";

export default function LogDetailV2() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const isFresh = sp.get("fresh") === "1";
  const navigate = useNavigate();
  const [c, setC] = useState<Conversation | null>(null);
  const [practiceOpen, setPracticeOpen] = useState(isFresh);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    if (!id) return;
    setC(getConversation(id));
  }, [id]);

  if (!c) return <div className="min-h-screen bg-white" />;

  return (
    <div className="min-h-screen bg-white text-zinc-900 pb-16">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white/90 backdrop-blur z-10 border-b border-zinc-100">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
        <div className="text-xs text-zinc-500">{format(parseISO(c.date), "yyyy年M月d日 (E)", { locale: ja })}</div>
        <div className="w-9" />
      </header>

      {/* Photos */}
      {c.photos.length > 0 && (
        <div className="px-4 pt-4 flex gap-2 overflow-x-auto">
          {c.photos.map((p, i) => (
            <img key={i} src={p} alt="" className="h-40 rounded-2xl object-cover shrink-0" />
          ))}
        </div>
      )}

      <div className="px-5 pt-6">
        {c.title && (
          <h1 className="text-3xl font-serif font-semibold mb-4">{c.title}</h1>
        )}

        {/* Summary */}
        {c.summary_en && (
          <div className="mb-8">
            <p className="text-[17px] leading-relaxed font-serif text-zinc-900">{c.summary_en}</p>
            {c.summary_jp && c.summary_jp.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-zinc-400 cursor-pointer">日本語訳</summary>
                <p className="text-sm leading-relaxed text-zinc-600 mt-2">
                  {c.summary_jp.join(" ")}
                </p>
              </details>
            )}
          </div>
        )}

        {/* Expressions */}
        {c.expressions && c.expressions.length > 0 && (
          <div className="mb-8">
            <div className="text-[11px] tracking-[0.2em] text-zinc-400 mb-3">汎用表現</div>
            <div className="border-t border-zinc-100">
              {c.expressions.map((e, i) => (
                <div key={i} className="border-b border-zinc-100 py-3">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-serif font-semibold text-lg">{e.en}</span>
                    <span className="text-sm text-zinc-500">{e.jp}</span>
                  </div>
                  {e.example && <p className="text-xs text-zinc-400 italic mt-1">"{e.example}"</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Practice CTA shown right after generation */}
        {isFresh && c.summary_sentences && c.summary_sentences.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-orange-50 border border-orange-100 p-5 mb-8">
            <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-orange-500" /><div className="font-medium">今日のサマリーを練習する？</div></div>
            <p className="text-sm text-zinc-600 mb-4">日本語訳を見て、英語で言えるか試してみましょう。</p>
            <div className="flex gap-2">
              <button onClick={() => navigate("/review")} className="flex-1 py-2.5 rounded-full bg-orange-500 text-white font-medium">やってみる</button>
              <button onClick={() => navigate("/")} className="flex-1 py-2.5 rounded-full bg-white border border-zinc-200 text-zinc-700">あとで</button>
            </div>
          </motion.div>
        )}

        {/* Full transcript */}
        <button
          onClick={() => setShowFull((x) => !x)}
          className="w-full flex items-center justify-between py-3 border-y border-zinc-100 text-sm text-zinc-600"
        >
          <span>会話全文 ({c.messages.length})</span>
          {showFull ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showFull && (
          <div className="mt-4 space-y-3">
            {c.messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "bg-orange-500 text-white" : "bg-zinc-100 text-zinc-800"}`}>
                  {m.photo && <img src={m.photo} alt="" className="rounded-xl mb-2 max-h-40 object-cover" />}
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}