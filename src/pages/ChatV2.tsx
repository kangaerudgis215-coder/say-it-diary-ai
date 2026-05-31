import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mic, Image as ImageIcon, Send, Square, Loader2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { appendMessage, finishConversation, getConversation, type ChatMessage } from "@/lib/conversationStore";
import { fileToCompressedDataUrl } from "@/lib/imageUtils";
import { VoiceRecorder, transcribeAudio, speak, stopSpeaking } from "@/lib/audioRecorder";

export default function ChatV2() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recProcessing, setRecProcessing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [muted, setMuted] = useState(false);
  const recRef = useRef<VoiceRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    const c = getConversation(id);
    if (!c) { navigate("/"); return; }
    setMessages(c.messages);
  }, [id, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const sendMessage = async (content: string, photo?: string) => {
    if (!id) return;
    if (!content.trim() && !photo) return;
    const userMsg = appendMessage(id, { role: "user", content: content.trim() || (photo ? "[photo]" : ""), photo });
    setMessages((prev) => [...prev, userMsg!]);
    setDraft("");

    setStreaming(true);
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const apiMessages = [...(getConversation(id)?.messages ?? [])].map((m) => ({
        role: m.role,
        content: m.photo ? `${m.content}\n[user attached a photo]` : m.content,
      }));

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      });
      if (!resp.ok || !resp.body) throw new Error("chat failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(json);
            const delta = p.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: acc };
                return copy;
              });
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }

      const saved = appendMessage(id, { id: assistantMsg.id, role: "assistant", content: acc });
      if (saved && !muted) speak(acc);
    } catch (e) {
      console.error(e);
      toast.error("AIとの通信に失敗しました");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  const startRec = async () => {
    try {
      const r = new VoiceRecorder();
      await r.start();
      recRef.current = r;
      setRecording(true);
    } catch (e) {
      console.error(e);
      toast.error("マイクが使えません");
    }
  };

  const stopRec = async () => {
    if (!recRef.current) return;
    setRecording(false);
    setRecProcessing(true);
    try {
      const { base64, mimeType } = await recRef.current.stop();
      const text = await transcribeAudio(base64, mimeType);
      if (text.trim()) await sendMessage(text);
      else toast.info("音声を認識できませんでした");
    } catch (e) {
      console.error(e);
      toast.error("音声認識に失敗しました");
    } finally {
      setRecProcessing(false);
      recRef.current = null;
    }
  };

  const onPickPhoto = async (file: File) => {
    try {
      const data = await fileToCompressedDataUrl(file);
      await sendMessage(draft || "Look at this photo!", data);
    } catch (e) {
      console.error(e);
      toast.error("写真を読み込めませんでした");
    }
  };

  const handleFinish = async () => {
    if (!id) return;
    const c = getConversation(id);
    if (!c || c.messages.filter((m) => m.role === "user").length === 0) {
      toast.info("メッセージを送ってから終了してください");
      return;
    }
    setFinishing(true);
    stopSpeaking();
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-conversation`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: c.messages.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const json = await resp.json();
      finishConversation(id, {
        summary_en: json.summary_en || "",
        summary_sentences: json.summary_sentences || [],
        summary_jp: json.summary_jp || [],
        expressions: json.expressions || [],
        title: json.title || null,
      });
      navigate(`/logs/${id}?fresh=1`);
    } catch (e) {
      console.error(e);
      toast.error("サマリー生成に失敗しました");
      setFinishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <button onClick={() => navigate("/")} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
        <div className="text-sm font-medium">SO-KI</div>
        <button onClick={() => { setMuted((m) => !m); stopSpeaking(); }} className="p-2 -mr-2">
          {muted ? <VolumeX className="w-5 h-5 text-zinc-400" /> : <Volume2 className="w-5 h-5 text-zinc-700" />}
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-zinc-400 text-sm mt-12">Say something in English...</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.role === "user" ? "bg-orange-500 text-white" : "bg-zinc-100 text-zinc-900"}`}>
              {m.photo && <img src={m.photo} alt="" className="rounded-xl mb-2 max-h-60 object-cover" />}
              <div className="whitespace-pre-wrap text-[15px] leading-snug">{m.content || (streaming && m.role === "assistant" ? "…" : "")}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-100 p-3 pb-5 space-y-2">
        <button
          disabled={finishing || streaming || recording}
          onClick={handleFinish}
          className="w-full text-sm text-zinc-500 hover:text-orange-600 disabled:opacity-40 transition py-1"
        >
          {finishing ? "サマリー生成中…" : "会話を終了する"}
        </button>

        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickPhoto(f);
              e.target.value = "";
            }}
          />
          <button onClick={() => fileRef.current?.click()} className="p-2.5 rounded-full bg-zinc-100"><ImageIcon className="w-5 h-5 text-zinc-600" /></button>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(draft); }
            }}
            rows={1}
            placeholder="Type or tap mic…"
            className="flex-1 resize-none max-h-32 rounded-2xl bg-zinc-100 px-4 py-2.5 outline-none text-[15px]"
          />

          {draft.trim() ? (
            <button onClick={() => sendMessage(draft)} disabled={streaming} className="p-2.5 rounded-full bg-orange-500 text-white disabled:opacity-50">
              <Send className="w-5 h-5" />
            </button>
          ) : recording ? (
            <button onClick={stopRec} className="p-2.5 rounded-full bg-red-500 text-white animate-pulse">
              <Square className="w-5 h-5" />
            </button>
          ) : recProcessing ? (
            <button disabled className="p-2.5 rounded-full bg-zinc-300 text-white">
              <Loader2 className="w-5 h-5 animate-spin" />
            </button>
          ) : (
            <button onClick={startRec} disabled={streaming} className="p-2.5 rounded-full bg-zinc-900 text-white disabled:opacity-50">
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}