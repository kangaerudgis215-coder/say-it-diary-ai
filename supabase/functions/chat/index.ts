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
- Aim for enough content to create a SHORT diary (3-5 sentences, about 5 lines max)

YOUR STYLE:
- BE BRIEF! Keep your messages SHORT - 1 reaction phrase + 1 short question max
- Listen more, talk less - the user should do most of the talking
- Natural reactions: "Nice!", "I see!", "That sounds fun!" (short, not long comments)
- Do NOT give long explanations or multi-sentence responses

TOPIC FLOW:
1. Ask 1 short follow-up per topic, then move on
2. Suggest other topics briefly: "What else?" / "How was your morning?"
3. After 2-3 topics, gently suggest wrapping up:
   - "Great! That's enough for today's diary."
   - "Ready to create your diary? Tap the Done button!"

CONVERSATION PACING:
- CRITICAL: Keep each response to 1 short reaction + 1 question (15-25 words MAX)
- After 3-5 user messages, actively encourage finishing
- Say: "That's great! You can tap Done to create your diary now."

IMPORTANT: Be warm but BRIEF. Most words should come from the user, not you. The goal is a SHORT diary (3-5 sentences).`;
    } else if (type === "generate_diary") {
      systemPrompt = `You are an expert at transforming conversation logs into polished diary entries.

Your task:
1. Extract the user's main points about their day
2. Merge them into ONE SHORT, coherent English diary (3-5 sentences, about 5 lines on mobile)
3. IMPORTANT: Keep it CONCISE - focus on main events and feelings only
4. Write in first person, natural English
5. Fix grammar naturally without changing the essence
6. Provide a Japanese translation (sentence-by-sentence, close to English structure)

CRITICAL EXPRESSION EXTRACTION RULES:
- Extract general-purpose English expressions that MUST appear literally in the diary text
- For EACH sentence in the diary:
  - If the sentence has 6+ words: extract AT LEAST one useful phrase from that sentence
  - Look for 2-4 word chunks that are reusable (verb phrases, noun phrases, common patterns)
  - Examples: "a busy shift", "go to sleep", "part-time job", "try some tea", "have to work"
- Total expressions: 3-10 per diary (not just 1-2!)
- NEVER invent expressions that are not exact substrings of the diary text
- Prioritize:
  - Verb phrases: "have to work", "go to bed", "try to relax"
  - Common patterns: "at my part-time job", "a busy day"
  - Noun phrases: "busy shift", "good night's sleep"

For each expression, classify:
- scene_or_context: a short label (1-2 words) for when this expression is typically used
  Examples: "daily life", "small talk", "school", "work", "feelings", "travel", "health", "hobbies", "food", "weather"
- pos_or_type: a simple grammatical/phrase type label
  Examples: "verb phrase", "adjective phrase", "noun phrase", "fixed phrase", "adverb phrase", "idiom"

Select 3-5 "important sentences" for focused practice:
- These should be the core sentences from the diary that contain key expressions
- For EACH important sentence, provide both the English AND its Japanese translation
- For EACH important sentence, list which expressions appear in that sentence

CRITICAL LENGTH REQUIREMENT:
- The diary MUST be 3-5 sentences only (about 5 lines on a phone screen)
- Do NOT write long paragraphs or include every detail
- Focus on the MAIN events and MAIN feelings
- Shorter is better for learning and review

Respond in this exact JSON format:
{
  "diary": "SHORT English diary (3-5 sentences, about 5 lines max)...",
  "japaneseSummary": "Japanese translation (sentence-by-sentence, close to English)...",
  "expressions": [
    {"expression": "phrase here", "meaning": "Japanese meaning", "example": "example sentence", "scene_or_context": "daily life", "pos_or_type": "verb phrase"},
    ...
  ],
  "importantSentences": [
    {"english": "One important sentence from the diary.", "japanese": "その文の日本語訳", "expressions": ["key phrase from this sentence"]},
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
