import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch user stats for context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let streakInfo = "";
    let expressionInfo = "";
    let displayName = "";

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_streak, total_diary_entries, display_name")
        .eq("user_id", userId)
        .maybeSingle();

      if (profile) {
        displayName = (profile.display_name || "").trim();
        streakInfo = `current_streak=${profile.current_streak || 0} ; total_diary_entries=${profile.total_diary_entries || 0}`;
      }

      // Unified mastery scale (0-100): mastered ≥ 80, learning 30-79, new < 30.
      const { count: masteredCount } = await supabase
        .from("expressions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active")
        .gte("mastery_level", 80);

      const { count: learningCount } = await supabase
        .from("expressions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active")
        .gte("mastery_level", 30)
        .lt("mastery_level", 80);

      const { count: totalCount } = await supabase
        .from("expressions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active");

      const pct = totalCount && totalCount > 0
        ? Math.round(((masteredCount || 0) / totalCount) * 100)
        : 0;

      expressionInfo = `total_expressions=${totalCount || 0} ; mastered=${masteredCount || 0} ; in_progress=${learningCount || 0} ; mastery_rate=${pct}%`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `あなたはアプリ「AI英語日記 SO-KI」のマスコット、ねむたげで穏やかな猫キャラクター（SO-KI）です。
ユーザーは英語日記を続けている日本人。あなたは寄り添う友達のような口調で、日本語のショートメッセージを返します。

【キャラ・口調】
- ねむたげ・ゆるい・あたたかい。語尾に「にゃ」「にゃ〜」がたまに自然に入る（毎文には付けない）。
- 1〜2文・合計60〜120字程度。絵文字は0〜2個まで。
- 短い英単語をひと言だけ混ぜるのはOK（例: "nice" "good job"）。長い英文は禁止。

【絶対ルール — 事実を作らない】
- 与えられた数値（current_streak / total_diary_entries / mastered / in_progress / mastery_rate）以外を**絶対に断定しない**。
- 連続日数を語るときは与えられた数字をそのまま使う。**それ以外の数字や事実を作らない**。
- current_streak が 0 のときは「○日続いてるね」など**嘘の称賛をしない**。優しく次を促すだけ。
- 「昨日の○○は楽しかったね」など、与えられていない過去の出来事・曜日・天気・場所・気分を勝手に作らない。
- 数字に自信がない／違和感があるときは数字を出さず、ふんわり褒めるだけにする。

【ユーザー名の扱い】
- 名前が与えられたときだけ、たまに（必須ではない）呼びかけてよい。
- 名前が空のときは絶対に名前らしきものを書かない。

【トーン】
- 説教しない・指示しない。寄り添うだけ。
- ストリーク0のときは「焦らずまた話そうにゃ〜」のように優しく。
- ストリークが続いているときは具体数を添えて静かに褒める。`
          },
          {
            role: "user",
            content: `今日の励ましメッセージを1つ、上のキャラ設定と「事実を作らない」ルールを厳守して、日本語のショートメッセージのみで返してください。

【ユーザー名】${displayName || "(なし — 名前は使わないこと)"}
【統計（これ以外の数字を作らないこと）】
${streakInfo}
${expressionInfo}
【今日の日付】${new Date().toISOString().slice(0, 10)}`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content || "Keep going! You're building something amazing, one diary at a time. 💪";

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-encouragement error:", e);
    return new Response(
      JSON.stringify({ message: "Every word you speak in English makes you stronger. Keep it up! 🌟" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
