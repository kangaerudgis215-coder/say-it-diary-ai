import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { target_en, target_jp, user_answer } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = `You judge a Japanese→English quick-composition answer with GENEROUS scoring.
Return JSON: { "correct": boolean, "praise": string (Japanese, 1 short cheerful sentence) }.
Mark correct=true unless:
- the user said nothing / gave up,
- the answer is clearly about something completely different,
- the meaning is unrecognizable.
Small grammar/vocab mistakes, paraphrasing, missing minor details → correct=true.
If correct, praise should be a warm Japanese cheer (e.g. "ナイス！自然な英語！").
If incorrect, praise is a gentle encouragement (e.g. "惜しい！正解文を見てみよう").`;

    const user = `Target English: ${target_en}\nTarget Japanese: ${target_jp}\nUser said: ${user_answer || "(no answer)"}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: "AI error", detail: t }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let parsed: any = { correct: false, praise: "" };
    try { parsed = JSON.parse(content); } catch {}
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