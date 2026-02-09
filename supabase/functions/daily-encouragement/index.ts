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

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_streak, total_diary_entries, display_name")
        .eq("user_id", userId)
        .maybeSingle();

      if (profile) {
        streakInfo = `The user "${profile.display_name || 'learner'}" has a ${profile.current_streak || 0}-day streak and ${profile.total_diary_entries || 0} total diary entries.`;
      }

      const { count: masteredCount } = await supabase
        .from("expressions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active")
        .gte("mastery_level", 5);

      const { count: totalCount } = await supabase
        .from("expressions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active");

      expressionInfo = `They have mastered ${masteredCount || 0} out of ${totalCount || 0} active expressions.`;
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
            content: `You are a warm, encouraging language learning coach for a Japanese person learning English through daily diary journaling app called SO-KI.
Generate a short daily encouragement message (2-3 sentences max). Be specific to their progress when stats are available. Mix English and occasional Japanese (using Japanese characters) naturally. Use emojis sparingly (1-2 max). Be genuine, not generic. Vary your tone: sometimes motivational, sometimes gentle, sometimes celebrating small wins.`
          },
          {
            role: "user",
            content: `Generate today's encouragement message. ${streakInfo} ${expressionInfo} Today's date: ${new Date().toISOString().slice(0, 10)}.`
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
