import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transcript = (messages as Array<{ role: string; content: string }>)
      .map((m) => `${m.role === "user" ? "User" : "SO-KI"}: ${m.content}`)
      .join("\n");

    const systemPrompt = `You are a language-learning assistant. Read the chat log and produce:
1. "summary_en": A faithful first-person English narrative (past tense) of what the USER talked about and did. Length scales with the conversation: short chat = 2-4 sentences, long chat = 6-12+ sentences. Natural, high-school level. Stay strictly faithful to user-stated facts; never invent.
2. "summary_sentences": The same summary split into individual sentences (array of strings, in order).
3. "summary_jp": Sentence-by-sentence literal Japanese translation, same order as summary_sentences (array, same length).
4. "expressions": Useful general-purpose words/phrases/collocations the user could reuse in OTHER contexts. Each item: { "en": string, "jp": string, "example": string (the sentence from summary_en or the conversation where it appears, verbatim if possible) }. Aim for 5-15 items depending on richness. Skip proper nouns and ultra-basic words.
5. "title": A short Japanese title (8 chars max) for the conversation, e.g. "ATEEZのダンス練習".

Return ONLY valid JSON, no markdown fences.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Conversation log:\n\n${transcript}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      return new Response(JSON.stringify({ error: "AI error", detail: t }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { error: "parse_failed", raw: content }; }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});