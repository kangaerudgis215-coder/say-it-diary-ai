import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let responseFormat = null;

    if (type === "conversation") {
      systemPrompt = `You are a warm, encouraging English conversation partner helping a Japanese learner practice English through daily journaling.

Your role:
- Listen attentively to what happened in the user's day
- Ask gentle follow-up questions to help them express more details
- Occasionally offer natural English alternatives if they seem to struggle
- Be supportive and positive, never critical of their English
- Keep responses concise (2-3 sentences max)
- Use casual, friendly language

Remember: The goal is to make them feel comfortable speaking about their day, not to teach grammar formally. Be like a kind friend who happens to help with English naturally.`;
    } else if (type === "generate_diary") {
      systemPrompt = `You are an expert at transforming conversation logs into polished diary entries.

Your task:
1. Extract all the user's messages that describe their day
2. Merge them into ONE coherent, natural-sounding English diary entry
3. Write it in first person, as if the user wrote it themselves
4. Use natural English that a native speaker would use
5. Keep the user's original meaning and emotions
6. Fix any grammar issues naturally without changing the essence
7. Also provide a brief Japanese summary (2-3 sentences)
8. Extract 3-5 useful, general-purpose English expressions from the diary

Respond in this exact JSON format:
{
  "diary": "The polished English diary entry here...",
  "japaneseSummary": "Japanese summary here...",
  "expressions": [
    {"expression": "phrase here", "meaning": "Japanese meaning", "example": "example sentence"},
    ...
  ]
}`;
    }

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        ...(type === "generate_diary" && {
          response_format: { type: "json_object" }
        }),
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (type === "generate_diary") {
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Failed to parse diary response:", e);
        return new Response(JSON.stringify({ 
          diary: content, 
          japaneseSummary: null, 
          expressions: [] 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Chat function error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
