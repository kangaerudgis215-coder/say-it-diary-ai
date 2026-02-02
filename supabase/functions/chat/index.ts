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

    if (type === "conversation") {
      systemPrompt = `You are a warm, encouraging English conversation partner helping a Japanese learner practice English through daily journaling.

CONVERSATION GOALS:
- Help the user talk about their day naturally
- Cover roughly 3 different aspects/topics of their day (morning, afternoon, evening / work, hobbies, feelings, etc.)
- Aim for enough content to create a ~3 sentence diary at the end

YOUR STYLE:
- Be natural and conversational - NO rigid templates or forced patterns
- Respond warmly and genuinely like a friendly chat partner
- Ask ONE follow-up question to deepen each topic slightly, then move on
- Don't explicitly rewrite the user's English every turn - just respond naturally

TOPIC FLOW:
1. For each topic the user shares: Ask about 1 follow-up question to get a bit more detail
2. Then gently suggest exploring another part of their day:
   - "What else happened today?"
   - "How about your [morning/afternoon/evening]?"
   - "Anything interesting with work/studies/hobbies?"
3. After covering ~3 topics, start wrapping up:
   - "That's a nice picture of your day!"
   - "Thanks for sharing! I think we have enough for today's diary."
   - "That gives me a good sense of your day. Ready to create your diary?"

CONVERSATION PACING:
- Keep each response short (1-2 sentences usually)
- Natural reactions: "Nice!", "Oh interesting!", "That sounds fun!" etc.
- After 4-6 user messages total, if you've covered multiple topics, suggest finishing
- When ready to finish, say something like: "Great! Let's wrap up and create your diary for today."

IMPORTANT: Be natural and encouraging. The goal is a pleasant conversation that gathers enough for a short 3-sentence diary.`;
    } else if (type === "generate_diary") {
      systemPrompt = `You are an expert at transforming conversation logs into polished diary entries.

Your task:
1. Extract all the user's messages that describe their day
2. Merge them into ONE coherent, natural-sounding English diary entry (2-3 sentences)
3. Write it in first person, as if the user wrote it themselves
4. Use natural English that a native speaker would use
5. Keep the user's original meaning and emotions
6. Fix any grammar issues naturally without changing the essence
7. Provide a Japanese translation that closely follows the English structure
8. Extract 3-5 useful, general-purpose English expressions from the diary
9. For each expression, also classify:
   - scene_or_context: a short label (1-2 words) for when this expression is typically used
     Examples: "daily life", "small talk", "school", "work", "feelings", "travel", "health", "hobbies", "food", "weather"
   - pos_or_type: a simple grammatical/phrase type label
     Examples: "verb phrase", "adjective phrase", "noun phrase", "fixed phrase", "adverb phrase", "idiom"
10. Select 3-5 "important sentences" for focused practice:
   - These are short, useful sentences from the diary that contain key expressions
   - For EACH important sentence, provide both the English AND its Japanese translation
   - These sentences will be used for instant English composition practice

JAPANESE TRANSLATION INSTRUCTIONS:
- Translate the English diary into Japanese sentence-by-sentence
- Keep the translation relatively literal and close to the English structure
- Do not paraphrase heavily or add new information
- The Japanese should help learners map English sentences to Japanese easily
- It's okay if the Japanese sounds slightly less elegant - accuracy to the English is more important

Respond in this exact JSON format:
{
  "diary": "The polished English diary entry here...",
  "japaneseSummary": "Japanese translation here (sentence-by-sentence, close to English)...",
  "expressions": [
    {"expression": "phrase here", "meaning": "Japanese meaning", "example": "example sentence", "scene_or_context": "daily life", "pos_or_type": "verb phrase"},
    ...
  ],
  "importantSentences": [
    {"english": "One important sentence from the diary.", "japanese": "その文の日本語訳", "expressions": ["key phrase used"]},
    {"english": "Another important sentence.", "japanese": "もう一つの日本語訳", "expressions": ["another phrase"]},
    ...
  ]
}`
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
