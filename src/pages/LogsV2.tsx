import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteConversation, getConversations, subscribe, type Conversation } from "@/lib/conversationStore";

export default function LogsV2() {
  const navigate = useNavigate();
  const [list, setList] = useState<Conversation[]>([]);

  useEffect(() => {
    const refresh = () => setList(getConversations().filter((c) => c.ended_at));
    refresh();
    return subscribe(refresh);
  }, []);

  // Group by month label
  const groups = list.reduce<Record<string, Conversation[]>>((acc, c) => {
    const key = format(parseISO(c.date), "yyyy年M月", { locale: ja });
    (acc[key] ||= []).push(c);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <button onClick={() => navigate("/")} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
        <div className="text-base font-semibold">ログ</div>
        <div className="w-9" />
      </header>

      {list.length === 0 && (
        <div className="p-10 text-center text-zinc-400 text-sm">まだログはありません</div>
      )}

      <div className="pb-10">
        {Object.entries(groups).map(([month, items]) => (
          <div key={month}>
            <div className="px-5 pt-5 pb-2 text-xs text-zinc-500">{month}</div>
            <div className="space-y-2 px-3">
              {items.map((c) => {
                const dow = format(parseISO(c.date), "E", { locale: ja });
                const day = format(parseISO(c.date), "d");
                const time = format(parseISO(c.started_at), "HH:mm");
                const thumb = c.photos[0];
                const preview = c.summary_en || c.messages.find((m) => m.role === "user")?.content || "";
                const unreviewed = !c.reviewed_at;
                return (
                  <Link
                    key={c.id}
                    to={`/logs/${c.id}`}
                    className="block rounded-2xl bg-zinc-50 hover:bg-zinc-100 transition px-4 py-4"
                  >
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center w-10 shrink-0">
                        <div className="text-[10px] text-zinc-500">{dow}</div>
                        <div className="text-2xl font-semibold leading-none">{day}</div>
                        <div className="text-[10px] text-zinc-400 mt-1">{time}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {c.title && <div className="text-xs text-zinc-500 truncate">{c.title}</div>}
                          {unreviewed && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500 text-white">未復習</span>}
                        </div>
                        <p className="text-sm text-zinc-700 line-clamp-3 leading-snug">{preview}</p>
                      </div>
                      {thumb && <img src={thumb} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            className="p-2 -mr-2 text-zinc-300 hover:text-red-500 self-start"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>このログを削除しますか？</AlertDialogTitle>
                            <AlertDialogDescription>
                              削除すると復習対象から外れ、会話・サマリー・表現すべて取り消せません。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteConversation(c.id)} className="bg-red-500 hover:bg-red-600">
                              削除する
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}